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
export type LimitFlagKey = "IN_LIMIT" | "OVER_LIMIT" | "UNLIMITED";
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
  transferKind?: "INTRA_UNIT" | "INTER_DEPARTMENT";
  maternityMode?: "SHARED_POSITION";
  maternityPrimaryEmployeeId?: string;
  maternityPrimaryEmployeeName?: string;
  targetDepartment?: string;
  targetUnit?: string;
  targetTeam?: string;
  employeeName?: string;
  employeeId?: string;
  transferFromPositionId?: string;
  indexationBatchId?: string;
  /** Связка TRANSFER ↔ PLANNED_HIRE для атомарного отката. */
  transferPairId?: string;
  /** Полный комментарий к событию (в UI — карточка; в тултипе — краткая выжимка). */
  comment?: string;
}

export interface PlannedEvent {
  id: string;
  type: EventType;
  createdAt: string;
  createdOrder: number;
  payload: EventPayload;
}

export interface SalaryRangeBand {
  id: string;
  specialization: string;
  level: string;
  minSalary: number;
  midpoint: number;
  maxSalary: number;
  currency: string;
}

/** Позже — из роли пользователя; в MVP только локальная заглушка. */
export type SalaryCatalogAccess = "read" | "write";

export interface PositionRecord {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  slotType: "carryover" | "new";
  /** Как `positions.limit_flag` в API — задаётся явно, не из % ФОТ. */
  limitFlag: LimitFlagKey;
  activeFromMonth: number;
  vacancySinceMonth: number | null;
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

