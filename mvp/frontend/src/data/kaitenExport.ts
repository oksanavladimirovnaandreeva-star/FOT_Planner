import { appendExportAuditLog } from "./exportAuditLog";
import { eventTypeLabel } from "./eventLabels";
import { summarizeEventChange } from "./eventJournal";
import {
  applyEvents,
  applyEventsUntil,
  LIMIT_FLAG_LABELS,
  monthLabel,
  POSITION_STATUS_LABELS,
} from "./planningData";
import type { UserRole } from "./userAccess";
import type { EventType, PlannedEvent, PositionRecord } from "../types";

export type KaitenRequestType = "hire" | "otiz";

export type KaitenExportField = {
  key: string;
  label: string;
  value: string;
};

export type KaitenExportPayload = {
  requestType: KaitenRequestType;
  generatedAt: string;
  planVersionId: string;
  planYear: number;
  positionId: string;
  eventId: string | null;
  fields: Record<string, string>;
};

const HIRE_EVENT_TYPES = new Set<EventType>(["PLANNED_HIRE"]);
const OTIZ_EVENT_TYPES = new Set<EventType>(["CLOSE_POSITION", "TERMINATION_TO_VACANCY", "CANCEL_VACANCY"]);

export function kaitenTypeForEventType(type: EventType): KaitenRequestType | null {
  if (HIRE_EVENT_TYPES.has(type)) return "hire";
  if (OTIZ_EVENT_TYPES.has(type)) return "otiz";
  return null;
}

export function journalEventKaitenEligible(type: EventType): boolean {
  return kaitenTypeForEventType(type) != null;
}

export function availableKaitenTypesForPosition(position: PositionRecord): KaitenRequestType[] {
  const types = new Set<KaitenRequestType>();
  if (position.status === "Vacancy" || position.events.some((event) => event.type === "PLANNED_HIRE")) {
    types.add("hire");
  }
  if (
    position.status === "Closed" ||
    position.events.some((event) => OTIZ_EVENT_TYPES.has(event.type))
  ) {
    types.add("otiz");
  }
  return [...types];
}

export function positionKaitenEligible(position: PositionRecord): boolean {
  return availableKaitenTypesForPosition(position).length > 0;
}

export function defaultKaitenTypeForPosition(position: PositionRecord): KaitenRequestType | null {
  const types = availableKaitenTypesForPosition(position);
  if (types.length === 0) return null;
  if (types.length === 1) return types[0];
  if (position.status === "Vacancy") return "hire";
  if (position.status === "Closed") return "otiz";
  return types[0];
}

function pickHireEvent(position: PositionRecord, event?: PlannedEvent): PlannedEvent | null {
  if (event?.type === "PLANNED_HIRE") return event;
  const hires = position.events.filter((item) => item.type === "PLANNED_HIRE");
  if (hires.length === 0) return null;
  return [...hires].sort((a, b) => a.payload.month - b.payload.month)[0];
}

function pickOtizEvent(position: PositionRecord, event?: PlannedEvent): PlannedEvent | null {
  if (event && OTIZ_EVENT_TYPES.has(event.type)) return event;
  const candidates = position.events.filter((item) => OTIZ_EVENT_TYPES.has(item.type));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.payload.month - a.payload.month || b.createdOrder - a.createdOrder)[0];
}

function hireMonth(position: PositionRecord, hireEvent: PlannedEvent | null): number {
  if (hireEvent) return Math.max(0, Math.min(11, hireEvent.payload.month));
  if (position.vacancySinceMonth != null) return position.vacancySinceMonth;
  return Math.max(0, Math.min(11, position.activeFromMonth));
}

function otizReason(event: PlannedEvent | null): string {
  if (!event) return "Сокращение / закрытие позиции";
  const label = eventTypeLabel(event);
  const comment = event.payload.comment?.trim();
  return comment ? `${label}: ${comment}` : label;
}

export function buildKaitenExportFields(options: {
  position: PositionRecord;
  planYear: number;
  requestType: KaitenRequestType;
  event?: PlannedEvent;
}): KaitenExportField[] {
  const { position, planYear, requestType, event } = options;

  if (requestType === "hire") {
    const hireEvent = pickHireEvent(position, event);
    const month = hireMonth(position, hireEvent);
    const applied = hireEvent ? applyEventsUntil(position, hireEvent.id, true) : applyEvents(position);
    const spec = applied.monthlySpec[month] ?? applied.monthlySpec[11] ?? "";
    const level = applied.monthlyLevel[month] ?? applied.monthlyLevel[11] ?? "";
    const base = applied.monthlyBase[month] ?? 0;
    const bonus = applied.monthlyBonus[month] ?? 0;
    return [
      { key: "position_id", label: "Позиция", value: position.positionId },
      { key: "role", label: "Роль", value: position.role },
      { key: "department", label: "Департамент", value: position.department },
      { key: "unit", label: "Юнит", value: position.unit },
      { key: "team", label: "Команда", value: position.team },
      { key: "limit_flag", label: "Лимит", value: LIMIT_FLAG_LABELS[position.limitFlag] },
      { key: "specialization", label: "Специализация", value: spec },
      { key: "level", label: "Уровень", value: level },
      { key: "base_salary", label: "Оклад", value: `${base.toLocaleString("ru-RU")} ₽` },
      { key: "bonus", label: "Премия", value: `${bonus.toLocaleString("ru-RU")} ₽` },
      {
        key: "start_month",
        label: "Месяц выхода",
        value: `${monthLabel(month)} ${planYear}`,
      },
    ];
  }

  const otizEvent = pickOtizEvent(position, event);
  const month = otizEvent
    ? Math.max(0, Math.min(11, otizEvent.payload.month))
    : position.status === "Closed"
      ? Math.max(0, Math.min(11, position.activeFromMonth))
      : 0;
  const change = otizEvent ? summarizeEventChange(position, otizEvent) : null;
  const statusBefore = change?.statusBefore ?? POSITION_STATUS_LABELS[position.seedStatus];
  const statusAfter =
    change?.statusAfter ??
    (position.status === "Closed" ? POSITION_STATUS_LABELS.Closed : POSITION_STATUS_LABELS[position.status]);
  const employee =
    otizEvent?.payload.employeeName?.trim() ||
    (position.employeeName ? `${position.employeeName}${position.employeeId ? ` (${position.employeeId})` : ""}` : "—");

  return [
    { key: "position_id", label: "Позиция", value: position.positionId },
    { key: "role", label: "Роль", value: position.role },
    { key: "department", label: "Департамент", value: position.department },
    { key: "unit", label: "Юнит", value: position.unit },
    { key: "team", label: "Команда", value: position.team },
    { key: "month", label: "Месяц изменения", value: `${monthLabel(month)} ${planYear}` },
    { key: "reason", label: "Причина", value: otizReason(otizEvent) },
    { key: "headcount_before", label: "Было", value: statusBefore },
    { key: "headcount_after", label: "Стало", value: statusAfter },
    { key: "employee", label: "Сотрудник", value: employee },
  ];
}

export function buildKaitenExportPayload(options: {
  position: PositionRecord;
  planVersionId: string;
  planYear: number;
  requestType: KaitenRequestType;
  event?: PlannedEvent;
}): KaitenExportPayload {
  const fields = buildKaitenExportFields(options);
  return {
    requestType: options.requestType,
    generatedAt: new Date().toISOString(),
    planVersionId: options.planVersionId,
    planYear: options.planYear,
    positionId: options.position.positionId,
    eventId: options.event?.id ?? null,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.value])),
  };
}

export function kaitenExportFilename(requestType: KaitenRequestType, positionId: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const kind = requestType === "hire" ? "hire" : "otiz";
  return `kaiten-${kind}-${positionId}-${stamp}.json`;
}

export function serializeKaitenPayload(payload: KaitenExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function downloadKaitenJson(payload: KaitenExportPayload): void {
  const blob = new Blob([serializeKaitenPayload(payload)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = kaitenExportFilename(payload.requestType, payload.positionId);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function runKaitenExport(options: {
  position: PositionRecord;
  planVersionId: string;
  planYear: number;
  requestType: KaitenRequestType;
  userRole: UserRole;
  event?: PlannedEvent;
  scopeLabel?: string;
}): KaitenExportPayload {
  const payload = buildKaitenExportPayload(options);
  downloadKaitenJson(payload);
  appendExportAuditLog({
    userRole: options.userRole,
    format: options.requestType === "hire" ? "kaiten_hire" : "kaiten_otiz",
    rowCount: 1,
    scopeHash: options.position.positionId,
    planVersionId: options.planVersionId,
    scopeLabel: options.scopeLabel ?? options.position.positionId,
  });
  return payload;
}

export const KAITEN_REQUEST_TYPE_LABEL: Record<KaitenRequestType, string> = {
  hire: "Найм",
  otiz: "Изменение в ОТиЗ",
};

const KAITEN_NUDGE_DISMISSED_KEY = "mvp.kaitenNudgeDismissed";

/** Тип nudge после сохранения события в drawer. */
export function kaitenNudgeForEventType(type: EventType): KaitenRequestType | null {
  if (type === "PLANNED_HIRE") return "hire";
  if (type === "CLOSE_POSITION" || type === "TERMINATION_TO_VACANCY") return "otiz";
  return null;
}

function readDismissedNudgeIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(KAITEN_NUDGE_DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissedNudgeIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(KAITEN_NUDGE_DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function isKaitenNudgeDismissed(eventId: string): boolean {
  return readDismissedNudgeIds().has(eventId);
}

export function dismissKaitenNudge(eventId: string): void {
  const ids = readDismissedNudgeIds();
  ids.add(eventId);
  writeDismissedNudgeIds(ids);
}
