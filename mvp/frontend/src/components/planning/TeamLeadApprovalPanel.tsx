import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, CircleCheck } from "lucide-react";
import { useMvpApp } from "../../context/MvpAppContext";
import { formatMoney, formatIsoDateTime } from "../../data/formatDisplay";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { formatPlanVersionTitle } from "../../data/planVersionDisplay";
import { isBudgetLocked } from "../../data/planVersions";
import { buildOrgConsolidationReport } from "../../data/teamConsolidation";
import {
  applySubmissionAction,
  getTeamSubmission,
} from "../../data/teamSubmissionStore";
import {
  buildTeamLeadVersionRibbon,
  formatNextQuarterVersionHint,
  resolveTeamLeadKanbanColumn,
  submissionApprovalSubstep,
  TEAM_LEAD_KANBAN_COLUMNS,
  type TeamLeadKanbanColumn,
} from "../../data/teamLeadApprovalKanban";
import { canRolePerformSubmissionAction } from "../../data/submissionWorkflowPolicy";
import { demoRoleActorOrg, demoRolePrimaryOrg } from "../../data/userAccess";
import { planWorkspacePath } from "../../data/planWorkspaceMode";
import { buildTeamApprovalDiff } from "../../data/teamApprovalDiff";
import { TeamLeadApprovalChangesList } from "./TeamLeadApprovalChangesList";
import { TeamLeadApprovalKpi } from "./TeamLeadApprovalKpi";

function formatSignedFotDelta(value: number): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), true)}`;
}

function columnHasCard(column: TeamLeadKanbanColumn, active: TeamLeadKanbanColumn): boolean {
  return column === active;
}

export function TeamLeadApprovalPanel() {
  const {
    positions,
    workingDraft,
    latestApproved,
    primaryBudget,
    versionDiff,
    userRole,
    leadEditFrozen,
    refreshTeamSubmissions,
    teamSubmissionRevision,
  } = useMvpApp();

  const scope = useMemo(() => {
    const primary = demoRolePrimaryOrg("team_lead");
    const actor = demoRoleActorOrg("team_lead");
    const unit = primary.unit ?? actor.units[0] ?? "";
    const team = primary.team ?? actor.teams[0] ?? "";
    return {
      department: primary.department,
      unit,
      team,
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
        team: scope.team,
        planYear,
        workingDraft,
        baselinePositions: versionDiff.baselinePositions,
        draftPositions: versionDiff.draftPositions,
        submissionPlanVersionId: workingDraft?.id ?? null,
      }),
    [applied, scope, planYear, workingDraft, versionDiff, teamSubmissionRevision],
  );

  const teamRow = report.units.flatMap((unit) => unit.teams).find((row) => row.team === scope.team) ?? report.units[0]?.teams[0];

  const submission = useMemo(() => {
    if (!workingDraft) return null;
    void teamSubmissionRevision;
    return getTeamSubmission(workingDraft.id, scope.department, scope.unit, scope.team);
  }, [workingDraft, scope, teamSubmissionRevision]);

  const activeColumn = resolveTeamLeadKanbanColumn({
    workingDraft,
    latestApproved,
    primaryBudget,
    submission,
  });

  const ribbonSteps = buildTeamLeadVersionRibbon({ primaryBudget, workingDraft, latestApproved });

  const canSubmit =
    Boolean(workingDraft) &&
    (activeColumn === "in_progress" || activeColumn === "returned") &&
    canRolePerformSubmissionAction("team_submit", {
      actorRole: userRole,
      actorDepartments: scope.departments,
      actorUnits: scope.units,
      actorTeams: scope.teams,
      targetDepartment: scope.department,
      targetUnit: scope.unit,
      targetTeam: scope.team,
      leadEditFrozen,
    });

  const canEditPlanning = activeColumn === "in_progress" || activeColumn === "returned";

  const handleSubmit = () => {
    if (!workingDraft || !teamRow) return;
    const confirmed = window.confirm(
      `Сдать команду «${teamRow.team}»?\n\nПосле сдачи правки будут закрыты до решения согласующих или возврата на доработку.`,
    );
    if (!confirmed) return;
    const result = applySubmissionAction({
      planVersionId: workingDraft.id,
      department: teamRow.department,
      unit: teamRow.unit,
      team: teamRow.team,
      action: "team_submit",
      actor: { role: userRole, leadEditFrozen },
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const publishedHint =
    activeColumn === "published" && latestApproved && latestApproved.versionNumber > 1
      ? formatNextQuarterVersionHint({
          planYear: latestApproved.planYear,
          latestPublishedVersionNumber: latestApproved.versionNumber,
        })
      : null;

  const approvalSubstep = submissionApprovalSubstep(submission);

  const approvalDiff = useMemo(() => {
    if (!workingDraft || versionDiff.baselinePositions.length === 0) {
      return null;
    }
    return buildTeamApprovalDiff({
      baselinePositions: versionDiff.baselinePositions,
      draftPositions: versionDiff.draftPositions,
      department: scope.department,
      unit: scope.unit,
      team: scope.team,
    });
  }, [workingDraft, versionDiff, scope]);

  const baselineLabel = versionDiff.summary.baselineLabel || "Утверждённый бюджет";
  const draftLabel = workingDraft ? formatPlanVersionTitle(workingDraft) : "Черновик";

  return (
    <div className="team-lead-approval">
      <section className="card team-lead-approval__ribbon" aria-label="Лента версий бюджета">
        <h2 className="section-title">Ваш бюджет</h2>
        <ol className="team-lead-approval__ribbon-track">
          {ribbonSteps.map((step, index) => {
            const isAnnualApproved = step.id === "annual" && step.state === "done";
            return (
            <li
              key={step.id}
              className={`team-lead-approval__ribbon-step team-lead-approval__ribbon-step--${step.state}${isAnnualApproved ? " team-lead-approval__ribbon-step--approved" : ""}`}
            >
              <span
                className={`team-lead-approval__ribbon-dot${step.state === "done" ? " team-lead-approval__ribbon-dot--done" : ""}${step.state === "current" ? " team-lead-approval__ribbon-dot--current" : ""}${isAnnualApproved ? " team-lead-approval__ribbon-dot--approved" : ""}`}
                aria-hidden
              >
                {isAnnualApproved ? (
                  <CircleCheck size={18} strokeWidth={2.25} />
                ) : step.state === "done" ? (
                  <Check size={12} strokeWidth={3} />
                ) : null}
              </span>
              <div>
                <strong>
                  {step.label}
                  {isAnnualApproved ? (
                    <span className="team-lead-approval__ribbon-approved-tag">утверждён</span>
                  ) : null}
                </strong>
                <span className="team-lead-approval__ribbon-state">
                  {isAnnualApproved
                    ? "закрыт для правок"
                    : step.state === "done"
                      ? "готово"
                      : step.state === "current"
                        ? "сейчас"
                        : "далее"}
                </span>
              </div>
              {index < ribbonSteps.length - 1 ? (
                <span className="team-lead-approval__ribbon-connector" aria-hidden />
              ) : null}
            </li>
            );
          })}
        </ol>
        {!workingDraft && primaryBudget && isBudgetLocked(primaryBudget) ? (
          <p className="muted-line team-lead-approval__ribbon-wait">
            C&B ещё не открыл квартальный черновик — дождитесь уведомления или уточните у C&B.
          </p>
        ) : null}
      </section>

      {approvalDiff && workingDraft ? (
        <>
          <TeamLeadApprovalKpi summary={approvalDiff.summary} baselineLabel={baselineLabel} draftLabel={draftLabel} />
          <TeamLeadApprovalChangesList rows={approvalDiff.rows} canEdit={canEditPlanning} positionsById={positionsById} />
        </>
      ) : null}

      <section className="team-lead-approval__kanban" aria-label="Статус сдачи">
        {TEAM_LEAD_KANBAN_COLUMNS.map((column) => {
          const isActive = columnHasCard(column.id, activeColumn);
          return (
            <div
              key={column.id}
              className={`team-lead-approval__column${isActive ? " team-lead-approval__column--active" : ""}`}
            >
              <header className="team-lead-approval__column-head">
                <h3>{column.title}</h3>
                <p className="muted-line">{column.hint}</p>
              </header>
              <div className="team-lead-approval__column-body">
                {isActive && teamRow ? (
                  <article className="team-lead-approval__card">
                    <strong className="team-lead-approval__card-title">{teamRow.team}</strong>
                    <p className="muted-line">
                      {teamRow.unit} · {teamRow.department}
                    </p>
                    {approvalDiff ? (
                      <p className="team-lead-approval__card-delta">
                        Δ ФОТ{" "}
                        <strong>{formatSignedFotDelta(approvalDiff.summary.deltaFot)}</strong>
                        {approvalDiff.summary.changeCount > 0
                          ? ` · ${approvalDiff.summary.changeCount} изм.`
                          : ""}
                      </p>
                    ) : (
                      <dl className="team-lead-approval__metrics">
                        <div>
                          <dt>Δ ФОТ (год)</dt>
                          <dd>{formatSignedFotDelta(teamRow.fotDeltaAnnual)}</dd>
                        </div>
                        <div>
                          <dt>События</dt>
                          <dd>{teamRow.deltaEvents}</dd>
                        </div>
                        <div>
                          <dt>Позиции</dt>
                          <dd>{teamRow.headcount}</dd>
                        </div>
                      </dl>
                    )}
                    {approvalSubstep ? (
                      <p className="team-lead-approval__substep">{approvalSubstep}</p>
                    ) : null}
                    {submission?.returnedNote ? (
                      <p className="team-lead-approval__return-note">
                        <strong>Комментарий:</strong> {submission.returnedNote}
                      </p>
                    ) : null}
                    {submission?.teamSubmittedAt && activeColumn === "in_approval" ? (
                      <p className="muted-line">Сдано {formatIsoDateTime(submission.teamSubmittedAt)}</p>
                    ) : null}
                    {activeColumn === "published" && latestApproved ? (
                      <p className="team-lead-approval__published-label">
                        Активна <strong>{formatPlanVersionTitle(latestApproved)}</strong>
                      </p>
                    ) : null}
                    {publishedHint ? (
                      <p className="team-lead-approval__next-hint">{publishedHint}</p>
                    ) : null}
                    <div className="team-lead-approval__card-actions">
                      {canSubmit ? (
                        <button type="button" className="primary-btn" onClick={handleSubmit}>
                          Сдать команду
                        </button>
                      ) : null}
                      {workingDraft && canEditPlanning ? (
                        <Link className="secondary-btn" to={planWorkspacePath("correction", { tab: "positions" })}>
                          Квартальное планирование
                        </Link>
                      ) : workingDraft ? (
                        <Link className="secondary-btn" to={planWorkspacePath("correction", { tab: "positions" })}>
                          Просмотр плана
                        </Link>
                      ) : latestApproved && activeColumn === "published" ? (
                        <Link className="secondary-btn" to="/planning">
                          Просмотр бюджета
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ) : (
                  <p className="team-lead-approval__column-empty muted-line">—</p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
