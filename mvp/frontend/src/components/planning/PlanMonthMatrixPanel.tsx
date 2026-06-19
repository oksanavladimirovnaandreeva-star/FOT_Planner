import { useMemo } from "react";
import { MONTHS } from "../../types";
import type { PositionRecord } from "../../types";
import type { ViewMode } from "../../data/dashboardMetrics";
import { formatMoneyShort } from "../../data/formatDisplay";
import {
  isCorrectionMonthLocked,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import {
  buildPlanMonthCell,
  matrixMonthOccupancyLabel,
  type PlanMonthCell,
} from "../../data/planMonthMatrix";
import { PositionIdentityCell } from "./PositionIdentityCell";
import type { UserRole } from "../../data/userAccess";

export type PlanMonthMatrixPanelProps = {
  positions: PositionRecord[];
  viewMode: ViewMode;
  viewModeLabel: string;
  userRole: UserRole;
  correctionWindow?: CorrectionWindowInfo | null;
  onOpenPosition: (positionId: string, month?: number) => void;
};

function cellClass(cell: PlanMonthCell, monthLocked: boolean): string {
  const parts = ["plan-matrix__cell"];
  if (monthLocked) parts.push("plan-matrix__cell--month-locked");
  if (cell.planStatus === "Closed") {
    parts.push("plan-matrix__cell--status-closed");
  } else if (cell.planStatus === "Vacancy") {
    parts.push("plan-matrix__cell--status-vacancy");
  } else if (cell.planStatus === "Occupied") {
    parts.push("plan-matrix__cell--status-occupied");
  }
  return parts.join(" ");
}

export function PlanMonthMatrixPanel({
  positions,
  viewMode,
  viewModeLabel,
  userRole,
  correctionWindow = null,
  onOpenPosition,
}: PlanMonthMatrixPanelProps) {
  const monthLocked = (month: number) =>
    correctionWindow != null && isCorrectionMonthLocked(month, correctionWindow);

  const rows = useMemo(
    () =>
      positions.map((position) => ({
        position,
        cells: MONTHS.map((_, month) => buildPlanMonthCell(position, month, viewMode, false)),
      })),
    [positions, viewMode],
  );

  const monthTotals = useMemo(() => {
    return MONTHS.map((_, month) => {
      let sum = 0;
      let headcount = 0;
      for (const { cells } of rows) {
        const cell = cells[month]!;
        if (cell.planStatus === "Closed") continue;
        sum += cell.planAmount;
        headcount += 1;
      }
      return { sum, headcount };
    });
  }, [rows]);

  return (
    <div className="plan-matrix-panel">
      <p className="plan-matrix-panel__legend muted-line">
        План на <strong>конец месяца</strong> · <strong>{viewModeLabel}</strong>
        {correctionWindow?.enforced ? (
          <>
            {" · "}
            <strong>серые столбцы</strong> — только просмотр до {correctionWindow.startMonthLabel}
          </>
        ) : (
          " · зелёный — занято · жёлтый — вакансия · розовый — закрыто"
        )}
      </p>
      <div className="plan-matrix-scroll">
        <table className="plan-matrix">
          <thead>
            <tr>
              <th className="plan-matrix__sticky">Сотрудник / позиция</th>
              {MONTHS.map((label, month) => {
                const locked = monthLocked(month);
                return (
                  <th
                    key={label}
                    className={locked ? "plan-matrix__col--locked" : undefined}
                    data-hint={locked ? `Месяц закрыт для правок (до ${correctionWindow?.startMonthLabel})` : undefined}
                  >
                    {label.slice(0, 3)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ position, cells }) => (
              <tr key={position.positionId}>
                <td className="plan-matrix__sticky">
                  <button
                    type="button"
                    className="plan-matrix__pos-btn"
                    onClick={() => onOpenPosition(position.positionId)}
                  >
                    <PositionIdentityCell record={position} userRole={userRole} compact />
                  </button>
                </td>
                {cells.map((cell) => {
                  const locked = monthLocked(cell.month);
                  const title = [
                    locked ? `Месяц закрыт (до ${correctionWindow?.startMonthLabel})` : null,
                    cell.planEmployeeName ? cell.planEmployeeName : null,
                    formatMoneyShort(cell.planAmount),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <td key={cell.month} className={locked ? "plan-matrix__td--locked" : undefined}>
                      <button
                        type="button"
                        className={cellClass(cell, locked)}
                        data-hint={title}
                        onClick={() => onOpenPosition(position.positionId, cell.month)}
                      >
                        <span className="plan-matrix__occupancy">
                          {matrixMonthOccupancyLabel(position, cell.month)}
                        </span>
                        <span className="plan-matrix__plan-amt">{formatMoneyShort(cell.planAmount)}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="plan-matrix__totals">
                <td className="plan-matrix__sticky">
                  <strong>Итого</strong>
                </td>
                {monthTotals.map((total, month) => (
                  <td key={month}>
                    <div className="plan-matrix__total-sum">{formatMoneyShort(total.sum)}</div>
                    <div className="muted-line plan-matrix__total-hc">{total.headcount} чел.</div>
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {rows.length === 0 ? <p className="muted-line">Нет позиций по фильтрам.</p> : null}
    </div>
  );
}
