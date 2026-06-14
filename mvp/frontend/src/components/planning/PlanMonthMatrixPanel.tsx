import { useMemo } from "react";
import { MONTHS } from "../../types";
import type { PositionRecord } from "../../types";
import type { ViewMode } from "../../data/dashboardMetrics";
import { hasFactData } from "../../data/factStore";
import { formatMoneyShort } from "../../data/formatDisplay";
import {
  isCorrectionMonthLocked,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import {
  buildPlanMonthCell,
  MATRIX_DEVIATION_LABEL,
  matrixMonthOccupancyLabel,
  type PlanMonthCell,
} from "../../data/planMonthMatrix";

export type PlanMonthMatrixPanelProps = {
  positions: PositionRecord[];
  viewMode: ViewMode;
  viewModeLabel: string;
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
  if (
    cell.deviation === "plan_fact_gap" ||
    cell.deviation === "fact_over_plan" ||
    cell.deviation === "multi_on_seat"
  ) {
    parts.push(`plan-matrix__cell--${cell.deviation}`);
  }
  return parts.join(" ");
}

export function PlanMonthMatrixPanel({
  positions,
  viewMode,
  viewModeLabel,
  correctionWindow = null,
  onOpenPosition,
}: PlanMonthMatrixPanelProps) {
  const factReady = hasFactData();
  const monthLocked = (month: number) =>
    correctionWindow != null && isCorrectionMonthLocked(month, correctionWindow);

  const rows = useMemo(
    () =>
      positions.map((position) => ({
        position,
        cells: MONTHS.map((_, month) => buildPlanMonthCell(position, month, viewMode, factReady)),
      })),
    [positions, viewMode, factReady],
  );

  return (
    <div className="plan-matrix-panel">
      <p className="plan-matrix-panel__legend muted-line">
        План на <strong>конец месяца</strong> · суммы: <strong>{viewModeLabel}</strong>
        {factReady
          ? " · факт только для отклонений (план из факта не меняется)"
          : " · факт не загружен — загрузите в «Данные»"}
        {correctionWindow?.enforced ? (
          <>
            {" · "}
            <strong>серые столбцы</strong> — до {correctionWindow.startMonthLabel}: только просмотр (
            {planEventMonthBlockedMessage(correctionWindow)})
          </>
        ) : (
          " · занятость: зелёный · вакансия · жёлтый · закрыта · розовый"
        )}
      </p>
      <div className="plan-matrix-scroll">
        <table className="plan-matrix">
          <thead>
            <tr>
              <th className="plan-matrix__sticky">Позиция</th>
              {MONTHS.map((label, month) => {
                const locked = monthLocked(month);
                return (
                  <th
                    key={label}
                    className={locked ? "plan-matrix__col--locked" : undefined}
                    title={locked ? `Месяц закрыт для корректировки (до ${correctionWindow?.startMonthLabel})` : undefined}
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
                    <strong>{position.positionId}</strong>
                    <span className="muted-line">{position.role}</span>
                  </button>
                </td>
                {cells.map((cell) => {
                  const locked = monthLocked(cell.month);
                  const devLabel = MATRIX_DEVIATION_LABEL[cell.deviation];
                  const title = [
                    locked ? `Месяц закрыт для корректировки (до ${correctionWindow?.startMonthLabel})` : null,
                    `План: ${cell.planStatus === "Closed" ? "закрыт" : cell.planStatus}`,
                    cell.planEmployeeName ? `· ${cell.planEmployeeName}` : "",
                    `· ${formatMoneyShort(cell.planAmount)}`,
                    factReady ? `Факт: ${formatMoneyShort(cell.factAmount)}` : "",
                    cell.deltaPlanMinusFact !== 0 && factReady
                      ? `Δ план−факт: ${formatMoneyShort(cell.deltaPlanMinusFact)}`
                      : "",
                    devLabel,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <td key={cell.month} className={locked ? "plan-matrix__td--locked" : undefined}>
                      <button
                        type="button"
                        className={cellClass(cell, locked)}
                        title={title}
                        onClick={() => onOpenPosition(position.positionId, cell.month)}
                      >
                        <span className="plan-matrix__occupancy">
                          {matrixMonthOccupancyLabel(position, cell.month)}
                        </span>
                        <span className="plan-matrix__plan-amt">{formatMoneyShort(cell.planAmount)}</span>
                        {factReady && cell.deviation !== "closed" ? (
                          <span className="plan-matrix__fact-amt">{formatMoneyShort(cell.factAmount)}</span>
                        ) : null}
                        {devLabel ? <span className="plan-matrix__flag">{devLabel}</span> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="muted-line">Нет позиций по фильтрам.</p> : null}
    </div>
  );
}
