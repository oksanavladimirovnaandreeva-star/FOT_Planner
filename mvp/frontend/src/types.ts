export const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export type MonthLabel = (typeof MONTHS)[number];
export type EventType =
  | "INDEXATION"
  | "MANUAL_OVERRIDE"
  | "TARGET_SALARY"
  | "CLASSIFICATION_CHANGE"
  | "TERMINATION"
  | "TERMINATION_TO_VACANCY"
  | "CLOSE_POSITION"
  | "PLANNED_HIRE"
  | "CANCEL_VACANCY"
  | "TRANSFER"
  | "POSITION_CARRYOVER";

export interface EventPayload {
  month: number;
  percent?: number;
  base?: number;
  bonus?: number;
  specialization?: string;
  level?: string;
  transferToPositionId?: string;
  employeeName?: string;
  employeeId?: string;
  transferFromPositionId?: string;
  indexationBatchId?: string;
}

export interface PlannedEvent {
  id: string;
  type: EventType;
  createdAt: string;
  createdOrder: number;
  payload: EventPayload;
}

export interface PositionRecord {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  slotType: "carryover" | "new";
  activeFromMonth: number;
  vacancySinceMonth: number | null;
  annualLimit: number;
  previousDecemberBase: number;
  employeeName: string | null;
  employeeId: string | null;
  status: "Occupied" | "Vacancy" | "Closed";
  seedEmployeeName: string | null;
  seedEmployeeId: string | null;
  seedStatus: "Occupied" | "Vacancy" | "Closed";
  seedVacancySinceMonth: number | null;
  monthlySpec: string[];
  monthlyLevel: string[];
  monthlyBase: number[];
  monthlyBonus: number[];
  seedMonthlySpec: string[];
  seedMonthlyLevel: string[];
  seedMonthlyBase: number[];
  seedMonthlyBonus: number[];
  events: PlannedEvent[];
}

