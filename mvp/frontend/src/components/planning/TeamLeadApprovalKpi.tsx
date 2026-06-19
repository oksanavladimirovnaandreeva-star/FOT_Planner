import { formatMoney } from "../../data/formatDisplay";
import { LIMIT_FLAG_LABELS } from "../../data/planningData";
import {
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
  /** Внутри карточки статуса — без второго заголовка и обёртки. */
  embedded?: boolean;
};

function deltaTone(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function formatChangeCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} изменение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} изменения`;
  return `${count} изменений`;
}

function formatSignedDelta(value: number, compact = false): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), compact)}`;
}

function LimitFotRows({
  totals,
  flags = TEAM_APPROVAL_LIMIT_FLAGS,
}: {
  totals: Record<LimitFlagKey, number>;
  flags?: LimitFlagKey[];
}) {
  return (
    <ul className="team-lead-approval__limit-rows">
      {flags.map((flag) => (
        <li key={flag} className="team-lead-approval__limit-row">
          <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
          <strong>{formatMoney(totals[flag], true)}</strong>
        </li>
      ))}
    </ul>
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
  const deltaToneValue = deltaTone(summary.deltaFot);
  const title = scopeTitle ?? "Бюджет команды к сдаче";
  const lead =
    scopeLead ??
    (isAnnual
      ? `Общий годовой ФОТ · ${draftLabel}`
      : `Общий ФОТ в ${draftLabel} — уходит на согласование`);

  const annualBlock = (
    <>
      <div className="team-lead-approval__kpi-hero">
        <span className="team-lead-approval__kpi-hero-label">Итого ФОТ год</span>
        <strong className="team-lead-approval__kpi-hero-value">{formatMoney(summary.draftFot, true)}</strong>
      </div>
      <LimitFotRows totals={summary.draftFotByLimit} />
      {isAnnual && summary.changeCount > 0 ? (
        <p className="muted-line team-lead-approval__kpi-foot">
          {formatChangeCountLabel(summary.changeCount)} — в журнале ниже
        </p>
      ) : null}
    </>
  );

  const quarterlyDeltaBlock = !isAnnual ? (
    <section
      className={`team-lead-approval__kpi team-lead-approval__kpi--delta team-lead-approval__kpi--${deltaToneValue}`}
      aria-label="Изменения относительно утверждённого года"
    >
      <h3 className="team-lead-approval__kpi-subtitle">Изменения vs {baselineLabel}</h3>
      <div className="team-lead-approval__kpi-delta-total">
        <span>Δ ФОТ год</span>
        <strong>{formatSignedDelta(summary.deltaFot, true)}</strong>
        <span className="muted-line">
          {formatMoney(summary.baselineFot, true)} → {formatMoney(summary.draftFot, true)}
        </span>
      </div>
      <ul className="team-lead-approval__limit-rows team-lead-approval__limit-rows--delta">
        {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => (
          <li key={flag} className="team-lead-approval__limit-row">
            <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
            <strong>{formatSignedDelta(summary.deltaFotByLimit[flag], true)}</strong>
            <span className="muted-line">
              {formatMoney(summary.baselineFotByLimit[flag], true)} →{" "}
              {formatMoney(summary.draftFotByLimit[flag], true)}
            </span>
          </li>
        ))}
      </ul>
      {summary.changeCount > 0 ? (
        <p className="muted-line team-lead-approval__kpi-foot">
          {formatChangeCountLabel(summary.changeCount)} в квартальной версии
        </p>
      ) : (
        <p className="muted-line team-lead-approval__kpi-foot">Правок в квартальной версии нет</p>
      )}
    </section>
  ) : null;

  if (embedded) {
    return (
      <div className="team-lead-approval__kpi-embedded">
        {annualBlock}
        {quarterlyDeltaBlock}
      </div>
    );
  }

  return (
    <div className="team-lead-approval__kpi-stack">
      <section className="card team-lead-approval__kpi" aria-label="Бюджет к сдаче">
        <h2 className="section-title">{title}</h2>
        <p className="muted-line team-lead-approval__kpi-lead">{lead}</p>
        {annualBlock}
      </section>

      {!isAnnual ? (
        <section
          className={`card team-lead-approval__kpi team-lead-approval__kpi--delta team-lead-approval__kpi--${deltaToneValue}`}
          aria-label="Изменения относительно утверждённого года"
        >
          <h2 className="section-title">Изменения vs утверждённый год</h2>
          <p className="muted-line team-lead-approval__kpi-lead">
            Насколько и почему бюджет изменился относительно {baselineLabel}. Детали — в журнале квартальной
            версии ниже.
          </p>
          <div className="team-lead-approval__kpi-delta-total">
            <span>Δ ФОТ год</span>
            <strong>{formatSignedDelta(summary.deltaFot, true)}</strong>
            <span className="muted-line">
              {formatMoney(summary.baselineFot, true)} → {formatMoney(summary.draftFot, true)}
            </span>
          </div>
          <ul className="team-lead-approval__limit-rows team-lead-approval__limit-rows--delta">
            {TEAM_APPROVAL_LIMIT_FLAGS.map((flag) => (
              <li key={flag} className="team-lead-approval__limit-row">
                <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                <strong>{formatSignedDelta(summary.deltaFotByLimit[flag], true)}</strong>
                <span className="muted-line">
                  {formatMoney(summary.baselineFotByLimit[flag], true)} →{" "}
                  {formatMoney(summary.draftFotByLimit[flag], true)}
                </span>
              </li>
            ))}
          </ul>
          {summary.changeCount > 0 ? (
            <p className="muted-line team-lead-approval__kpi-foot">
              {formatChangeCountLabel(summary.changeCount)} в квартальной версии
            </p>
          ) : (
            <p className="muted-line team-lead-approval__kpi-foot">Правок в квартальной версии нет</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
