import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMvpApp } from "../../context/MvpAppContext";
import { formatMoney, formatIsoDateTime } from "../../data/formatDisplay";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { formatPlanVersionTitle } from "../../data/planVersionDisplay";
import { buildOrgConsolidationReport, type TeamConsolidationRow } from "../../data/teamConsolidation";
import {
  applySubmissionAction,
  getTeamSubmissionForApprovalScope,
  resolveSubmissionPlanVersionId,
} from "../../data/teamSubmissionStore";
import {
  buildTeamLeadVersionRibbon,
  groupTeamsByKanbanColumn,
  resolveTeamLeadKanbanColumn,
  submissionApprovalSubstep,
  UNIT_LEAD_KANBAN_COLUMNS,
  type TeamLeadKanbanColumn,
} from "../../data/teamLeadApprovalKanban";
import {
  canRolePerformSubmissionAction,
  submissionPhaseLabel,
} from "../../data/submissionWorkflowPolicy";
import { demoRoleActorOrg, demoRolePrimaryOrg } from "../../data/userAccess";
import { planWorkspacePath } from "../../data/planWorkspaceMode";
import { buildUnitApprovalDiff } from "../../data/teamApprovalDiff";
import { ApprovalVersionRibbon } from "./ApprovalVersionRibbon";
import { TeamLeadApprovalChangesList } from "./TeamLeadApprovalChangesList";
import { TeamLeadApprovalKpi } from "./TeamLeadApprovalKpi";

function formatSignedFotDelta(value: number): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), true)}`;
}

export function UnitLeadApprovalPanel() {
  const {
    positions,
    workingDraft,
    latestApproved,
    primaryBudget,
    versionDiff,
    userRole,
    refreshTeamSubmissions,
    teamSubmissionRevision,
  } = useMvpApp();

  const scope = useMemo(() => {
    const primary = demoRolePrimaryOrg("unit_lead");
    const actor = demoRoleActorOrg("unit_lead");
    const unit = primary.unit ?? actor.units[0] ?? "";
    return {
      department: primary.department,
      unit,
      departments: actor.departments,
      units: actor.units,
      teams: actor.teams,
    };
  }, []);

  const planYear = primaryBudget?.planYear ?? workingDraft?.planYear ?? 2026;
  const applied = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const positionsById = useMemo(
    () => new Map(applied.map((position) => [position.positionId, position])),
    [applied],
  );

  const report = useMemo(
    () =>
      buildOrgConsolidationReport(applied, {
        department: scope.department,
        unit: scope.unit,
        team: null,
        planYear,
        workingDraft,
        baselinePositions: versionDiff.baselinePositions,
        draftPositions: versionDiff.draftPositions,
        submissionPlanVersionId: workingDraft?.id ?? null,
        primaryBudget,
      }),
    [applied, scope, planYear, workingDraft, versionDiff, teamSubmissionRevision, primaryBudget],
  );

  const unitGroup = report.units.find((group) => group.unit === scope.unit) ?? report.units[0];
  const unitTeams = unitGroup?.teams ?? [];

  const ribbonSteps = buildTeamLeadVersionRibbon({ primaryBudget, workingDraft, latestApproved });

  const approvalDiff = useMemo(() => {
    if (!workingDraft || versionDiff.baselinePositions.length === 0) {
      return null;
    }
    return buildUnitApprovalDiff({
      baselinePositions: versionDiff.baselinePositions,
      draftPositions: versionDiff.draftPositions,
      department: scope.department,
      unit: scope.unit,
      mode: "quarterly",
    });
  }, [workingDraft, versionDiff, scope]);

  const baselineLabel = versionDiff.summary.baselineLabel || "Утверждённый бюджет";
  const draftLabel = workingDraft ? formatPlanVersionTitle(workingDraft) : "Черновик";

  const teamsByColumn = useMemo(() => {
    return groupTeamsByKanbanColumn(unitTeams, (team) => {
      const submission = getTeamSubmissionForApprovalScope(
        workingDraft?.id ?? null,
        primaryBudget,
        team.department,
        team.unit,
        team.team,
      );
      return resolveTeamLeadKanbanColumn({
        workingDraft,
        latestApproved,
        primaryBudget,
        submission,
      });
    });
  }, [unitTeams, workingDraft, latestApproved, primaryBudget, teamSubmissionRevision]);

  const awaitingApproval = unitTeams.filter((team) => team.displayStatus === "team_submitted").length;
  const submittedTeams = report.totals.filledTeams;

  const teamsAwaitingApproval = useMemo(() => {
    void teamSubmissionRevision;
    return unitTeams.filter((team) => {
      const submission = getTeamSubmissionForApprovalScope(
        workingDraft?.id ?? null,
        primaryBudget,
        team.department,
        team.unit,
        team.team,
      );
      return submission?.phase === "team_submitted";
    });
  }, [unitTeams, workingDraft, primaryBudget, teamSubmissionRevision]);

  const submissionPlanVersionIdFor = (team: TeamConsolidationRow) =>
    resolveSubmissionPlanVersionId(
      workingDraft?.id ?? null,
      primaryBudget,
      team.department,
      team.unit,
      team.team,
    );

  const handleUnitApprove = (team: TeamConsolidationRow) => {
    const planVersionId = submissionPlanVersionIdFor(team);
    if (!planVersionId) return;
    const confirmed = window.confirm(`Согласовать команду «${team.team}» и отправить дальше?`);
    if (!confirmed) return;
    const result = applySubmissionAction({
      planVersionId,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: "unit_approve",
      actor: { role: userRole },
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handleReturn = (team: TeamConsolidationRow) => {
    const planVersionId = submissionPlanVersionIdFor(team);
    if (!planVersionId) return;
    const note = window.prompt("Комментарий к возврату (опционально):") ?? undefined;
    const result = applySubmissionAction({
      planVersionId,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: "return",
      actor: { role: userRole },
      note,
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const canUnitApproveTeam = (team: TeamConsolidationRow, submission: ReturnType<typeof getTeamSubmissionForApprovalScope>) =>
    submission?.phase === "team_submitted" &&
    canRolePerformSubmissionAction("unit_approve", {
      actorRole: userRole,
      actorDepartments: scope.departments,
      actorUnits: scope.units,
      actorTeams: scope.teams,
      targetDepartment: team.department,
      targetUnit: team.unit,
      targetTeam: team.team,
    });

  const canReturnTeam = (team: TeamConsolidationRow, submission: ReturnType<typeof getTeamSubmissionForApprovalScope>) =>
    submission?.phase === "team_submitted" &&
    canRolePerformSubmissionAction("return", {
      actorRole: userRole,
      actorDepartments: scope.departments,
      actorUnits: scope.units,
      actorTeams: scope.teams,
      targetDepartment: team.department,
      targetUnit: team.unit,
      targetTeam: team.team,
    });

  const renderTeamCard = (team: TeamConsolidationRow, column: TeamLeadKanbanColumn) => {
    const submission = getTeamSubmissionForApprovalScope(
      workingDraft?.id ?? null,
      primaryBudget,
      team.department,
      team.unit,
      team.team,
    );
    const approvalSubstep = submissionApprovalSubstep(submission);
    const canApprove = canUnitApproveTeam(team, submission);
    const canReturn = canReturnTeam(team, submission);

    return (
      <article key={`${team.unit}-${team.team}`} className="team-lead-approval__card">
        <strong className="team-lead-approval__card-title">{team.team}</strong>
        <p className="muted-line">{team.unit} · {team.department}</p>
        <p className="team-lead-approval__card-delta">
          Δ ФОТ <strong>{formatSignedFotDelta(team.fotDeltaAnnual)}</strong>
          {team.deltaEvents > 0 ? ` · ${team.deltaEvents} изм.` : ""}
        </p>
        {submission ? (
          <p className="team-lead-approval__card-phase">
            <span className="submission-phase-badge submission-phase-badge--progress">
              {submissionPhaseLabel(submission.phase)}
            </span>
          </p>
        ) : null}
        {approvalSubstep ? <p className="team-lead-approval__substep">{approvalSubstep}</p> : null}
        {submission?.returnedNote ? (
          <p className="team-lead-approval__return-note">
            <strong>Комментарий:</strong> {submission.returnedNote}
          </p>
        ) : null}
        {submission?.teamSubmittedAt && column === "in_approval" ? (
          <p className="muted-line">Сдано {formatIsoDateTime(submission.teamSubmittedAt)}</p>
        ) : null}
        <div className="team-lead-approval__card-actions">
          {canApprove ? (
            <button type="button" className="primary-btn" onClick={() => handleUnitApprove(team)}>
              Согласовать и отправить дальше
            </button>
          ) : null}
          {canReturn ? (
            <button type="button" className="secondary-btn" onClick={() => handleReturn(team)}>
              Вернуть на доработку
            </button>
          ) : null}
          {workingDraft ? (
            <Link className="secondary-btn" to={planWorkspacePath("correction", { tab: "positions" })}>
              Просмотр плана
            </Link>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="team-lead-approval unit-lead-approval">
      <ApprovalVersionRibbon
        steps={ribbonSteps}
        workingDraft={workingDraft}
        primaryBudget={primaryBudget}
      />

      <section className="card unit-lead-approval__queue" aria-label="Очередь на согласование">
        <h2 className="section-title">Очередь на согласование</h2>
        {teamsAwaitingApproval.length > 0 ? (
          <>
            <p className="muted-line unit-lead-approval__queue-hint">
              Сданные команды — согласуйте и отправьте дальше или верните на доработку.
            </p>
            <ul className="unit-lead-approval__queue-list">
              {teamsAwaitingApproval.map((team) => {
                const submission = getTeamSubmissionForApprovalScope(
                  workingDraft?.id ?? null,
                  primaryBudget,
                  team.department,
                  team.unit,
                  team.team,
                );
                return (
                  <li key={`${team.unit}-${team.team}`} className="unit-lead-approval__queue-item">
                    <div className="unit-lead-approval__queue-item-main">
                      <strong>{team.team}</strong>
                      <span className="muted-line">
                        {team.unit} · Δ ФОТ {formatSignedFotDelta(team.fotDeltaAnnual)}
                        {submission?.teamSubmittedAt
                          ? ` · сдано ${formatIsoDateTime(submission.teamSubmittedAt)}`
                          : ""}
                      </span>
                    </div>
                    <div className="unit-lead-approval__queue-actions">
                      {canUnitApproveTeam(team, submission) ? (
                        <button type="button" className="primary-btn" onClick={() => handleUnitApprove(team)}>
                          Согласовать и отправить дальше
                        </button>
                      ) : null}
                      {canReturnTeam(team, submission) ? (
                        <button type="button" className="secondary-btn" onClick={() => handleReturn(team)}>
                          Вернуть на доработку
                        </button>
                      ) : null}
                      {workingDraft ? (
                        <Link
                          className="secondary-btn"
                          to={planWorkspacePath("correction", { tab: "positions" })}
                        >
                          Просмотр плана
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="muted-line unit-lead-approval__queue-empty">
            Пока нет сданных команд. После того как тимлид нажмёт «Отправить бюджет на согласование», команда
            появится здесь.
          </p>
        )}
      </section>

      {workingDraft && unitTeams.length > 0 ? (
        <section className="card unit-lead-approval__teams-progress" aria-label="Прогресс сдачи команд">
          <h2 className="section-title">Команды юнита {scope.unit}</h2>
          <p className="muted-line">
            Сдано <strong>{submittedTeams}</strong> из <strong>{unitTeams.length}</strong>
            {awaitingApproval > 0 ? (
              <>
                {" "}
                · ждут согласования: <strong>{awaitingApproval}</strong>
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      <section className="team-lead-approval__kanban" aria-label="Статус команд юнита">
        {UNIT_LEAD_KANBAN_COLUMNS.map((column) => {
          const cards = teamsByColumn[column.id];
          const hasCards = cards.length > 0;
          return (
            <div
              key={column.id}
              className={`team-lead-approval__column${hasCards ? " team-lead-approval__column--active" : ""}`}
            >
              <header className="team-lead-approval__column-head">
                <h3>
                  {column.title}
                  {hasCards ? <span className="team-lead-approval__column-count">{cards.length}</span> : null}
                </h3>
                <p className="muted-line">{column.hint}</p>
              </header>
              <div className="team-lead-approval__column-body team-lead-approval__column-body--stack">
                {hasCards ? (
                  cards.map((team) => renderTeamCard(team, column.id))
                ) : (
                  <p className="team-lead-approval__column-empty muted-line">—</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {approvalDiff && workingDraft ? (
        <>
          <TeamLeadApprovalKpi
            summary={approvalDiff.summary}
            baselineLabel={baselineLabel}
            draftLabel={draftLabel}
            submissionMode="quarterly"
          />
          <TeamLeadApprovalChangesList
            rows={approvalDiff.rows}
            canEdit={false}
            positionsById={positionsById}
            versionLabel={draftLabel}
            submissionMode="quarterly"
            planningLink={planWorkspacePath("correction", { tab: "positions" })}
          />
        </>
      ) : null}
    </div>
  );
}
