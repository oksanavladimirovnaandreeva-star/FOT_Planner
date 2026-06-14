import {
  employeeHasPaymentInMonth,
  getFactEmployeeOnPosition,
  hasFactData,
  listFactEmployeeIds,
  listFactEmployeesOnPosition,
} from "./factStore";
import { monthLabel } from "./planningData";
import { planOccupancyAtMonth } from "./occupancyTimeline";
import type { PositionRecord } from "../types";

export type OccupancyMismatchKind =
  | "PLAN_VACANCY_FACT_OCCUPIED"
  | "PLAN_OCCUPIED_FACT_EMPTY"
  | "PLAN_OCCUPIED_FACT_OTHER_EMPLOYEE"
  | "MULTI_ON_SEAT"
  | "FACT_EMPLOYEE_NOT_ON_PLAN";

export const OCCUPANCY_MISMATCH_LABELS: Record<OccupancyMismatchKind, string> = {
  PLAN_VACANCY_FACT_OCCUPIED: "В плане вакансия, в факте есть сотрудник",
  PLAN_OCCUPIED_FACT_EMPTY: "В плане сотрудник, в факте нет выплат",
  PLAN_OCCUPIED_FACT_OTHER_EMPLOYEE: "В факте на позиции другой сотрудник",
  MULTI_ON_SEAT: "Двое и более на позиции в факте",
  FACT_EMPLOYEE_NOT_ON_PLAN: "Выплаты есть, в плане не на позиции",
};

export interface OccupancyMismatch {
  kind: OccupancyMismatchKind;
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  month: number;
  monthLabel: string;
  planEmployeeId: string | null;
  planEmployeeName: string | null;
  factEmployeeId: string | null;
  summary: string;
}

function isPlanVacantAtMonth(snapshot: ReturnType<typeof planOccupancyAtMonth>): boolean {
  return snapshot.status === "Vacancy" || snapshot.status === "Closed" || !snapshot.employeeId;
}

export function collectOccupancyMismatches(positions: PositionRecord[]): OccupancyMismatch[] {
  if (!hasFactData()) return [];

  const mismatches: OccupancyMismatch[] = [];
  const applied = positions;

  for (const position of applied) {
    if (position.status === "Closed") continue;
    const start = position.activeFromMonth;

    for (let month = start; month < 12; month += 1) {
      const plan = planOccupancyAtMonth(position, month);
      if (plan.status === "Closed") continue;

      const factFromAssignment = getFactEmployeeOnPosition(position.positionId, month);
      const factEmployeesOnSeat = listFactEmployeesOnPosition(position.positionId, month);
      const planEmployeeId = plan.employeeId;
      const factViaPlanEmployee =
        planEmployeeId && employeeHasPaymentInMonth(planEmployeeId, month) ? planEmployeeId : null;
      const factEmployeeId = factFromAssignment ?? factViaPlanEmployee;

      if (factEmployeesOnSeat.length >= 2) {
        mismatches.push({
          kind: "MULTI_ON_SEAT",
          positionId: position.positionId,
          role: position.role,
          department: position.department,
          unit: position.unit,
          team: position.team,
          month,
          monthLabel: monthLabel(month),
          planEmployeeId,
          planEmployeeName: plan.employeeName,
          factEmployeeId: factEmployeesOnSeat.join(", "),
          summary: `${position.positionId}: ${factEmployeesOnSeat.length} сотрудника в факте (${monthLabel(month)})`,
        });
        continue;
      }

      if (isPlanVacantAtMonth(plan) && factEmployeeId) {
        mismatches.push({
          kind: "PLAN_VACANCY_FACT_OCCUPIED",
          positionId: position.positionId,
          role: position.role,
          department: position.department,
          unit: position.unit,
          team: position.team,
          month,
          monthLabel: monthLabel(month),
          planEmployeeId: null,
          planEmployeeName: null,
          factEmployeeId,
          summary: `${position.positionId}: вакансия в плане, в факте ${factEmployeeId} (${monthLabel(month)})`,
        });
        continue;
      }

      if (!isPlanVacantAtMonth(plan) && planEmployeeId) {
        if (!employeeHasPaymentInMonth(planEmployeeId, month) && !factFromAssignment) {
          mismatches.push({
            kind: "PLAN_OCCUPIED_FACT_EMPTY",
            positionId: position.positionId,
            role: position.role,
            department: position.department,
            unit: position.unit,
            team: position.team,
            month,
            monthLabel: monthLabel(month),
            planEmployeeId,
            planEmployeeName: plan.employeeName,
            factEmployeeId: null,
            summary: `${position.positionId}: в плане ${planEmployeeId}, нет факта за ${monthLabel(month)}`,
          });
        } else if (factFromAssignment && factFromAssignment !== planEmployeeId) {
          mismatches.push({
            kind: "PLAN_OCCUPIED_FACT_OTHER_EMPLOYEE",
            positionId: position.positionId,
            role: position.role,
            department: position.department,
            unit: position.unit,
            team: position.team,
            month,
            monthLabel: monthLabel(month),
            planEmployeeId,
            planEmployeeName: plan.employeeName,
            factEmployeeId: factFromAssignment,
            summary: `${position.positionId}: план ${planEmployeeId}, факт на позиции ${factFromAssignment}`,
          });
        }
      }
    }
  }

  const planEmployeeMonths = new Set<string>();
  for (const position of applied) {
    for (let month = 0; month < 12; month += 1) {
      const plan = planOccupancyAtMonth(position, month);
      if (plan.employeeId) planEmployeeMonths.add(`${plan.employeeId}\0${month}`);
    }
  }

  for (const employeeId of listFactEmployeeIds()) {
    for (let month = 0; month < 12; month += 1) {
      if (!employeeHasPaymentInMonth(employeeId, month)) continue;
      if (planEmployeeMonths.has(`${employeeId}\0${month}`)) continue;
      mismatches.push({
        kind: "FACT_EMPLOYEE_NOT_ON_PLAN",
        positionId: "—",
        role: "—",
        department: "—",
        unit: "—",
        team: "—",
        month,
        monthLabel: monthLabel(month),
        planEmployeeId: null,
        planEmployeeName: null,
        factEmployeeId: employeeId,
        summary: `Сотрудник ${employeeId}: выплаты за ${monthLabel(month)}, в плане не занят ни на одной позиции`,
      });
    }
  }

  return mismatches;
}

export function mismatchesForPosition(
  mismatches: OccupancyMismatch[],
  positionId: string,
): OccupancyMismatch[] {
  return mismatches.filter((item) => item.positionId === positionId);
}
