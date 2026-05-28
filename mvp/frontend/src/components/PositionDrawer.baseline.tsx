import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2, X } from "lucide-react";
import {
  annualTotal,
  applyDirectEdit,
  decToDec,
  defaultLimitFlagForSlotType,
  getMonthlyCR,
  hasCarryoverEvent,
  levelOptionsForSpecialization,
  LIMIT_FLAG_LABELS,
  LIMIT_FLAG_OPTIONS,
  upsertEvent,
} from "../data/planningData";
import { specializationOptions } from "../data/salaryRangeData";
import { useMvpApp } from "../context/MvpAppContext";
import type { LimitFlagKey } from "../types";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord } from "../types";
import { eventTypeLabel, formatEventHuman } from "./drawer/formatEventHistory";

interface PositionDrawerProps {
  open: boolean;
  record: PositionRecord | null;
  onClose: () => void;
  onSaveDraft: (record: PositionRecord, sourcePositionId?: string, forceCreate?: boolean) => void;
  onAddEvent: (positionId: string, event: PlannedEvent) => void;
  onDeleteEvent: (positionId: string, eventId: string) => void;
  onDeletePosition: (positionId: string) => void;
  vacancyOptions: { positionId: string; role: string; department: string; unit: string; team: string }[];
  employeeOptions: { employeeId: string; employeeName: string; positionId: string }[];
  suggestedNewEmployeeId: string;
  isPersisted: boolean;
  departmentOptions: string[];
  unitOptionsForDepartment: (department: string) => string[];
  teamOptionsForUnit: (department: string, unit: string) => string[];
}

type ScenarioType =
  | "REVIEW"
  | "TRANSFER_INTRA"
  | "TRANSFER_INTER"
  | "TERMINATION"
  | "REDUCTION"
  | "MATERNITY";
type ScenarioFormState = {
  scenario: ScenarioType;
  month: number;
  base: number;
  bonus: number;
  specialization: string;
  level: string;
  transferToPositionId: string;
  replacementMode: "FROM_LIST" | "NEW";
  replacementEmployeeId: string;
  newReplacementName: string;
  newReplacementId: string;
  targetDepartment: string;
  targetUnit: string;
  targetTeam: string;
};
const SCENARIO_LABEL: Record<ScenarioType, string> = {
  REVIEW: "Пересмотр",
  TRANSFER_INTRA: "Перевод внутри юнита",
  TRANSFER_INTER: "Перевод в другой департамент",
  TERMINATION: "Увольнение",
  REDUCTION: "Сокращение",
  MATERNITY: "Декрет",
};

function scenarioHelpText(scenario: ScenarioType): string {
  switch (scenario) {
    case "REVIEW":
      return "Оклад, премия, специализация и уровень — с выбранного месяца до конца года.";
    case "TRANSFER_INTRA":
      return "Перевод на вакансию в том же департаменте и юните.";
    case "TRANSFER_INTER":
      return "Перевод в другой департамент; вакансию можно не указыать.";
    case "TERMINATION":
      return "Сотрудник уходит, позиция остаётся вакансией.";
    case "REDUCTION":
      return "Позиция закрывается.";
    case "MATERNITY":
      return "Декрет с указанием сотрудника замещения.";
    default:
      return "";
  }
}

function crTone(value: number): "warn" | "ok" | "danger" {
  if (value < 0.8) return "warn";
  if (value <= 1.2) return "ok";
  return "danger";
}

export function PositionDrawer({
  open,
  record,
  onClose,
  onSaveDraft,
  onAddEvent,
  onDeleteEvent,
  onDeletePosition,
  vacancyOptions,
  employeeOptions,
  suggestedNewEmployeeId,
  isPersisted,
  departmentOptions,
  unitOptionsForDepartment,
  teamOptionsForUnit,
}: PositionDrawerProps) {
  const { salaryBands } = useMvpApp();
  const specOptions = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const selected = useMemo(() => record, [record]);
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
    newReplacementName: "",
    newReplacementId: suggestedNewEmployeeId,
    targetDepartment: "",
    targetUnit: "",
    targetTeam: "",
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
      newReplacementName: "",
      newReplacementId: suggestedNewEmployeeId,
      targetDepartment: preferredDepartment,
      targetUnit: preferredUnit,
      targetTeam: preferredTeam,
    });
  }, [selected?.positionId, departmentOptions, unitOptionsForDepartment, teamOptionsForUnit, suggestedNewEmployeeId]);
  if (!open || !selected) return null;
  const intraTransferOptions = vacancyOptions.filter(
    (vacancy) =>
      vacancy.positionId !== selected.positionId &&
      vacancy.department === selected.department &&
      vacancy.unit === selected.unit,
  );
  const interTransferOptions = vacancyOptions.filter(
    (vacancy) =>
      vacancy.positionId !== selected.positionId &&
      vacancy.department === scenarioForm.targetDepartment &&
      (scenarioForm.targetUnit ? vacancy.unit === scenarioForm.targetUnit : true),
  );
  const transferOptions = scenarioForm.scenario === "TRANSFER_INTRA" ? intraTransferOptions : interTransferOptions;
  const replacementEmployeeOptions = employeeOptions.filter((employee) => employee.employeeId !== selected.employeeId);

  const growth = decToDec(selected.previousDecemberBase, selected.monthlyBase[11]);
  const carryoverApplied = hasCarryoverEvent(selected);

  const addVacancyFromDrawer = () => {
    onSaveDraft(selected, selected.positionId, true);
    window.alert("Вакансия добавлена в общий список.");
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
  const createEvent = (type: PlannedEvent["type"], payload: PlannedEvent["payload"]): PlannedEvent => ({
    id: crypto.randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    createdOrder: selected.events.length + 1,
    payload,
  });
  const applyEventToRecord = (event: PlannedEvent) => {
    if (isPersisted) {
      onAddEvent(selected.positionId, event);
      return;
    }
    // Для новой вакансии (черновика) сначала сохраняем позицию в список,
    // затем применяем событие к уже сохраненной записи.
    onSaveDraft(upsertEvent(selected, event), selected.positionId, true);
  };
  const applyScenario = () => {
    const month = scenarioForm.month;
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
        const requiresExistingVacancy = scenarioForm.scenario === "TRANSFER_INTRA";
        if (requiresExistingVacancy && !scenarioForm.transferToPositionId) {
          window.alert("Выберите целевую вакансию для перевода.");
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
        if (base <= 0) {
          window.alert("Для замещения в декрете укажите оклад > 0.");
          return;
        }
        let replacementEmployeeId: string;
        let replacementEmployeeName: string;
        if (scenarioForm.replacementMode === "FROM_LIST") {
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
          replacementEmployeeId = replacement.employeeId;
          replacementEmployeeName = replacement.employeeName;
        } else {
          const name = scenarioForm.newReplacementName.trim();
          const id = scenarioForm.newReplacementId.trim();
          if (!name) {
            window.alert("Укажите ФИО нового сотрудника замещения.");
            return;
          }
          if (!id) {
            window.alert("Укажите ID сотрудника замещения или сгенерируйте автоматически.");
            return;
          }
          replacementEmployeeId = id;
          replacementEmployeeName = name;
        }
        applyEventToRecord(
          createEvent("MANUAL_OVERRIDE", {
            month,
            base,
            bonus: 0,
            specialization,
            level,
            maternityMode: "SHARED_POSITION",
            maternityPrimaryEmployeeId: selected.employeeId ?? undefined,
            maternityPrimaryEmployeeName: selected.employeeName ?? undefined,
            employeeId: replacementEmployeeId,
            employeeName: replacementEmployeeName,
          }),
        );
        window.alert("Декрет применен: на позиции отражены сотрудник в декрете и сотрудник замещения.");
        break;
      }
      default:
        break;
    }
    setScenarioForm((prev) => ({
      ...prev,
      transferToPositionId: "",
      replacementEmployeeId: "",
      newReplacementName: "",
      newReplacementId: suggestedNewEmployeeId,
    }));
  };
  const selectedTransferTarget = transferOptions.find((item) => item.positionId === scenarioForm.transferToPositionId) || null;
  const monthLevels = levelOptionsForSpecialization(scenarioForm.specialization, salaryBands);
  const isReview = scenarioForm.scenario === "REVIEW";
  const isTransfer = scenarioForm.scenario === "TRANSFER_INTRA" || scenarioForm.scenario === "TRANSFER_INTER";
  const isInterTransfer = scenarioForm.scenario === "TRANSFER_INTER";
  const isMaternity = scenarioForm.scenario === "MATERNITY";
  const transferButtonDisabled =
    selected.status !== "Occupied" || (scenarioForm.scenario === "TRANSFER_INTRA" && transferOptions.length === 0);

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <header className="drawer-header">
          <div className="drawer-header__main">
            <h2>{selected.role}</h2>
            <p className="drawer-header__meta">
              <span>{selected.positionId}</span>
              <span>·</span>
              <span>{selected.employeeName ?? "Вакансия"}</span>
              <span>·</span>
              <span>
                {selected.department} / {selected.unit}
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
                aria-label="Удалить вакансию"
                title="Удалить вакансию"
                onClick={() => onDeletePosition(selected.positionId)}
              >
                <Trash2 size={18} />
              </button>
            )}
            {!isPersisted && selected.status === "Vacancy" && (
              <button type="button" className="primary-btn" onClick={addVacancyFromDrawer}>
                Добавить вакансию
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </header>

        <section className="drawer-section limit-settings">
          <h3 className="drawer-section__title">Позиция</h3>
          <label>
            ID позиции
            <input
              type="text"
              value={selected.positionId}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (!value) return;
                const next = applyDirectEdit(selected, (draft) => {
                  draft.positionId = value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Роль
            <input
              type="text"
              value={selected.role}
              onChange={(event) => {
                const next = applyDirectEdit(selected, (draft) => {
                  draft.role = event.target.value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Департамент
            <select
              value={selected.department}
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
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>
          <label>
            Юнит
            <select
              value={selected.unit}
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
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <label>
            Команда
            <select
              value={selected.team}
              onChange={(event) => {
                const next = applyDirectEdit(selected, (draft) => {
                  draft.team = event.target.value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {teamOptionsForUnit(selected.department, selected.unit).map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </label>
          <label>
            С какого месяца активна позиция
            <select
              value={selected.activeFromMonth}
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
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            Специализация вакансии
            <select
              value={selected.seedMonthlySpec[selected.activeFromMonth]}
              onChange={(event) => {
                const specialization = event.target.value;
                const levels = levelOptionsForSpecialization(specialization, salaryBands);
                const chosenLevel = levels[0];
                const next = applyDirectEdit(selected, (draft) => {
                  for (let monthIndex = draft.activeFromMonth; monthIndex < 12; monthIndex += 1) {
                    draft.seedMonthlySpec[monthIndex] = specialization;
                    draft.seedMonthlyLevel[monthIndex] = chosenLevel;
                  }
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {specOptions.map((specialization) => (
                <option key={specialization} value={specialization}>{specialization}</option>
              ))}
            </select>
          </label>
          <label>
            Уровень вакансии
            <select
              value={selected.seedMonthlyLevel[selected.activeFromMonth]}
              onChange={(event) => {
                const level = event.target.value;
                const next = applyDirectEdit(selected, (draft) => {
                  for (let monthIndex = draft.activeFromMonth; monthIndex < 12; monthIndex += 1) {
                    draft.seedMonthlyLevel[monthIndex] = level;
                  }
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {levelOptionsForSpecialization(selected.seedMonthlySpec[selected.activeFromMonth], salaryBands).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            ID сотрудника
            <input
              type="text"
              value={selected.employeeId ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim() || null;
                const next = applyDirectEdit(selected, (draft) => {
                  draft.seedEmployeeId = value;
                  draft.employeeId = value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Тип слота
            <select
              value={selected.slotType}
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
              <option value="carryover">Перенос (старые позиции)</option>
              <option value="new">Новый слот</option>
            </select>
          </label>
          <label>
            Признак лимита (limit_flag)
            <select
              value={selected.limitFlag}
              disabled={selected.slotType === "carryover"}
              onChange={(event) => {
                const limitFlag = event.target.value as LimitFlagKey;
                const next = applyDirectEdit(selected, (draft) => {
                  draft.limitFlag = limitFlag;
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {LIMIT_FLAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {selected.status === "Vacancy" && selected.slotType === "carryover" && !carryoverApplied && (
            <p className="drawer-section__hint drawer-section__hint--block">
              Перенос бюджета: добавьте событие на странице планирования.
            </p>
          )}
        </section>

        <section className="drawer-section event-form">
          <h3 className="drawer-section__title">Событие</h3>
          <div className="event-grid">
            <label>
              Сценарий
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
                {(Object.keys(SCENARIO_LABEL) as ScenarioType[]).map((scenarioKey) => (
                  <option key={scenarioKey} value={scenarioKey}>
                    {SCENARIO_LABEL[scenarioKey]}
                  </option>
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
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
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
                        ? "Выберите вакансию"
                        : "Нет доступных вакансий"}
                  </option>
                  {transferOptions.map((option) => (
                    <option key={option.positionId} value={option.positionId}>
                      {option.positionId} · {option.department}/{option.unit} · {option.role}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
                    <option value="FROM_LIST">Сотрудник из списка</option>
                    <option value="NEW">Новый сотрудник</option>
                  </select>
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
                  <>
                    <label>
                      ФИО нового сотрудника
                      <input
                        type="text"
                        value={scenarioForm.newReplacementName}
                        onChange={(event) => setScenarioForm((prev) => ({ ...prev, newReplacementName: event.target.value }))}
                        placeholder="Иванов Иван"
                      />
                    </label>
                    <label>
                      ID сотрудника
                      <input
                        type="text"
                        value={scenarioForm.newReplacementId}
                        onChange={(event) => setScenarioForm((prev) => ({ ...prev, newReplacementId: event.target.value }))}
                        placeholder={suggestedNewEmployeeId}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setScenarioForm((prev) => ({ ...prev, newReplacementId: suggestedNewEmployeeId }))
                      }
                    >
                      Сгенерировать ID ({suggestedNewEmployeeId})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          <p className="drawer-section__hint">{scenarioHelpText(scenarioForm.scenario)}</p>
          {selectedTransferTarget && (
            <p className="drawer-section__hint">
              → {selectedTransferTarget.positionId} ({selectedTransferTarget.department}/{selectedTransferTarget.unit})
            </p>
          )}
          <div className="drawer-section__footer">
            <button
              type="button"
              onClick={applyScenario}
              className="primary-btn"
              disabled={isTransfer && transferButtonDisabled}
            >
              Применить
            </button>
          </div>
        </section>

        <section className="drawer-section monthly-table-wrap">
          <h3 className="drawer-section__title">Помесячно</h3>
            <table className="monthly-table monthly-table--drawer">
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Spec</th>
                <th>Level</th>
                <th>BASE</th>
                <th>BONUS</th>
                <th>TOTAL</th>
                <th>CR</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, index) => {
                const total = selected.monthlyBase[index] + selected.monthlyBonus[index];
                const cr = getMonthlyCR(selected.monthlyBase[index], selected.monthlySpec[index], selected.monthlyLevel[index], salaryBands);
                return (
                  <tr key={month}>
                    <td>{month}</td>
                    <td>
                      <select value={selected.monthlySpec[index]} onChange={(event) => {
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
                          <option key={specialization} value={specialization}>
                            {specialization}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={selected.monthlyLevel[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          for (let monthIndex = index; monthIndex < 12; monthIndex += 1) {
                            draft.seedMonthlyLevel[monthIndex] = event.target.value;
                          }
                        });
                        onSaveDraft(next, selected.positionId);
                      }}>
                        {levelOptionsForSpecialization(selected.monthlySpec[index], salaryBands).map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" value={selected.monthlyBase[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBase[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td>
                      <input type="number" value={selected.monthlyBonus[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBonus[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td>{total.toLocaleString("ru-RU")} ₽</td>
                    <td>
                      <span className={`cr-value cr-value--${crTone(cr)}`}>{cr.toFixed(2)}</span>
                    </td>
                    <td>
                      <button className="icon-btn" title="Copy forward" onClick={() => applyCopyForward(index)}>
                        <Copy size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="drawer-section history-wrap">
          <h3 className="drawer-section__title">История</h3>
          <p className="drawer-section__hint">Удаление события откатывает его влияние на план.</p>
          <ul className="drawer-history-list">
            {selected.events.length === 0 && <li className="drawer-history-list__empty">Событий пока нет</li>}
            {[...selected.events]
              .sort((a, b) => b.createdOrder - a.createdOrder)
              .map((event) => (
                <li key={event.id} className="drawer-history-item">
                  <div className="drawer-history-item__head">
                    <strong>{eventTypeLabel(event.type)}</strong>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label="Удалить"
                      onClick={() => onDeleteEvent(selected.positionId, event.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p>{formatEventHuman(event)}</p>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

