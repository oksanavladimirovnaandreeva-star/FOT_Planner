import {
  applyEventsUntil,
  monthLabel,
  POSITION_STATUS_LABELS,
  sortEventsForApply,
} from "./planningData";
import type { EventType, PlannedEvent, PositionRecord } from "../types";
import { eventTypeLabel } from "./eventLabels";
import { isMultiSelectNone } from "./multiSelectFilter";

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

/** Служебные события — не показываем в журнале и истории drawer. */
const JOURNAL_HIDDEN_EVENT_TYPES = new Set<EventType>(["INDEXATION", "POSITION_CARRYOVER"]);

/** В drawer не показываем массовую индексацию и служебный перенос с прошлого года. */
const DRAWER_HIDDEN_EVENT_TYPES = JOURNAL_HIDDEN_EVENT_TYPES;

export function eventsForDrawerHistory(events: PlannedEvent[]): PlannedEvent[] {
  return sortEventsForApply(events).filter(
    (event) => TABLE_EVENT_TYPES.has(event.type) && !DRAWER_HIDDEN_EVENT_TYPES.has(event.type),
  );
}

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
  if (status === "Occupied") return "table-row--occupied";
  return "";
}

/** Цвет строки: вакансия с плановым наймом остаётся жёлтой до фактического занятия слота. */
export function tableRowStatusForDisplay(record: PositionRecord): PositionRecord["status"] {
  if (record.seedStatus === "Vacancy" && record.seedEmployeeId == null) {
    if (record.status === "Vacancy") return "Vacancy";
    if (record.events.some((event) => event.type === "PLANNED_HIRE")) return "Vacancy";
  }
  return record.status;
}

export function positionTableRowClass(
  record: PositionRecord,
  extraClasses?: string,
): string {
  const parts = ["positions-table__row", tableRowStatusClass(tableRowStatusForDisplay(record))];
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

/** В drawer — только ФИО, без технического ID. */
export function eventEmployeeNameForDrawer(event: PlannedEvent, position: PositionRecord): string | null {
  return event.payload.employeeName?.trim() || position.employeeName?.trim() || null;
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
    typeLabel: eventTypeLabel(event),
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

export function gradeProfileLabel(spec: string, level: string): string {
  const safeSpec = spec.trim();
  const safeLevel = level.trim();
  if (!safeSpec && !safeLevel) return "—";
  if (!safeSpec) return safeLevel;
  if (!safeLevel) return safeSpec;
  return `${safeSpec}/${safeLevel}`;
}

export function gradeChanged(
  change: Pick<EventChangeSummary, "specBefore" | "specAfter" | "levelBefore" | "levelAfter">,
): boolean {
  return change.specBefore !== change.specAfter || change.levelBefore !== change.levelAfter;
}

export function salaryChanged(change: Pick<EventChangeSummary, "baseBefore" | "baseAfter">): boolean {
  return change.baseBefore !== change.baseAfter;
}

export function formatSalaryChangeRange(change: Pick<EventChangeSummary, "baseBefore" | "baseAfter">): string {
  return `${change.baseBefore.toLocaleString("ru-RU")} → ${change.baseAfter.toLocaleString("ru-RU")} ₽`;
}

export function formatGradeChangeRange(
  change: Pick<EventChangeSummary, "specBefore" | "specAfter" | "levelBefore" | "levelAfter">,
): string {
  return `${gradeProfileLabel(change.specBefore, change.levelBefore)} → ${gradeProfileLabel(change.specAfter, change.levelAfter)}`;
}

/** Январь → декабрь в таблице позиций (как оклад «дек → дек»). */
export function positionGradeYearRange(record: PositionRecord): {
  before: string;
  after: string;
  changed: boolean;
} {
  const before = gradeProfileLabel(record.monthlySpec[0] ?? "", record.monthlyLevel[0] ?? "");
  const after = gradeProfileLabel(record.monthlySpec[11] ?? "", record.monthlyLevel[11] ?? "");
  return { before, after, changed: before !== after };
}

export function formatApprovalJournalSummary(row: {
  isNewPosition: boolean;
  fotDeltaAnnual: number;
  change: EventChangeSummary;
  typeLabel: string;
}): { title: string; detail: string } {
  if (row.isNewPosition) {
    const fot = Math.round(row.fotDeltaAnnual).toLocaleString("ru-RU");
    return {
      title: "Новая позиция",
      detail: fotDeltaAnnualNonZero(row.fotDeltaAnnual) ? `ФОТ ${fot} ₽/год` : "плановый найм",
    };
  }

  const details: string[] = [];
  if (row.change.statusBefore !== row.change.statusAfter) {
    details.push(`${row.change.statusBefore} → ${row.change.statusAfter}`);
  }
  if (salaryChanged(row.change)) {
    details.push(formatSalaryChangeRange(row.change));
  }
  if (gradeChanged(row.change)) {
    details.push(formatGradeChangeRange(row.change));
  }

  return {
    title: row.typeLabel,
    detail: details.length > 0 ? details.join(" · ") : "без изменения ФОТ и грейда",
  };
}

function fotDeltaAnnualNonZero(value: number): boolean {
  return Math.abs(value) >= 1;
}

/** Было → стало без месяца (месяц — в отдельной колонке). */
export function formatEventChangeLine(change: EventChangeSummary): string {
  const parts: string[] = [];
  if (change.statusBefore !== change.statusAfter) {
    parts.push(`${change.statusBefore} → ${change.statusAfter}`);
  }
  if (salaryChanged(change)) {
    parts.push(formatSalaryChangeRange(change));
  }
  if (gradeChanged(change)) {
    parts.push(formatGradeChangeRange(change));
  }
  return parts.length > 0 ? parts.join(" · ") : "без изменения ФОТ и грейда";
}

export function collectPlanEventJournalRows(positions: PositionRecord[]): PlanEventJournalRow[] {
  const rows: PlanEventJournalRow[] = [];
  for (const position of positions) {
    for (const event of sortEventsForApply(position.events)) {
      if (!TABLE_EVENT_TYPES.has(event.type)) continue;
      if (JOURNAL_HIDDEN_EVENT_TYPES.has(event.type)) continue;
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
        typeLabel: eventTypeLabel(event),
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
  { value: "MANUAL_OVERRIDE", label: "Пересмотр" },
  { value: "TARGET_SALARY", label: "Пересмотр" },
  { value: "CLASSIFICATION_CHANGE", label: "Смена грейда" },
  { value: "POSITION_CARRYOVER", label: "Перенос бюджета" },
];

/** Группы для фильтра журнала (один пункт «Пересмотр» на оба типа события). */
export const JOURNAL_EVENT_TYPE_FILTERS: { id: string; label: string; types: EventType[] }[] = [
  { id: "TRANSFER", label: "Перевод", types: ["TRANSFER"] },
  { id: "PLANNED_HIRE", label: "Плановый найм", types: ["PLANNED_HIRE"] },
  { id: "TERMINATION_TO_VACANCY", label: "Увольнение", types: ["TERMINATION_TO_VACANCY"] },
  { id: "CLOSE_POSITION", label: "Сокращение", types: ["CLOSE_POSITION"] },
  { id: "INDEXATION", label: "Индексация", types: ["INDEXATION"] },
  { id: "REVIEW", label: "Пересмотр", types: ["MANUAL_OVERRIDE", "TARGET_SALARY"] },
  { id: "CLASSIFICATION_CHANGE", label: "Смена грейда", types: ["CLASSIFICATION_CHANGE"] },
];

export function journalEventMatchesTypeFilter(eventType: EventType, selectedFilterIds: string[]): boolean {
  if (isMultiSelectNone(selectedFilterIds)) return false;
  if (selectedFilterIds.length === 0) return true;
  return JOURNAL_EVENT_TYPE_FILTERS.some(
    (group) => selectedFilterIds.includes(group.id) && group.types.includes(eventType),
  );
}
