import { useState, type ReactNode } from "react";
import { formatGrowthPct, sliceAnalytics } from "../data/dashboardMetrics";
import { formatMoney } from "../data/formatDisplay";
import { getMonthlyCR } from "../data/planningData";
import { LIMIT_FLAG_LABELS } from "../data/planningData";
import { METRIC_HELP } from "../data/metricHelp";
import { MetricHelp } from "./MetricHelp";
import type { LimitFlagKey, PositionRecord, SalaryRangeBand } from "../types";
import type { ViewMode } from "../data/dashboardMetrics";

const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

function StripLabel({ children, help }: { children: ReactNode; help?: string }) {
  return (
    <span className="analytics-strip__label">
      {children}
      {help ? <MetricHelp title={typeof children === "string" ? children : undefined}>{help}</MetricHelp> : null}
    </span>
  );
}

export function AnalyticsSummaryStrip({
  positions,
  viewMode,
  salaryBands,
  showYtd = true,
  showFactYtd = true,
  showAvgCr = true,
  singleRow = false,
  planningLayout = false,
  planningCompact = false,
}: {
  positions: PositionRecord[];
  viewMode: ViewMode;
  salaryBands: SalaryRangeBand[];
  showYtd?: boolean;
  showFactYtd?: boolean;
  showAvgCr?: boolean;
  singleRow?: boolean;
  /** Планирование: 1-я строка — ФОТ/дек, 2-я — позиции и вакансии */
  planningLayout?: boolean;
  /** Компактный режим на Планировании: 4 KPI + развернуть */
  planningCompact?: boolean;
}) {
  const [planningExpanded, setPlanningExpanded] = useState(false);
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

  const stripClass = [
    "analytics-strip",
    singleRow && !planningLayout ? "analytics-strip--single-row" : "",
    planningLayout ? "analytics-strip--planning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fotCards = (
    <>
      <div className="analytics-strip__item">
        <StripLabel help={METRIC_HELP.yearPlan}>Итого ФОТ год</StripLabel>
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
        <StripLabel help={METRIC_HELP.decPrev}>Дек прошл.</StripLabel>
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
        <StripLabel help={METRIC_HELP.decPlan}>Дек план</StripLabel>
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
        <StripLabel>Дек → дек (прирост)</StripLabel>
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
    </>
  );

  const headcountCards = (
    <>
      <div className="analytics-strip__item">
        <StripLabel help={METRIC_HELP.positions}>Позиции</StripLabel>
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
        <StripLabel help={METRIC_HELP.vacancies}>Вакансии</StripLabel>
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
    </>
  );

  const extraCards = (
    <>
      {showAvgCr ? (
        <div className="analytics-strip__item">
          <StripLabel help={METRIC_HELP.avgCr}>Средний CR</StripLabel>
          <strong>{avgCr.toFixed(2)}</strong>
        </div>
      ) : null}
      {showYtd ? (
        <>
          <div className="analytics-strip__item">
            <StripLabel>План YTD</StripLabel>
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
            <StripLabel>Факт YTD</StripLabel>
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
              <StripLabel>Отклонение YTD</StripLabel>
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
    </>
  );

  if (planningLayout && planningCompact && !planningExpanded) {
    return (
      <div className="analytics-strip analytics-strip--planning-compact">
        <div className="analytics-strip__row-group analytics-strip__row-group--compact">
          <div className="analytics-strip__item">
            <span>Итого ФОТ год</span>
            <strong>{formatMoney(a.yearPlan, true)}</strong>
          </div>
          <div className="analytics-strip__item">
            <StripLabel>Позиции</StripLabel>
            <strong>{active.length}</strong>
          </div>
          <div className="analytics-strip__item">
            <StripLabel>Вакансии</StripLabel>
            <strong>{totalVacancyCount}</strong>
          </div>
          <div className="analytics-strip__item">
            <StripLabel help={METRIC_HELP.avgCr}>Средний CR</StripLabel>
            <strong>{avgCr > 0 ? avgCr.toFixed(2) : "—"}</strong>
          </div>
        </div>
        <button type="button" className="ghost-btn analytics-strip__expand" onClick={() => setPlanningExpanded(true)}>
          Показать все метрики
        </button>
      </div>
    );
  }

  if (planningLayout) {
    return (
      <div className={stripClass}>
        {planningCompact ? (
          <button
            type="button"
            className="ghost-btn analytics-strip__expand analytics-strip__expand--top"
            onClick={() => setPlanningExpanded(false)}
          >
            Свернуть метрики
          </button>
        ) : null}
        <div className="analytics-strip__row-group analytics-strip__row-group--fot">{fotCards}</div>
        <div className="analytics-strip__row-group analytics-strip__row-group--hc">{headcountCards}</div>
      </div>
    );
  }

  return (
    <div className={stripClass}>
      {fotCards}
      {headcountCards}
      {extraCards}
    </div>
  );
}
