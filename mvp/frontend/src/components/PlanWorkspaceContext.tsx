import { useNavigate } from "react-router-dom";
import { useMvpApp } from "../context/MvpAppContext";
import {
  formatPlanVersionOptionLabel,
  formatPlanVersionTitle,
  formatReopenPrimaryBudgetConfirm,
} from "../data/planVersionDisplay";
import { canCreateQuarterlyWorkingDraft, canReopenPrimaryBudget } from "../data/planVersionLifecycle";
import { isBudgetLocked } from "../data/planVersions";
import { resolvePlanWorkspaceStatus } from "../data/planWorkspaceStatus";
import { roleCanSwitchPlanVersions } from "../data/userAccess";
import { planWorkspacePath } from "../data/planWorkspaceMode";

export function PlanWorkspaceContext() {
  const navigate = useNavigate();
  const {
    userRole,
    planVersions,
    planVersionId,
    setPlanVersionId,
    activePlan,
    canEditPlan,
    leadEditFrozenForRole,
    primaryBudget,
    latestApproved,
    workingDraft,
    openVersion,
    reopenPrimaryBudget,
    canManagePlanVersions,
    createWorkingDraft,
  } = useMvpApp();

  const canSwitchVersions = roleCanSwitchPlanVersions(userRole);
  const workspaceStatus = resolvePlanWorkspaceStatus({
    activePlan,
    canEditPlan,
    leadEditFrozenForRole,
  });

  const approvedBaseline = latestApproved && isBudgetLocked(latestApproved) ? latestApproved : null;
  const approvedLabel = approvedBaseline
    ? formatPlanVersionTitle(approvedBaseline)
    : primaryBudget && !isBudgetLocked(primaryBudget)
      ? "На утверждении"
      : "—";

  const workingLabel = workingDraft
    ? formatPlanVersionTitle(workingDraft)
    : canEditPlan && activePlan.kind === "APPROVED" && activePlan.status === "DRAFT"
      ? formatPlanVersionTitle(activePlan)
      : approvedBaseline
        ? formatPlanVersionTitle(approvedBaseline)
        : primaryBudget
          ? formatPlanVersionTitle(primaryBudget)
          : "—";

  const reopenPolicy = primaryBudget ? canReopenPrimaryBudget(planVersions) : { ok: false as const, error: "" };

  const handleReopen = () => {
    if (!primaryBudget) return;
    if (!window.confirm(formatReopenPrimaryBudgetConfirm(primaryBudget))) return;
    const result = reopenPrimaryBudget();
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    navigate("/planning");
  };

  const workingCardActive =
    Boolean(workingDraft) ||
    (canEditPlan && activePlan.kind === "APPROVED" && activePlan.status === "DRAFT");

  const canCreateQuarterlyDraft = canCreateQuarterlyWorkingDraft({
    canManagePlanVersions,
    latestApproved,
    primaryBudget,
    workingDraft,
  });

  const handleCreateQuarterlyDraft = () => {
    const result = createWorkingDraft(latestApproved?.id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    const opened = openVersion(result.draftId);
    if (!opened.ok) {
      window.alert(opened.error);
      return;
    }
    navigate(planWorkspacePath("correction"));
  };

  return (
    <div className="plan-workspace-context">
      <div className="plan-workspace-context__grid">
        <div
          className={`plan-workspace-context__card${!workingCardActive ? " plan-workspace-context__card--active" : ""}`}
        >
          <span className="plan-workspace-context__card-label">Утверждённый бюджет</span>
          <strong className="plan-workspace-context__card-value">{approvedLabel}</strong>
        </div>
        <div
          className={`plan-workspace-context__card${workingCardActive ? " plan-workspace-context__card--active" : ""}`}
        >
          <span className="plan-workspace-context__card-label">Работаем в</span>
          <strong className="plan-workspace-context__card-value">{workingLabel}</strong>
        </div>
      </div>

      <span className={`app-status-chip app-status-chip--${workspaceStatus.tone}`}>{workspaceStatus.label}</span>

      {canCreateQuarterlyDraft ? (
        <button type="button" className="app-btn app-btn--primary app-btn--sm" onClick={handleCreateQuarterlyDraft}>
          Создать квартальный черновик
        </button>
      ) : null}

      {canSwitchVersions ? (
        <>
          <label className="app-field plan-workspace-context__switch">
            <span>Переключить версию (C&B)</span>
            <select value={planVersionId} onChange={(event) => setPlanVersionId(event.target.value)}>
              {planVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {formatPlanVersionOptionLabel(version)}
                </option>
              ))}
            </select>
          </label>
          {workingDraft && planVersionId !== workingDraft.id ? (
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--sm"
              onClick={() => {
                const result = openVersion(workingDraft.id);
                if (!result.ok) window.alert(result.error);
                else navigate("/planning?mode=correction");
              }}
            >
              Открыть {formatPlanVersionTitle(workingDraft)}
            </button>
          ) : null}
          {canManagePlanVersions && reopenPolicy.ok ? (
            <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={handleReopen}>
              Открыть бюджет для правок
            </button>
          ) : canManagePlanVersions && !reopenPolicy.ok && primaryBudget && isBudgetLocked(primaryBudget) ? (
            <p className="plan-workspace-context__hint muted-line">{reopenPolicy.error}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
