import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { CorrectionComparePanel } from "../components/planning/CorrectionComparePanel";
import { PlanApprovalPanel } from "../components/planning/PlanApprovalPanel";
import { formatApprovalSubmitConfirm } from "../data/planApprovalRules";
import { resolveCorrectionWindow } from "../data/planCorrectionWindow";
import { formatDiffSummaryLine } from "../data/planVersionDiff";
import {
  formatApprovePrimaryBudgetConfirm,
  formatReopenPrimaryBudgetConfirm,
  formatPlanVersionTitle,
  planVersionStatusUiLabel,
} from "../data/planVersionDisplay";
import { isBudgetLocked } from "../data/planVersions";
import { canReopenPrimaryBudget } from "../data/planVersionLifecycle";
import { canDeletePlanVersion } from "../data/planVersionDelete";
import { publishSubmissionHint } from "../data/teamSubmissionStore";
import { useMvpApp } from "../context/MvpAppContext";
import type { UserRole } from "../data/userAccess";
import { planWorkspacePath } from "../data/planWorkspaceMode";

const LEAD_ROLES: UserRole[] = ["cb_admin", "gd", "director", "unit_lead", "team_lead"];

type VersionsTab = "versions" | "approval" | "compare";

function parseVersionsTab(value: string | null): VersionsTab {
  if (value === "approval" || value === "consolidation") return "approval";
  if (value === "compare") return "compare";
  return "versions";
}

export function VersionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseVersionsTab(searchParams.get("tab"));
  const {
    planVersions,
    planVersionId,
    activePlan,
    canEditPlan,
    canManagePlanVersions,
    workingDraft,
    latestApproved,
    primaryBudget,
    approvalRoute,
    createWorkingDraft,
    publishWorkingDraft,
    approvePrimaryBudget,
    submitDraftForApproval,
    draftApprovalCheck,
    openVersion,
    deletePlanVersion,
    versionDiff,
    userRole,
    reopenPrimaryBudget,
  } = useMvpApp();

  const showApprovalTab = LEAD_ROLES.includes(userRole);

  useEffect(() => {
    if (canManagePlanVersions) return;
    if (tab === "versions") {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", "approval");
          return params;
        },
        { replace: true },
      );
    }
  }, [canManagePlanVersions, tab, setSearchParams]);

  const correctionWindow = useMemo(
    () => resolveCorrectionWindow(activePlan, primaryBudget, { workspaceMode: "correction" }),
    [activePlan, primaryBudget],
  );

  const setTab = (next: VersionsTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "versions") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  const { rows, summary } = versionDiff;
  const firstVersionLocked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveFirstVersion = primaryBudget && !firstVersionLocked && canManagePlanVersions && canEditPlan;
  const canCreateDraft = Boolean(latestApproved && firstVersionLocked && !workingDraft && canManagePlanVersions && canEditPlan);
  const canSubmitApproval =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";
  const canReopenBudget =
    canManagePlanVersions && primaryBudget ? canReopenPrimaryBudget(planVersions).ok : false;

  const handleOpenVersion = (id: string, goPlanning = false) => {
    const result = openVersion(id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    if (goPlanning) {
      const version = planVersions.find((item) => item.id === id);
      navigate(version?.kind === "WORKING_DRAFT" ? planWorkspacePath("correction") : "/planning");
    }
  };

  const handleCreateDraft = () => {
    const result = createWorkingDraft(latestApproved?.id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    handleOpenVersion(result.draftId, true);
  };

  const handleApproveV1 = () => {
    if (!primaryBudget) return;
    const confirmed = window.confirm(formatApprovePrimaryBudgetConfirm(primaryBudget));
    if (!confirmed) return;
    const result = approvePrimaryBudget();
    if (!result.ok) window.alert(result.error);
  };

  const handleReopenBudget = () => {
    if (!primaryBudget) return;
    if (!window.confirm(formatReopenPrimaryBudgetConfirm(primaryBudget))) return;
    const result = reopenPrimaryBudget();
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    navigate("/planning");
  };

  const handleSubmitApproval = () => {
    const confirmText = formatApprovalSubmitConfirm(draftApprovalCheck);
    if (confirmText && !window.confirm(confirmText)) return;
    const result = submitDraftForApproval();
    if (!result.ok) window.alert(result.error);
  };

  const handlePublish = () => {
    const hint = workingDraft ? publishSubmissionHint(workingDraft.id) : null;
    const lines = ["Создать следующую утверждённую версию из черновика?"];
    if (hint) lines.push("", hint);
    if (!window.confirm(lines.join("\n"))) return;
    const result = publishWorkingDraft();
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    openVersion(result.versionId);
    window.alert(`Создана ${result.versionLabel}.`);
  };

  const handleDeleteVersion = (versionId: string, label: string) => {
    const policy = canDeletePlanVersion(versionId, planVersions);
    if (!policy.ok) {
      window.alert(policy.error);
      return;
    }
    const isReset = planVersions.length <= 1;
    const confirmed = window.confirm(
      isReset
        ? `Сбросить «${label}»?\n\nВерсия вернётся в черновик. Позиции сохранятся, статус утверждения сбросится.`
        : `Удалить «${label}»?\n\nДанные позиций этой версии будут удалены из браузера. Действие необратимо.`,
    );
    if (!confirmed) return;
    const result = deletePlanVersion(versionId);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    window.alert(`Версия «${result.deletedLabel}» удалена.`);
  };

  const approveButtonLabel = primaryBudget
    ? `Утвердить · ${formatPlanVersionTitle(primaryBudget)}`
    : "Утвердить бюджет";

  return (
    <div className="content-page versions-page">
      <header className="content-page__header versions-page__header-compact">
        <div>
          <h1>{canManagePlanVersions ? "Версии" : "Согласование"}</h1>
          {!canManagePlanVersions ? null : tab === "approval" && !workingDraft && firstVersionLocked ? (
            <p className="muted-line">Утверждённый бюджет готов — создайте квартальный черновик для сдачи команд.</p>
          ) : null}
        </div>
        {((tab === "versions" && canManagePlanVersions) || (tab === "approval" && canManagePlanVersions && (canCreateDraft || canApproveFirstVersion))) ? (
        <div className="versions-page__actions">
          {canApproveFirstVersion ? (
            <button type="button" className="primary-btn" onClick={handleApproveV1}>
              {approveButtonLabel}
            </button>
          ) : null}
          {tab === "versions" && canReopenBudget ? (
            <button type="button" className="secondary-btn" onClick={handleReopenBudget}>
              Открыть бюджет для правок
            </button>
          ) : null}
          {canCreateDraft ? (
            <button type="button" className="primary-btn" onClick={handleCreateDraft}>
              Создать · 1 Квартал {primaryBudget?.planYear ?? 2026}
            </button>
          ) : null}
          {tab === "versions" && workingDraft ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                handleOpenVersion(workingDraft.id);
                navigate(planWorkspacePath("correction"));
              }}
            >
              Открыть черновик
            </button>
          ) : null}
          {canSubmitApproval ? (
            <button type="button" className="secondary-btn" onClick={handleSubmitApproval}>
              Отправить на согласование
            </button>
          ) : null}
          {canPublish ? (
            <button type="button" className="primary-btn" onClick={handlePublish}>
              Опубликовать следующую версию
            </button>
          ) : null}
        </div>
        ) : null}
      </header>

      <nav className="planning-workspace-tabs" aria-label="Разделы версий">
        {canManagePlanVersions ? (
        <button
          type="button"
          className={`planning-workspace-tabs__btn${tab === "versions" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setTab("versions")}
        >
          Версии бюджета
        </button>
        ) : null}
        {showApprovalTab ? (
          <button
            type="button"
            className={`planning-workspace-tabs__btn${tab === "approval" ? " planning-workspace-tabs__btn--active" : ""}`}
            onClick={() => setTab("approval")}
          >
            Согласование и сдача
          </button>
        ) : null}
        {workingDraft ? (
          <button
            type="button"
            className={`planning-workspace-tabs__btn${tab === "compare" ? " planning-workspace-tabs__btn--active" : ""}`}
            onClick={() => setTab("compare")}
          >
            Сравнение
          </button>
        ) : null}
      </nav>

      {tab === "approval" && showApprovalTab ? (
        <section className="planning-workspace-panel planning-workspace-panel--approval">
          <PlanApprovalPanel />
        </section>
      ) : null}

      {tab === "compare" && workingDraft ? (
        <CorrectionComparePanel workspaceMode="correction" correctionWindow={correctionWindow} />
      ) : null}

      {tab === "versions" && canManagePlanVersions ? (
      <>
      <section className="version-approval-route">
        <h2 className="version-approval-route__title">Маршрут</h2>
        <ol className="version-approval-route__steps">
          {approvalRoute.map((step) => (
            <li key={step.id} className={`version-approval-route__step version-approval-route__step--${step.state}`}>
              <span className="version-approval-route__dot" aria-hidden />
              <div>
                <strong>{step.label}</strong>
                <p>{step.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="versions-page__registry">
        <h2>История версий</h2>
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Версия</th>
              <th>Статус</th>
              <th>Создана</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...planVersions]
              .sort((a, b) => b.versionNumber - a.versionNumber || b.createdAt.localeCompare(a.createdAt))
              .map((version) => {
                const deletePolicy = canDeletePlanVersion(version.id, planVersions);
                return (
                <tr key={version.id} className={version.id === planVersionId ? "data-table__row--active" : ""}>
                  <td>
                    <strong>{version.label}</strong>
                    {version.kind === "WORKING_DRAFT" ? (
                      <span className="version-tag version-tag--draft">черновик</span>
                    ) : null}
                  </td>
                  <td>{planVersionStatusUiLabel(version.status)}</td>
                  <td className="muted-text">
                    {new Date(version.publishedAt ?? version.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td>
                    <div className="versions-page__row-actions">
                      <button
                        type="button"
                        className="app-btn app-btn--ghost app-btn--sm"
                        onClick={() => handleOpenVersion(version.id, version.kind === "WORKING_DRAFT")}
                      >
                        {version.kind === "WORKING_DRAFT" ? "Планирование" : "Открыть"}
                      </button>
                      {canManagePlanVersions ? (
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Удалить ${version.label}`}
                          data-hint={deletePolicy.ok ? "Удалить версию" : deletePolicy.error}
                          disabled={!deletePolicy.ok}
                          onClick={() => handleDeleteVersion(version.id, version.label)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      {workingDraft && rows.length > 0 ? (
        <section className="versions-page__changes card">
          <h2>Сводка изменений</h2>
          <p className="versions-page__summary">{formatDiffSummaryLine(summary)}</p>
          <div className="versions-page__audit-cta">
            <Link className="primary-btn" to="/versions?tab=compare">
              Сравнение и лимит
            </Link>
            <Link
              className="secondary-btn"
              to={planWorkspacePath("correction", {
                tab: "journal",
                diff: "1",
                positions: rows.map((row) => row.positionId).join(","),
              })}
            >
              Журнал ({rows.length} поз.)
            </Link>
          </div>
        </section>
      ) : workingDraft ? (
        <section className="versions-page__empty card">
          <p>Черновик без отличий от базы.</p>
        </section>
      ) : (
        <section className="versions-page__empty card">
          {firstVersionLocked && primaryBudget ? (
            <p>
              Создайте квартальный черновик от {formatPlanVersionTitle(primaryBudget)}, чтобы сравнить и править план.
            </p>
          ) : primaryBudget ? (
            <p>
              Сначала утвердите {formatPlanVersionTitle(primaryBudget)} или правьте на{" "}
              <Link to="/planning">планировании</Link>.
            </p>
          ) : (
            <p>
              Сначала утвердите бюджет или правьте на <Link to="/planning">планировании</Link>.
            </p>
          )}
        </section>
      )}

      {!canEditPlan && activePlan.kind === "APPROVED" && isBudgetLocked(activePlan) ? (
        <p className="versions-page__readonly muted-text">
          Открыта зафиксированная версия — только просмотр. Редактирование в{" "}
          {workingDraft ? (
            <button type="button" className="link-btn" onClick={() => handleOpenVersion(workingDraft.id, true)}>
              черновике
            </button>
          ) : (
            "квартальном черновике"
          )}
          .
        </p>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
