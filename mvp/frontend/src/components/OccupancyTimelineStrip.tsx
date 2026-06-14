import { MONTHS } from "../types";
import type { PositionRecord } from "../types";
import {
  formatSlotOccupancyAtMonth,
  occupancyTimelineCellTone,
} from "../data/occupancyTimeline";
import type { OccupancyMismatch } from "../data/occupancyReconciliation";

type OccupancyTimelineStripProps = {
  record: PositionRecord;
  activeFromMonth: number;
  mismatches?: OccupancyMismatch[];
  compact?: boolean;
  /** Нейтральные ячейки без цветных заливок */
  subtle?: boolean;
};

export function OccupancyTimelineStrip({
  record,
  activeFromMonth,
  mismatches = [],
  compact = false,
  subtle = false,
}: OccupancyTimelineStripProps) {
  const mismatchMonths = new Set(mismatches.map((item) => item.month));

  return (
    <div
      className={`occupancy-timeline${compact ? " occupancy-timeline--compact" : ""}${subtle ? " occupancy-timeline--subtle" : ""}`}
    >
      <div className="occupancy-timeline__months" role="list">
        {MONTHS.map((label, month) => {
          if (month < activeFromMonth) {
            return (
              <span key={label} className="occupancy-timeline__cell occupancy-timeline__cell--inactive" role="listitem">
                {compact ? label.slice(0, 1) : label.slice(0, 3)}
              </span>
            );
          }
          const tone = occupancyTimelineCellTone(record, month);
          const warn = mismatchMonths.has(month);
          const caption = formatSlotOccupancyAtMonth(record, month, compact);
          return (
            <span
              key={label}
              className={`occupancy-timeline__cell occupancy-timeline__cell--${tone}${warn ? " occupancy-timeline__cell--warn" : ""}`}
              role="listitem"
              title={`${label}: ${formatSlotOccupancyAtMonth(record, month)}`}
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
