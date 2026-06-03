import { Link, useNavigate } from "react-router-dom";
import { VersionCompareDashboard } from "../components/VersionCompareDashboard";
import { formatApprovalSubmitConfirm } from "../data/planApprovalRules";
import { formatDiffSummaryLine } from "../data/planVersionDiff";
import { isBudgetLocked, PLAN_VERSION_STATUS_LABELS } from "../data/planVersions";
import { useMvpApp } from "../context/MvpAppContext";

export function VersionsPage() {
  const navigate = useNavigate();
  const {
    planVersions,
    planVersionId,
    activePlan,
    canEditPlan,
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
    versionDiff,
  } = useMvpApp();

  const { rows, summary, baselinePositions, draftPositions } = versionDiff;
  const v1Locked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveV1 = primaryBudget && !v1Locked;
  const canCreateDraft = Boolean(latestApproved && v1Locked && !workingDraft);
  const canSubmitApproval = activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish = activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";

  const handleOpenVersion = (id: string, goPlanning = false) => {
    const result = openVersion(id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    if (goPlanning) navigate("/planning");
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
    const confirmed = window.confirm("Утвердить бюджет v1? После этого правки только через квартальный черновик.");
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
    const confirmed = window.confirm("Создать новую утверждённую версию (v+1) из черновика?");
    if (!confirmed) return;
    const result = publishWorkingDraft();
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    openVersion(result.versionId);
    window.alert(`Создана ${result.versionLabel}.`);
  };

  return (
    <div className="content-page versions-page">
      <header className="content-page__header versions-page__header-compact">
        <div>
          <h1>Версии бюджета</h1>
          <p className="content-page__lead">
            Жизненный цикл: v1 → утверждение → квартальный черновик → согласование → v+1. События по позициям — в{" "}
            <Link to="/audit">аудите</Link>, правки — в <Link to="/planning">планировании</Link>.
          </p>
        </div>
        <div className="versions-page__actions">
          {canApproveV1 ? (
            <button type="button" className="primary-btn" onClick={handleApproveV1}>
              Утвердить бюджет v1
            </button>
          ) : null}
          {canCreateDraft ? (
            <button type="button" className="primary-btn" onClick={handleCreateDraft}>
              Создать квартальный черновик
            </button>
          ) : null}
          {workingDraft ? (
            <button type="button" className="secondary-btn" onClick={() => handleOpenVersion(workingDraft.id, true)}>
              Открыть черновик в планировании
            </button>
          ) : null}
          {canSubmitApproval ? (
            <button type="button" className="secondary-btn" onClick={handleSubmitApproval}>
              Отправить на согласование
            </button>
          ) : null}
          {canPublish ? (
            <button type="button" className="primary-btn" onClick={handlePublish}>
              Опубликовать v+1
            </button>
          ) : null}
        </div>
      </header>

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
              .map((version) => (
                <tr key={version.id} className={version.id === planVersionId ? "data-table__row--active" : ""}>
                  <td>
                    <strong>{version.label}</strong>
                    {version.kind === "WORKING_DRAFT" ? (
                      <span className="version-tag version-tag--draft">черновик</span>
                    ) : null}
                  </td>
                  <td>{PLAN_VERSION_STATUS_LABELS[version.status]}</td>
                  <td className="muted-text">
                    {new Date(version.publishedAt ?? version.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="app-btn app-btn--ghost app-btn--sm"
                      onClick={() => handleOpenVersion(version.id, version.kind === "WORKING_DRAFT")}
                    >
                      {version.kind === "WORKING_DRAFT" ? "Планирование" : "Открыть"}
                    </button>
                  </td>
                </tr>
              ))}
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
                <Link
                  className="primary-btn"
                  to={`/planning?tab=journal&diff=1&positions=${rows.map((row) => row.positionId).join(",")}`}
                >
                  Журнал изменений ({rows.length} поз.)
                </Link>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="versions-page__empty card">
          {v1Locked ? (
            <p>Создайте квартальный черновик от {latestApproved?.label}, чтобы сравнить и править план.</p>
          ) : (
            <p>
              Сначала утвердите бюджет v1 или правьте его на{" "}
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
    </div>
  );
}
