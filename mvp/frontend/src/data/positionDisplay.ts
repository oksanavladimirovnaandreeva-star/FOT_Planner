import { MONTHS } from "../types";
import type { PositionRecord } from "../types";
import { POSITION_STATUS_LABELS } from "./planningData";
import type { UserRole } from "./userAccess";

/** Подпись «даты приёма» для UI: месяц первого PLANNED_HIRE или activeFromMonth. */
export function formatPositionHireLabel(record: PositionRecord, planYear: number): string {
  const hireEvent = [...record.events]
    .filter((event) => event.type === "PLANNED_HIRE")
    .sort((a, b) => a.payload.month - b.payload.month)[0];
  const month = hireEvent?.payload.month ?? record.activeFromMonth;
  const safeMonth = Math.max(0, Math.min(11, month));
  if (record.status === "Vacancy") {
    return record.vacancySinceMonth != null
      ? `Вакансия с ${MONTHS[record.vacancySinceMonth]} ${planYear}`
      : `С ${MONTHS[safeMonth]} ${planYear}`;
  }
  if (record.status === "Closed") {
    return "Позиция закрыта";
  }
  return `${MONTHS[safeMonth]} ${planYear}`;
}

export function employeeDisplayLine(record: PositionRecord): string {
  if (record.status === "Occupied" && record.employeeName) {
    return record.employeeId ? `${record.employeeName} (${record.employeeId})` : record.employeeName;
  }
  return POSITION_STATUS_LABELS[record.status];
}

function maternityEmployeeLabel(record: PositionRecord): string | null {
  const maternityEvent = [...record.events]
    .filter((event) => event.type === "MANUAL_OVERRIDE" && event.payload.maternityMode === "SHARED_POSITION")
    .sort((a, b) => b.createdOrder - a.createdOrder)[0];
  if (!maternityEvent) return null;
  const primaryName = maternityEvent.payload.maternityPrimaryEmployeeName || record.employeeName || "Сотрудник";
  const primaryId = maternityEvent.payload.maternityPrimaryEmployeeId || record.employeeId || "—";
  const replacementLabel =
    maternityEvent.payload.maternityReplacementKind === "VACANCY"
      ? "Вакансия (замещение)"
      : `${maternityEvent.payload.employeeName || "Замещение"} (${maternityEvent.payload.employeeId || "—"})`;
  return `${primaryName} (${primaryId}) [декрет] + ${replacementLabel}`;
}

/** Первая строка ячейки: только ФИО (статус — отдельно в UI). */
export function positionEmployeePrimaryName(record: PositionRecord): string {
  const maternity = maternityEmployeeLabel(record);
  if (maternity) return maternity;
  if (record.status === "Occupied" && record.employeeName) {
    return record.employeeName;
  }
  return "";
}

/** Вторая строка: org по уровню доступа + (position_id). */
export function formatPositionOrgLine(record: PositionRecord, role: UserRole): string {
  const parts: string[] = [];
  if (role === "admin" || role === "viewer") {
    parts.push(record.department, record.unit);
  } else if (role === "director") {
    parts.push(record.unit);
  }
  if (record.team) parts.push(record.team);
  const org = parts.filter(Boolean).join(" / ");
  return org ? `${org} (${record.positionId})` : `(${record.positionId})`;
}

/** CR как коэффициент (1.00 = midpoint), не проценты. */
export function formatCrCoefficient(cr: number): string {
  return cr > 0 ? cr.toFixed(2) : "—";
}
