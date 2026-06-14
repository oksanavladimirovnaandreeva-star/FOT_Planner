import { levelOptionsForSpecialization } from "../../data/planningData";
import type { SalaryRangeBand } from "../../types";
import type { PositionRecord } from "../../types";

export type ScenarioType =
  | "REVIEW"
  | "TRANSFER_INTRA"
  | "TRANSFER_INTER"
  | "TERMINATION"
  | "REDUCTION"
  | "MATERNITY";

export type ScenarioFormState = {
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

export type DrawerTab = "position" | "event" | "monthly" | "history";

export const SCENARIO_CARDS: {
  id: ScenarioType;
  title: string;
  short: string;
  occupiedOnly?: boolean;
}[] = [
  { id: "REVIEW", title: "Пересмотр", short: "Оклад, уровень, специализация с месяца" },
  { id: "TRANSFER_INTRA", title: "Перевод внутри юнита", short: "На другую вакансию в том же юните", occupiedOnly: true },
  { id: "TRANSFER_INTER", title: "Перевод в другой департамент", short: "Смена оргструктуры", occupiedOnly: true },
  { id: "TERMINATION", title: "Увольнение", short: "Позиция станет вакансией", occupiedOnly: true },
  { id: "REDUCTION", title: "Сокращение", short: "Позиция закрывается", occupiedOnly: true },
  { id: "MATERNITY", title: "Декрет", short: "Замещение: сотрудник или вакансия", occupiedOnly: true },
];

export function scenarioHelpText(scenario: ScenarioType): string {
  switch (scenario) {
    case "REVIEW":
      return "С выбранного месяца меняются оклад, премия (если указана), специализация и уровень — дальше по году подтянется автоматически.";
    case "TRANSFER_INTRA":
      return "Сотрудник переводится на выбранную вакансию внутри департамента и юнита.";
    case "TRANSFER_INTER":
      return "Перевод в другой департамент: можно выбрать вакансию или создать новую позицию в целевом подразделении.";
    case "TERMINATION":
      return "Сотрудник уходит, позиция остаётся как вакансия.";
    case "REDUCTION":
      return "Позиция закрывается, сотрудник снимается с плана.";
    case "MATERNITY":
      return "Основной сотрудник в декрете, на позиции указывается замещающий.";
    default:
      return "";
  }
}

export function initialScenarioForm(
  selected: PositionRecord,
  specOptions: string[],
  salaryBands: SalaryRangeBand[],
  departmentOptions: string[],
  unitOptionsForDepartment: (d: string) => string[],
  teamOptionsForUnit: (d: string, u: string) => string[],
): ScenarioFormState {
  const month = 0;
  const specialization = selected.monthlySpec[month] || specOptions[0] || "Engineering";
  const levels = levelOptionsForSpecialization(specialization, salaryBands);
  const preferredDepartment =
    departmentOptions.find((d) => d !== selected.department) || departmentOptions[0] || selected.department;
  const preferredUnit = unitOptionsForDepartment(preferredDepartment)[0] || "";
  const preferredTeam = teamOptionsForUnit(preferredDepartment, preferredUnit)[0] || "";
  return {
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
  };
}
