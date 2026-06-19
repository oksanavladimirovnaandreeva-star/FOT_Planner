import { Link } from "react-router-dom";
import { formatMoney } from "../../data/formatDisplay";
import type { BudgetTeamRow } from "../../data/buildBudgetPackage";
import { submissionPhaseLabel } from "../../data/submissionWorkflowPolicy";
import type { TeamSubmissionRecord } from "../../data/teamSubmissionStore";
import { resolveTeamLeadDisplayForTeam } from "../../data/demoPersonas";
import { formatRosterBrief, rosterSummaryForTeam } from "../../data/teamRosterSummary";
import { planTeamPlanningPath } from "../../data/planWorkspaceMode";
import type { PositionRecord } from "../../types";

function formatSignedFotDelta(value: number): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), true)}`;
}

type Props = {
  teams: BudgetTeamRow[];
  positions: PositionRecord[];
  primaryPlanningTeams: string[];
  canUnitApprove: (team: BudgetTeamRow, submission: TeamSubmissionRecord | null) => boolean;
  canReturn: (team: BudgetTeamRow, submission: TeamSubmissionRecord | null) => boolean;
  onApprove: (team: BudgetTeamRow) => void;
  onReturn: (team: BudgetTeamRow) => void;
  showUnitColumn?: boolean;
};

export function BudgetTeamsTable({
  teams,
  positions,
  primaryPlanningTeams,
  canUnitApprove,
  canReturn,
  onApprove,
  onReturn,
  showUnitColumn = false,
}: Props) {
  const planningLink = planTeamPlanningPath;

  const sortedTeams = [...teams].sort((a, b) => {
    const aPrimary = primaryPlanningTeams.includes(a.team) ? 0 : 1;
    const bPrimary = primaryPlanningTeams.includes(b.team) ? 0 : 1;
    return aPrimary - bPrimary || a.team.localeCompare(b.team, "ru");
  });

  return (
    <section className="card budget-teams-table" aria-label="Команды">
      <h2 className="section-title">Команды</h2>
      <p className="muted-line">Прямые подчинённые — тимлиды команд юнита. Жирная ссылка «Планирование» — ваши команды по умолчанию.</p>
      <div className="table-scroll">
        <table className="simple-table budget-teams-table__grid">
          <thead>
            <tr>
              <th>Команда</th>
              <th>Тимлид</th>
              <th>Состав</th>
              {showUnitColumn ? <th>Юнит</th> : null}
              <th>ФОТ год</th>
              <th>Δ ФОТ</th>
              <th>Изм.</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team) => {
              const isPrimary = primaryPlanningTeams.includes(team.team);
              const submission = team.submission;
              const phaseLabel = submission ? submissionPhaseLabel(submission.phase) : team.statusLabel;
              const teamLeadName =
                resolveTeamLeadDisplayForTeam(team.department, team.unit, team.team) ?? "—";
              const roster = rosterSummaryForTeam(positions, team.department, team.unit, team.team);
              const rosterBrief = formatRosterBrief(roster);
              const teamPlanningHref = planningLink(team.team);
              return (
                <tr key={`${team.unit}-${team.team}`} className={isPrimary ? "budget-teams-table__row--primary" : undefined}>
                  <td>
                    <strong>{team.team}</strong>
                    {!showUnitColumn ? <div className="muted-line">{team.unit}</div> : null}
                  </td>
                  <td>
                    <strong>{teamLeadName}</strong>
                    {isPrimary ? <div className="muted-line">прямой подчинённый</div> : null}
                  </td>
                  <td>
                    <strong>{rosterBrief}</strong>
                  </td>
                  {showUnitColumn ? <td>{team.unit}</td> : null}
                  <td>{formatMoney(team.draftFotAnnual, true)}</td>
                  <td>{formatSignedFotDelta(team.fotDeltaAnnual)}</td>
                  <td>{team.deltaEvents > 0 ? team.deltaEvents : "—"}</td>
                  <td>
                    <span className="submission-phase-badge submission-phase-badge--progress">{phaseLabel}</span>
                  </td>
                  <td>
                    <div className="budget-teams-table__actions">
                      {canUnitApprove(team, submission) ? (
                        <button type="button" className="primary-btn app-btn--sm" onClick={() => onApprove(team)}>
                          Согласовать
                        </button>
                      ) : null}
                      {canReturn(team, submission) ? (
                        <button type="button" className="secondary-btn app-btn--sm" onClick={() => onReturn(team)}>
                          Вернуть
                        </button>
                      ) : null}
                      <Link className="primary-btn app-btn--sm" to={teamPlanningHref}>
                        Планирование
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
