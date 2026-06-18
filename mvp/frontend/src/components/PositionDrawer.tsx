import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, ArrowRight, Briefcase, Calendar, History, Table2, Trash2, User, X } from "lucide-react";
import {
  annualTotal,
  applyDirectEdit,
  applyEvents,
  decToDec,
  defaultLimitFlagForSlotType,
  formatGrowthDelta,
  formatGrowthPct,
  getMonthlyCR,
  growthTone,
  intraTransferVacancyHint,
  levelOptionsForSpecialization,
  LIMIT_FLAG_LABELS,
  LIMIT_FLAG_OPTIONS,
  POSITION_STATUS_LABELS,
  removeEvent,
  upsertEvent,
  hasCarryoverEvent,
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
import {
  employeeDisplayLine,
  employeeInitials,
  formatEmployeeDrawerMeta,
  formatPositionHireLabel,
} from "../data/positionDisplay";
import {
  formatMaternityReplacementLabel,
  formatTransferVacancyLabel,
  listMaternityReplacementCandidates,
  pickTransferVacancyTargets,
  transferVacancyEmptyHint,
} from "../data/transferScenario";
import {
  isPlanEventMonthAllowed,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../data/planCorrectionWindow";
import { defaultKaitenTypeForPosition, dismissKaitenNudge, isKaitenNudgeDismissed, kaitenNudgeForEventType, positionKaitenEligible, type KaitenRequestType } from "../data/kaitenExport";
import { canShowKaitenExport } from "../data/userAccess";
import { KaitenExportModal } from "./KaitenExportModal";
import { MetricHelp } from "./MetricHelp";

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
    scenarios: ["REVIEW", "GRADE_CHANGE"],
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

function scenarioHintForPosition(_record: PositionRecord, scenario: ScenarioType): string {
  return scenarioHelpText(scenario);
}

function scenarioGroupsForPosition(record: PositionRecord): typeof SCENARIO_GROUPS {
  if (applyEvents(record).status === "Vacancy") {
    return [{ label: "ФОТ и профиль компенсации", scenarios: ["REVIEW", "GRADE_CHANGE"] as ScenarioType[] }];
  }
  return SCENARIO_GROUPS;
}

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
  const view = useMemo(() => (record ? applyEvents(record) : null), [record]);
  const scenarioGroups = useMemo(
    () => (record ? scenarioGroupsForPosition(record) : SCENARIO_GROUPS),
    [record],
  );
  const composerRef = useRef<HTMLDivElement>(null);
  const requestClose = useCallback(
    (event?: { preventDefault(): void; stopPropagation(): void }) => {
      event?.preventDefault();
      event?.stopPropagation();
      onClose();
    },
    [onClose],
  );
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
    if (!view) return;
    const month = 0;
    const specialization = view.monthlySpec[month] || specOptions[0];
    const levels = levelOptionsForSpecialization(specialization, salaryBands);
    const preferredDepartment =
      departmentOptions.find((department) => department !== view.department) || departmentOptions[0] || view.department;
    const units = unitOptionsForDepartment(preferredDepartment);
    const preferredUnit = units[0] || "";
    const teams = teamOptionsForUnit(preferredDepartment, preferredUnit);
    const preferredTeam = teams[0] || "";
    setScenarioForm({
      scenario: "REVIEW",
      month,
      base: view.monthlyBase[month] || 0,
      bonus: view.monthlyBonus[month] || 0,
      specialization,
      level: view.monthlyLevel[month] || levels[0],
      transferToPositionId: "",
      replacementMode: "FROM_LIST",
      replacementEmployeeId: "",
      targetDepartment: preferredDepartment,
      targetUnit: preferredUnit,
      targetTeam: preferredTeam,
      comment: "",
    });
  }, [view?.positionId, salaryBands, specOptions]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  useEffect(() => {
    document.body.classList.toggle("position-drawer-open", open);
    return () => document.body.classList.remove("position-drawer-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setKaitenExportOpen(false);
  }, [open, view?.positionId]);

  useEffect(() => {
    setKaitenNudge(null);
    setKaitenModalEvent(undefined);
  }, [open, view?.positionId]);

  const planYear = activePlan.planYear;

  const drawerHistoryEvents = useMemo(
    () => eventsForDrawerHistory(record?.events ?? []),
    [record?.events],
  );

  if (!open || !view || !record) return null;
  const transferMonth = scenarioForm.month;
  const intraTransferPick = pickTransferVacancyTargets(planPositions, view.positionId, transferMonth, {
    department: view.department,
    unit: view.unit,
  });
  const interTransferPick = pickTransferVacancyTargets(planPositions, view.positionId, transferMonth, {
    department: scenarioForm.targetDepartment,
    unit: scenarioForm.targetUnit || undefined,
    team: scenarioForm.targetTeam || undefined,
  });
  const transferPick = scenarioForm.scenario === "TRANSFER_INTRA" ? intraTransferPick : interTransferPick;
  const transferOptions = transferPick.options;
  const intraTransferHint =
    scenarioForm.scenario === "TRANSFER_INTRA" && transferOptions.length === 0
      ? intraTransferVacancyHint(planPositions, view, transferMonth)
      : null;
  const maternityReplacementOptions = listMaternityReplacementCandidates(planPositions, employeeOptions, {
    employeeId: view.employeeId ?? undefined,
    department: view.department,
  });
  const scenarioHint = scenarioHintForPosition(view, scenarioForm.scenario);

  const renderTransferVacancyPicker = (emptyLabel: string) => (
    <div className="drawer-transfer-vacancy">
      <div className="drawer-transfer-vacancy__head">
        <span className="drawer-field__label">Свободная позиция</span>
        {transferOptions.length > 0 ? (
          <span className="drawer-transfer-vacancy__count">
            {transferOptions.length} свободн{transferOptions.length === 1 ? "ая" : "ых"} в срезе
          </span>
        ) : null}
      </div>
      {transferPick.relaxedFromTeam ? (
        <p className="drawer-field__hint">
          В выбранной команде пусто — показаны все свободные позиции юнита.
        </p>
      ) : null}
      {transferOptions.length === 0 ? (
        <p className="drawer-field__hint">
          {intraTransferHint ??
            transferVacancyEmptyHint(
              scenarioForm.scenario === "TRANSFER_INTER"
                ? {
                    department: scenarioForm.targetDepartment,
                    unit: scenarioForm.targetUnit,
                    team: scenarioForm.targetTeam,
                  }
                : { department: view.department, unit: view.unit },
              true,
            )}
        </p>
      ) : (
        <div className="drawer-transfer-pick" role="listbox" aria-label="Свободные позиции">
          <button
            type="button"
            role="option"
            aria-selected={!scenarioForm.transferToPositionId}
            className={`drawer-transfer-pick__item drawer-transfer-pick__item--create${
              !scenarioForm.transferToPositionId ? " drawer-transfer-pick__item--active" : ""
            }`}
            onClick={() => setScenarioForm((prev) => ({ ...prev, transferToPositionId: "" }))}
          >
            <strong>{emptyLabel}</strong>
            <span className="muted-line">Без привязки к существующей вакансии</span>
          </button>
          {transferOptions.map((option) => {
            const viewId = scenarioForm.transferToPositionId === option.positionId;
            return (
              <button
                key={option.positionId}
                type="button"
                role="option"
                aria-selected={viewId}
                className={`drawer-transfer-pick__item${viewId ? " drawer-transfer-pick__item--active" : ""}`}
                onClick={() =>
                  setScenarioForm((prev) => ({ ...prev, transferToPositionId: option.positionId }))
                }
              >
                <strong>{option.positionId}</strong>
                <span>{option.team || option.unit}</span>
                <span className="muted-line">{formatTransferVacancyLabel(option)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  const persistVacancyToPlan = () => {
    if (!record) return;
    const applied = applyEvents(record);
    const month = applied.activeFromMonth;
    const spec = applied.monthlySpec[month] ?? "";
    const level = applied.monthlyLevel[month] ?? "";
    const base = applied.monthlyBase[month] ?? 0;
    if (!spec || !level) {
      window.alert("Укажите специализацию и уровень в блоке «Профиль компенсации».");
      return;
    }
    if (base <= 0) {
      window.alert("Укажите оклад больше 0 в блоке «Профиль компенсации».");
      return;
    }
    let draft = record;
    if (record.slotType === "carryover" && !hasCarryoverEvent(record)) {
      draft = upsertEvent(record, {
        id: crypto.randomUUID(),
        type: "POSITION_CARRYOVER",
        createdAt: new Date().toISOString(),
        createdOrder: record.events.length + 1,
        payload: { month: record.activeFromMonth },
      });
    }
    onSaveDraft(draft, record.positionId, true);
  };

  const createEvent = (type: PlannedEvent["type"], payload: PlannedEvent["payload"]): PlannedEvent => {
    const comment = scenarioForm.comment.trim();
    return {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      createdOrder: (record?.events.length ?? 0) + 1,
      payload: {
        ...payload,
        comment: comment || undefined,
      },
    };
  };
  const applyEventToRecord = (event: PlannedEvent) => {
    if (readOnly || !record) return;
    if (isPersisted) {
      onAddEvent(record.positionId, event);
      return;
    }
    onSaveDraft(upsertEvent(record, event), record.positionId, false);
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
    if (readOnly || !record) return;
    if (isPersisted) {
      onDeleteEvent(record.positionId, eventId);
      return;
    }
    onSaveDraft(removeEvent(record, eventId), record.positionId, false);
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
    if (view.status !== "Occupied" && scenarioForm.scenario !== "REVIEW") {
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
      case "GRADE_CHANGE": {
        const currentSpec = view.monthlySpec[month] ?? "";
        const currentLevel = view.monthlyLevel[month] ?? "";
        if (specialization === currentSpec && level === currentLevel) {
          window.alert("Укажите новую специализацию или уровень.");
          return;
        }
        applyEventToRecord(
          createEvent("CLASSIFICATION_CHANGE", {
            month,
            specialization,
            level,
          }),
        );
        break;
      }
      case "TRANSFER_INTRA":
      case "TRANSFER_INTER": {
        if (!view.employeeId || !view.employeeName) {
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
            employeeId: view.employeeId,
            employeeName: view.employeeName,
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
          maternityPrimaryEmployeeId: view.employeeId ?? undefined,
          maternityPrimaryEmployeeName: view.employeeName ?? undefined,
        };
        if (scenarioForm.replacementMode === "VACANCY") {
          payload.maternityReplacementKind = "VACANCY";
          payload.employeeName = "Вакансия (замещение)";
        } else if (scenarioForm.replacementMode === "FROM_LIST") {
          if (!scenarioForm.replacementEmployeeId) {
            window.alert("Выберите сотрудника замещения из списка.");
            return;
          }
          const replacement = maternityReplacementOptions.find(
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
  const viewTransferTarget =
    transferOptions.find((item) => item.positionId === scenarioForm.transferToPositionId) || null;
  const monthLevels = levelOptionsForSpecialization(scenarioForm.specialization, salaryBands);
  const isReview = scenarioForm.scenario === "REVIEW";
  const isGradeChange = scenarioForm.scenario === "GRADE_CHANGE";
  const isCompensationForm = isReview || isGradeChange;
  const isTransfer = scenarioForm.scenario === "TRANSFER_INTRA" || scenarioForm.scenario === "TRANSFER_INTER";
  const isInterTransfer = scenarioForm.scenario === "TRANSFER_INTER";
  const isMaternity = scenarioForm.scenario === "MATERNITY";
  const transferButtonDisabled = view.status !== "Occupied";

  const renderDrawerMonthRows = (fromMonth: number, toMonth: number) =>
    Array.from({ length: toMonth - fromMonth }, (_, offset) => {
      const index = fromMonth + offset;
      const month = MONTHS[index]!;
      const closeEvent = view.events.find((event) => event.type === "CLOSE_POSITION");
      const closedFrom = closeEvent?.payload.month;
      const isClosedMonth = closedFrom != null && index >= closedFrom;
      const total = view.monthlyBase[index] + view.monthlyBonus[index];
      const cr = getMonthlyCR(
        view.monthlyBase[index],
        view.monthlySpec[index],
        view.monthlyLevel[index],
        salaryBands,
      );
      return (
        <tr key={month} className={isClosedMonth ? "monthly-table__row--closed" : undefined}>
          <td>{month}</td>
          <td className="monthly-table__readonly">{view.monthlySpec[index]}</td>
          <td className="monthly-table__readonly">{view.monthlyLevel[index]}</td>
          <td className="monthly-table__readonly">{view.monthlyBase[index].toLocaleString("ru-RU")} ₽</td>
          <td className="monthly-table__readonly">{view.monthlyBonus[index].toLocaleString("ru-RU")} ₽</td>
          <td className="monthly-table__total">{formatMoney(total)}</td>
          <td>
            <span className={`cr-value cr-value--${crTone(cr)}`}>{cr.toFixed(2)}</span>
          </td>
        </tr>
      );
    });

  const headerTitle =
    view.status === "Occupied" && view.employeeName
      ? employeeDisplayLine(view)
      : view.role?.trim() || `Позиция ${view.positionId}`;
  const annualFotTotal = annualTotal(view);
  const decPrevBase = view.previousDecemberBase;
  const decPlanBase = view.monthlyBase[11] ?? 0;
  const decDelta = decPlanBase - decPrevBase;
  const decPct = decToDec(decPrevBase, decPlanBase);
  const identitySpec = view.monthlySpec[view.activeFromMonth] ?? view.monthlySpec[0] ?? "";
  const identityLevel = view.monthlyLevel[view.activeFromMonth] ?? view.monthlyLevel[0] ?? "";
  const canExportKaiten = canShowKaitenExport(userRole, leadEditFrozen) && positionKaitenEligible(view);
  const openKaitenExport = () => {
    const initialType = defaultKaitenTypeForPosition(view);
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

  const isVacancyDraft = view.status === "Vacancy" && !isPersisted;
  const showPlanEvents = view.status !== "Vacancy" || isPersisted;
  const vacancyProfileMonth = view.activeFromMonth;
  const vacancyProfileSpec = view.monthlySpec[vacancyProfileMonth] ?? specOptions[0] ?? "";
  const vacancyProfileLevel = view.monthlyLevel[vacancyProfileMonth] ?? "";
  const vacancyProfileBase = view.monthlyBase[vacancyProfileMonth] ?? 0;
  const vacancyProfileBonus = view.monthlyBonus[vacancyProfileMonth] ?? 0;
  const vacancyProfileLevels = levelOptionsForSpecialization(vacancyProfileSpec, salaryBands);
  const updateVacancyProfile = (patch: Partial<{ spec: string; level: string; base: number; bonus: number }>) => {
    if (readOnly) return;
    const month = record.activeFromMonth;
    const spec = patch.spec ?? vacancyProfileSpec;
    const levels = levelOptionsForSpecialization(spec, salaryBands);
    const level =
      patch.level ?? (levels.includes(vacancyProfileLevel) ? vacancyProfileLevel : (levels[0] ?? vacancyProfileLevel));
    const base = patch.base ?? vacancyProfileBase;
    const bonus = patch.bonus ?? vacancyProfileBonus;
    const next = applyDirectEdit(record, (draft) => {
      for (let index = month; index < 12; index += 1) {
        draft.seedMonthlySpec[index] = spec;
        draft.seedMonthlyLevel[index] = level;
        draft.seedMonthlyBase[index] = base;
        draft.seedMonthlyBonus[index] = bonus;
      }
    });
    onSaveDraft(next, record.positionId);
  };

  return createPortal(
    <>
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="drawer-overlay__scrim"
        aria-label="Закрыть"
        onClick={requestClose}
      />
      <div className="drawer drawer--workspace-full">
        <header className="drawer-header">
          <div className="drawer-header__main">
            <h2>{headerTitle}</h2>
          </div>
          <div className="drawer-header-actions">
            {canExportKaiten ? (
              <button
                type="button"
                className="secondary-btn drawer-header-actions__kaiten"
                onClick={openKaitenExport}
                data-hint="Заявка в Kaiten: найм для вакансий, ОТиЗ для сокращения и увольнения"
              >
                <ExternalLink size={14} aria-hidden />
                Kaiten
              </button>
            ) : null}
            {view.status === "Vacancy" && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Удалить позицию"
                data-hint="Удалить позицию"
                onClick={() => onDeletePosition(view.positionId)}
              >
                <Trash2 size={18} />
              </button>
            )}
            {!isPersisted && view.status === "Vacancy" && (
              <button type="button" className="primary-btn" onClick={persistVacancyToPlan}>
                Сохранить позицию
              </button>
            )}
            <button
              type="button"
              className="icon-btn drawer-header-actions__close"
              onClick={requestClose}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="drawer-body drawer-body--wb">
          <div className="drawer-unified--stack">
            <section className="drawer-identity drawer-card">
              <div className="drawer-identity__split">
                <div className="drawer-identity__pane drawer-identity__pane--position">
                  <div className="drawer-identity__label">
                    <span className="drawer-identity__icon drawer-identity__icon--position" aria-hidden>
                      <Briefcase size={14} />
                    </span>
                    Позиция
                  </div>
                  {view.status === "Vacancy" ? (
                    <input
                      className="drawer-identity__title-input"
                      type="text"
                      value={view.role}
                      disabled={readOnly}
                      placeholder="Название позиции"
                      onChange={(event) => {
                        const next = applyDirectEdit(record, (draft) => {
                          draft.role = event.target.value;
                        });
                        onSaveDraft(next, record.positionId);
                      }}
                    />
                  ) : (
                    <h3 className="drawer-identity__title">
                      {view.role?.trim() || `Позиция ${view.positionId}`}
                    </h3>
                  )}
                  <div className="drawer-identity__org-line">
                    {view.status === "Vacancy" ? (
                      <>
                        <select
                          className="drawer-identity__org-select"
                          value={view.department}
                          disabled={readOnly}
                          onChange={(event) => {
                            const nextDepartment = event.target.value;
                            const units = unitOptionsForDepartment(nextDepartment);
                            const nextUnit = units[0] ?? "";
                            const teams = teamOptionsForUnit(nextDepartment, nextUnit);
                            const nextTeam = teams[0] ?? "";
                            const next = applyDirectEdit(record, (draft) => {
                              draft.department = nextDepartment;
                              draft.unit = nextUnit;
                              draft.team = nextTeam;
                            });
                            onSaveDraft(next, record.positionId);
                          }}
                        >
                          {departmentOptions.map((department) => (
                            <option key={department} value={department}>
                              {department}
                            </option>
                          ))}
                        </select>
                        <span className="drawer-identity__sep">/</span>
                        <select
                          className="drawer-identity__org-select"
                          value={view.unit}
                          disabled={readOnly}
                          onChange={(event) => {
                            const nextUnit = event.target.value;
                            const teams = teamOptionsForUnit(view.department, nextUnit);
                            const nextTeam = teams[0] ?? "";
                            const next = applyDirectEdit(record, (draft) => {
                              draft.unit = nextUnit;
                              draft.team = nextTeam;
                            });
                            onSaveDraft(next, record.positionId);
                          }}
                        >
                          {unitOptionsForDepartment(view.department).map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                        {view.team ? (
                          <>
                            <span className="drawer-identity__sep">/</span>
                            <select
                              className="drawer-identity__org-select"
                              value={view.team}
                              disabled={readOnly}
                              onChange={(event) => {
                                const next = applyDirectEdit(record, (draft) => {
                                  draft.team = event.target.value;
                                });
                                onSaveDraft(next, record.positionId);
                              }}
                            >
                              {teamOptionsForUnit(view.department, view.unit).map((team) => (
                                <option key={team} value={team}>
                                  {team}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span>{view.department}</span>
                        <span className="drawer-identity__sep">/</span>
                        <span>{identitySpec || view.unit}</span>
                        {identityLevel ? (
                          <>
                            <span className="drawer-identity__sep">·</span>
                            <span className="drawer-identity__muted">{identityLevel}</span>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                  <p className="drawer-identity__id">{view.positionId}</p>
                </div>

                <div className="drawer-identity__bridge" aria-hidden>
                  <ArrowRight size={18} />
                </div>

                <div className="drawer-identity__pane drawer-identity__pane--employee">
                  <div className="drawer-identity__label">
                    <span className="drawer-identity__icon drawer-identity__icon--employee" aria-hidden>
                      <User size={14} />
                    </span>
                    Сотрудник
                  </div>
                  {view.status === "Occupied" && view.employeeName ? (
                    <div className="drawer-identity__employee">
                      <span className="drawer-identity__avatar" aria-hidden>
                        {employeeInitials(view.employeeName)}
                        <span className="drawer-identity__avatar-dot" />
                      </span>
                      <div className="drawer-identity__employee-text">
                        <p className="drawer-identity__employee-name">{employeeDisplayLine(view)}</p>
                        <p className="drawer-identity__employee-meta">{formatEmployeeDrawerMeta(view, planYear)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="drawer-identity__employee drawer-identity__employee--empty">
                      <span className="drawer-identity__avatar drawer-identity__avatar--muted" aria-hidden>
                        —
                      </span>
                      <div className="drawer-identity__employee-text">
                        <p className="drawer-identity__employee-name">{POSITION_STATUS_LABELS[view.status]}</p>
                        <p className="drawer-identity__employee-meta">{formatPositionHireLabel(view, planYear)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="drawer-status-bar drawer-card">
              <div className="drawer-status-bar__controls">
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Тип позиции</span>
                  <select
                    value={view.slotType}
                    disabled={readOnly}
                    onChange={(event) => {
                      const slotType = event.target.value as PositionRecord["slotType"];
                      const next = applyDirectEdit(record, (draft) => {
                        draft.slotType = slotType;
                        if (slotType === "carryover") {
                          draft.limitFlag = "IN_LIMIT";
                        } else if (draft.limitFlag === "IN_LIMIT" && slotType === "new") {
                          draft.limitFlag = defaultLimitFlagForSlotType("new");
                        }
                      });
                      onSaveDraft(next, record.positionId);
                    }}
                  >
                    <option value="carryover">Перенос</option>
                    <option value="new">Новая</option>
                  </select>
                </label>
                <label className="drawer-meta-field">
                  <span className="drawer-meta-field__label">Лимит</span>
                  <select
                    className={`drawer-meta-field__limit drawer-meta-field__limit--${view.limitFlag}`}
                    value={view.limitFlag}
                    disabled={readOnly || view.slotType === "carryover"}
                    onChange={(event) => {
                      const limitFlag = event.target.value as LimitFlagKey;
                      const next = applyDirectEdit(record, (draft) => {
                        draft.limitFlag = limitFlag;
                      });
                      onSaveDraft(next, record.positionId);
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
                    value={view.activeFromMonth}
                    disabled={readOnly}
                    onChange={(event) => {
                      const month = Number(event.target.value);
                      const next = applyDirectEdit(record, (draft) => {
                        draft.activeFromMonth = month;
                        if (draft.vacancySinceMonth !== null && draft.vacancySinceMonth < month) {
                          draft.vacancySinceMonth = month;
                          draft.seedVacancySinceMonth = month;
                        }
                      });
                      onSaveDraft(next, record.positionId);
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
                  <select value={view.status} disabled>
                    <option value="Occupied">{POSITION_STATUS_LABELS.Occupied}</option>
                    <option value="Vacancy">{POSITION_STATUS_LABELS.Vacancy}</option>
                    <option value="Closed">{POSITION_STATUS_LABELS.Closed}</option>
                  </select>
                </label>
              </div>
            </section>

            {view.status === "Vacancy" ? (
              <section className="drawer-card drawer-card--plan drawer-vacancy-profile">
                <h3 className="drawer-section__title drawer-section__title--plan">
                  Профиль компенсации
                </h3>
                {isVacancyDraft ? (
                  <p className="drawer-field__hint drawer-vacancy-profile__hint">
                    Заполните оклад, специализацию и уровень — затем нажмите «Сохранить позицию» в шапке.
                  </p>
                ) : (
                  <p className="drawer-field__hint drawer-vacancy-profile__hint">
                    С месяца «{MONTHS[vacancyProfileMonth]}» по конец года.
                  </p>
                )}
                <div className="drawer-scenario-form__row drawer-scenario-form__row--four">
                  <label className="drawer-field">
                    <span className="drawer-field__label">Специализация</span>
                    <select
                      value={vacancyProfileSpec}
                      disabled={readOnly}
                      onChange={(event) => updateVacancyProfile({ spec: event.target.value })}
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
                      value={vacancyProfileLevel}
                      disabled={readOnly}
                      onChange={(event) => updateVacancyProfile({ level: event.target.value })}
                    >
                      {vacancyProfileLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="drawer-field">
                    <span className="drawer-field__label">Оклад, ₽</span>
                    <input
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={vacancyProfileBase}
                      onChange={(event) => updateVacancyProfile({ base: Number(event.target.value) })}
                    />
                  </label>
                  <label className="drawer-field">
                    <span className="drawer-field__label">Премия, ₽</span>
                    <input
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={vacancyProfileBonus}
                      onChange={(event) => updateVacancyProfile({ bonus: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {showPlanEvents ? (
            <section className="drawer-events-panel drawer-card drawer-card--plan" ref={composerRef}>
            <h3 className="drawer-section__title drawer-section__title--plan">
              <Calendar size={14} aria-hidden />
              Плановое изменение
            </h3>
          <div className="drawer-scenario-form">
            {isCompensationForm ? (
              <div className="drawer-scenario-form__row drawer-scenario-form__row--six">
                <label className="drawer-field">
                  <span className="drawer-field__label drawer-field__label--with-help">
                    Тип изменения
                    <MetricHelp title="Тип изменения">{scenarioHint}</MetricHelp>
                  </span>
                  <select
                    value={scenarioForm.scenario}
                    onChange={(event) =>
                      setScenarioForm((prev) => ({
                        ...prev,
                        scenario: event.target.value as ScenarioType,
                        transferToPositionId: "",
                        targetDepartment:
                          prev.targetDepartment ||
                          departmentOptions.find((department) => department !== view.department) ||
                          departmentOptions[0] ||
                          "",
                      }))
                    }
                  >
                    {scenarioGroups.map((group) => (
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
                <label className="drawer-field">
                  <span className="drawer-field__label">С месяца</span>
                  <select
                    value={scenarioForm.month}
                    onChange={(event) => {
                      const month = Number(event.target.value);
                      const specialization = view.monthlySpec[month] || scenarioForm.specialization;
                      const levels = levelOptionsForSpecialization(specialization, salaryBands);
                      const level = levels.includes(view.monthlyLevel[month])
                        ? view.monthlyLevel[month]
                        : levels[0];
                      setScenarioForm((prev) => ({
                        ...prev,
                        month,
                        specialization,
                        level,
                        base: view.monthlyBase[month] || prev.base,
                        bonus: view.monthlyBonus[month] || prev.bonus,
                      }));
                    }}
                  >
                    {MONTHS.map((month, index) => {
                      const blocked =
                        correctionWindow != null && !isPlanEventMonthAllowed(index, correctionWindow);
                      return (
                        <option key={month} value={index} disabled={blocked}>
                          {month.slice(0, 3)}
                          {blocked ? " (закрыт)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="drawer-field">
                  <span className="drawer-field__label">Новый оклад, ₽</span>
                  <input
                    type="number"
                    value={scenarioForm.base}
                    disabled={isGradeChange}
                    onChange={(event) => setScenarioForm((prev) => ({ ...prev, base: Number(event.target.value) }))}
                  />
                </label>
                <label className="drawer-field">
                  <span className="drawer-field__label">Новый уровень</span>
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
                <label className="drawer-field">
                  <span className="drawer-field__label">Новая специализация</span>
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
                  <span className="drawer-field__label">Премия, ₽</span>
                  <input
                    type="number"
                    value={scenarioForm.bonus}
                    disabled={isGradeChange}
                    onChange={(event) => setScenarioForm((prev) => ({ ...prev, bonus: Number(event.target.value) }))}
                  />
                </label>
              </div>
            ) : (
              <>
            <div className="drawer-scenario-form__row drawer-scenario-form__row--primary">
            <label className="drawer-field drawer-field--type">
              <span className="drawer-field__label drawer-field__label--with-help">
                Тип изменения
                <MetricHelp title="Тип изменения">{scenarioHint}</MetricHelp>
              </span>
              <select
                value={scenarioForm.scenario}
                onChange={(event) =>
                  setScenarioForm((prev) => ({
                    ...prev,
                    scenario: event.target.value as ScenarioType,
                    transferToPositionId: "",
                    targetDepartment:
                      prev.targetDepartment ||
                      departmentOptions.find((department) => department !== view.department) ||
                      departmentOptions[0] ||
                      "",
                  }))
                }
              >
                {scenarioGroups.map((group) => (
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
            <label className="drawer-field drawer-field--month">
              <span className="drawer-field__label">С месяца</span>
              <select
                value={scenarioForm.month}
                onChange={(event) => {
                  const month = Number(event.target.value);
                  const specialization = view.monthlySpec[month] || scenarioForm.specialization;
                  const levels = levelOptionsForSpecialization(specialization, salaryBands);
                  const level = levels.includes(view.monthlyLevel[month]) ? view.monthlyLevel[month] : levels[0];
                  setScenarioForm((prev) => ({
                    ...prev,
                    month,
                    specialization,
                    level,
                    base: view.monthlyBase[month] || prev.base,
                    bonus: view.monthlyBonus[month] || prev.bonus,
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
            <label className="drawer-field drawer-field--salary">
              <span className="drawer-field__label">Оклад, ₽</span>
              <input
                type="number"
                value={scenarioForm.base}
                onChange={(event) => setScenarioForm((prev) => ({ ...prev, base: Number(event.target.value) }))}
              />
            </label>
            {!isMaternity ? (
              <label className="drawer-field drawer-field--bonus">
                <span className="drawer-field__label">Премия, ₽</span>
                <input
                  type="number"
                  value={scenarioForm.bonus}
                  onChange={(event) => setScenarioForm((prev) => ({ ...prev, bonus: Number(event.target.value) }))}
                />
              </label>
            ) : null}
            </div>
            {(isTransfer || isMaternity) ? (
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
            {isTransfer && !isInterTransfer ? (
              <div className="drawer-scenario-form__block">
                <p className="drawer-scenario-form__block-title">Целевая вакансия в юните</p>
                {renderTransferVacancyPicker("Создать вакансию в том же юните")}
              </div>
            ) : null}
            {isInterTransfer ? (
              <div className="drawer-scenario-form__block">
                <p className="drawer-scenario-form__block-title">Целевой департамент и вакансия</p>
                <div className="drawer-scenario-form__row drawer-scenario-form__row--targets">
                  <label className="drawer-field">
                    <span className="drawer-field__label">Департамент</span>
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
                        .filter((department) => department !== view.department)
                        .map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="drawer-field">
                    <span className="drawer-field__label">Юнит</span>
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
                  <label className="drawer-field">
                    <span className="drawer-field__label">Команда</span>
                    <select
                      value={scenarioForm.targetTeam}
                      onChange={(event) =>
                        setScenarioForm((prev) => ({
                          ...prev,
                          targetTeam: event.target.value,
                          transferToPositionId: "",
                        }))
                      }
                    >
                      {teamOptionsForUnit(scenarioForm.targetDepartment, scenarioForm.targetUnit).map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {renderTransferVacancyPicker("Создать позицию в целевом департаменте")}
              </div>
            ) : null}
            {isMaternity ? (
              <div className="drawer-scenario-form__block">
                <p className="drawer-scenario-form__block-title">Замещение в декрете</p>
                <div className="drawer-scenario-form__row drawer-scenario-form__row--maternity">
                  <label className="drawer-field">
                    <span className="drawer-field__label">Режим замещения</span>
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
                      <option value="FROM_LIST">Сотрудник из списка</option>
                      <option value="VACANCY">Вакансия (без ФИО)</option>
                    </select>
                  </label>
                  {scenarioForm.replacementMode === "FROM_LIST" ? (
                    <label className="drawer-field">
                      <span className="drawer-field__label">Сотрудник замещения</span>
                      <select
                        value={scenarioForm.replacementEmployeeId}
                        onChange={(event) =>
                          setScenarioForm((prev) => ({ ...prev, replacementEmployeeId: event.target.value }))
                        }
                      >
                        <option value="">
                          {maternityReplacementOptions.length
                            ? "Выберите сотрудника"
                            : "Нет сотрудников в департаменте"}
                        </option>
                        {maternityReplacementOptions.map((employee) => (
                          <option key={employee.employeeId} value={employee.employeeId}>
                            {formatMaternityReplacementLabel(employee)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                {scenarioForm.replacementMode === "VACANCY" ? (
                  <p className="drawer-field__hint drawer-events-block__hint">
                    Замещение планируется как вакансия на позиции (бюджет задаётся окладом выше).
                  </p>
                ) : null}
              </div>
            ) : null}
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
              Запланировать
            </button>
            </div>
          </div>
          {viewTransferTarget && (
            <p className="drawer-events-block__hint">
              → {viewTransferTarget.positionId} ({viewTransferTarget.team || viewTransferTarget.unit})
            </p>
          )}
          {kaitenNudge ? (
            <div className="drawer-kaiten-nudge" role="status">
              <p className="drawer-kaiten-nudge__text">
                {kaitenNudge.type === "hire"
                  ? "Плановый найм сохранён. Создать заявку на найм в Kaiten?"
                  : "Событие сохранено. Создать заявку на изменение в ОТиЗ?"}
              </p>
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
            ) : null}

            <section className="drawer-history-section drawer-card">
              <h3 className="drawer-section__title drawer-section__title--history">
                <History size={14} aria-hidden />
                История изменений
              </h3>
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

          <section className="drawer-fot drawer-card">
            <h3 className="drawer-section__title drawer-section__title--fot">
              <Table2 size={14} aria-hidden />
              ФОТ по месяцам
            </h3>
            <div className="drawer-fot__summary" role="group" aria-label="Сводка ФОТ">
              <div className="drawer-fot__summary-col">
                <p className="drawer-fot__summary-label">
                  Декабрь {planYear - 1} к декабрю {planYear}
                </p>
                <div className={`drawer-fot__dec dec-cell--${growthTone(decDelta)}`}>
                  <div className="positions-table__dec-range">
                    {decPrevBase.toLocaleString("ru-RU")} → {decPlanBase.toLocaleString("ru-RU")} ₽
                  </div>
                  <div>
                    {formatGrowthDelta(decDelta)} · {formatGrowthPct(decPct)}
                  </div>
                </div>
              </div>
              <div className="drawer-fot__summary-col drawer-fot__summary-col--annual">
                <p className="drawer-fot__summary-label">Итого за {planYear} год</p>
                <p className="drawer-fot__annual-value">{formatMoney(annualFotTotal)}</p>
              </div>
            </div>
            <div className="drawer-fot__split">
              <div className="drawer-fot__half">
                <p className="drawer-fot__half-title">I полугодие</p>
                <table className="monthly-table monthly-table--drawer monthly-table--drawer-compact monthly-table--readonly">
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th>Специализация</th>
                      <th>Уровень</th>
                      <th>Оклад</th>
                      <th>Премия</th>
                      <th>Итого</th>
                      <th>CR</th>
                    </tr>
                  </thead>
                  <tbody>{renderDrawerMonthRows(0, 6)}</tbody>
                </table>
              </div>
              <div className="drawer-fot__half">
                <p className="drawer-fot__half-title">II полугодие</p>
                <table className="monthly-table monthly-table--drawer monthly-table--drawer-compact monthly-table--readonly">
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th>Специализация</th>
                      <th>Уровень</th>
                      <th>Оклад</th>
                      <th>Премия</th>
                      <th>Итого</th>
                      <th>CR</th>
                    </tr>
                  </thead>
                  <tbody>{renderDrawerMonthRows(6, 12)}</tbody>
                </table>
              </div>
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
    {kaitenExportOpen ? (
      <KaitenExportModal
        open={kaitenExportOpen}
        onClose={() => setKaitenExportOpen(false)}
        position={view}
        planVersionId={planVersionId}
        planYear={planYear}
        userRole={userRole}
        initialType={kaitenInitialType}
        event={kaitenModalEvent}
      />
    ) : null}
    </>
    ,
    document.body,
  );
}
