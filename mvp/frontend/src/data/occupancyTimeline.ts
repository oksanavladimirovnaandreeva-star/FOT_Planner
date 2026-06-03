import { applyEvents } from "./planningData";
import type { PositionRecord } from "../types";

export type PlanOccupancySnapshot = {
  status: PositionRecord["status"];
  employeeId: string | null;
  employeeName: string | null;
};

/** Плановая занятость позиции на конец месяца (события с month ≤ M). */
export function planOccupancyAtMonth(record: PositionRecord, month: number): PlanOccupancySnapshot {
  const capped = Math.max(0, Math.min(11, month));
  const eventsThroughMonth = record.events.filter((event) => event.payload.month <= capped);
  const simulated = applyEvents({ ...record, events: eventsThroughMonth });
  return {
    status: simulated.status,
    employeeId: simulated.employeeId,
    employeeName: simulated.employeeName,
  };
}

/** Позиция закрыта в плане на конец месяца (сокращение с month ≤ M). */
export function isPlanClosedAtMonth(record: PositionRecord, month: number): boolean {
  return planOccupancyAtMonth(record, month).status === "Closed";
}

export function planOccupancyTimeline(record: PositionRecord): PlanOccupancySnapshot[] {
  return Array.from({ length: 12 }, (_, month) => planOccupancyAtMonth(record, month));
}

/** Подпись занятости на конец месяца (без «З» / «В»). */
export function formatOccupancyMonthLabel(snapshot: PlanOccupancySnapshot, compact = false): string {
  if (snapshot.status === "Closed") return "Закрыта";
  if (snapshot.status === "Vacancy" || !snapshot.employeeId) return "Вакансия";
  const name = snapshot.employeeName?.trim();
  if (!name) return "Занято";
  if (!compact) return name;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0)}.`;
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}
