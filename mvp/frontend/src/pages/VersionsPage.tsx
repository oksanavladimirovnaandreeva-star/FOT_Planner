import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { VersionCompareDashboard } from "../components/VersionCompareDashboard";
import { CorrectionComparePanel } from "../components/planning/CorrectionComparePanel";
import { PlanApprovalPanel } from "../components/planning/PlanApprovalPanel";
import { formatApprovalSubmitConfirm } from "../data/planApprovalRules";
import { resolveCorrectionWindow } from "../data/planCorrectionWindow";
import { formatDiffSummaryLine } from "../data/planVersionDiff";
import { planVersionStatusUiLabel } from "../data/planVersionDisplay";
import { isBudgetLocked } from "../data/planVersions";
import { canDeletePlanVersion } from "../data/planVersionDelete";
import { useMvpApp } from "../context/MvpAppContext";
import { ConsolidationPage } from "./ConsolidationPage";
import type { UserRole } from "../data/userAccess";
import { planWorkspacePath } from "../data/planWorkspaceMode";

const CONSOLIDATION_ROLES: UserRole[] = ["cb_admin", "gd", "director", "unit_lead", "team_lead"];

type VersionsTab = "versions" | "consolidation" | "approval" | "compare";

function parseVersionsTab(value: string | null): VersionsTab {
  if (value === "consolidation") return "consolidation";
  if (value === "approval") return "approval";
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
  } = useMvpApp();

  const showConsolidation = CONSOLIDATION_ROLES.includes(userRole);

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

  const { rows, summary, baselinePositions, draftPositions } = versionDiff;
  const firstVersionLocked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveFirstVersion = primaryBudget && !firstVersionLocked && canManagePlanVersions && canEditPlan;
  const canCreateDraft = Boolean(latestApproved && firstVersionLocked && !workingDraft && canManagePlanVersions && canEditPlan);
  const canSubmitApproval =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";

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
    const confirmed = window.confirm("Утвердить Версию 1? После этого правки только через квартальный черновик.");
    if (!confirmed) return;
    const result = approvePrimaryBudget();
    if (!result.ok) window.alert(result.error);
  };

  const handleSubmitApproval = () => {
    const confirmText = formatApprovalSubmitConfirm(draftApprovalCheck);
    if (confirmText && !window.confirm(confirmText)) return;
    const result = submitDraftForApproval();
    if (!result.ok) window.alert(result.error);
  };

  const handlePublish = () => {
    const confirmed = window.confirm("Создать следующую утверждённую версию из черновика?");
    if (!confirmed) return;
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
    const confirmed = window.confirm(
      `Удалить версию «${label}»?\n\nДанные позиций этой версии будут удалены из браузера. Действие необратимо.`,
    );
    if (!confirmed) return;
    const result = deletePlanVersion(versionId);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    window.alert(`Версия «${result.deletedLabel}» удалена.`);
  };

  return (
    <div className="content-page versions-page">
      <header className="content-page__header versions-page__header-compact">
        <div>
          <h1>Версии и согласование</h1>
          <p className="content-page__lead">
            Жизненный цикл: Версия 1 → утверждение → квартальный черновик → согласование → следующая версия. События по позициям — в{" "}
            <Link to="/audit">аудите</Link>, правки — в <Link to="/planning">планировании</Link>.
          </p>
        </div>
        {tab === "versions" ? (
        <div className="versions-page__actions">
          {canApproveFirstVersion ? (
            <button type="button" className="primary-btn" onClick={handleApproveV1}>
              Утвердить Версию 1
            </button>
          ) : null}
          {canCreateDraft ? (
            <button type="button" className="primary-btn" onClick={handleCreateDraft}>
              Создать квартальный черновик
            </button>
          ) : null}
          {workingDraft ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                handleOpenVersion(workingDraft.id);
                navigate(planWorkspacePath("correction"));
              }}
            >
              Открыть в корректировке
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
        <button
          type="button"
          className={`planning-workspace-tabs__btn${tab === "versions" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setTab("versions")}
        >
          Версии бюджета
        </button>
        {showConsolidation ? (
          <button
            type="button"
            className={`planning-workspace-tabs__btn${tab === "consolidation" ? " planning-workspace-tabs__btn--active" : ""}`}
            onClick={() => setTab("consolidation")}
          >
            Ход планирования
          </button>
        ) : null}
        <button
          type="button"
          className={`planning-workspace-tabs__btn${tab === "approval" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setTab("approval")}
        >
          Согласование
        </button>
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

      {tab === "consolidation" && showConsolidation ? <ConsolidationPage embedded /> : null}

      {tab === "approval" ? (
        <section className="planning-workspace-panel planning-workspace-panel--approval">
          <PlanApprovalPanel />
        </section>
      ) : null}

      {tab === "compare" && workingDraft ? (
        <CorrectionComparePanel workspaceMode="correction" correctionWindow={correctionWindow} />
      ) : null}

      {tab === "versions" ? (
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

      {workingDraft && baselinePositions.length > 0 ? (
        <>
          <VersionCompareDashboard
            baselineLabel={summary.baselineLabel}
            draftLabel={summary.draftLabel}
            baselinePositions={baselinePositions}
            draftPositions={draftPositions}
          />
          <section className="versions-page__changes card">
            <h2>Сводка diff</h2>
            <p className="versions-page__summary">{formatDiffSummaryLine(summary)}</p>
            {rows.length === 0 ? (
              <p className="muted-text">Нет отличий от базы.</p>
            ) : (
              <div className="versions-page__audit-cta">
                <p className="muted-text">
                  Детализация по событиям (месяц, статус, оклад, комментарии) — в аудите, не дублируем таблицу здесь.
                </p>
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
            )}
          </section>
        </>
      ) : (
        <section className="versions-page__empty card">
          {firstVersionLocked ? (
            <p>Создайте квартальный черновик от {latestApproved?.label}, чтобы сравнить и править план.</p>
          ) : (
            <p>
              Сначала утвердите Версию 1 или правьте её на{" "}
              <Link to="/planning">планировании</Link>.
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
