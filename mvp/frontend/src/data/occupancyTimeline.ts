import { applyEvents, sortEventsForApply } from "./planningData";
import type { PlannedEvent, PositionRecord } from "../types";

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

/** Один проход по событиям — для сида факта. */
export function planOccupancyTimelineFast(record: PositionRecord): PlanOccupancySnapshot[] {
  const sorted = sortEventsForApply(record.events);
  const snapshots: PlanOccupancySnapshot[] = [];
  let end = 0;
  for (let month = 0; month < 12; month += 1) {
    while (end < sorted.length && sorted[end].payload.month <= month) {
      end += 1;
    }
    const simulated = applyEvents({ ...record, events: sorted.slice(0, end) });
    snapshots.push({
      status: simulated.status,
      employeeId: simulated.employeeId,
      employeeName: simulated.employeeName,
    });
  }
  return snapshots;
}

/** Активное событие декрета (SHARED_POSITION) на конец месяца M. */
export function activeMaternityEventAtMonth(record: PositionRecord, month: number): PlannedEvent | null {
  const capped = Math.max(0, Math.min(11, month));
  const candidates = record.events
    .filter(
      (event) =>
        event.type === "MANUAL_OVERRIDE" &&
        event.payload.maternityMode === "SHARED_POSITION" &&
        event.payload.month <= capped,
    )
    .sort((a, b) => b.payload.month - a.payload.month || b.createdOrder - a.createdOrder);
  return candidates[0] ?? null;
}

function shortenPersonName(name: string, compact: boolean): string {
  const trimmed = name.trim();
  if (!compact) return trimmed;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0)}.`;
  return trimmed.length > 12 ? `${trimmed.slice(0, 11)}…` : trimmed;
}

/** Подпись занятости на конец месяца с учётом декрета и замещения. */
export function formatSlotOccupancyAtMonth(record: PositionRecord, month: number, compact = false): string {
  const snap = planOccupancyAtMonth(record, month);
  if (snap.status === "Closed") return "Закрыта";

  const maternity = activeMaternityEventAtMonth(record, month);
  if (maternity) {
    const payload = maternity.payload;
    const primaryName =
      payload.maternityPrimaryEmployeeName || snap.employeeName || "Сотрудник";
    const primary = shortenPersonName(primaryName, compact);
    if (payload.maternityReplacementKind === "VACANCY") {
      return compact ? `${primary} + вак.` : `${primaryName} [декрет] + Вакансия`;
    }
    const replacementName = payload.employeeName || "Замещение";
    const replacement = shortenPersonName(replacementName, compact);
    return compact
      ? `${primary} + ${replacement}`
      : `${primaryName} [декрет] + ${replacementName}`;
  }

  return formatOccupancyMonthLabel(snap, compact);
}

/** CSS-модификатор ячейки таймлайна: occupied | vacancy | closed | maternity | maternity-vacancy */
export function occupancyTimelineCellTone(record: PositionRecord, month: number): string {
  const snap = planOccupancyAtMonth(record, month);
  if (snap.status === "Closed") return "closed";
  const maternity = activeMaternityEventAtMonth(record, month);
  if (maternity) {
    return maternity.payload.maternityReplacementKind === "VACANCY" ? "maternity-vacancy" : "maternity";
  }
  return snap.status.toLowerCase();
}

/** Подпись занятости на конец месяца (без «З» / «В»). */
export function formatOccupancyMonthLabel(snapshot: PlanOccupancySnapshot, compact = false): string {
  if (snapshot.status === "Closed") return "Закрыта";
  if (snapshot.status === "Vacancy" || !snapshot.employeeId) return "Вакансия";
  const name = snapshot.employeeName?.trim();
  if (!name) return "В штате";
  return shortenPersonName(name, compact);
}
