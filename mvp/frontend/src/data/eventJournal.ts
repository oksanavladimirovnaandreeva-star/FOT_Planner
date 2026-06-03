import {
  applyEventsUntil,
  monthLabel,
  POSITION_STATUS_LABELS,
  sortEventsForApply,
} from "./planningData";
import type { EventType, PlannedEvent, PositionRecord } from "../types";
import { eventTypeLabel } from "../components/drawer/formatEventHistory";

const TABLE_EVENT_TYPES = new Set<EventType>([
  "INDEXATION",
  "MANUAL_OVERRIDE",
  "TARGET_SALARY",
  "CLASSIFICATION_CHANGE",
  "TERMINATION_TO_VACANCY",
  "TERMINATION",
  "CLOSE_POSITION",
  "PLANNED_HIRE",
  "TRANSFER",
  "POSITION_CARRYOVER",
  "CANCEL_VACANCY",
]);

export type EventChangeSummary = {
  month: number;
  monthLabel: string;
  statusBefore: string;
  statusAfter: string;
  baseBefore: number;
  baseAfter: number;
  specBefore: string;
  specAfter: string;
  levelBefore: string;
  levelAfter: string;
};

export type PositionEventSummary = {
  event: PlannedEvent;
  typeLabel: string;
  employeeLine: string | null;
  change: EventChangeSummary;
  commentTooltip: string | null;
};

export type PlanEventJournalRow = {
  event: PlannedEvent;
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  limitFlag: PositionRecord["limitFlag"];
  statusAfter: PositionRecord["status"];
  employeeLine: string | null;
  typeLabel: string;
  change: EventChangeSummary;
  comment: string | null;
  commentTooltip: string | null;
  createdAt: string;
};

export function tableRowStatusClass(status: PositionRecord["status"]): string {
  if (status === "Vacancy") return "table-row--vacancy";
  if (status === "Closed") return "table-row--closed";
  return "";
}

export function positionTableRowClass(
  status: PositionRecord["status"],
  extraClasses?: string,
): string {
  const parts = ["positions-table__row", tableRowStatusClass(status)];
  if (extraClasses) parts.push(extraClasses);
  return parts.filter(Boolean).join(" ");
}

export function eventEmployeeLine(event: PlannedEvent, position: PositionRecord): string | null {
  const name = event.payload.employeeName?.trim();
  const id = event.payload.employeeId?.trim();
  if (name && id) return `${name} (${id})`;
  if (name) return name;
  if (id) return id;
  if (position.employeeName) {
    return position.employeeId ? `${position.employeeName} (${position.employeeId})` : position.employeeName;
  }
  return null;
}

export function eventCommentTooltip(event: PlannedEvent): string | null {
  const comment = event.payload.comment?.trim();
  if (!comment) return null;
  if (comment.length <= 120) return comment;
  return `${comment.slice(0, 117)}…`;
}

export function summarizeEventChange(position: PositionRecord, event: PlannedEvent): EventChangeSummary {
  const month = Math.max(0, Math.min(11, event.payload.month));
  const before = applyEventsUntil(position, event.id, false);
  const after = applyEventsUntil(position, event.id, true);
  return {
    month,
    monthLabel: monthLabel(month),
    statusBefore: POSITION_STATUS_LABELS[before.status],
    statusAfter: POSITION_STATUS_LABELS[after.status],
    baseBefore: before.monthlyBase[month] ?? 0,
    baseAfter: after.monthlyBase[month] ?? 0,
    specBefore: before.monthlySpec[month] ?? "",
    specAfter: after.monthlySpec[month] ?? "",
    levelBefore: before.monthlyLevel[month] ?? "",
    levelAfter: after.monthlyLevel[month] ?? "",
  };
}

export function summarizeLatestPositionEvent(position: PositionRecord): PositionEventSummary | null {
  const candidates = position.events.filter((event) => TABLE_EVENT_TYPES.has(event.type));
  if (candidates.length === 0) return null;
  const event = [...candidates].sort((a, b) => {
    if (a.payload.month !== b.payload.month) return b.payload.month - a.payload.month;
    return b.createdOrder - a.createdOrder;
  })[0];
  return {
    event,
    typeLabel: eventTypeLabel(event.type),
    employeeLine: eventEmployeeLine(event, position),
    change: summarizeEventChange(position, event),
    commentTooltip: eventCommentTooltip(event),
  };
}

/** Одна строка для таблицы планирования (без дубля drawer). */
export function formatEventTableCompact(summary: PositionEventSummary): string {
  const hasComment = Boolean(summary.event.payload.comment?.trim());
  const commentMark = hasComment ? " · комментарий" : "";
  return `${summary.typeLabel} · с ${summary.change.monthLabel}${commentMark}`;
}

export function formatEventChangeLine(change: EventChangeSummary): string {
  const parts: string[] = [`с ${change.monthLabel}`];
  if (change.statusBefore !== change.statusAfter) {
    parts.push(`${change.statusBefore} → ${change.statusAfter}`);
  }
  if (change.baseBefore !== change.baseAfter) {
    parts.push(
      `${change.baseBefore.toLocaleString("ru-RU")} → ${change.baseAfter.toLocaleString("ru-RU")} ₽`,
    );
  } else if (change.specBefore !== change.specAfter || change.levelBefore !== change.levelAfter) {
    parts.push(`${change.specBefore}/${change.levelBefore} → ${change.specAfter}/${change.levelAfter}`);
  }
  return parts.join(" · ");
}

export function collectPlanEventJournalRows(positions: PositionRecord[]): PlanEventJournalRow[] {
  const rows: PlanEventJournalRow[] = [];
  for (const position of positions) {
    for (const event of sortEventsForApply(position.events)) {
      if (!TABLE_EVENT_TYPES.has(event.type)) continue;
      const change = summarizeEventChange(position, event);
      rows.push({
        event,
        positionId: position.positionId,
        role: position.role,
        department: position.department,
        unit: position.unit,
        team: position.team,
        limitFlag: position.limitFlag,
        statusAfter: applyEventsUntil(position, event.id, true).status,
        employeeLine: eventEmployeeLine(event, position),
        typeLabel: eventTypeLabel(event.type),
        change,
        comment: event.payload.comment?.trim() || null,
        commentTooltip: eventCommentTooltip(event),
        createdAt: event.createdAt,
      });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.event.createdOrder - a.event.createdOrder);
}

export const JOURNAL_EVENT_TYPE_OPTIONS: { value: EventType | "All"; label: string }[] = [
  { value: "All", label: "Все типы" },
  { value: "TRANSFER", label: "Перевод" },
  { value: "PLANNED_HIRE", label: "Плановый найм" },
  { value: "TERMINATION_TO_VACANCY", label: "Увольнение" },
  { value: "CLOSE_POSITION", label: "Сокращение" },
  { value: "INDEXATION", label: "Индексация" },
  { value: "MANUAL_OVERRIDE", label: "Ручная настройка" },
  { value: "CLASSIFICATION_CHANGE", label: "Смена грейда" },
  { value: "POSITION_CARRYOVER", label: "Перенос бюджета" },
];
