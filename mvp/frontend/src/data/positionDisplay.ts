import { MONTHS } from "../types";
import type { PositionRecord } from "../types";
import { POSITION_STATUS_LABELS } from "./planningData";

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
