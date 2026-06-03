import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2, X } from "lucide-react";
import {
  annualTotal,
  applyDirectEdit,
  decToDec,
  defaultLimitFlagForSlotType,
  getMonthlyCR,
  hasCarryoverEvent,
  isVacantForTransferAtMonth,
  intraTransferVacancyHint,
  levelOptionsForSpecialization,
  LIMIT_FLAG_LABELS,
  LIMIT_FLAG_OPTIONS,
  POSITION_STATUS_LABELS,
  removeEvent,
  upsertEvent,
} from "../data/planningData";
import { specializationOptions } from "../data/salaryRangeData";
import { useMvpApp } from "../context/MvpAppContext";
import type { LimitFlagKey } from "../types";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord } from "../types";
import { eventEmployeeLine } from "../data/eventJournal";
import { eventTypeLabel, formatEventHuman } from "./drawer/formatEventHistory";
import {
  scenarioHelpText,
  SCENARIO_CARDS,
  type ScenarioType,
} from "./drawer/scenarioTypes";
import { OccupancyTimelineStrip } from "./OccupancyTimelineStrip";
import { collectOccupancyMismatches, mismatchesForPosition } from "../data/occupancyReconciliation";
import { formatOccupancyMonthLabel, planOccupancyAtMonth, planOccupancyTimeline } from "../data/occupancyTimeline";
import { hasFactData } from "../data/factStore";
import {
  isPlanEventMonthAllowed,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../data/planCorrectionWindow";

interface PositionDrawerProps {
  open: boolean;
  record: PositionRecord | null;
  onClose: () => void;
  onSaveDraft: (record: PositionRecord, sourcePositionId?: string, forceCreate?: boolean) => void;
  onAddEvent: (positionId: string, event: PlannedEvent) => void;
  onDeleteEvent: (positionId: string, eventId: string) => void;
  onDeletePosition: (positionId: string) => void;
  planPositions: PositionRecord[];
  employeeOptions: { employeeId: string; employeeName: string; positionId: string }[];
  suggestedNewEmployeeId: string;
  isPersisted: boolean;
  departmentOptions: string[];
  unitOptionsForDepartment: (department: string) => string[];
  teamOptionsForUnit: (department: string, unit: string) => string[];
  readOnly?: boolean;
  correctionWindow?: CorrectionWindowInfo;
}

type ScenarioFormState = {
  scenario: ScenarioType;
  month: number;
  base: number;
  bonus: number;
  specialization: string;
  level: string;
  transferToPositionId: string;
  replacementMode: "FROM_LIST" | "VACANCY";
  replacementEmployeeId: string;
  targetDepartment: string;
  targetUnit: string;
  targetTeam: string;
  comment: string;
};

const SCENARIO_LABEL = Object.fromEntries(SCENARIO_CARDS.map((c) => [c.id, c.title])) as Record<
  ScenarioType,
  string
>;

const SCENARIO_GROUPS: { label: string; scenarios: ScenarioType[] }[] = [
  {
    label: "Занятость слота",
    scenarios: ["TRANSFER_INTRA", "TRANSFER_INTER", "TERMINATION", "REDUCTION", "MATERNITY"],
  },
  {
    label: "ФОТ без смены занятости",
    scenarios: ["REVIEW"],
  },
];

function crTone(value: number): "warn" | "ok" | "danger" {
  if (value < 0.8) return "warn";
  if (value <= 1.2) return "ok";
  return "danger";
}

type DrawerTab = "slot" | "plan";

const DRAWER_TAB_LABEL: Record<DrawerTab, string> = {
  slot: "Слот и занятость",
  plan: "События и ФОТ",
};

export function PositionDrawer({
  open,
  record,
  onClose,
  onSaveDraft,
  onAddEvent,
  onDeleteEvent,
  onDeletePosition,
  planPositions,
  employeeOptions,
  suggestedNewEmployeeId,
  isPersisted,
  departmentOptions,
  unitOptionsForDepartment,
  teamOptionsForUnit,
  readOnly = false,
  correctionWindow,
}: PositionDrawerProps) {
  const { salaryBands, positions: planPositionsAll } = useMvpApp();
  const specOptions = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const selected = useMemo(() => record, [record]);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("slot");
  const [scenarioForm, setScenarioForm] = useState<ScenarioFormState>({
    scenario: "REVIEW",
    month: 0,
    base: 0,
    bonus: 0,
    specialization: specOptions[0] ?? "Engineering",
    level: levelOptionsForSpecialization(specOptions[0] ?? "Engineering", salaryBands)[0],
    transferToPositionId: "",
    replacementMode: "FROM_LIST",
    replacementEmployeeId: "",
    targetDepartment: "",
    targetUnit: "",
    targetTeam: "",
    comment: "",
  });
  useEffect(() => {
    if (!selected) return;
    const month = 0;
    const specialization = selected.monthlySpec[month] || specOptions[0];
    const levels = levelOptionsForSpecialization(specialization, salaryBands);
    const preferredDepartment =
      departmentOptions.find((department) => department !== selected.department) || departmentOptions[0] || selected.department;
    const units = unitOptionsForDepartment(preferredDepartment);
    const preferredUnit = units[0] || "";
    const teams = teamOptionsForUnit(preferredDepartment, preferredUnit);
    const preferredTeam = teams[0] || "";
    setScenarioForm({
      scenario: "REVIEW",
      month,
      base: selected.monthlyBase[month] || 0,
      bonus: selected.monthlyBonus[month] || 0,
      specialization,
      level: selected.monthlyLevel[month] || levels[0],
      transferToPositionId: "",
      replacementMode: "FROM_LIST",
      replacementEmployeeId: "",
      targetDepartment: preferredDepartment,
      targetUnit: preferredUnit,
      targetTeam: preferredTeam,
      comment: "",
    });
  }, [selected?.positionId, departmentOptions, unitOptionsForDepartment, teamOptionsForUnit, suggestedNewEmployeeId]);

  useEffect(() => {
    if (open) setDrawerTab("slot");
  }, [open, selected?.positionId]);

  const occupancyTimeline = useMemo(
    () => (selected ? planOccupancyTimeline(selected) : []),
    [selected],
  );
  const positionMismatches = useMemo(() => {
    if (!selected || !hasFactData()) return [];
    return mismatchesForPosition(collectOccupancyMismatches(planPositionsAll), selected.positionId);
  }, [selected, planPositionsAll]);

  if (!open || !selected) return null;
  const transferMonth = scenarioForm.month;
  const orgMatch = (a: string, b: string) => a.trim() === b.trim();
  const intraTransferOptions = planPositions.filter(
    (position) =>
      position.positionId !== selected.positionId &&
      orgMatch(position.department, selected.department) &&
      orgMatch(position.unit, selected.unit) &&
      isVacantForTransferAtMonth(position, transferMonth),
  );
  const interTransferOptions = planPositions.filter(
    (position) =>
      position.positionId !== selected.positionId &&
      orgMatch(position.department, scenarioForm.targetDepartment) &&
      (scenarioForm.targetUnit ? orgMatch(position.unit, scenarioForm.targetUnit) : true) &&
      isVacantForTransferAtMonth(position, transferMonth),
  );
  const transferOptions = scenarioForm.scenario === "TRANSFER_INTRA" ? intraTransferOptions : interTransferOptions;
  const intraTransferHint =
    scenarioForm.scenario === "TRANSFER_INTRA" && transferOptions.length === 0
      ? intraTransferVacancyHint(planPositions, selected, transferMonth)
      : null;
  const replacementEmployeeOptions = employeeOptions.filter((employee) => employee.employeeId !== selected.employeeId);

  const growth = decToDec(selected.previousDecemberBase, selected.monthlyBase[11]);
  const carryoverApplied = hasCarryoverEvent(selected);

  const persistVacancyToPlan = () => {
    onSaveDraft(selected, selected.positionId, true);
  };

  const applyCopyForward = (month: number) => {
    const next = {
      ...selected,
      monthlySpec: [...selected.monthlySpec],
      monthlyLevel: [...selected.monthlyLevel],
      monthlyBase: [...selected.monthlyBase],
      monthlyBonus: [...selected.monthlyBonus],
    };

    for (let index = month + 1; index < 12; index += 1) {
      next.monthlySpec[index] = next.monthlySpec[month];
      next.monthlyLevel[index] = next.monthlyLevel[month];
      next.monthlyBase[index] = next.monthlyBase[month];
      next.monthlyBonus[index] = next.monthlyBonus[month];
    }
    onSaveDraft(
      applyDirectEdit(next, (draft) => {
        draft.seedMonthlySpec = [...next.monthlySpec];
        draft.seedMonthlyLevel = [...next.monthlyLevel];
        draft.seedMonthlyBase = [...next.monthlyBase];
        draft.seedMonthlyBonus = [...next.monthlyBonus];
      }),
      selected.positionId,
    );
  };
  const createEvent = (type: PlannedEvent["type"], payload: PlannedEvent["payload"]): PlannedEvent => {
    const comment = scenarioForm.comment.trim();
    return {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: {
        ...payload,
        comment: comment || undefined,
      },
    };
  };
  const applyEventToRecord = (event: PlannedEvent) => {
    if (readOnly) return;
    if (isPersisted) {
      onAddEvent(selected.positionId, event);
      return;
    }
    onSaveDraft(upsertEvent(selected, event), selected.positionId, false);
  };
  const deleteEventFromRecord = (eventId: string) => {
    if (readOnly) return;
    if (isPersisted) {
      onDeleteEvent(selected.positionId, eventId);
      return;
    }
    onSaveDraft(removeEvent(selected, eventId), selected.positionId, false);
  };
  const applyScenario = () => {
    if (readOnly) return;
    const month = scenarioForm.month;
    if (correctionWindow && !isPlanEventMonthAllowed(month, correctionWindow)) {
      window.alert(planEventMonthBlockedMessage(correctionWindow));
      return;
    }
    const base = Number(scenarioForm.base);
    const bonus = Number(scenarioForm.bonus);
    const specialization = scenarioForm.specialization;
    const level = scenarioForm.level;
    if (selected.status !== "Occupied" && scenarioForm.scenario !== "REVIEW") {
      window.alert("Операция доступна только для занятых сотрудников.");
      return;
    }
    switch (scenarioForm.scenario) {
      case "REVIEW":
        applyEventToRecord(
          createEvent("MANUAL_OVERRIDE", {
            month,
            base,
            bonus,
            specialization,
            level,
          }),
        );
        break;
      case "TRANSFER_INTRA":
      case "TRANSFER_INTER": {
        if (!selected.employeeId || !selected.employeeName) {
          window.alert("Для перевода нужны employeeId и ФИО сотрудника.");
          return;
        }
        const target = transferOptions.find((item) => item.positionId === scenarioForm.transferToPositionId);
        if (scenarioForm.transferToPositionId && !target) {
          window.alert("Целевая вакансия не подходит для выбранного типа перевода.");
          return;
        }
        if (scenarioForm.scenario === "TRANSFER_INTER" && !scenarioForm.targetDepartment) {
          window.alert("Выберите целевой департамент.");
          return;
        }
        applyEventToRecord(
          createEvent("TRANSFER", {
            month,
            transferToPositionId: target?.positionId,
            transferKind: scenarioForm.scenario === "TRANSFER_INTRA" ? "INTRA_UNIT" : "INTER_DEPARTMENT",
            targetDepartment: scenarioForm.scenario === "TRANSFER_INTER" ? scenarioForm.targetDepartment : undefined,
            targetUnit: scenarioForm.scenario === "TRANSFER_INTER" ? scenarioForm.targetUnit : undefined,
            targetTeam: scenarioForm.scenario === "TRANSFER_INTER" ? scenarioForm.targetTeam : undefined,
            employeeId: selected.employeeId,
            employeeName: selected.employeeName,
            base,
            bonus,
            specialization,
            level,
          }),
        );
        break;
      }
      case "TERMINATION":
        applyEventToRecord(createEvent("TERMINATION_TO_VACANCY", { month }));
        break;
      case "REDUCTION":
        applyEventToRecord(createEvent("CLOSE_POSITION", { month }));
        break;
      case "MATERNITY": {
        if (base <= 0 && scenarioForm.replacementMode !== "VACANCY") {
          window.alert("Для замещения в декрете укажите оклад > 0.");
          return;
        }
        const payload: PlannedEvent["payload"] = {
          month,
          base: scenarioForm.replacementMode === "VACANCY" ? base : base,
          bonus: 0,
          specialization,
          level,
          maternityMode: "SHARED_POSITION",
          maternityPrimaryEmployeeId: selected.employeeId ?? undefined,
          maternityPrimaryEmployeeName: selected.employeeName ?? undefined,
        };
        if (scenarioForm.replacementMode === "VACANCY") {
          payload.maternityReplacementKind = "VACANCY";
          payload.employeeName = "Вакансия (замещение)";
        } else if (scenarioForm.replacementMode === "FROM_LIST") {
          if (!scenarioForm.replacementEmployeeId) {
            window.alert("Выберите сотрудника замещения из списка.");
            return;
          }
          const replacement = replacementEmployeeOptions.find(
            (employee) => employee.employeeId === scenarioForm.replacementEmployeeId,
          );
          if (!replacement) {
            window.alert("Сотрудник замещения не найден в списке.");
            return;
          }
          payload.maternityReplacementKind = "EMPLOYEE";
          payload.employeeId = replacement.employeeId;
          payload.employeeName = replacement.employeeName;
        }
        applyEventToRecord(createEvent("MANUAL_OVERRIDE", payload));
        window.alert(
          scenarioForm.replacementMode === "VACANCY"
            ? "Декрет: основной сотрудник + замещение вакансией."
            : "Декрет: основной + сотрудник замещения.",
        );
        break;
      }
      default:
        break;
    }
    setScenarioForm((prev) => ({
      ...prev,
      transferToPositionId: "",
      replacementEmployeeId: "",
      comment: "",
    }));
  };
  const selectedTransferTarget =
    transferOptions.find((item) => item.positionId === scenarioForm.transferToPositionId) || null;
  const monthLevels = levelOptionsForSpecialization(scenarioForm.specialization, salaryBands);
  const isReview = scenarioForm.scenario === "REVIEW";
  const isTransfer = scenarioForm.scenario === "TRANSFER_INTRA" || scenarioForm.scenario === "TRANSFER_INTER";
  const isInterTransfer = scenarioForm.scenario === "TRANSFER_INTER";
  const isMaternity = scenarioForm.scenario === "MATERNITY";
  const transferButtonDisabled = selected.status !== "Occupied";
  const classAnchor = selected.activeFromMonth;
  const slotSpec = selected.monthlySpec[classAnchor] ?? selected.seedMonthlySpec[classAnchor];
  const slotLevel = selected.monthlyLevel[classAnchor] ?? selected.seedMonthlyLevel[classAnchor];
  const slotLevels = levelOptionsForSpecialization(slotSpec, salaryBands);

  const updateSlotClassification = (specialization: string, level?: string) => {
    const levels = levelOptionsForSpecialization(specialization, salaryBands);
    const chosenLevel = level && levels.includes(level) ? level : levels[0];
    const next = applyDirectEdit(selected, (draft) => {
      for (let monthIndex = draft.activeFromMonth; monthIndex < 12; monthIndex += 1) {
        draft.seedMonthlySpec[monthIndex] = specialization;
        draft.seedMonthlyLevel[monthIndex] = chosenLevel;
      }
    });
    onSaveDraft(next, selected.positionId);
  };

  const headerTitle =
    selected.status === "Occupied" && selected.employeeName
      ? `${selected.employeeName} · слот ${selected.positionId}`
      : `Слот ${selected.positionId}`;
  const headerEmployeeId =
    selected.status === "Occupied" && selected.employeeId ? selected.employeeId : null;

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer drawer--workspace">
        <header className="drawer-header">
          <div className="drawer-header__main">
            <h2>{headerTitle}</h2>
            <p className="drawer-header__meta">
              <span>{selected.role}</span>
              {selected.status === "Occupied" && selected.employeeName ? (
                <>
                  <span>В·</span>
                  <span>
                    {selected.employeeName}
                    {headerEmployeeId ? ` (${headerEmployeeId})` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span>В·</span>
                  <span>{POSITION_STATUS_LABELS[selected.status]}</span>
                </>
              )}
              <span>В·</span>
              <span>
                {selected.department} / {selected.unit}
                {selected.team ? ` / ${selected.team}` : ""}
              </span>
            </p>
            <div className="drawer-header__chips">
              <span className={`limit-flag-badge limit-flag-badge--${selected.limitFlag}`}>
                {LIMIT_FLAG_LABELS[selected.limitFlag]}
              </span>
              <span className="drawer-header__stat">Дек→дек {growth.toFixed(1)}%</span>
              <span className="drawer-header__stat">ФОТ {annualTotal(selected).toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
          <div className="drawer-header-actions">
            {selected.status === "Vacancy" && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Удалить слот"
                title="Удалить слот"
                onClick={() => onDeletePosition(selected.positionId)}
              >
                <Trash2 size={18} />
              </button>
            )}
            {!isPersisted && selected.status === "Vacancy" && (
              <button type="button" className="primary-btn" onClick={persistVacancyToPlan}>
                Сохранить слот
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="drawer-tabs" aria-label="Р Р°Р·РґРµР»С‹ РєР°СЂС‚РѕС‡РєРё">
          {(Object.keys(DRAWER_TAB_LABEL) as DrawerTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`drawer-tabs__btn${drawerTab === tab ? " drawer-tabs__btn--active" : ""}`}
              onClick={() => setDrawerTab(tab)}
            >
              {DRAWER_TAB_LABEL[tab]}
              {tab === "plan" && selected.events.length > 0 ? (
                <span className="drawer-tabs__badge">{selected.events.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="drawer-body drawer-body--tabbed">
          {drawerTab === "slot" ? (
          <>
          <section className="drawer-position-block">
            <div className="drawer-position-block__group">
              <p className="drawer-position-block__label">Профиль слота</p>
              <div className="drawer-position-block__grid drawer-position-block__grid--slot">
                <label>
                  ID слота
                  <input
                    type="text"
                    value={selected.positionId}
                    disabled
                  />
                </label>
                <label>
                  Р РѕР»СЊ
                  <input
                    type="text"
                    value={selected.role}
                    disabled={readOnly}
                    onChange={(event) => {
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.role = event.target.value;
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  />
                </label>
                <label>
                  Специализация
                  <select
                    value={slotSpec}
                    disabled={readOnly}
                    onChange={(event) => updateSlotClassification(event.target.value)}
                  >
                    {specOptions.map((specialization) => (
                      <option key={specialization} value={specialization}>
                        {specialization}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Уровень
                  <select
                    value={slotLevel}
                    disabled={readOnly}
                    onChange={(event) => updateSlotClassification(slotSpec, event.target.value)}
                  >
                    {slotLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="drawer-position-block__group">
              <p className="drawer-position-block__label">Оргструктура</p>
              <div className="drawer-position-block__grid drawer-position-block__grid--org">
                <label>
                  Департамент
                  <select
                    value={selected.department}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextDepartment = event.target.value;
                      const units = unitOptionsForDepartment(nextDepartment);
                      const nextUnit = units[0] ?? "";
                      const teams = teamOptionsForUnit(nextDepartment, nextUnit);
                      const nextTeam = teams[0] ?? "";
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.department = nextDepartment;
                        draft.unit = nextUnit;
                        draft.team = nextTeam;
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Юнит
                  <select
                    value={selected.unit}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextUnit = event.target.value;
                      const teams = teamOptionsForUnit(selected.department, nextUnit);
                      const nextTeam = teams[0] ?? "";
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.unit = nextUnit;
                        draft.team = nextTeam;
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    {unitOptionsForDepartment(selected.department).map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Команда
                  <select
                    value={selected.team}
                    disabled={readOnly}
                    onChange={(event) => {
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.team = event.target.value;
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    {teamOptionsForUnit(selected.department, selected.unit).map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="drawer-position-block__group">
              <p className="drawer-position-block__label">Параметры слота</p>
              <div className="drawer-position-block__grid drawer-position-block__grid--params">
                <label>
                  Активен с
                  <select
                    value={selected.activeFromMonth}
                    disabled={readOnly}
                    onChange={(event) => {
                      const month = Number(event.target.value);
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.activeFromMonth = month;
                        if (draft.vacancySinceMonth !== null && draft.vacancySinceMonth < month) {
                          draft.vacancySinceMonth = month;
                          draft.seedVacancySinceMonth = month;
                        }
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index}>
                        {month.slice(0, 3)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Тип слота
                  <select
                    value={selected.slotType}
                    disabled={readOnly}
                    onChange={(event) => {
                      const slotType = event.target.value as PositionRecord["slotType"];
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.slotType = slotType;
                        if (slotType === "carryover") {
                          draft.limitFlag = "IN_LIMIT";
                        } else if (draft.limitFlag === "IN_LIMIT" && slotType === "new") {
                          draft.limitFlag = defaultLimitFlagForSlotType("new");
                        }
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    <option value="carryover">Перенос</option>
                    <option value="new">Новый</option>
                  </select>
                </label>
                <label>
                  Лимит
                  <select
                    value={selected.limitFlag}
                    disabled={readOnly || selected.slotType === "carryover"}
                    onChange={(event) => {
                      const limitFlag = event.target.value as LimitFlagKey;
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.limitFlag = limitFlag;
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  >
                    {LIMIT_FLAG_OPTIONS.filter((option) => option.value !== "UNLIMITED").map((option) => (
                      <option key={option.value} value={option.value}>
                        {LIMIT_FLAG_LABELS[option.value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {selected.status === "Vacancy" && selected.slotType === "carryover" && !carryoverApplied ? (
              <p className="drawer-position-block__hint">Перенос бюджета — в «Данные» или на планировании.</p>
            ) : null}
          </section>

          <section className="drawer-position-block drawer-position-block--occupancy-tab">
            <p className="drawer-position-block__label">Занятость по месяцам (план)</p>
            <p className="drawer-position-block__hint">
              На конец каждого месяца. События, меняющие занятость и ФОТ — на вкладке «События и ФОТ».
            </p>
            <div className="drawer-occupancy-current">
              <span className="position-state-badge position-state-badge--status">
                {POSITION_STATUS_LABELS[selected.status]}
              </span>
              {selected.status === "Occupied" && selected.employeeName ? (
                <span>
                  {selected.employeeName} ({selected.employeeId})
                </span>
              ) : (
                <span className="muted-line">
                  {selected.status === "Vacancy"
                    ? `Вакансия с ${MONTHS[selected.vacancySinceMonth ?? selected.activeFromMonth]}`
                    : "—"}
                </span>
              )}
            </div>
            <OccupancyTimelineStrip
              timeline={occupancyTimeline}
              activeFromMonth={selected.activeFromMonth}
              mismatches={positionMismatches}
            />
            {positionMismatches.length > 0 ? (
              <ul className="drawer-occupancy-mismatches">
                {positionMismatches.map((item) => (
                  <li key={`${item.kind}-${item.month}`}>{item.summary}</li>
                ))}
              </ul>
            ) : hasFactData() ? (
              <p className="muted-line drawer-position-block__hint">Расхождений с фактом по этому слоту нет.</p>
            ) : (
              <p className="muted-line drawer-position-block__hint">Загрузите факт в «Данные», чтобы сверять занятость.</p>
            )}
          </section>
          </>
          ) : null}

          {drawerTab === "plan" ? (
          <>
          <section className="drawer-events-panel">
          <div className="drawer-events-panel__history">
            <h3 className="drawer-events-panel__title">История изменений по слоту</h3>
            <ul className="drawer-history-list drawer-history-list--prominent">
              {selected.events.length === 0 && (
                <li className="drawer-history-list__empty">Событий пока нет — добавьте сценарий ниже</li>
              )}
              {[...selected.events]
                .sort((a, b) => b.createdOrder - a.createdOrder)
                .map((event) => {
                  const employeeLine = eventEmployeeLine(event, selected);
                  return (
                    <li key={event.id} className="drawer-history-item drawer-history-item--prominent">
                      <div className="drawer-history-item__head">
                        <strong>{eventTypeLabel(event.type)}</strong>
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label="Удалить"
                          disabled={readOnly}
                          onClick={() => deleteEventFromRecord(event.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {employeeLine ? (
                        <div className="drawer-history-item__employee">{employeeLine}</div>
                      ) : null}
                      <p className="drawer-history-item__details">{formatEventHuman(event)}</p>
                      {event.payload.comment ? (
                        <blockquote className="drawer-history-item__comment">{event.payload.comment}</blockquote>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>

          <div className="drawer-events-panel__composer">
            <h3 className="drawer-events-panel__title">Плановое изменение</h3>
            <p className="drawer-events-panel__hint">{scenarioHelpText(scenarioForm.scenario)}</p>
          <div className="drawer-events-block__form event-grid event-grid--drawer">
            <label>
              Тип изменения
              <select
                value={scenarioForm.scenario}
                onChange={(event) =>
                  setScenarioForm((prev) => ({
                    ...prev,
                    scenario: event.target.value as ScenarioType,
                    transferToPositionId: "",
                    targetDepartment:
                      prev.targetDepartment ||
                      departmentOptions.find((department) => department !== selected.department) ||
                      departmentOptions[0] ||
                      "",
                  }))
                }
              >
                {SCENARIO_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.scenarios.map((scenarioKey) => (
                      <option key={scenarioKey} value={scenarioKey}>
                        {SCENARIO_LABEL[scenarioKey]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              С какого месяца
              <select
                value={scenarioForm.month}
                onChange={(event) => {
                  const month = Number(event.target.value);
                  const specialization = selected.monthlySpec[month] || scenarioForm.specialization;
                  const levels = levelOptionsForSpecialization(specialization, salaryBands);
                  const level = levels.includes(selected.monthlyLevel[month]) ? selected.monthlyLevel[month] : levels[0];
                  setScenarioForm((prev) => ({
                    ...prev,
                    month,
                    specialization,
                    level,
                    base: selected.monthlyBase[month] || prev.base,
                    bonus: selected.monthlyBonus[month] || prev.bonus,
                  }));
                }}
              >
                {MONTHS.map((month, index) => {
                  const blocked =
                    correctionWindow != null && !isPlanEventMonthAllowed(index, correctionWindow);
                  return (
                    <option key={month} value={index} disabled={blocked}>
                      {month}
                      {blocked ? " (закрыт)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Оклад
              <input
                type="number"
                value={scenarioForm.base}
                onChange={(event) => setScenarioForm((prev) => ({ ...prev, base: Number(event.target.value) }))}
              />
            </label>
            {!isMaternity && (
              <label>
                Премия
                <input
                  type="number"
                  value={scenarioForm.bonus}
                  onChange={(event) => setScenarioForm((prev) => ({ ...prev, bonus: Number(event.target.value) }))}
                />
              </label>
            )}
            {(isReview || isTransfer || isMaternity) && (
              <>
                <label>
                  Специализация
                  <select
                    value={scenarioForm.specialization}
                    onChange={(event) => {
                      const specialization = event.target.value;
                      const levels = levelOptionsForSpecialization(specialization, salaryBands);
                      setScenarioForm((prev) => ({
                        ...prev,
                        specialization,
                        level: levels.includes(prev.level) ? prev.level : levels[0],
                      }));
                    }}
                  >
                    {specOptions.map((specialization) => (
                      <option key={specialization} value={specialization}>
                        {specialization}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Уровень
                  <select value={scenarioForm.level} onChange={(event) => setScenarioForm((prev) => ({ ...prev, level: event.target.value }))}>
                    {monthLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {isTransfer && (
              <label>
                Целевая вакансия
                <select
                  value={scenarioForm.transferToPositionId}
                  onChange={(event) => setScenarioForm((prev) => ({ ...prev, transferToPositionId: event.target.value }))}
                >
                  <option value="">
                    {isInterTransfer
                      ? transferOptions.length
                        ? "Нет подходящей? можно без вакансии"
                        : "Создать позицию в целевом департаменте"
                      : transferOptions.length
                        ? "Или без выбора — создать вакансию в юните"
                        : "Создать вакансию в том же юните"}
                  </option>
                  {transferOptions.map((option) => (
                    <option key={option.positionId} value={option.positionId}>
                      {option.positionId} В· {option.team || option.unit} В· {option.role}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {intraTransferHint ? (
              <p className="drawer-events-block__hint drawer-events-block__hint--warn">{intraTransferHint}</p>
            ) : null}
            {isInterTransfer && (
              <>
                <label>
                  Целевой департамент
                  <select
                    value={scenarioForm.targetDepartment}
                    onChange={(event) => {
                      const targetDepartment = event.target.value;
                      const units = unitOptionsForDepartment(targetDepartment);
                      const targetUnit = units[0] || "";
                      const teams = teamOptionsForUnit(targetDepartment, targetUnit);
                      const targetTeam = teams[0] || "";
                      setScenarioForm((prev) => ({
                        ...prev,
                        targetDepartment,
                        targetUnit,
                        targetTeam,
                        transferToPositionId: "",
                      }));
                    }}
                  >
                    {departmentOptions
                      .filter((department) => department !== selected.department)
                      .map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Целевой юнит
                  <select
                    value={scenarioForm.targetUnit}
                    onChange={(event) => {
                      const targetUnit = event.target.value;
                      const teams = teamOptionsForUnit(scenarioForm.targetDepartment, targetUnit);
                      const targetTeam = teams[0] || "";
                      setScenarioForm((prev) => ({
                        ...prev,
                        targetUnit,
                        targetTeam,
                        transferToPositionId: "",
                      }));
                    }}
                  >
                    {unitOptionsForDepartment(scenarioForm.targetDepartment).map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Целевая команда
                  <select
                    value={scenarioForm.targetTeam}
                    onChange={(event) => setScenarioForm((prev) => ({ ...prev, targetTeam: event.target.value }))}
                  >
                    {teamOptionsForUnit(scenarioForm.targetDepartment, scenarioForm.targetUnit).map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {isMaternity && (
              <>
                <label>
                  Замещение
                  <select
                    value={scenarioForm.replacementMode}
                    onChange={(event) =>
                      setScenarioForm((prev) => ({
                        ...prev,
                        replacementMode: event.target.value as ScenarioFormState["replacementMode"],
                        replacementEmployeeId: "",
                      }))
                    }
                  >
                    <option value="FROM_LIST">Существующий сотрудник</option>
                    <option value="VACANCY">Вакансия (без ФИО замещения)</option>                  </select>
                </label>
                {scenarioForm.replacementMode === "FROM_LIST" ? (
                  <label>
                    Сотрудник замещения
                    <select
                      value={scenarioForm.replacementEmployeeId}
                      onChange={(event) => setScenarioForm((prev) => ({ ...prev, replacementEmployeeId: event.target.value }))}
                    >
                      <option value="">
                        {replacementEmployeeOptions.length ? "Выберите сотрудника" : "Нет доступных сотрудников"}
                      </option>
                      {replacementEmployeeOptions.map((employee) => (
                        <option key={employee.employeeId} value={employee.employeeId}>
                          {employee.employeeName} ({employee.employeeId}) В· {employee.positionId}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="drawer-events-block__hint">
                    Замещение планируется как вакансия на слоте (бюджет можно задать окладом выше).
                  </p>
                )}
              </>
            )}
          </div>
          {selectedTransferTarget && (
            <p className="drawer-events-block__hint">
              в†’ {selectedTransferTarget.positionId} ({selectedTransferTarget.team || selectedTransferTarget.unit})
            </p>
          )}
          <label className="drawer-comment-field">
            <span className="drawer-comment-field__label">Комментарий для согласования</span>
            <textarea
              rows={4}
              value={scenarioForm.comment}
              disabled={readOnly}
              placeholder="Зачем меняем: перевод, увольнение, индексация…"
              onChange={(event) => setScenarioForm((prev) => ({ ...prev, comment: event.target.value }))}
            />
          </label>
          <div className="drawer-events-panel__footer">
            <button
              type="button"
              onClick={applyScenario}
              className="primary-btn"
              disabled={readOnly || (isTransfer && transferButtonDisabled)}
            >
              Применить изменение
            </button>
          </div>
          </div>
          </section>

          <section className="drawer-section monthly-table-wrap drawer-section--flush drawer-section--monthly-tab">
              <h3 className="drawer-section__title">ФОТ и занятость по месяцам</h3>
              <table className="monthly-table monthly-table--drawer monthly-table--dense">
            <thead>
              <tr>
                <th>Мес</th>
                <th>На слоте</th>
                <th>Spec</th>
                <th>Lvl</th>
                <th>BASE</th>
                <th>BON</th>
                <th>Σ</th>
                <th>CR</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, index) => {
                const monthSnap = planOccupancyAtMonth(selected, index);
                const isClosedMonth = monthSnap.status === "Closed";
                const occupancyLabel = formatOccupancyMonthLabel(monthSnap);
                const total = selected.monthlyBase[index] + selected.monthlyBonus[index];
                const cr = getMonthlyCR(selected.monthlyBase[index], selected.monthlySpec[index], selected.monthlyLevel[index], salaryBands);
                return (
                  <tr key={month} className={isClosedMonth ? "monthly-table__row--closed" : undefined}>
                    <td>{month.slice(0, 3)}</td>
                    <td className="monthly-table__occupancy">{occupancyLabel}</td>
                    <td>
                      <select value={selected.monthlySpec[index]} disabled={readOnly} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          const specialization = event.target.value;
                          const levelOptions = levelOptionsForSpecialization(specialization, salaryBands);
                          const currentLevel = draft.seedMonthlyLevel[index];
                          const nextLevel = levelOptions.includes(currentLevel) ? currentLevel : levelOptions[0];
                          for (let monthIndex = index; monthIndex < 12; monthIndex += 1) {
                            draft.seedMonthlySpec[monthIndex] = specialization;
                            draft.seedMonthlyLevel[monthIndex] = nextLevel;
                          }
                        });
                        onSaveDraft(next, selected.positionId);
                      }}>
                        {specOptions.map((specialization) => (
                          <option key={specialization} value={specialization}>{specialization.slice(0, 8)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={selected.monthlyLevel[index]} disabled={readOnly} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          for (let monthIndex = index; monthIndex < 12; monthIndex += 1) {
                            draft.seedMonthlyLevel[monthIndex] = event.target.value;
                          }
                        });
                        onSaveDraft(next, selected.positionId);
                      }}>
                        {levelOptionsForSpecialization(selected.monthlySpec[index], salaryBands).map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" disabled={readOnly} value={selected.monthlyBase[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBase[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td>
                      <input type="number" disabled={readOnly} value={selected.monthlyBonus[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBonus[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td className="monthly-table__total">{(total / 1000).toFixed(0)}k</td>
                    <td>
                      <span className={`cr-value cr-value--${crTone(cr)}`}>{cr.toFixed(2)}</span>
                    </td>
                    <td>
                      <button type="button" className="icon-btn" disabled={readOnly} title="Copy forward" onClick={() => applyCopyForward(index)}>
                        <Copy size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </section>
          </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
