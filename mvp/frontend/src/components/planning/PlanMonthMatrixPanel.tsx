import { useMemo } from "react";
import { MONTHS } from "../../types";
import type { PositionRecord } from "../../types";
import type { ViewMode } from "../../data/dashboardMetrics";
import { hasFactData } from "../../data/factStore";
import {
  buildPlanMonthCell,
  MATRIX_DEVIATION_LABEL,
  matrixMonthOccupancyLabel,
  type MatrixDeviation,
} from "../../data/planMonthMatrix";

export type PlanMonthMatrixPanelProps = {
  positions: PositionRecord[];
  viewMode: ViewMode;
  viewModeLabel: string;
  onOpenPosition: (positionId: string, month?: number) => void;
};

function formatMoneyShort(value: number): string {
  if (value === 0) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

function cellClass(deviation: MatrixDeviation): string {
  if (deviation === "closed") return "plan-matrix__cell plan-matrix__cell--closed";
  if (deviation === "none" || deviation === "no_fact_loaded") return "plan-matrix__cell";
  return `plan-matrix__cell plan-matrix__cell--${deviation}`;
}

export function PlanMonthMatrixPanel({
  positions,
  viewMode,
  viewModeLabel,
  onOpenPosition,
}: PlanMonthMatrixPanelProps) {
  const factReady = hasFactData();

  const rows = useMemo(
    () =>
      positions.map((position) => ({
        position,
        cells: MONTHS.map((_, month) => buildPlanMonthCell(position, month, viewMode)),
      })),
    [positions, viewMode],
  );

  return (
    <div className="plan-matrix-panel">
      <p className="plan-matrix-panel__legend muted-line">
        План на <strong>конец месяца</strong> · суммы: <strong>{viewModeLabel}</strong>
        {factReady
          ? " · факт только для отклонений (план из факта не меняется)"
          : " · факт не загружен — загрузите в «Данные»"}
        {" · сокращение: с месяца M — «Закрыта», план 0, без Δ"}
      </p>
      <div className="plan-matrix-scroll">
        <table className="plan-matrix">
          <thead>
            <tr>
              <th className="plan-matrix__sticky">Позиция</th>
              {MONTHS.map((label) => (
                <th key={label}>{label.slice(0, 3)}</th>
              ))}
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
                  const devLabel = MATRIX_DEVIATION_LABEL[cell.deviation];
                  const title = [
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
                    <td key={cell.month}>
                      <button
                        type="button"
                        className={cellClass(cell.deviation)}
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
