import { formatGrowthPct, sliceAnalytics } from "../data/dashboardMetrics";
import { getMonthlyCR } from "../data/planningData";
import { LIMIT_FLAG_LABELS } from "../data/planningData";
import type { LimitFlagKey, PositionRecord, SalaryRangeBand } from "../types";
import type { ViewMode } from "../data/dashboardMetrics";

const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

function formatMoney(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} млн ₽`;
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function AnalyticsSummaryStrip({
  positions,
  viewMode,
  salaryBands,
  showYtd = true,
  showFactYtd = true,
  showAvgCr = true,
  singleRow = false,
}: {
  positions: PositionRecord[];
  viewMode: ViewMode;
  salaryBands: SalaryRangeBand[];
  showYtd?: boolean;
  showFactYtd?: boolean;
  showAvgCr?: boolean;
  singleRow?: boolean;
}) {
  const a = sliceAnalytics(positions, viewMode);
  const active = positions.filter((position) => position.status !== "Closed");
  const decByLimit = active.reduce(
    (acc, position) => {
      acc[position.limitFlag].prev += position.previousDecemberBase;
      acc[position.limitFlag].plan += position.monthlyBase[11];
      return acc;
    },
    {
      IN_LIMIT: { prev: 0, plan: 0 },
      OVER_LIMIT: { prev: 0, plan: 0 },
      UNLIMITED: { prev: 0, plan: 0 },
    } satisfies Record<LimitFlagKey, { prev: number; plan: number }>,
  );
  const ytdThroughMonth = new Date().getMonth();
  const ytdPlanByLimit = active.reduce(
    (acc, position) => {
      for (let month = 0; month <= ytdThroughMonth; month += 1) {
        acc[position.limitFlag] += viewMode === "total" ? position.monthlyBase[month] + position.monthlyBonus[month] : position.monthlyBase[month];
      }
      return acc;
    },
    {
      IN_LIMIT: 0,
      OVER_LIMIT: 0,
      UNLIMITED: 0,
    } satisfies Record<LimitFlagKey, number>,
  );
  const avgCr = (() => {
    let sum = 0;
    let count = 0;
    for (const position of active) {
      for (let month = 0; month < 12; month += 1) {
        const cr = getMonthlyCR(position.monthlyBase[month], position.monthlySpec[month], position.monthlyLevel[month], salaryBands);
        if (cr > 0) {
          sum += cr;
          count += 1;
        }
      }
    }
    return count ? sum / count : 0;
  })();
  const vacancyByLimit = active.reduce(
    (acc, position) => {
      if (position.status === "Vacancy") acc[position.limitFlag] += 1;
      return acc;
    },
    {
      IN_LIMIT: 0,
      OVER_LIMIT: 0,
      UNLIMITED: 0,
    } satisfies Record<LimitFlagKey, number>,
  );
  const yearPlanByLimit = active.reduce(
    (acc, position) => {
      const yearPlan = viewMode === "total"
        ? position.monthlyBase.reduce((sum, value, idx) => sum + value + position.monthlyBonus[idx], 0)
        : position.monthlyBase.reduce((sum, value) => sum + value, 0);
      acc[position.limitFlag] += yearPlan;
      return acc;
    },
    { IN_LIMIT: 0, OVER_LIMIT: 0, UNLIMITED: 0 } satisfies Record<LimitFlagKey, number>,
  );
  const decPrevByLimit = active.reduce(
    (acc, position) => {
      acc[position.limitFlag] += position.previousDecemberBase;
      return acc;
    },
    { IN_LIMIT: 0, OVER_LIMIT: 0, UNLIMITED: 0 } satisfies Record<LimitFlagKey, number>,
  );
  const decPlanByLimit = active.reduce(
    (acc, position) => {
      acc[position.limitFlag] += position.monthlyBase[11];
      return acc;
    },
    { IN_LIMIT: 0, OVER_LIMIT: 0, UNLIMITED: 0 } satisfies Record<LimitFlagKey, number>,
  );
  const vacancyAmountByLimit = active.reduce(
    (acc, position) => {
      if (position.status !== "Vacancy") return acc;
      const yearPlan = viewMode === "total"
        ? position.monthlyBase.reduce((sum, value, idx) => sum + value + position.monthlyBonus[idx], 0)
        : position.monthlyBase.reduce((sum, value) => sum + value, 0);
      acc[position.limitFlag] += yearPlan;
      return acc;
    },
    { IN_LIMIT: 0, OVER_LIMIT: 0, UNLIMITED: 0 } satisfies Record<LimitFlagKey, number>,
  );
  const positionsByLimit = active.reduce(
    (acc, position) => {
      acc[position.limitFlag] += 1;
      return acc;
    },
    { IN_LIMIT: 0, OVER_LIMIT: 0, UNLIMITED: 0 } satisfies Record<LimitFlagKey, number>,
  );
  const totalVacancyCount = active.filter((position) => position.status === "Vacancy").length;
  const totalVacancyAmount = vacancyAmountByLimit.IN_LIMIT + vacancyAmountByLimit.OVER_LIMIT;

  return (
    <div className={`analytics-strip${singleRow ? " analytics-strip--single-row" : ""}`}>
      <div className="analytics-strip__item">
        <span>Итого ФОТ год</span>
        <strong>{formatMoney(a.yearPlan, true)}</strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <span>{formatMoney(yearPlanByLimit[flag], true)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-strip__item">
        <span>Дек прошл.</span>
        <strong>{formatMoney(a.decPrev)}</strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <span>{formatMoney(decPrevByLimit[flag])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-strip__item">
        <span>Дек план</span>
        <strong>{formatMoney(a.decPlan)}</strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <span>{formatMoney(decPlanByLimit[flag])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-strip__item">
        <span>Дек → дек (прирост)</span>
        <strong>
          {formatGrowthPct(a.decPct)} · {formatMoney(a.decPlan - a.decPrev)}
        </strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <strong>
                {formatGrowthPct(
                  decByLimit[flag].prev === 0
                    ? decByLimit[flag].plan === 0
                      ? 0
                      : 100
                    : ((decByLimit[flag].plan - decByLimit[flag].prev) / decByLimit[flag].prev) * 100,
                )}{" "}
                · {formatMoney(decByLimit[flag].plan - decByLimit[flag].prev)}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-strip__item">
        <span>Позиции</span>
        <strong>
          {active.length} · {formatMoney(a.yearPlan, true)}
        </strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <span>
                {positionsByLimit[flag]} · {formatMoney(yearPlanByLimit[flag], true)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="analytics-strip__item">
        <span>Вакансии</span>
        <strong>
          {totalVacancyCount} · {formatMoney(totalVacancyAmount, true)}
        </strong>
        <div className="analytics-strip__rows">
          {DISPLAY_LIMIT_FLAGS.map((flag) => (
            <div key={flag} className="analytics-strip__row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
              <span>
                {vacancyByLimit[flag]} · {formatMoney(vacancyAmountByLimit[flag], true)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {showAvgCr ? (
        <div className="analytics-strip__item">
          <span>Средний CR</span>
          <strong>{avgCr.toFixed(2)}</strong>
        </div>
      ) : null}
      {showYtd ? (
        <>
          <div className="analytics-strip__item">
            <span>План YTD</span>
            <strong>{formatMoney(a.planYtd, true)}</strong>
            <div className="analytics-strip__rows">
              {DISPLAY_LIMIT_FLAGS.map((flag) => (
                <div key={flag} className="analytics-strip__row">
                  <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                  <span>{formatMoney(ytdPlanByLimit[flag], true)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="analytics-strip__item analytics-strip__item--muted">
            <span>Факт YTD</span>
            <strong>{a.hasFactData ? formatMoney(a.factYtd, true) : "—"}</strong>
            <div className="analytics-strip__rows">
              {DISPLAY_LIMIT_FLAGS.map((flag) => (
                <div key={flag} className="analytics-strip__row">
                  <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                  <span>—</span>
                </div>
              ))}
            </div>
          </div>
          {showFactYtd ? (
            <div className="analytics-strip__item analytics-strip__item--muted">
              <span>Отклонение YTD</span>
              <strong>{a.hasFactData ? formatMoney(a.ytdVariance, true) : "—"}</strong>
              <div className="analytics-strip__rows">
                {DISPLAY_LIMIT_FLAGS.map((flag) => (
                  <div key={flag} className="analytics-strip__row">
                    <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                    <span>—</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
