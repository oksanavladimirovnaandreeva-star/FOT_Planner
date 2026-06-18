import { formatMoney } from "../../data/formatDisplay";
import type { TeamApprovalDiffSummary } from "../../data/teamApprovalDiff";

type Props = {
  summary: TeamApprovalDiffSummary;
  baselineLabel: string;
  draftLabel: string;
};

function deltaTone(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function TeamLeadApprovalKpi({ summary, baselineLabel, draftLabel }: Props) {
  const maxFot = Math.max(summary.baselineFot, summary.draftFot, 1);
  const baselinePct = Math.round((summary.baselineFot / maxFot) * 100);
  const draftPct = Math.round((summary.draftFot / maxFot) * 100);
  const tone = deltaTone(summary.deltaFot);

  return (
    <section className="card team-lead-approval__kpi" aria-label="Сводка изменений команды">
      <h2 className="section-title">Изменения vs утверждённая версия</h2>
      <div className="team-lead-approval__kpi-grid">
        <article className="team-lead-kpi-card">
          <span className="team-lead-kpi-card__label">Было</span>
          <strong className="team-lead-kpi-card__value">{formatMoney(summary.baselineFot, true)}</strong>
          <span className="team-lead-kpi-card__hint">{baselineLabel}</span>
        </article>
        <article className={`team-lead-kpi-card team-lead-kpi-card--delta team-lead-kpi-card--${tone}`}>
          <span className="team-lead-kpi-card__label">Δ ФОТ</span>
          <strong className="team-lead-kpi-card__value">
            {summary.deltaFot === 0
              ? "—"
              : `${summary.deltaFot > 0 ? "+" : "−"}${formatMoney(Math.abs(summary.deltaFot), true)}`}
          </strong>
          <span className="team-lead-kpi-card__hint">
            {summary.changeCount} {summary.changeCount === 1 ? "изменение" : "изменений"}
          </span>
        </article>
        <article className="team-lead-kpi-card team-lead-kpi-card--accent">
          <span className="team-lead-kpi-card__label">Стало</span>
          <strong className="team-lead-kpi-card__value">{formatMoney(summary.draftFot, true)}</strong>
          <span className="team-lead-kpi-card__hint">{draftLabel}</span>
        </article>
      </div>
      <div className="team-lead-approval__kpi-bars" aria-hidden>
        <div className="team-lead-approval__kpi-bar-row">
          <span>{baselineLabel}</span>
          <div className="team-lead-approval__kpi-bar-track">
            <span className="team-lead-approval__kpi-bar-fill team-lead-approval__kpi-bar-fill--base" style={{ width: `${baselinePct}%` }} />
          </div>
        </div>
        <div className="team-lead-approval__kpi-bar-row">
          <span>{draftLabel}</span>
          <div className="team-lead-approval__kpi-bar-track">
            <span className="team-lead-approval__kpi-bar-fill team-lead-approval__kpi-bar-fill--draft" style={{ width: `${draftPct}%` }} />
          </div>
        </div>
      </div>
      <div className="team-lead-approval__kpi-chips">
        <span className="team-lead-approval__chip">
          Позиции: {summary.baselineHeadcount} → {summary.draftHeadcount}
        </span>
      </div>
    </section>
  );
}
