import { useMemo } from "react";
import { type LimitPlanFact } from "../data/dashboardMetrics";
import { LIMIT_FLAG_LABELS, monthLabel } from "../data/planningData";
import type { LimitFlagKey } from "../types";
const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

const COLORS: Record<LimitFlagKey, string> = {
  IN_LIMIT: "#3b82f6",
  OVER_LIMIT: "#f59e0b",
  UNLIMITED: "#94a3b8",
};

type MonthRow = {
  month: number;
  label: string;
  byLimit: Record<LimitFlagKey, LimitPlanFact>;
};

function pct(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${(value / max) * 100}%`;
}

function formatAxisRub(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

function conicGradient(segments: { value: number; color: string }[]): string {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return "#e5e7eb";
  let cursor = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const share = (seg.value / total) * 100;
    const end = cursor + share;
    stops.push(`${seg.color} ${cursor}% ${end}%`);
    cursor = end;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export function PlanFactMonthlyChart({
  monthlyByLimit,
  hasFactData,
}: {
  monthlyByLimit: MonthRow[];
  hasFactData: boolean;
}) {
  const { maxValue, yTicks } = useMemo(() => {
    let max = 1;
    for (const row of monthlyByLimit) {
      const plan =
        row.byLimit.IN_LIMIT.plan + row.byLimit.OVER_LIMIT.plan + row.byLimit.UNLIMITED.plan;
      const fact =
        row.byLimit.IN_LIMIT.fact + row.byLimit.OVER_LIMIT.fact + row.byLimit.UNLIMITED.fact;
      max = Math.max(max, plan, hasFactData ? fact : 0);
    }
    const step = max / 4;
    const ticks = [max, max - step, max - step * 2, max - step * 3, 0];
    return { maxValue: max, yTicks: ticks };
  }, [monthlyByLimit, hasFactData]);

  return (
    <div className="pf-chart pf-chart--monthly">
      <div className="pf-chart__y-axis">
        {yTicks.map((tick) => (
          <span key={tick}>{formatAxisRub(tick)}</span>
        ))}
      </div>
      <div className="pf-chart__body">
        <div className="pf-chart__grid">
          {yTicks.slice(0, -1).map((tick) => (
            <div key={tick} className="pf-chart__grid-line" />
          ))}
        </div>
        <div className="pf-chart__plot">
          {monthlyByLimit.map((row) => {
            const inLimit = row.byLimit.IN_LIMIT.plan;
            const overLimit = row.byLimit.OVER_LIMIT.plan + row.byLimit.UNLIMITED.plan;
            const planTotal = inLimit + overLimit;
            const fact =
              row.byLimit.IN_LIMIT.fact + row.byLimit.OVER_LIMIT.fact + row.byLimit.UNLIMITED.fact;
            return (
              <div key={row.month} className="pf-chart__month" title={monthLabel(row.month)}>
                <div className="pf-chart__cluster">
                  <div
                    className="pf-chart__stack"
                    style={{ height: pct(planTotal, maxValue) }}
                    aria-label={`План ${monthLabel(row.month)}`}
                  >
                    {inLimit > 0 && (
                      <div
                        className="pf-chart__segment pf-chart__segment--in_limit"
                        style={{ flex: inLimit }}
                      />
                    )}
                    {overLimit > 0 && (
                      <div
                        className="pf-chart__segment pf-chart__segment--over_limit"
                        style={{ flex: overLimit }}
                      />
                    )}
                  </div>
                  {hasFactData && fact > 0 ? (
                    <div className="pf-chart__fact-col" style={{ height: pct(fact, maxValue) }} />
                  ) : (
                    <div className="pf-chart__fact-col pf-chart__fact-col--empty" />
                  )}
                </div>
                <span className="pf-chart__month-label">{monthLabel(row.month).slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PlanByLimitDonut({
  byLimit,
  hasFactData,
}: {
  byLimit: Record<LimitFlagKey, LimitPlanFact>;
  hasFactData: boolean;
}) {
  const pieData = DISPLAY_LIMIT_FLAGS.map((flag) => ({
    key: flag,
    name: LIMIT_FLAG_LABELS[flag],
    value: flag === "OVER_LIMIT" ? byLimit.OVER_LIMIT.plan + byLimit.UNLIMITED.plan : byLimit[flag].plan,
    color: COLORS[flag],
  })).filter((item) => item.value > 0);

  const planTotal = pieData.reduce((sum, item) => sum + item.value, 0);
  const factTotal = byLimit.IN_LIMIT.fact + byLimit.OVER_LIMIT.fact + byLimit.UNLIMITED.fact;

  if (planTotal <= 0) {
    return <p className="muted-line">Нет данных для диаграммы.</p>;
  }

  const gradient = conicGradient(pieData.map((item) => ({ value: item.value, color: item.color })));

  return (
    <div className="pf-donut-wrap">
      <div className="pf-donut-ring">
        <div className="pf-donut" style={{ background: gradient }} />
        <div className="pf-donut__center">
          <span>План год</span>
          <strong>{(planTotal / 1_000_000).toFixed(2)} млн ₽</strong>
          <span className="muted-line">
            {hasFactData ? `Факт: ${(factTotal / 1_000_000).toFixed(2)} млн ₽` : "Факт: —"}
          </span>
        </div>
      </div>
      <ul className="pf-donut__legend">
        {pieData.map((item) => (
          <li key={item.key}>
            <i className={`pf-donut__dot pf-donut__dot--${item.key.toLowerCase()}`} />
            {item.name} · {((item.value / planTotal) * 100).toFixed(0)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
