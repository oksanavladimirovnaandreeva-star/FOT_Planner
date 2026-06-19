import { Link } from "react-router-dom";
import type { BudgetContour, BudgetContourTeamTile } from "../../data/buildBudgetContour";

function contourBadgeClass(statusLabel: string): string {
  const lower = statusLabel.toLowerCase();
  if (lower.includes("соглас") || lower.includes("сдан") || lower.includes("готов")) {
    return "team-lead-approval__status-badge--in_approval";
  }
  if (lower.includes("возврат") || lower.includes("доработ")) {
    return "team-lead-approval__status-badge--returned";
  }
  return "team-lead-approval__status-badge--in_progress";
}

function ContourCard({ tile }: { tile: BudgetContourTeamTile }) {
  const leadRole = tile.leadRoleLabel === "unit_lead" ? "Юнит-лид" : "Тимлид";
  const leadMissing = tile.leadRoleLabel === "unit_lead" ? "Юнит-лид не назначен" : "Тимлид не назначен";

  return (
    <section
      className={`card team-lead-approval__status budget-contour-card${tile.isDirectReport ? " budget-contour-card--direct" : ""}`}
      aria-label={tile.team}
    >
      <div className="team-lead-approval__status-head">
        <div>
          <span className={`team-lead-approval__status-badge ${contourBadgeClass(tile.statusLabel)}`}>
            {tile.statusLabel}
          </span>
          <h2 className="team-lead-approval__status-team">{tile.team}</h2>
          <p className="muted-line">
            {tile.unit}
            {tile.leadRoleLabel === "team_lead" ? ` · ${tile.department}` : ""}
            {tile.isDirectReport ? " · прямой подчинённый" : ""}
          </p>
          <p className="budget-contour-card__meta">
            {tile.rosterBrief}
            {tile.fotBrief ? ` · ${tile.fotBrief} ФОТ год` : ""}
          </p>
          <p className="budget-contour-card__lead">
            <span className="budget-contour-card__lead-label">{leadRole}:</span>{" "}
            {tile.teamLeadName && tile.leadPlanningHref ? (
              <Link to={tile.leadPlanningHref} className="budget-contour-card__lead-link">
                {tile.teamLeadName}
              </Link>
            ) : tile.teamLeadName ? (
              <strong>{tile.teamLeadName}</strong>
            ) : (
              <span className="muted-line">{leadMissing}</span>
            )}
          </p>
        </div>
        <div className="team-lead-approval__status-actions">
          <Link
            className="primary-btn"
            to={tile.leadPlanningHref ?? tile.planningHref}
          >
            Планирование
          </Link>
          {tile.leadRoleLabel === "team_lead" ? (
            <Link className="secondary-btn" to={tile.planningHref}>
              Вся команда
            </Link>
          ) : null}
          {tile.unitPlanningHref ? (
            <Link className="secondary-btn" to={tile.unitPlanningHref}>
              Весь юнит
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type Props = {
  contour: BudgetContour;
};

export function BudgetContourPanel({ contour }: Props) {
  const showUnitHeadings = contour.unitGroups.length > 1;

  return (
    <section className="budget-contour" aria-label={contour.title}>
      <h2 className="section-title">{contour.title}</h2>
      <p className="muted-line budget-contour__lead">{contour.leadLine}</p>
      <div className="budget-contour__groups">
        {contour.unitGroups.map((group) => (
          <div key={group.id} className="budget-contour__group">
            {showUnitHeadings ? (
              <h3 className="budget-contour__unit-title">
                {group.unit}
                <span className="muted-line"> · {group.teamCount} команд</span>
              </h3>
            ) : null}
            <div className="budget-contour-cards">
              {group.teams.map((tile) => (
                <ContourCard key={tile.id} tile={tile} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
