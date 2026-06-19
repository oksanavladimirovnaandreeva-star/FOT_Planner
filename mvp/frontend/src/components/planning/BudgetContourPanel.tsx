import { Link } from "react-router-dom";
import type { BudgetContour, BudgetContourTeamTile } from "../../data/buildBudgetContour";

function TeamTile({ tile }: { tile: BudgetContourTeamTile }) {
  return (
    <article
      className={`budget-contour-tile${tile.isDirectReport ? " budget-contour-tile--direct" : ""}`}
    >
      <h3 className="budget-contour-tile__team">{tile.team}</h3>
      <p className="budget-contour-tile__lead">
        {tile.teamLeadName
          ? `${tile.leadRoleLabel === "unit_lead" ? "Юнит-лид" : "Тимлид"}: ${tile.teamLeadName}`
          : tile.leadRoleLabel === "unit_lead"
            ? "Юнит-лид не назначен"
            : "Тимлид не назначен"}
      </p>
      <p className="budget-contour-tile__meta">{tile.rosterBrief}</p>
      {tile.isDirectReport ? <span className="budget-contour-tile__badge">прямой</span> : null}
      <Link className="primary-btn app-btn--sm budget-contour-tile__link" to={tile.planningHref}>
        Планирование
      </Link>
    </article>
  );
}

type Props = {
  contour: BudgetContour;
};

export function BudgetContourPanel({ contour }: Props) {
  const showUnitHeadings = contour.unitGroups.length > 1;

  return (
    <section className="card budget-contour" aria-label={contour.title}>
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
            <div className="budget-contour-tiles">
              {group.teams.map((tile) => (
                <TeamTile key={tile.id} tile={tile} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
