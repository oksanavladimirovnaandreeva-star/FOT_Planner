import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord } from "../types";

const MIDPOINTS: Record<string, Record<string, number>> = {
  Engineering: {
    Junior: 1_200_000,
    Middle: 1_800_000,
    Senior: 2_500_000,
    Lead: 3_200_000,
  },
  Product: {
    Middle: 1_900_000,
    Senior: 2_700_000,
    Lead: 3_300_000,
  },
  Marketing: {
    Middle: 1_400_000,
    Senior: 2_000_000,
    Lead: 2_800_000,
  },
};

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

export const SPECIALIZATION_OPTIONS = Object.keys(MIDPOINTS);

export function levelOptionsForSpecialization(specialization: string): string[] {
  const levels = Object.keys(MIDPOINTS[specialization] ?? {});
  return levels.length ? levels : ["Junior", "Middle", "Senior", "Lead"];
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
      activeFromMonth: 0,
      vacancySinceMonth: null,
      annualLimit: 2_450_000,
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
      activeFromMonth: 0,
      vacancySinceMonth: null,
      annualLimit: 2_100_000,
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
      events: [],
    },
    {
      positionId: "P003",
      role: "Product Manager",
      department: "Product",
      unit: "Core",
      team: "PM Team A",
      slotType: "carryover",
      activeFromMonth: 0,
      vacancySinceMonth: null,
      annualLimit: 3_050_000,
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

export function getMonthlyCR(base: number, spec: string, level: string): number {
  const midpoint = MIDPOINTS[spec]?.[level];
  if (!midpoint) return 0;
  return base / (midpoint / 12);
}

export function annualTotal(record: PositionRecord): number {
  return record.monthlyBase.reduce((sum, item) => sum + item, 0) + record.monthlyBonus.reduce((sum, item) => sum + item, 0);
}

export function limitUsagePercent(record: PositionRecord): number {
  if (record.annualLimit <= 0) return 0;
  return (annualTotal(record) / record.annualLimit) * 100;
}

export function getLimitStatus(record: PositionRecord): { label: "In Limit" | "Near Limit" | "Over Limit"; tone: "ok" | "warn" | "danger" } {
  const usage = limitUsagePercent(record);
  if (usage > 100) return { label: "Over Limit", tone: "danger" };
  if (usage >= 90) return { label: "Near Limit", tone: "warn" };
  return { label: "In Limit", tone: "ok" };
}

export function decToDec(prevDecember: number, currDecember: number): number {
  if (prevDecember === 0 && currDecember === 0) return 0;
  if (prevDecember === 0 && currDecember > 0) return 100;
  return ((currDecember - prevDecember) / prevDecember) * 100;
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

