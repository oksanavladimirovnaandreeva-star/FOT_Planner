import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";
import {
  annualTotal,
  applyDirectEdit,
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
import { formatMoney } from "../data/formatDisplay";
import { specializationOptions } from "../data/salaryRangeData";
import { useMvpApp } from "../context/MvpAppContext";
import type { LimitFlagKey } from "../types";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord } from "../types";
import { eventsForDrawerHistory } from "../data/eventJournal";
import { eventTypeLabel, formatEventDrawerTimestamp, formatEventHumanForDrawer } from "./drawer/formatEventHistory";
import {
  scenarioHelpText,
  SCENARIO_CARDS,
  type ScenarioType,
} from "./drawer/scenarioTypes";
import { formatPositionHireLabel } from "../data/positionDisplay";
import { formatDecGrowthPctLine, resolveDecGrowthDisplay } from "../data/decGrowthDisplay";
import {
  isPlanEventMonthAllowed,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../data/planCorrectionWindow";
import { defaultKaitenTypeForPosition, dismissKaitenNudge, isKaitenNudgeDismissed, kaitenNudgeForEventType, positionKaitenEligible, type KaitenRequestType } from "../data/kaitenExport";
import { canShowKaitenExport } from "../data/userAccess";
import { KaitenExportModal } from "./KaitenExportModal";

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
    label: "ФОТ и профиль компенсации",
    scenarios: ["REVIEW"],
  },
  {
    label: "Занятость позиции",
    scenarios: ["TRANSFER_INTRA", "TRANSFER_INTER", "TERMINATION", "REDUCTION", "MATERNITY"],
  },
];

function crTone(value: number): "warn" | "ok" | "danger" {
  if (value < 0.8) return "warn";
  if (value <= 1.2) return "ok";
  return "danger";
}

const SCENARIO_OPTION_HINT = Object.fromEntries(
  SCENARIO_CARDS.map((card) => [card.id, card.short]),
) as Record<ScenarioType, string>;

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
  suggestedNewEmployeeId: _suggestedNewEmployeeId,
  isPersisted,
  departmentOptions,
  unitOptionsForDepartment,
  teamOptionsForUnit,
  readOnly = false,
  correctionWindow,
}: PositionDrawerProps) {
  const { salaryBands, activePlan, planVersionId, userRole, leadEditFrozen } = useMvpApp();
  const specOptions = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const selected = useMemo(() => record, [record]);
  const composerRef = useRef<HTMLDivElement>(null);
  const [kaitenExportOpen, setKaitenExportOpen] = useState(false);
  const [kaitenInitialType, setKaitenInitialType] = useState<KaitenRequestType>("hire");
  const [kaitenModalEvent, setKaitenModalEvent] = useState<PlannedEvent | undefined>(undefined);
  const [kaitenNudge, setKaitenNudge] = useState<{ type: KaitenRequestType; event: PlannedEvent } | null>(null);
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
  }, [selected?.positionId, salaryBands, specOptions]);

  useEffect(() => {
    if (!open) setKaitenExportOpen(false);
  }, [open, selected?.positionId]);

  useEffect(() => {
    setKaitenNudge(null);
    setKaitenModalEvent(undefined);
  }, [open, selected?.positionId]);

  const planYear = activePlan.planYear;

  const drawerHistoryEvents = useMemo(
    () => eventsForDrawerHistory(selected?.events ?? []),
    [selected?.events],
  );

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

  const carryoverApplied = hasCarryoverEvent(selected);

  const persistVacancyToPlan = () => {
    onSaveDraft(selected, selected.positionId, true);
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
  const scrollToComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const maybeShowKaitenNudge = (event: PlannedEvent) => {
    if (!canShowKaitenExport(userRole, leadEditFrozen)) return;
    const nudgeType = kaitenNudgeForEventType(event.type);
    if (!nudgeType || isKaitenNudgeDismissed(event.id)) return;
    setKaitenNudge({ type: nudgeType, event });
    scrollToComposer();
  };
  const applyEventWithNudge = (event: PlannedEvent) => {
    applyEventToRecord(event);
    maybeShowKaitenNudge(event);
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
      case "TERMINATION": {
        const event = createEvent("TERMINATION_TO_VACANCY", { month });
        applyEventWithNudge(event);
        break;
      }
      case "REDUCTION": {
        const event = createEvent("CLOSE_POSITION", { month });
        applyEventWithNudge(event);
        break;
      }
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

  const headerTitle =
    selected.status === "Occupied" && selected.employeeName
      ? `${selected.employeeName} · ${selected.positionId}`
      : selected.role?.trim() || `Позиция ${selected.positionId}`;
  const decGrowth = resolveDecGrowthDisplay(selected, planYear);
  const canExportKaiten = canShowKaitenExport(userRole, leadEditFrozen) && positionKaitenEligible(selected);
  const openKaitenExport = () => {
    const initialType = defaultKaitenTypeForPosition(selected);
    if (!initialType) return;
    setKaitenModalEvent(undefined);
    setKaitenInitialType(initialType);
    setKaitenExportOpen(true);
  };
  const openKaitenFromNudge = () => {
    if (!kaitenNudge) return;
    setKaitenModalEvent(kaitenNudge.event);
    setKaitenInitialType(kaitenNudge.type);
    setKaitenExportOpen(true);
    setKaitenNudge(null);
  };
  const dismissKaitenNudgeLater = () => {
    if (!kaitenNudge) return;
    dismissKaitenNudge(kaitenNudge.event.id);
    setKaitenNudge(null);
  };

  return (
    <>
    <div className="drawer-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="drawer drawer--workspace-full" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header">
          <div className="drawer-header__main">
            <h2>{headerTitle}</h2>
            <div className="drawer-header__chips">
              <span className="drawer-header__stat">
                Дек {decGrowth.prevYear}→{decGrowth.planYear}: {formatDecGrowthPctLine(decGrowth)}
              </span>
              <span className="drawer-header__stat">ФОТ {annualTotal(selected).toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
          <div className="drawer-header-actions">
            {canExportKaiten ? (
              <button
                type="button"
                className="secondary-btn drawer-header-actions__kaiten"
                onClick={openKaitenExport}
                title="Подготовить заявку в Kaiten (найм или ОТиЗ)"
              >
                <ExternalLink size={14} aria-hidden />
                Kaiten
              </button>
            ) : null}
            {selected.status === "Vacancy" && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Удалить позицию"
                title="Удалить позицию"
                onClick={() => onDeletePosition(selected.positionId)}
              >
                <Trash2 size={18} />
              </button>
            )}
            {!isPersisted && selected.status === "Vacancy" && (
              <button type="button" className="primary-btn" onClick={persistVacancyToPlan}>
                Сохранить позицию
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="drawer-body drawer-body--wb">
          <div className="drawer-unified drawer-unified--stack">
            <section className="drawer-meta-bar drawer-card">
              <div className="drawer-meta-bar__context">
                <p className="drawer-meta-bar__role">{selected.role?.trim() || `Позиция ${selected.positionId}`}</p>
                <p className="drawer-meta-bar__org">
                  {selected.department} / {selected.unit}
                  {selected.team ? ` / ${selected.team}` : ""}
                </p>
                {selected.status === "Occupied" && selected.employeeName ? (
                  <p className="drawer-meta-bar__employee">
                    {selected.employeeName} · {formatPositionHireLabel(selected, planYear)}
                  </p>
                ) : null}
              </div>
              <div className="drawer-meta-bar__controls">
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Тип позиции</span>
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
                    <option value="new">Новая</option>
                  </select>
                </label>
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Лимит</span>
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
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">В плане с</span>
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
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Статус</span>
                  <select value={selected.status} disabled>
                    <option value="Occupied">{POSITION_STATUS_LABELS.Occupied}</option>
                    <option value="Vacancy">{POSITION_STATUS_LABELS.Vacancy}</option>
                    <option value="Closed">{POSITION_STATUS_LABELS.Closed}</option>
                  </select>
                </label>
              </div>
              {selected.status === "Vacancy" ? (
                <div className="drawer-meta-bar__vacancy">
                  <label className="drawer-meta-field drawer-meta-field--wide">
                    <span className="drawer-meta-field__label">Название / роль</span>
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
                  <label className="drawer-meta-field">
                    <span className="drawer-meta-field__label">Департамент</span>
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
                  <label className="drawer-meta-field">
                    <span className="drawer-meta-field__label">Юнит</span>
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
                  <label className="drawer-meta-field">
                    <span className="drawer-meta-field__label">Команда</span>
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
                  {selected.slotType === "carryover" && !carryoverApplied ? (
                    <p className="drawer-meta-bar__hint">Перенос бюджета — в «Настройки → Данные».</p>
                  ) : null}
                </div>
              ) : (
                <p className="drawer-meta-bar__hint muted-line">
                  Смена оргструктуры — сценарий «Перевод в другой департамент».
                </p>
              )}
              <div className="drawer-december-strip">
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Дек {decGrowth.prevYear}, ₽</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    disabled={readOnly}
                    value={selected.previousDecemberBase}
                    onChange={(event) => {
                      const next = applyDirectEdit(selected, (draft) => {
                        draft.previousDecemberBase = Math.max(0, Number(event.target.value) || 0);
                      });
                      onSaveDraft(next, selected.positionId);
                    }}
                  />
                </label>
                <div className="drawer-meta-field drawer-meta-field--readonly">
                  <span className="drawer-meta-field__label">Дек {decGrowth.planYear} (план)</span>
                  <span className="drawer-meta-field__value">{selected.monthlyBase[11].toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="drawer-meta-field drawer-meta-field--readonly">
                  <span className="drawer-meta-field__label">Δ дек→дек</span>
                  <span className="drawer-meta-field__value">{formatDecGrowthPctLine(decGrowth)}</span>
                </div>
              </div>
            </section>

            <section className="drawer-events-panel drawer-card drawer-card--plan" ref={composerRef}>
            <h3 className="drawer-section__title drawer-section__title--upper">Плановое изменение</h3>
          <div className="drawer-scenario-form">
            <div className="drawer-scenario-form__row">
            <label className="drawer-field drawer-field--wide" title={scenarioHelpText(scenarioForm.scenario)}>
              <span className="drawer-field__label">Тип изменения</span>
              <select
                value={scenarioForm.scenario}
                title={scenarioHelpText(scenarioForm.scenario)}
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
                      <option key={scenarioKey} value={scenarioKey} title={SCENARIO_OPTION_HINT[scenarioKey]}>
                        {SCENARIO_LABEL[scenarioKey]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              <span className="drawer-field__label">С месяца</span>
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
            <label className="drawer-field">
              <span className="drawer-field__label">Оклад, ₽</span>
              <input
                type="number"
                value={scenarioForm.base}
                onChange={(event) => setScenarioForm((prev) => ({ ...prev, base: Number(event.target.value) }))}
              />
            </label>
            {!isMaternity ? (
              <label className="drawer-field">
                <span className="drawer-field__label">Премия, ₽</span>
                <input
                  type="number"
                  value={scenarioForm.bonus}
                  onChange={(event) => setScenarioForm((prev) => ({ ...prev, bonus: Number(event.target.value) }))}
                />
              </label>
            ) : null}
            </div>
            {isReview ? (
              <div className="drawer-scenario-form__row">
                <label className="drawer-field" title="Специализация с выбранного месяца">
                  <span className="drawer-field__label">Специализация</span>
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
                <label className="drawer-field" title="Уровень / грейд с выбранного месяца">
                  <span className="drawer-field__label">Уровень</span>
                  <select
                    value={scenarioForm.level}
                    onChange={(event) => setScenarioForm((prev) => ({ ...prev, level: event.target.value }))}
                  >
                    {monthLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {(isTransfer || isMaternity) && !isReview ? (
              <div className="drawer-scenario-form__row">
                <label className="drawer-field">
                  <span className="drawer-field__label">Специализация</span>
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
                <label className="drawer-field">
                  <span className="drawer-field__label">Уровень</span>
                  <select
                    value={scenarioForm.level}
                    onChange={(event) => setScenarioForm((prev) => ({ ...prev, level: event.target.value }))}
                  >
                    {monthLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {isTransfer ? (
              <label className="drawer-field drawer-field--full">
                <span className="drawer-field__label">Целевая вакансия</span>
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
            ) : null}
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
                          {employee.employeeName} ({employee.employeeId}) · {employee.positionId}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="drawer-events-block__hint">
                    Замещение планируется как вакансия на позиции (бюджет можно задать окладом выше).
                  </p>
                )}
              </>
            )}
            <div className="drawer-scenario-form__submit-row">
            <label className="drawer-field drawer-field--grow">
              <span className="drawer-field__label">Комментарий / обоснование</span>
              <input
                type="text"
                value={scenarioForm.comment}
                disabled={readOnly}
                placeholder="Например: по результатам performance review…"
                onChange={(event) => setScenarioForm((prev) => ({ ...prev, comment: event.target.value }))}
              />
            </label>
            <button
              type="button"
              onClick={applyScenario}
              className="primary-btn drawer-scenario-form__submit"
              disabled={readOnly || (isTransfer && transferButtonDisabled)}
            >
              Применить
            </button>
            </div>
          </div>
          {selectedTransferTarget && (
            <p className="drawer-events-block__hint">
              → {selectedTransferTarget.positionId} ({selectedTransferTarget.team || selectedTransferTarget.unit})
            </p>
          )}
          {kaitenNudge ? (
            <div className="drawer-kaiten-nudge" role="status">
              <p className="drawer-kaiten-nudge__text">Событие сохранено. Создать заявку в Kaiten?</p>
              <div className="drawer-kaiten-nudge__actions">
                <button type="button" className="primary-btn" onClick={openKaitenFromNudge}>
                  Создать заявку
                </button>
                <button type="button" className="secondary-btn" onClick={dismissKaitenNudgeLater}>
                  Позже
                </button>
              </div>
            </div>
          ) : null}
            </section>

            <section className="drawer-history-section drawer-card">
              <h3 className="drawer-section__title drawer-section__title--upper">История изменений</h3>
              <ul className="drawer-history-timeline">
                {drawerHistoryEvents.length === 0 && (
                  <li className="drawer-history-timeline__empty">Событий пока нет</li>
                )}
                {[...drawerHistoryEvents]
                  .sort((a, b) => b.createdOrder - a.createdOrder)
                  .map((event) => (
                    <li key={event.id} className="drawer-history-timeline__item">
                      <span className="drawer-history-timeline__dot" aria-hidden />
                      <div className="drawer-history-timeline__body">
                        <div className="drawer-history-timeline__head">
                          <p className="drawer-history-timeline__text">
                            <strong>{eventTypeLabel(event.type)}</strong> · {formatEventHumanForDrawer(event)}
                          </p>
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
                        {event.payload.comment ? (
                          <p className="drawer-history-timeline__comment">{event.payload.comment}</p>
                        ) : null}
                        <p className="drawer-history-timeline__meta">{formatEventDrawerTimestamp(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>

          <section className="drawer-monthly-row monthly-table-wrap drawer-section--monthly-tab drawer-card">
            <h3 className="drawer-section__title">ФОТ по месяцам</h3>
            <p className="drawer-section__hint muted-line">
              Расчёт по событиям. Оклад, специализацию и уровень — через «Плановое изменение» → Пересмотр.
            </p>
            <table className="monthly-table monthly-table--drawer monthly-table--readonly">
              <thead>
                <tr>
                  <th>Мес.</th>
                  <th>Спец.</th>
                  <th>Ур.</th>
                  <th>Оклад</th>
                  <th>Прем.</th>
                  <th>Итого</th>
                  <th>CR</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((month, index) => {
                  const closeEvent = selected.events.find((event) => event.type === "CLOSE_POSITION");
                  const closedFrom = closeEvent?.payload.month;
                  const isClosedMonth = closedFrom != null && index >= closedFrom;
                  const total = selected.monthlyBase[index] + selected.monthlyBonus[index];
                  const cr = getMonthlyCR(
                    selected.monthlyBase[index],
                    selected.monthlySpec[index],
                    selected.monthlyLevel[index],
                    salaryBands,
                  );
                  return (
                    <tr key={month} className={isClosedMonth ? "monthly-table__row--closed" : undefined}>
                      <td>{month.slice(0, 3)}</td>
                      <td className="monthly-table__readonly">{selected.monthlySpec[index]}</td>
                      <td className="monthly-table__readonly">{selected.monthlyLevel[index]}</td>
                      <td className="monthly-table__readonly">{selected.monthlyBase[index].toLocaleString("ru-RU")} ₽</td>
                      <td className="monthly-table__readonly">{selected.monthlyBonus[index].toLocaleString("ru-RU")} ₽</td>
                      <td className="monthly-table__total">{formatMoney(total, true)}</td>
                      <td>
                        <span className={`cr-value cr-value--${crTone(cr)}`}>{cr.toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          </div>
        </div>
      </div>
    </div>
    {kaitenExportOpen ? (
      <KaitenExportModal
        open={kaitenExportOpen}
        onClose={() => setKaitenExportOpen(false)}
        position={selected}
        planVersionId={planVersionId}
        planYear={planYear}
        userRole={userRole}
        initialType={kaitenInitialType}
        event={kaitenModalEvent}
      />
    ) : null}
    </>
  );
}
