import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMvpApp } from "../../context/MvpAppContext";
import { formatIsoDateTime } from "../../data/formatDisplay";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { formatPlanVersionTitle } from "../../data/planVersionDisplay";
import { buildOrgConsolidationReport } from "../../data/teamConsolidation";
import {
  applySubmissionAction,
  canSubmitTeamBudget,
  getTeamSubmission,
  isTeamEditingLocked,
} from "../../data/teamSubmissionStore";
import {
  buildTeamLeadVersionRibbon,
  formatNextQuarterVersionHint,
  resolveTeamLeadKanbanColumn,
  submissionApprovalSubstep,
  type TeamLeadKanbanColumn,
} from "../../data/teamLeadApprovalKanban";
import { canRolePerformSubmissionAction } from "../../data/submissionWorkflowPolicy";
import { demoRoleActorOrg, demoRolePrimaryOrg } from "../../data/userAccess";
import { resolveActivePersonaOrgScope } from "../../data/demoSessionStore";
import { planTeamPlanningPath, planWorkspacePath } from "../../data/planWorkspaceMode";
import { buildTeamApprovalDiff, type TeamApprovalSubmissionMode } from "../../data/teamApprovalDiff";
import { formatRosterBrief, rosterSummaryForTeam } from "../../data/teamRosterSummary";
import { ApprovalVersionRibbon } from "./ApprovalVersionRibbon";
import { TeamLeadApprovalChangesList } from "./TeamLeadApprovalChangesList";
import { TeamLeadApprovalKpi } from "./TeamLeadApprovalKpi";

const STATUS_COPY: Record<TeamLeadKanbanColumn, { title: string; hint: string }> = {
  in_progress: {
    title: "В работе",
    hint: "Можно править план и отправить бюджет на согласование.",
  },
  in_approval: {
    title: "На согласовании",
    hint: "Правки закрыты до решения юнит-лида, директора и C&B.",
  },
  returned: {
    title: "На доработке",
    hint: "Согласующий вернул — исправьте и сдайте снова.",
  },
  published: {
    title: "Бюджет опубликован",
    hint: "Активна утверждённая версия.",
  },
};

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
    appConfigRevision,
  } = useMvpApp();

  const scope = useMemo(() => {
    const personaOrg = resolveActivePersonaOrgScope();
    if (personaOrg) {
      const unit = personaOrg.unit ?? personaOrg.units[0] ?? "";
      const team = personaOrg.team ?? personaOrg.teams[0] ?? "";
      return {
        department: personaOrg.department,
        unit,
        team,
        departments: personaOrg.departments,
        units: personaOrg.units,
        teams: personaOrg.teams,
      };
    }
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
  }, [appConfigRevision]);

  const planYear = primaryBudget?.planYear ?? workingDraft?.planYear ?? 2026;
  const applied = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const positionsById = useMemo(
    () => new Map(applied.map((position) => [position.positionId, position])),
    [applied],
  );

  const submissionMode: TeamApprovalSubmissionMode | null = workingDraft
    ? "quarterly"
    : primaryBudget?.status === "DRAFT" && primaryBudget.versionNumber === 1
      ? "annual"
      : null;

  const submissionPlanVersionId =
    submissionMode === "quarterly" ? workingDraft?.id : primaryBudget?.id;

  const submission = useMemo(() => {
    if (!submissionPlanVersionId) return null;
    void teamSubmissionRevision;
    return getTeamSubmission(
      submissionPlanVersionId,
      scope.department,
      scope.unit,
      scope.team,
    );
  }, [submissionPlanVersionId, scope, teamSubmissionRevision]);

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
        submissionPlanVersionId: submissionPlanVersionId ?? null,
      }),
    [applied, scope, planYear, workingDraft, versionDiff, teamSubmissionRevision, submissionPlanVersionId],
  );

  const teamRow = report.units.flatMap((unit) => unit.teams).find((row) => row.team === scope.team) ?? report.units[0]?.teams[0];

  const rosterBrief = useMemo(() => {
    const summary = rosterSummaryForTeam(applied, scope.department, scope.unit, scope.team);
    return formatRosterBrief(summary);
  }, [applied, scope]);

  const activeColumn = resolveTeamLeadKanbanColumn({
    workingDraft,
    latestApproved,
    primaryBudget,
    submission,
  });

  const ribbonSteps = buildTeamLeadVersionRibbon({ primaryBudget, workingDraft, latestApproved });

  const editLocked = Boolean(submission && isTeamEditingLocked(submission));
  const canEditPlanning =
    (activeColumn === "in_progress" || activeColumn === "returned") && !editLocked;

  const canSubmit =
    Boolean(submissionPlanVersionId) &&
    Boolean(submissionMode) &&
    canSubmitTeamBudget(submission) &&
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

  const handleSubmit = () => {
    if (!submissionPlanVersionId || !teamRow) return;
    const confirmed = window.confirm(
      `Отправить бюджет на согласование («${teamRow.team}»)?\n\nПосле отправки правки будут закрыты до решения согласующих или возврата на доработку.`,
    );
    if (!confirmed) return;
    const result = applySubmissionAction({
      planVersionId: submissionPlanVersionId,
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
  const statusCopy = STATUS_COPY[activeColumn];

  const draftPositionsForApproval = useMemo(() => {
    if (submissionMode === "quarterly" && versionDiff.draftPositions.length > 0) {
      return versionDiff.draftPositions;
    }
    if (submissionMode === "annual") {
      return positions;
    }
    return [];
  }, [submissionMode, versionDiff.draftPositions, positions]);

  const baselinePositionsForApproval =
    submissionMode === "quarterly" ? versionDiff.baselinePositions : [];

  const approvalDiff = useMemo(() => {
    if (!submissionMode || draftPositionsForApproval.length === 0) return null;
    return buildTeamApprovalDiff({
      baselinePositions: baselinePositionsForApproval,
      draftPositions: draftPositionsForApproval,
      department: scope.department,
      unit: scope.unit,
      team: scope.team,
      mode: submissionMode,
    });
  }, [submissionMode, draftPositionsForApproval, baselinePositionsForApproval, scope]);

  const baselineLabel =
    submissionMode === "quarterly"
      ? versionDiff.summary.baselineLabel || "Утверждённый год"
      : "Утверждённый год";
  const draftLabel =
    submissionMode === "quarterly" && workingDraft
      ? formatPlanVersionTitle(workingDraft)
      : primaryBudget
        ? formatPlanVersionTitle(primaryBudget)
        : "Черновик";
  const planningLink =
    submissionMode === "quarterly"
      ? planWorkspacePath("correction", { tab: "positions", team: scope.team })
      : planTeamPlanningPath(scope.team);
  const planningActionLabel =
    canEditPlanning
      ? submissionMode === "annual"
        ? "Годовое планирование"
        : "Квартальное планирование"
      : "Просмотр плана";

  return (
    <div className="team-lead-approval">
      <ApprovalVersionRibbon
        steps={ribbonSteps}
        workingDraft={workingDraft}
        primaryBudget={primaryBudget}
      />

      {teamRow ? (
        <section className="card team-lead-approval__status" aria-label="Мой бюджет команды">
          <div className="team-lead-approval__status-head">
            <div>
              <span className={`team-lead-approval__status-badge team-lead-approval__status-badge--${activeColumn}`}>
                {statusCopy.title}
              </span>
              <h2 className="team-lead-approval__status-team">{teamRow.team}</h2>
              <p className="muted-line">
                {teamRow.unit} · {teamRow.department}
                {rosterBrief !== "—" ? ` · ${rosterBrief}` : ""}
                {draftLabel ? ` · ${draftLabel}` : ""}
              </p>
              <p className="team-lead-approval__status-hint">{statusCopy.hint}</p>
            </div>
            <div className="team-lead-approval__status-actions">
              {canSubmit ? (
                <button type="button" className="primary-btn" onClick={handleSubmit}>
                  Отправить бюджет на согласование
                </button>
              ) : null}
              <Link className={canSubmit ? "secondary-btn" : "primary-btn"} to={planningLink}>
                {planningActionLabel}
              </Link>
            </div>
          </div>

          {approvalDiff ? (
            <TeamLeadApprovalKpi
              embedded
              summary={approvalDiff.summary}
              baselineLabel={baselineLabel}
              draftLabel={draftLabel}
              submissionMode={submissionMode!}
            />
          ) : null}

          {approvalSubstep ? <p className="team-lead-approval__substep">{approvalSubstep}</p> : null}
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
          {publishedHint ? <p className="team-lead-approval__next-hint">{publishedHint}</p> : null}
        </section>
      ) : (
        <section className="card team-lead-approval__status" role="alert">
          <h2 className="section-title">Команда не найдена в плане</h2>
          <p className="muted-line">
            Срез: {scope.department || "—"} · {scope.unit || "—"} · {scope.team || "—"}
          </p>
          <p className="muted-line">
            Данные демо устарели. C&B: Настройки → «Сбросить пилот / план» или откройте приложение с{" "}
            <code>?reset=demo</code>.
          </p>
        </section>
      )}

      {approvalDiff && submissionMode ? (
        <TeamLeadApprovalChangesList
          rows={approvalDiff.rows}
          canEdit={canEditPlanning}
          positionsById={positionsById}
          versionLabel={draftLabel}
          submissionMode={submissionMode}
          planningLink={planningLink}
        />
      ) : null}
    </div>
  );
}
