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

import { ORG_STRUCTURE, departmentOptions, teamOptions, unitOptions } from "./orgStructure";
import { buildDemoPositions } from "./demoPlanSeed";

export { ORG_STRUCTURE, departmentOptions, unitOptions, teamOptions };

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

export function normalizeOrgPath(department: string, unit: string, team: string): { department: string; unit: string; team: string } {
  const departments = departmentOptions();
  const safeDepartment = departments.includes(department) ? department : departments[0];
  const units = unitOptions(safeDepartment);
  const safeUnit = units.includes(unit) ? unit : units[0];
  const teams = teamOptions(safeDepartment, safeUnit);
  const safeTeam = teams.includes(team) ? team : teams[0];
  return { department: safeDepartment, unit: safeUnit, team: safeTeam };
}

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

export function sortEventsForApply(events: PositionRecord["events"]): PositionRecord["events"] {
  return [...events].sort((a, b) => {
    if (a.payload.month !== b.payload.month) return a.payload.month - b.payload.month;
    const priorityDiff = (EVENT_PRIORITY[a.type] ?? 99) - (EVENT_PRIORITY[b.type] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdOrder - b.createdOrder;
  });
}

/** Вакантна ли позиция в месяц перевода (с учётом событий до этого месяца). */
export function isVacantForTransferAtMonth(record: PositionRecord, transferMonth: number): boolean {
  if (transferMonth < record.activeFromMonth) return false;

  let status: PositionRecord["status"] = record.seedStatus;

  for (const event of sortEventsForApply(record.events)) {
    const month = Math.max(0, Math.min(11, event.payload.month));
    if (month > transferMonth) continue;

    switch (event.type) {
      case "TERMINATION":
      case "TERMINATION_TO_VACANCY":
        status = "Vacancy";
        break;
      case "CLOSE_POSITION":
      case "CANCEL_VACANCY":
        status = "Closed";
        break;
      case "PLANNED_HIRE":
        status = "Occupied";
        break;
      default:
        break;
    }
  }

  return status === "Vacancy";
}

/** Подсказка, почему нет целевых вакансий для перевода внутри юнита. */
export function intraTransferVacancyHint(
  planPositions: PositionRecord[],
  source: PositionRecord,
  transferMonth: number,
): string | null {
  const norm = (value: string) => value.trim();
  const sameUnit = planPositions.filter(
    (position) =>
      position.positionId !== source.positionId &&
      norm(position.department) === norm(source.department) &&
      norm(position.unit) === norm(source.unit),
  );
  const vacantNow = sameUnit.filter((position) => isVacantForTransferAtMonth(position, transferMonth));
  if (vacantNow.length > 0) return null;

  if (sameUnit.length === 0) {
    const vacantElsewhere = planPositions.filter(
      (position) =>
        position.positionId !== source.positionId &&
        norm(position.department) === norm(source.department) &&
        norm(position.unit) !== norm(source.unit) &&
        isVacantForTransferAtMonth(position, transferMonth),
    );
    if (vacantElsewhere.length > 0) {
      const units = [...new Set(vacantElsewhere.map((position) => position.unit))];
      return `В юните «${source.unit}» нет позиций. Свободные вакансии в ${source.department}: ${units.join(", ")} — смените юнит у вакансии или используйте перевод в другой департамент.`;
    }
    return `В юните «${source.unit}» (${source.department}) нет вакансий на ${monthLabel(transferMonth)}. Создайте вакансию с тем же юнитом и «Сохранить в план».`;
  }

  const blocked = sameUnit.map((position) => {
    if (transferMonth < position.activeFromMonth) {
      return `${position.positionId} (с ${monthLabel(position.activeFromMonth)})`;
    }
    return `${position.positionId} (занят)`;
  });
  return `На ${monthLabel(transferMonth)} в юните «${source.unit}» недоступно: ${blocked.join(", ")}. Сдвиньте месяц перевода или «С месяца» у вакансии.`;
}

export function initialPositions(): PositionRecord[] {
  return buildDemoPositions();
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
  carryover: "Перенос",
  new: "Новая",
};

export const LIMIT_FLAG_LABELS: Record<LimitFlagKey, string> = {
  IN_LIMIT: "В лимите (старая позиция)",
  OVER_LIMIT: "Сверх лимита (новая позиция)",
  UNLIMITED: "Без ограничения роста",
};

export const POSITION_STATUS_LABELS: Record<PositionRecord["status"], string> = {
  Occupied: "В штате",
  Vacancy: "Вакансия",
  Closed: "Закрыта",
};

export const LIMIT_FLAG_OPTIONS: { value: LimitFlagKey; label: string }[] = [
  { value: "IN_LIMIT", label: "В лимите (старая позиция)" },
  { value: "OVER_LIMIT", label: "Сверх лимита (новая позиция)" },
  { value: "UNLIMITED", label: "Без ограничения роста" },
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

/** Состояние позиции после применения событий до eventId (не включая или включая). */
export function applyEventsUntil(
  record: PositionRecord,
  untilEventId: string,
  inclusive: boolean,
): PositionRecord {
  const sorted = sortEventsForApply(record.events);
  const index = sorted.findIndex((event) => event.id === untilEventId);
  if (index < 0) return applyEvents({ ...record, events: [] });
  const events = sorted.slice(0, inclusive ? index + 1 : index);
  return applyEvents({ ...record, events });
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

  const sorted = sortEventsForApply(base.events);

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

export type IndexationBatchLog = {
  id: string;
  month: number;
  percent: number;
  affectedCount: number;
  createdAt: string;
};

/** Собирает факты массовой индексации из событий позиций (переживает смену версии / черновик). */
export function collectIndexationBatchesFromPositions(positions: PositionRecord[]): IndexationBatchLog[] {
  const batchMap = new Map<
    string,
    { month: number; percent: number; createdAt: string; positionIds: Set<string> }
  >();

  for (const position of positions) {
    for (const event of position.events) {
      if (event.type !== "INDEXATION") continue;
      const batchId = event.payload.indexationBatchId;
      const month = event.payload.month;
      const percent = event.payload.percent;
      if (!batchId || typeof month !== "number" || typeof percent !== "number") continue;

      let entry = batchMap.get(batchId);
      if (!entry) {
        entry = { month, percent, createdAt: event.createdAt, positionIds: new Set() };
        batchMap.set(batchId, entry);
      }
      entry.positionIds.add(position.positionId);
      if (event.createdAt < entry.createdAt) {
        entry.createdAt = event.createdAt;
      }
    }
  }

  return [...batchMap.entries()]
    .map(([id, entry]) => ({
      id,
      month: entry.month,
      percent: entry.percent,
      affectedCount: entry.positionIds.size,
      createdAt: entry.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function applyExistingIndexationBatches(
  record: PositionRecord,
  allPositions: PositionRecord[],
): PositionRecord {
  const batches = collectIndexationBatchesFromPositions(allPositions);
  if (batches.length === 0) return record;
  const existingBatchIds = new Set(
    record.events
      .filter((event) => event.type === "INDEXATION" && typeof event.payload.indexationBatchId === "string")
      .map((event) => event.payload.indexationBatchId as string),
  );
  const missingBatches = batches
    .filter((batch) => !existingBatchIds.has(batch.id))
    .sort((a, b) => a.month - b.month || a.createdAt.localeCompare(b.createdAt));
  if (missingBatches.length === 0) return record;
  const extraEvents: PlannedEvent[] = missingBatches.map((batch, index) => ({
    id: crypto.randomUUID(),
    type: "INDEXATION",
    createdAt: batch.createdAt,
    createdOrder: record.events.length + index + 1,
    payload: {
      month: batch.month,
      percent: batch.percent,
      indexationBatchId: batch.id,
    },
  }));
  return applyEvents({ ...record, events: [...record.events, ...extraEvents] });
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

