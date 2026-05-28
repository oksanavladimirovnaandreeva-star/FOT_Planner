import { MONTHS } from "../types";
import type { LimitFlagKey, PlannedEvent, PositionRecord } from "../types";

import {
  getMonthlyCR as crFromCatalog,
  initialSalaryBands,
  levelOptionsForSpecialization as levelsFromCatalog,
  specializationOptions,
} from "./salaryRangeData";
import type { SalaryRangeBand } from "../types";

const DEFAULT_BANDS = initialSalaryBands();

export const ORG_STRUCTURE: Record<string, Record<string, string[]>> = {
  Engineering: {
    Platform: ["Backend Core", "Infrastructure"],
    ProductDev: ["Frontend Web", "Mobile"],
  },
  Product: {
    Core: ["PM Team A", "PM Team B"],
    Analytics: ["Research", "Insights"],
  },
  Marketing: {
    Brand: ["Content", "SMM"],
    Growth: ["Performance", "CRM"],
  },
};

/** @deprecated Используйте specializationOptions(salaryBands) из контекста. */
export const SPECIALIZATION_OPTIONS = specializationOptions(DEFAULT_BANDS);

export function levelOptionsForSpecialization(
  specialization: string,
  bands: SalaryRangeBand[] = DEFAULT_BANDS,
): string[] {
  return levelsFromCatalog(specialization, bands);
}

export function getMonthlyCR(
  base: number,
  spec: string,
  level: string,
  bands: SalaryRangeBand[] = DEFAULT_BANDS,
): number {
  return crFromCatalog(base, spec, level, bands);
}

export const departmentOptions = Object.keys(ORG_STRUCTURE);

export function unitOptions(department: string): string[] {
  return Object.keys(ORG_STRUCTURE[department] ?? {});
}

export function teamOptions(department: string, unit: string): string[] {
  return ORG_STRUCTURE[department]?.[unit] ?? [];
}

export function normalizeOrgPath(department: string, unit: string, team: string): { department: string; unit: string; team: string } {
  const safeDepartment = departmentOptions.includes(department) ? department : departmentOptions[0];
  const units = unitOptions(safeDepartment);
  const safeUnit = units.includes(unit) ? unit : units[0];
  const teams = teamOptions(safeDepartment, safeUnit);
  const safeTeam = teams.includes(team) ? team : teams[0];
  return { department: safeDepartment, unit: safeUnit, team: safeTeam };
}

const twelve = <T,>(value: T): T[] => Array.from({ length: 12 }, () => value);

const EVENT_PRIORITY: Record<string, number> = {
  MANUAL_OVERRIDE: 1,
  TARGET_SALARY: 1,
  CLASSIFICATION_CHANGE: 1,
  PLANNED_HIRE: 1,
  INDEXATION: 2,
  TERMINATION: 3,
  TERMINATION_TO_VACANCY: 3,
  CLOSE_POSITION: 3,
  CANCEL_VACANCY: 3,
  TRANSFER: 3,
  POSITION_CARRYOVER: 3,
};

export function initialPositions(): PositionRecord[] {
  return [
    {
      positionId: "P001",
      role: "Senior Frontend Engineer",
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
      slotType: "carryover",
      limitFlag: "IN_LIMIT",
      activeFromMonth: 0,
      vacancySinceMonth: null,
      previousDecemberBase: 172_000,
      employeeName: "Ирина Соколова",
      employeeId: "E001",
      status: "Occupied",
      seedEmployeeName: "Ирина Соколова",
      seedEmployeeId: "E001",
      seedStatus: "Occupied",
      seedVacancySinceMonth: null,
      monthlySpec: twelve("Engineering"),
      monthlyLevel: twelve("Senior"),
      monthlyBase: twelve(180_000),
      monthlyBonus: twelve(0),
      seedMonthlySpec: twelve("Engineering"),
      seedMonthlyLevel: twelve("Senior"),
      seedMonthlyBase: twelve(180_000),
      seedMonthlyBonus: twelve(0),
      events: [],
    },
    {
      positionId: "P002",
      role: "Backend Engineer",
      department: "Engineering",
      unit: "Platform",
      team: "Backend Core",
      slotType: "carryover",
      limitFlag: "IN_LIMIT",
      activeFromMonth: 0,
      vacancySinceMonth: null,
      previousDecemberBase: 150_000,
      employeeName: null,
      employeeId: null,
      status: "Vacancy",
      seedEmployeeName: null,
      seedEmployeeId: null,
      seedStatus: "Vacancy",
      seedVacancySinceMonth: null,
      monthlySpec: twelve("Engineering"),
      monthlyLevel: twelve("Middle"),
      monthlyBase: twelve(155_000),
      monthlyBonus: twelve(0),
      seedMonthlySpec: twelve("Engineering"),
      seedMonthlyLevel: twelve("Middle"),
      seedMonthlyBase: twelve(155_000),
      seedMonthlyBonus: twelve(0),
      events: [
        {
          id: "seed-carryover-p002",
          type: "POSITION_CARRYOVER",
          createdAt: "2026-01-01T00:00:00.000Z",
          createdOrder: 1,
          payload: { month: 0 },
        },
      ],
    },
    {
      positionId: "P003",
      role: "Product Manager",
      department: "Product",
      unit: "Core",
      team: "PM Team A",
      slotType: "carryover",
      limitFlag: "IN_LIMIT",
      activeFromMonth: 0,
      vacancySinceMonth: null,
      previousDecemberBase: 205_000,
      employeeName: "Марк Чен",
      employeeId: "E003",
      status: "Occupied",
      seedEmployeeName: "Марк Чен",
      seedEmployeeId: "E003",
      seedStatus: "Occupied",
      seedVacancySinceMonth: null,
      monthlySpec: twelve("Product"),
      monthlyLevel: twelve("Senior"),
      monthlyBase: twelve(220_000),
      monthlyBonus: twelve(0),
      seedMonthlySpec: twelve("Product"),
      seedMonthlyLevel: twelve("Senior"),
      seedMonthlyBase: twelve(220_000),
      seedMonthlyBonus: twelve(0),
      events: [],
    },
  ];
}

function round(value: number): number {
  return Math.round(value);
}

export function annualTotal(record: PositionRecord): number {
  return record.monthlyBase.reduce((sum, item) => sum + item, 0) + record.monthlyBonus.reduce((sum, item) => sum + item, 0);
}

export function decToDec(prevDecember: number, currDecember: number): number {
  if (prevDecember === 0 && currDecember === 0) return 0;
  if (prevDecember === 0 && currDecember > 0) return 100;
  return ((currDecember - prevDecember) / prevDecember) * 100;
}

export type SlotTypeKey = PositionRecord["slotType"];

export const SLOT_TYPE_LABELS: Record<SlotTypeKey, string> = {
  carryover: "Перенос (старые)",
  new: "Новый слот",
};

export const LIMIT_FLAG_LABELS: Record<LimitFlagKey, string> = {
  IN_LIMIT: "В лимите",
  OVER_LIMIT: "Сверх лимита",
  UNLIMITED: "Без лимита",
};

export const POSITION_STATUS_LABELS: Record<PositionRecord["status"], string> = {
  Occupied: "Занято",
  Vacancy: "Вакансия",
  Closed: "Закрыта",
};

export const LIMIT_FLAG_OPTIONS: { value: LimitFlagKey; label: string }[] = [
  { value: "IN_LIMIT", label: "В лимите (IN_LIMIT)" },
  { value: "OVER_LIMIT", label: "Сверх лимита (OVER_LIMIT)" },
  { value: "UNLIMITED", label: "Без лимита (UNLIMITED)" },
];

/** Стартовое значение при создании слота (как в VacancyDrawer: carryover → только IN_LIMIT). */
export function defaultLimitFlagForSlotType(slotType: PositionRecord["slotType"]): LimitFlagKey {
  return slotType === "carryover" ? "IN_LIMIT" : "OVER_LIMIT";
}

export function hasCarryoverEvent(record: PositionRecord): boolean {
  return record.events.some((event) => event.type === "POSITION_CARRYOVER");
}

export function decGrowthByLimitFlag(positions: PositionRecord[]): {
  total: DecGrowthBucket;
  IN_LIMIT: DecGrowthBucket;
  OVER_LIMIT: DecGrowthBucket;
} {
  const active = positions.filter((position) => position.status !== "Closed");
  return {
    total: computeDecGrowthBucket(active),
    IN_LIMIT: computeDecGrowthBucket(active.filter((position) => position.limitFlag === "IN_LIMIT")),
    OVER_LIMIT: computeDecGrowthBucket(active.filter((position) => position.limitFlag === "OVER_LIMIT")),
  };
}

export interface DecGrowthBucket {
  decPrev: number;
  decPlan: number;
  delta: number;
  pct: number;
  positionCount: number;
  annualFot: number;
}

export function computeDecGrowthBucket(positions: PositionRecord[]): DecGrowthBucket {
  let decPrev = 0;
  let decPlan = 0;
  let annualFot = 0;
  let positionCount = 0;
  for (const position of positions) {
    if (position.status === "Closed") continue;
    decPrev += position.previousDecemberBase;
    decPlan += position.monthlyBase[11];
    annualFot += annualTotal(position);
    positionCount += 1;
  }
  const delta = decPlan - decPrev;
  return {
    decPrev,
    decPlan,
    delta,
    pct: decToDec(decPrev, decPlan),
    positionCount,
    annualFot,
  };
}

export interface DecGrowthBySlot {
  total: DecGrowthBucket;
  carryover: DecGrowthBucket;
  new: DecGrowthBucket;
}

export function decGrowthBySlotType(positions: PositionRecord[]): DecGrowthBySlot {
  const active = positions.filter((position) => position.status !== "Closed");
  return {
    total: computeDecGrowthBucket(active),
    carryover: computeDecGrowthBucket(active.filter((position) => position.slotType === "carryover")),
    new: computeDecGrowthBucket(active.filter((position) => position.slotType === "new")),
  };
}

export function formatGrowthPct(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

export function formatGrowthDelta(delta: number): string {
  if (delta > 0) return `+${delta.toLocaleString("ru-RU")} ₽`;
  return `${delta.toLocaleString("ru-RU")} ₽`;
}

export function growthTone(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function applyEvents(base: PositionRecord): PositionRecord {
  const next: PositionRecord = {
    ...base,
    employeeName: base.seedEmployeeName,
    employeeId: base.seedEmployeeId,
    status: base.seedStatus,
    vacancySinceMonth: base.seedVacancySinceMonth,
    monthlySpec: [...base.seedMonthlySpec],
    monthlyLevel: [...base.seedMonthlyLevel],
    monthlyBase: [...base.seedMonthlyBase],
    monthlyBonus: [...base.seedMonthlyBonus],
  };

  for (let index = 0; index < next.activeFromMonth; index += 1) {
    next.monthlyBase[index] = 0;
    next.monthlyBonus[index] = 0;
  }

  const sorted = [...base.events].sort((a, b) => {
    if (a.payload.month !== b.payload.month) return a.payload.month - b.payload.month;
    const priorityDiff = (EVENT_PRIORITY[a.type] ?? 99) - (EVENT_PRIORITY[b.type] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdOrder - b.createdOrder;
  });

  for (const event of sorted) {
    const month = Math.max(0, Math.min(11, event.payload.month));
    switch (event.type) {
      case "MANUAL_OVERRIDE":
      case "TARGET_SALARY": {
        for (let index = month; index < 12; index += 1) {
          if (typeof event.payload.base === "number") next.monthlyBase[index] = event.payload.base;
          if (typeof event.payload.bonus === "number") next.monthlyBonus[index] = event.payload.bonus;
          if (event.payload.specialization) next.monthlySpec[index] = event.payload.specialization;
          if (event.payload.level) next.monthlyLevel[index] = event.payload.level;
        }
        break;
      }
      case "CLASSIFICATION_CHANGE": {
        for (let index = month; index < 12; index += 1) {
          if (event.payload.specialization) next.monthlySpec[index] = event.payload.specialization;
          if (event.payload.level) next.monthlyLevel[index] = event.payload.level;
        }
        break;
      }
      case "INDEXATION": {
        const rate = (event.payload.percent ?? 0) / 100;
        for (let index = month; index < 12; index += 1) {
          next.monthlyBase[index] = round(next.monthlyBase[index] * (1 + rate));
          next.monthlyBonus[index] = round(next.monthlyBonus[index] * (1 + rate));
        }
        break;
      }
      case "TERMINATION": {
        next.employeeName = null;
        next.employeeId = null;
        next.status = "Vacancy";
        next.vacancySinceMonth = month;
        for (let index = month; index < 12; index += 1) {
          next.monthlyBonus[index] = 0;
        }
        break;
      }
      case "TERMINATION_TO_VACANCY": {
        next.employeeName = null;
        next.employeeId = null;
        next.status = "Vacancy";
        next.vacancySinceMonth = month;
        break;
      }
      case "CLOSE_POSITION": {
        next.employeeName = null;
        next.employeeId = null;
        next.status = "Closed";
        for (let index = month; index < 12; index += 1) {
          next.monthlyBase[index] = 0;
          next.monthlyBonus[index] = 0;
        }
        break;
      }
      case "PLANNED_HIRE": {
        next.status = "Occupied";
        next.employeeName = event.payload.employeeName ?? next.employeeName ?? "Planned Hire";
        next.employeeId = event.payload.employeeId ?? next.employeeId ?? "E-PLANNED";
        next.vacancySinceMonth = null;
        for (let index = month; index < 12; index += 1) {
          if (typeof event.payload.base === "number") next.monthlyBase[index] = event.payload.base;
          if (typeof event.payload.bonus === "number") next.monthlyBonus[index] = event.payload.bonus;
          if (event.payload.specialization) next.monthlySpec[index] = event.payload.specialization;
          if (event.payload.level) next.monthlyLevel[index] = event.payload.level;
        }
        break;
      }
      case "CANCEL_VACANCY": {
        next.status = "Closed";
        next.employeeName = null;
        next.employeeId = null;
        break;
      }
      case "TRANSFER":
        next.employeeName = null;
        next.employeeId = null;
        next.status = "Vacancy";
        next.vacancySinceMonth = month;
        break;
      case "POSITION_CARRYOVER":
        next.slotType = "carryover";
        next.limitFlag = "IN_LIMIT";
        if (next.status === "Vacancy") {
          const carryMonth = Math.max(0, Math.min(11, event.payload.month));
          if (carryMonth < next.activeFromMonth) {
            next.activeFromMonth = carryMonth;
          }
        }
        break;
      default:
        break;
    }
  }

  return next;
}

export function upsertEvent(record: PositionRecord, event: PlannedEvent): PositionRecord {
  const existing = record.events.find((item) => item.id === event.id);
  const events = existing ? record.events.map((item) => (item.id === event.id ? event : item)) : [...record.events, event];
  return applyEvents({ ...record, events });
}

export function removeEvent(record: PositionRecord, eventId: string): PositionRecord {
  const events = record.events.filter((event) => event.id !== eventId);
  return applyEvents({ ...record, events });
}

export function monthLabel(index: number): string {
  return MONTHS[Math.max(0, Math.min(11, index))];
}

export function applyDirectEdit(record: PositionRecord, updater: (draft: PositionRecord) => void): PositionRecord {
  const draft: PositionRecord = {
    ...record,
    seedMonthlySpec: [...record.seedMonthlySpec],
    seedMonthlyLevel: [...record.seedMonthlyLevel],
    seedMonthlyBase: [...record.seedMonthlyBase],
    seedMonthlyBonus: [...record.seedMonthlyBonus],
  };
  updater(draft);
  return applyEvents(draft);
}

