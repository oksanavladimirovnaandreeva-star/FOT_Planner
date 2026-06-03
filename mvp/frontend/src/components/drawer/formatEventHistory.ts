import { LIMIT_FLAG_LABELS, monthLabel } from "../../data/planningData";
import type { PlannedEvent } from "../../types";

const EVENT_TYPE_LABEL: Record<string, string> = {
  MANUAL_OVERRIDE: "Ручная настройка",
  TRANSFER: "Перевод",
  TERMINATION_TO_VACANCY: "Увольнение → вакансия",
  CLOSE_POSITION: "Сокращение",
  PLANNED_HIRE: "Плановый найм",
  POSITION_CARRYOVER: "Перенос бюджета",
  INDEXATION: "Индексация",
};

export function formatEventHuman(event: PlannedEvent): string {
  const p = event.payload;
  const parts: string[] = [];
  const month = p.month !== undefined ? `с ${monthLabel(p.month)}` : "";

  if (typeof p.percent === "number") parts.push(`индексация ${p.percent}%`);
  if (typeof p.base === "number") parts.push(`оклад ${p.base.toLocaleString("ru-RU")} ₽`);
  if (typeof p.bonus === "number") parts.push(`премия ${p.bonus.toLocaleString("ru-RU")} ₽`);
  if (p.specialization) parts.push(p.specialization);
  if (p.level) parts.push(p.level);
  if (p.transferToPositionId) parts.push(`→ позиция ${p.transferToPositionId}`);
  if (p.targetDepartment) {
    const org = [p.targetDepartment, p.targetUnit, p.targetTeam].filter(Boolean).join(" / ");
    parts.push(`цель: ${org}`);
  }
  if (p.maternityMode === "SHARED_POSITION") {
    const primary = p.maternityPrimaryEmployeeName || p.maternityPrimaryEmployeeId || "основной";
    const repl =
      p.maternityReplacementKind === "VACANCY"
        ? "вакансия (замещение)"
        : p.employeeName || p.employeeId || "замещение";
    parts.push(`декрет: ${primary}, замещение: ${repl}`);
  } else if (p.employeeName) {
    parts.push(p.employeeName);
  }
  if (event.type === "POSITION_CARRYOVER") parts.push("перенос в план года");

  const body = parts.length ? parts.join(" · ") : "без деталей";
  return `${month ? month.charAt(0).toUpperCase() + month.slice(1) : "Год"}: ${body}`;
}

export function formatEventCommentPreview(comment: string, maxLength = 120): string {
  const trimmed = comment.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABEL[type] ?? type;
}

export function limitFlagShort(flag: keyof typeof LIMIT_FLAG_LABELS): string {
  return LIMIT_FLAG_LABELS[flag];
}
