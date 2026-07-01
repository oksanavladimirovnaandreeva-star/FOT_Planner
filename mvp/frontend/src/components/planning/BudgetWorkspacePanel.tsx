import { useMemo } from "react";
import { useMvpApp } from "../../context/MvpAppContext";
import { buildBudgetPackage, type BudgetTeamRow, type BudgetWorkspaceLevel } from "../../data/buildBudgetPackage";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { resolveCorrectionWindow } from "../../data/planCorrectionWindow";
import {
  applyPackageSubmissionAction,
  BUDGET_PIPELINE_LABELS,
  PACKAGE_PHASE_LABELS,
  type BudgetPipelineStep,
} from "../../data/packageSubmissionStore";
import { formatIsoDateTime } from "../../data/formatDisplay";
import {
  canApproveBudgetPackage,
  canReturnBudgetPackage,
  canSubmitBudgetPackage,
  packageStatusHint,
  packageSubmitConfirmMessage,
  packageTeamsProgressLine,
} from "../../data/budgetPackageWorkflow";
import {
  applySubmissionAction,
  resolveSubmissionPlanVersionId,
  type TeamSubmissionRecord,
} from "../../data/teamSubmissionStore";
import { buildTeamLeadVersionRibbon } from "../../data/teamLeadApprovalKanban";
import { canRolePerformSubmissionAction, submissionActionLabel } from "../../data/submissionWorkflowPolicy";
import { demoRoleActorOrg, demoRolePrimaryOrg, filterPositionsByRole } from "../../data/userAccess";
import { resolvePlanningTeamsForActivePersona } from "../../data/demoPersonas";
import { buildBudgetContour } from "../../data/buildBudgetContour";
import { loadResolvedDemoPersona, resolveActivePersonaOrgScope } from "../../data/demoSessionStore";
import { planWorkspacePath } from "../../data/planWorkspaceMode";
import { resolveBudgetWorkspacePositions } from "../../data/resolveBudgetWorkspacePositions";
import { ApprovalVersionRibbon } from "./ApprovalVersionRibbon";
import { CorrectionComparePanel } from "./CorrectionComparePanel";
import { TeamLeadApprovalKpi } from "./TeamLeadApprovalKpi";
import { BudgetContourPanel } from "./BudgetContourPanel";
import { BudgetTeamsTable } from "./BudgetTeamsTable";
import { BudgetChangesByType } from "./BudgetChangesByType";

const PIPELINE_STEPS: BudgetPipelineStep[] = [
  "in_progress",
  "teams_submitting",
  "awaiting_unit",
  "at_director",
  "at_cb",
  "published",
];

type Props = {
  level: BudgetWorkspaceLevel;
};

export function BudgetWorkspacePanel({ level }: Props) {
  const {
    positions,
    workingDraft,
    primaryBudget,
    latestApproved,
    versionDiff,
    userRole,
    refreshTeamSubmissions,
    teamSubmissionRevision,
  } = useMvpApp();

  const roleKey = level === "department" ? "director" : "unit_lead";
  const scope = useMemo(() => {
    const personaOrg = resolveActivePersonaOrgScope();
    const primary = personaOrg ?? {
      department: demoRolePrimaryOrg(roleKey).department,
      unit: demoRolePrimaryOrg(roleKey).unit,
      team: demoRolePrimaryOrg(roleKey).team,
      departments: demoRoleActorOrg(roleKey).departments,
      units: demoRoleActorOrg(roleKey).units,
      teams: demoRoleActorOrg(roleKey).teams,
    };
    const unit = primary.unit ?? primary.units[0] ?? "";
    return {
      department: primary.department,
      unit: level === "unit" ? unit : null,
      departments: primary.departments,
      units: primary.units,
      teams: primary.teams,
      scopeLabel:
        level === "department" ? `департамент ${primary.department}` : `юнит ${unit}`,
    };
  }, [level, roleKey]);

  const applied = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const positionsById = useMemo(
    () => new Map(applied.map((position) => [position.positionId, position])),
    [applied],
  );

  const roleScopedVersionDiff = useMemo(
    () => ({
      baseline: filterPositionsByRole(versionDiff.baselinePositions, userRole),
      draft: filterPositionsByRole(versionDiff.draftPositions, userRole),
    }),
    [versionDiff.baselinePositions, versionDiff.draftPositions, userRole],
  );

  const resolvedPositions = useMemo(
    () =>
      resolveBudgetWorkspacePositions({
        workingDraft,
        primaryBudget,
        versionDiffBaseline: roleScopedVersionDiff.baseline,
        versionDiffDraft: roleScopedVersionDiff.draft,
        appliedPlanPositions: applied,
      }),
    [workingDraft, primaryBudget, roleScopedVersionDiff, applied],
  );

  const pkg = useMemo(() => {
    void teamSubmissionRevision;
    return buildBudgetPackage({
      level,
      department: scope.department,
      unit: scope.unit,
      scopeLabel: scope.scopeLabel,
      positions: applied,
      baselinePositions: resolvedPositions.baselinePositions,
      draftPositions: resolvedPositions.draftPositions,
      workingDraft,
      primaryBudget,
      versionDiffSummary: versionDiff.summary,
      submissionMode: resolvedPositions.submissionMode,
    });
  }, [level, scope, applied, resolvedPositions, workingDraft, primaryBudget, versionDiff, teamSubmissionRevision]);

  const ribbonSteps = buildTeamLeadVersionRibbon({
    primaryBudget,
    workingDraft,
    latestApproved,
  });
  const correctionWindow = useMemo(
    () =>
      resolveCorrectionWindow(workingDraft ?? primaryBudget!, primaryBudget, {
        workspaceMode: "correction",
      }),
    [workingDraft, primaryBudget],
  );

  const primaryPlanningTeams = useMemo(() => resolvePlanningTeamsForActivePersona(), []);
  const persona = loadResolvedDemoPersona();
  const contour = useMemo(
    () =>
      buildBudgetContour({
        level,
        department: scope.department,
        unit: scope.unit,
        teams: pkg.teams,
        positions: applied,
        directReportPersonaIds: persona?.directReportPersonaIds,
      }),
    [level, scope.department, scope.unit, pkg.teams, applied, persona?.directReportPersonaIds],
  );
  const planningLink = planWorkspacePath("planning", { tab: "positions" });
  const planVersionId = workingDraft?.id ?? primaryBudget?.id ?? null;

  const submissionPlanVersionIdFor = (team: BudgetTeamRow) =>
    resolveSubmissionPlanVersionId(
      workingDraft?.id ?? null,
      primaryBudget,
      team.department,
      team.unit,
      team.team,
    );

  const teamApproveAction = level === "department" ? "director_approve" : "unit_approve";
  const teamApprovePhase = level === "department" ? "unit_approved" : "team_submitted";

  const handleTeamApprove = (team: BudgetTeamRow) => {
    const id = submissionPlanVersionIdFor(team);
    if (!id) return;
    const confirmText =
      level === "department"
        ? `Согласовать команду «${team.team}» директором?`
        : `Согласовать команду «${team.team}» и отправить дальше?`;
    if (!window.confirm(confirmText)) return;
    const result = applySubmissionAction({
      planVersionId: id,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: teamApproveAction,
      actor: { role: userRole },
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handleReturn = (team: BudgetTeamRow) => {
    const id = submissionPlanVersionIdFor(team);
    if (!id) return;
    const note = window.prompt("Комментарий к возврату (опционально):") ?? undefined;
    const result = applySubmissionAction({
      planVersionId: id,
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

  const canApproveTeam = (team: BudgetTeamRow, submission: TeamSubmissionRecord | null) =>
    submission?.phase === teamApprovePhase &&
    canRolePerformSubmissionAction(teamApproveAction, {
      actorRole: userRole,
      actorDepartments: scope.departments,
      actorUnits: scope.units,
      actorTeams: scope.teams,
      targetDepartment: team.department,
      targetUnit: team.unit,
      targetTeam: team.team,
    });

  const canReturnTeam = (team: BudgetTeamRow, submission: TeamSubmissionRecord | null) =>
    (submission?.phase === "team_submitted" || submission?.phase === "unit_approved") &&
    canRolePerformSubmissionAction("return", {
      actorRole: userRole,
      actorDepartments: scope.departments,
      actorUnits: scope.units,
      actorTeams: scope.teams,
      targetDepartment: team.department,
      targetUnit: team.unit,
      targetTeam: team.team,
    });

  const packageAction = level === "unit" ? "package_submit_unit" : "package_submit_department";
  const packageApproveAction =
    level === "unit" ? "package_approve_unit" : "package_approve_department";

  const packagePhase = pkg.packageSubmission?.phase ?? "collecting";

  const canSubmitPackage =
    planVersionId != null &&
    canSubmitBudgetPackage(packagePhase) &&
    canRolePerformSubmissionAction(packageAction, {
      actorRole: userRole,
      targetDepartment: scope.department,
      targetUnit: scope.unit ?? "",
    });

  const canApprovePackage =
    planVersionId != null &&
    canApproveBudgetPackage(packagePhase) &&
    canRolePerformSubmissionAction(packageApproveAction, {
      actorRole: userRole,
      targetDepartment: scope.department,
      targetUnit: scope.unit ?? "",
    });

  const canReturnPackage =
    planVersionId != null &&
    canReturnBudgetPackage(packagePhase) &&
    canRolePerformSubmissionAction("package_return", {
      actorRole: userRole,
      targetDepartment: scope.department,
      targetUnit: scope.unit ?? "",
    });

  const handlePackageSubmit = () => {
    if (!planVersionId) return;
    const label = submissionActionLabel(packageAction);
    const confirmMessage = packageSubmitConfirmMessage({
      label,
      submissionMode: pkg.submissionMode,
      teamsSubmitted: pkg.teamsSubmitted,
      teamsTotal: pkg.teamsTotal,
    });
    if (!window.confirm(confirmMessage)) {
      return;
    }
    const result = applyPackageSubmissionAction({
      planVersionId,
      level: level === "department" ? "department" : "unit",
      department: scope.department,
      unit: scope.unit,
      action: packageAction,
      actorRole: userRole,
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handlePackageApprove = () => {
    if (!planVersionId) return;
    const result = applyPackageSubmissionAction({
      planVersionId,
      level: level === "department" ? "department" : "unit",
      department: scope.department,
      unit: scope.unit,
      action: packageApproveAction,
      actorRole: userRole,
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handlePackageReturn = () => {
    if (!planVersionId) return;
    const note = window.prompt("Комментарий к возврату пакета (опционально):") ?? undefined;
    const result = applyPackageSubmissionAction({
      planVersionId,
      level: level === "department" ? "department" : "unit",
      department: scope.department,
      unit: scope.unit,
      action: "package_return",
      actorRole: userRole,
      note,
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const activePipelineIndex = PIPELINE_STEPS.indexOf(pkg.pipelineStep);

  const scopeTitle =
    level === "department" ? "Бюджет департамента к сдаче" : "Бюджет юнита к сдаче";
  const scopeLead = `Сводка по ${scope.scopeLabel}`;

  return (
    <div className="team-lead-approval budget-workspace">
      <ApprovalVersionRibbon
        steps={ribbonSteps}
        workingDraft={workingDraft}
        primaryBudget={primaryBudget}
      />

      <section className="card budget-workspace__pipeline" aria-label="Статус согласования">
        <h2 className="section-title">Статус</h2>
        <ol className="budget-workspace__pipeline-steps">
          {PIPELINE_STEPS.map((step, index) => {
            const state =
              index < activePipelineIndex ? "done" : index === activePipelineIndex ? "current" : "pending";
            return (
              <li
                key={step}
                className={`budget-workspace__pipeline-step budget-workspace__pipeline-step--${state}`}
              >
                <span className="budget-workspace__pipeline-dot" aria-hidden />
                <span>{BUDGET_PIPELINE_LABELS[step]}</span>
              </li>
            );
          })}
        </ol>
        {pkg.packageSubmission ? (
          <>
            <p className="muted-line">
              Пакет: <strong>{PACKAGE_PHASE_LABELS[pkg.packageSubmission.phase]}</strong>
              {pkg.packageSubmission.submittedAt && packagePhase !== "collecting"
                ? ` · ${formatIsoDateTime(pkg.packageSubmission.submittedAt)}`
                : ""}
            </p>
            {packagePhase === "returned" && pkg.packageSubmission.returnedNote ? (
              <p className="budget-workspace__return-note">{pkg.packageSubmission.returnedNote}</p>
            ) : null}
          </>
        ) : null}
        <p className="muted-line">
          {packageTeamsProgressLine({
            submissionMode: pkg.submissionMode,
            teamsSubmitted: pkg.teamsSubmitted,
            teamsTotal: pkg.teamsTotal,
            teamsAwaitingUnit: pkg.teamsAwaitingUnit,
          })}
        </p>
      </section>

      {workingDraft ? <CorrectionComparePanel correctionWindow={correctionWindow} /> : null}

      <TeamLeadApprovalKpi
        summary={pkg.totals}
        baselineLabel={pkg.baselineLabel}
        draftLabel={pkg.draftLabel}
        submissionMode={pkg.submissionMode}
        scopeTitle={scopeTitle}
        scopeLead={scopeLead}
      />

      <BudgetContourPanel contour={contour} hideUnitInTiles={level === "unit"} />

      <BudgetTeamsTable
        teams={pkg.teams}
        positions={applied}
        primaryPlanningTeams={primaryPlanningTeams}
        canUnitApprove={canApproveTeam}
        canReturn={canReturnTeam}
        onApprove={handleTeamApprove}
        onReturn={handleReturn}
        showUnitColumn={level === "department"}
      />

      <section className="card budget-workspace__package-actions" aria-label="Действия пакета">
        <h2 className="section-title">Согласование пакета</h2>
        {!pkg.packageSubmission ? (
          <p className="muted-line budget-workspace__package-phase">
            {packageStatusHint(pkg.submissionMode)}
          </p>
        ) : null}
        <div className="budget-workspace__package-buttons">
          {canSubmitPackage ? (
            <button type="button" className="primary-btn" onClick={handlePackageSubmit}>
              {submissionActionLabel(packageAction)}
            </button>
          ) : null}
          {canApprovePackage ? (
            <button type="button" className="primary-btn" onClick={handlePackageApprove}>
              {submissionActionLabel(packageApproveAction)}
            </button>
          ) : null}
          {canReturnPackage ? (
            <button type="button" className="secondary-btn" onClick={handlePackageReturn}>
              {submissionActionLabel("package_return")}
            </button>
          ) : null}
        </div>
      </section>

      <BudgetChangesByType
        groups={pkg.changesByType}
        rows={pkg.journalRows}
        positionsById={positionsById}
        versionLabel={pkg.draftLabel}
        planningLink={planningLink}
        submissionMode={pkg.submissionMode}
      />
    </div>
  );
}
