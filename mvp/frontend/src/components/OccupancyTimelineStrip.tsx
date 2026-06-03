import { MONTHS } from "../types";
import { formatOccupancyMonthLabel, type PlanOccupancySnapshot } from "../data/occupancyTimeline";
import type { OccupancyMismatch } from "../data/occupancyReconciliation";

type OccupancyTimelineStripProps = {
  timeline: PlanOccupancySnapshot[];
  activeFromMonth: number;
  mismatches?: OccupancyMismatch[];
  compact?: boolean;
};

export function OccupancyTimelineStrip({
  timeline,
  activeFromMonth,
  mismatches = [],
  compact = false,
}: OccupancyTimelineStripProps) {
  const mismatchMonths = new Set(mismatches.map((item) => item.month));

  return (
    <div className={`occupancy-timeline${compact ? " occupancy-timeline--compact" : ""}`}>
      <div className="occupancy-timeline__legend muted-line">
        <span>ФИО или «Вакансия» / «Закрыта» на конец месяца</span>
        <span className="occupancy-timeline__legend-warn">! — расхождение с фактом</span>
      </div>
      <div className="occupancy-timeline__months" role="list">
        {MONTHS.map((label, month) => {
          if (month < activeFromMonth) {
            return (
              <span key={label} className="occupancy-timeline__cell occupancy-timeline__cell--inactive" role="listitem">
                {compact ? label.slice(0, 1) : label.slice(0, 3)}
              </span>
            );
          }
          const snapshot = timeline[month];
          const warn = mismatchMonths.has(month);
          const caption = formatOccupancyMonthLabel(snapshot, compact);
          return (
            <span
              key={label}
              className={`occupancy-timeline__cell occupancy-timeline__cell--${snapshot.status.toLowerCase()}${warn ? " occupancy-timeline__cell--warn" : ""}`}
              role="listitem"
              title={
                snapshot.employeeName
                  ? `${label}: ${snapshot.employeeName} (${snapshot.employeeId})`
                  : `${label}: ${caption}`
              }
            >
              {compact ? (
                caption
              ) : (
                <>
                  <span className="occupancy-timeline__month">{label.slice(0, 3)}</span>
                  <span className="occupancy-timeline__label">{caption}</span>
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
