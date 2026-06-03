import { levelOptionsForSpecialization } from "../../data/planningData";
import type { PlannedEvent, PositionRecord } from "../../types";
import type { ScenarioFormState, ScenarioType } from "./scenarioTypes";

type VacancyOption = { positionId: string; role: string; department: string; unit: string; team: string };
type EmployeeOption = { employeeId: string; employeeName: string; positionId: string };

export function applyDrawerScenario(params: {
  selected: PositionRecord;
  scenarioForm: ScenarioFormState;
  scenario: ScenarioType;
  transferOptions: VacancyOption[];
  replacementEmployeeOptions: EmployeeOption[];
  createEvent: (type: PlannedEvent["type"], payload: PlannedEvent["payload"]) => PlannedEvent;
  onAddEvent: (positionId: string, event: PlannedEvent) => void;
}): { ok: true } | { ok: false; message: string } {
  const {
    selected,
    scenarioForm,
    scenario,
    transferOptions,
    replacementEmployeeOptions,
    createEvent,
    onAddEvent,
  } = params;

  const month = scenarioForm.month;
  const base = Number(scenarioForm.base);
  const bonus = Number(scenarioForm.bonus);
  const specialization = scenarioForm.specialization;
  const level = scenarioForm.level;

  if (selected.status !== "Occupied" && scenario !== "REVIEW") {
    return { ok: false, message: "Операция доступна только для занятых позиций." };
  }

  switch (scenario) {
    case "REVIEW":
      onAddEvent(selected.positionId, createEvent("MANUAL_OVERRIDE", { month, base, bonus, specialization, level }));
      return { ok: true };
    case "TRANSFER_INTRA":
    case "TRANSFER_INTER": {
      if (!selected.employeeId || !selected.employeeName) {
        return { ok: false, message: "Для перевода нужны ID и ФИО сотрудника." };
      }
      if (scenario === "TRANSFER_INTRA" && !scenarioForm.transferToPositionId) {
        return { ok: false, message: "Выберите целевую вакансию." };
      }
      const target = transferOptions.find((item) => item.positionId === scenarioForm.transferToPositionId);
      if (scenarioForm.transferToPositionId && !target) {
        return { ok: false, message: "Целевая вакансия не подходит для перевода." };
      }
      if (scenario === "TRANSFER_INTER" && !scenarioForm.targetDepartment) {
        return { ok: false, message: "Выберите целевой департамент." };
      }
      onAddEvent(
        selected.positionId,
        createEvent("TRANSFER", {
          month,
          transferToPositionId: target?.positionId,
          transferKind: scenario === "TRANSFER_INTRA" ? "INTRA_UNIT" : "INTER_DEPARTMENT",
          targetDepartment: scenario === "TRANSFER_INTER" ? scenarioForm.targetDepartment : undefined,
          targetUnit: scenario === "TRANSFER_INTER" ? scenarioForm.targetUnit : undefined,
          targetTeam: scenario === "TRANSFER_INTER" ? scenarioForm.targetTeam : undefined,
          employeeId: selected.employeeId,
          employeeName: selected.employeeName,
          base,
          bonus,
          specialization,
          level,
        }),
      );
      return { ok: true };
    }
    case "TERMINATION":
      onAddEvent(selected.positionId, createEvent("TERMINATION_TO_VACANCY", { month }));
      return { ok: true };
    case "REDUCTION":
      onAddEvent(selected.positionId, createEvent("CLOSE_POSITION", { month }));
      return { ok: true };
    case "MATERNITY": {
      if (base <= 0 && scenarioForm.replacementMode !== "VACANCY") {
        return { ok: false, message: "Укажите оклад замещения > 0." };
      }
      const payload: PlannedEvent["payload"] = {
        month,
        base,
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
      } else {
        if (!scenarioForm.replacementEmployeeId) {
          return { ok: false, message: "Выберите сотрудника замещения." };
        }
        const replacement = replacementEmployeeOptions.find(
          (e) => e.employeeId === scenarioForm.replacementEmployeeId,
        );
        if (!replacement) return { ok: false, message: "Сотрудник не найден." };
        payload.maternityReplacementKind = "EMPLOYEE";
        payload.employeeId = replacement.employeeId;
        payload.employeeName = replacement.employeeName;
      }
      onAddEvent(selected.positionId, createEvent("MANUAL_OVERRIDE", payload));
      return { ok: true };
    }
    default:
      return { ok: false, message: "Неизвестный сценарий." };
  }
}

export function syncScenarioFormFromMonth(
  selected: PositionRecord,
  month: number,
  prev: ScenarioFormState,
  salaryBands: Parameters<typeof levelOptionsForSpecialization>[1],
): ScenarioFormState {
  const specialization = selected.monthlySpec[month] || prev.specialization;
  const levels = levelOptionsForSpecialization(specialization, salaryBands);
  const level = levels.includes(selected.monthlyLevel[month]) ? selected.monthlyLevel[month] : levels[0];
  return {
    ...prev,
    month,
    specialization,
    level,
    base: selected.monthlyBase[month] || prev.base,
    bonus: selected.monthlyBonus[month] || prev.bonus,
  };
}
