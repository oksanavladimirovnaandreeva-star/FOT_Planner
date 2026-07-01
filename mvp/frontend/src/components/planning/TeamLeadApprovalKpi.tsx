import type { ReactNode } from "react";
import { formatLimitDecGrowthLine, formatMoney, formatSignedMoneyDelta } from "../../data/formatDisplay";
import { decToDec, formatGrowthPct, LIMIT_FLAG_LABELS } from "../../data/planningData";
import {
  sumLimitBucketValues,
  TEAM_APPROVAL_LIMIT_FLAGS,
  type TeamApprovalDiffSummary,
  type TeamApprovalSubmissionMode,
} from "../../data/teamApprovalDiff";
import type { LimitFlagKey } from "../../types";

type Props = {
  summary: TeamApprovalDiffSummary;
  baselineLabel: string;
  draftLabel: string;
  submissionMode: TeamApprovalSubmissionMode;
  scopeTitle?: string;
  scopeLead?: string;
  embedded?: boolean;
};

export function formatChangeCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} изменение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} изменения`;
  return `${count} изменений`;
}

const LIMIT_SHORT: Record<LimitFlagKey, string> = {
  IN_LIMIT: "В лимите",
  OVER_LIMIT: "Сверх лимита",
  UNLIMITED: "Без ограничения",
};

function QuarterlyBudgetSummary({
  summary,
  baselineLabel,
  draftLabel,
}: {
  summary: TeamApprovalDiffSummary;
  baselineLabel: string;
  draftLabel: string;
}) {
  const totalDecGrowth = sumLimitBucketValues(summary.draftDecGrowthByLimit);
  const totalPrevDec = sumLimitBucketValues(summary.draftPrevDecByLimit);

  return (
    <div className="budget-kpi-summary">
      <div className="budget-kpi-summary__hero">
        <span className="budget-kpi-summary__hero-label">ФОТ год · черновик «{draftLabel}»</span>
        <strong className="budget-kpi-summary__hero-value">{formatMoney(summary.draftFot, true)}</strong>
      </div>

      <table className="budget-kpi-summary__table">
        <tbody>
          <tr>
            <th scope="row">{baselineLabel}</th>
            <td>{formatMoney(summary.baselineFot, true)}</td>
          </tr>
          <tr>
            <th scope="row">Изменения в {draftLabel}</th>
            <td>{formatSignedMoneyDelta(summary.deltaFot, true)}</td>
          </tr>
          <tr className="budget-kpi-summary__total">
            <th scope="row">Итого в черновике</th>
            <td>
              <strong>{formatMoney(summary.draftFot, true)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="budget-kpi-summary__limits">
        <p className="budget-kpi-summary__limits-title">По лимитам (годовой ФОТ)</p>
        {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => {
          const baseline = summary.baselineFotByLimit[flag];
          const draft = summary.draftFotByLimit[flag];
          const delta = summary.deltaFotByLimit[flag];
          return (
            <div key={flag} className="budget-kpi-summary__limit-row">
              <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_SHORT[flag]}</span>
              <span className="budget-kpi-summary__limit-values">
                {formatMoney(baseline, true)} → {formatMoney(draft, true)}
                {delta !== 0 ? (
                  <strong className="budget-kpi-summary__limit-delta">
                    {" "}
                    ({formatSignedMoneyDelta(delta, true)})
                  </strong>
                ) : (
                  <span className="muted-line"> (без изменений)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <details className="budget-kpi-summary__details">
        <summary>Декабрь и прирост дек → дек</summary>
        <table className="budget-kpi-summary__table budget-kpi-summary__table--compact">
          <thead>
            <tr>
              <th />
              <th>Итого</th>
              <th>В лимите</th>
              <th>Сверх лимита</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Дек прошл.</th>
              <td>{formatMoney(totalPrevDec)}</td>
              {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => (
                <td key={flag}>{formatMoney(summary.draftPrevDecByLimit[flag])}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Дек план</th>
              <td>{formatMoney(totalPrevDec + totalDecGrowth)}</td>
              {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => (
                <td key={flag}>
                  {formatMoney(
                    summary.draftPrevDecByLimit[flag] + summary.draftDecGrowthByLimit[flag],
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Прирост</th>
              <td>
                {formatSignedMoneyDelta(totalDecGrowth, true)}
                {totalPrevDec > 0 || totalDecGrowth !== 0 ? (
                  <span className="muted-line">
                    {" "}
                    · {formatGrowthPct(decToDec(totalPrevDec, totalPrevDec + totalDecGrowth))}
                  </span>
                ) : null}
              </td>
              {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => {
                const growth = summary.draftDecGrowthByLimit[flag];
                const prevDec = summary.draftPrevDecByLimit[flag];
                return (
                  <td key={flag}>
                    <strong>
                      {formatLimitDecGrowthLine(growth, prevDec, totalDecGrowth, totalPrevDec, true)}
                    </strong>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <p className="muted-line budget-kpi-summary__pct-hint">
          По лимитам: 1-й % — рост блока к его прошлому декабрю; 2-й % — вклад в общий % дек→дек
          (п.п., как в Excel: «%, в лимите» + «%, сверх лимита» = итого).
        </p>
      </details>

      <p className="muted-line budget-kpi-summary__note">
        Сумма в черновике = «Итого ФОТ год» на «Планировании» (та же версия, тот же срез роли —
        без вашей персональной позиции, см. настройки доступа).
      </p>
    </div>
  );
}

function LimitRows({
  flags = TEAM_APPROVAL_LIMIT_FLAGS,
  renderValue,
}: {
  flags?: LimitFlagKey[];
  renderValue: (flag: LimitFlagKey) => ReactNode;
}) {
  return (
    <div className="analytics-strip__rows">
      {flags.map((flag) => (
        <div key={flag} className="analytics-strip__row">
          <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
          {renderValue(flag)}
        </div>
      ))}
    </div>
  );
}

function AnnualKpiBody({ summary }: { summary: TeamApprovalDiffSummary }) {
  const totalDecGrowth = sumLimitBucketValues(summary.draftDecGrowthByLimit);
  const totalPrevDec = sumLimitBucketValues(summary.draftPrevDecByLimit);
  const totalPlanDec = totalPrevDec + totalDecGrowth;

  return (
    <div className="analytics-strip analytics-strip--planning analytics-strip--budget-kpi">
      <div className="analytics-strip__row-group analytics-strip__row-group--fot">
        <div className="analytics-strip__item">
          <span className="analytics-strip__label">Итого ФОТ год</span>
          <strong>{formatMoney(summary.draftFot, true)}</strong>
          <LimitRows renderValue={(flag) => <span>{formatMoney(summary.draftFotByLimit[flag], true)}</span>} />
        </div>
        <div className="analytics-strip__item">
          <span className="analytics-strip__label">Дек прошл.</span>
          <strong>{formatMoney(totalPrevDec)}</strong>
          <LimitRows
            renderValue={(flag) => <span>{formatMoney(summary.draftPrevDecByLimit[flag])}</span>}
          />
        </div>
        <div className="analytics-strip__item">
          <span className="analytics-strip__label">Дек план</span>
          <strong>{formatMoney(totalPlanDec)}</strong>
          <LimitRows
            renderValue={(flag) => (
              <span>
                {formatMoney(
                  summary.draftPrevDecByLimit[flag] + summary.draftDecGrowthByLimit[flag],
                )}
              </span>
            )}
          />
        </div>
        <div className="analytics-strip__item">
          <span className="analytics-strip__label">Дек → дек (прирост)</span>
          <strong>
            {formatSignedMoneyDelta(totalDecGrowth, true)}
            {totalPrevDec > 0 || totalDecGrowth !== 0 ? (
              <span className="muted-line">
                {" "}
                · {formatGrowthPct(decToDec(totalPrevDec, totalPlanDec))}
              </span>
            ) : null}
          </strong>
          <LimitRows
            renderValue={(flag) => (
              <strong>
                {formatLimitDecGrowthLine(
                  summary.draftDecGrowthByLimit[flag],
                  summary.draftPrevDecByLimit[flag],
                  totalDecGrowth,
                  totalPrevDec,
                  true,
                )}
              </strong>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function CompactKpiBody({
  summary,
  baselineLabel,
  draftLabel,
  submissionMode,
}: {
  summary: TeamApprovalDiffSummary;
  baselineLabel: string;
  draftLabel: string;
  submissionMode: TeamApprovalSubmissionMode;
}) {
  const isAnnual = submissionMode === "annual";

  if (!isAnnual) {
    return (
      <>
        <QuarterlyBudgetSummary summary={summary} baselineLabel={baselineLabel} draftLabel={draftLabel} />
        {summary.changeCount > 0 ? (
          <p className="muted-line team-lead-approval__kpi-foot">
            {formatChangeCountLabel(summary.changeCount)} — в таблице ниже
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <AnnualKpiBody summary={summary} />
      {summary.changeCount > 0 ? (
        <p className="muted-line team-lead-approval__kpi-foot">
          {formatChangeCountLabel(summary.changeCount)} — в журнале ниже
        </p>
      ) : null}
    </>
  );
}

export function TeamLeadApprovalKpi({
  summary,
  baselineLabel,
  draftLabel,
  submissionMode,
  scopeTitle,
  scopeLead,
  embedded = false,
}: Props) {
  const isAnnual = submissionMode === "annual";
  const title = scopeTitle ?? "Бюджет команды к сдаче";
  const lead =
    scopeLead ??
    (isAnnual
      ? `Общий годовой ФОТ · ${draftLabel}`
      : `Общий ФОТ в ${draftLabel} — уходит на согласование`);

  if (embedded) {
    return (
      <div className="team-lead-approval__kpi-embedded">
        <CompactKpiBody
          summary={summary}
          baselineLabel={baselineLabel}
          draftLabel={draftLabel}
          submissionMode={submissionMode}
        />
      </div>
    );
  }

  return (
    <div className="team-lead-approval__kpi-stack">
      <section className="card team-lead-approval__kpi" aria-label="Бюджет к сдаче">
        <h2 className="section-title">{title}</h2>
        <p className="muted-line team-lead-approval__kpi-lead">{lead}</p>
        <CompactKpiBody
          summary={summary}
          baselineLabel={baselineLabel}
          draftLabel={draftLabel}
          submissionMode={submissionMode}
        />
      </section>
    </div>
  );
}
