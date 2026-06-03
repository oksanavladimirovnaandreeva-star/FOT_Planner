import { Link } from "react-router-dom";
import { VersionCompareDashboard } from "../VersionCompareDashboard";
import { formatDiffSummaryLine } from "../../data/planVersionDiff";
import {
  APPROVAL_RULE_DEFINITIONS,
  formatApprovalSubmitConfirm,
} from "../../data/planApprovalRules";
import { isBudgetLocked, PLAN_VERSION_STATUS_LABELS } from "../../data/planVersions";
import { useMvpApp } from "../../context/MvpAppContext";

export function PlanApprovalPanel() {
  const {
    activePlan,
    canEditPlan,
    workingDraft,
    latestApproved,
    primaryBudget,
    approvalRoute,
    versionDiff,
    draftApprovalCheck,
    createWorkingDraft,
    publishWorkingDraft,
    approvePrimaryBudget,
    submitDraftForApproval,
    openVersion,
    planVersionId,
  } = useMvpApp();

  const { rows, summary, baselinePositions, draftPositions } = versionDiff;
  const v1Locked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveV1 = primaryBudget && !v1Locked && canEditPlan;
  const canCreateDraft = Boolean(latestApproved && v1Locked && !workingDraft && canEditPlan);
  const canSubmitApproval = canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish = canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";
  const triggeredRuleIds = new Set(draftApprovalCheck.triggered.map((rule) => rule.id));

  const handleCreateDraft = () => {
    const result = createWorkingDraft(latestApproved?.id);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    openVersion(result.draftId);
  };

  const handleSubmitApproval = () => {
    const confirmText = formatApprovalSubmitConfirm(draftApprovalCheck);
    if (confirmText && !window.confirm(confirmText)) return;
    const result = submitDraftForApproval();
    if (!result.ok) window.alert(result.error);
  };

  return (
    <div className="plan-approval-panel">
      <div className="plan-approval-panel__hero card">
        <div>
          <h2 className="section-title">Маршрут согласования</h2>
          <p className="muted-line">
            Текущая версия: <strong>{activePlan.label}</strong> · {PLAN_VERSION_STATUS_LABELS[activePlan.status]}
            {!canEditPlan ? " · правки недоступны (роль или статус версии)" : ""}
          </p>
        </div>
        <div className="plan-approval-panel__actions">
          {canApproveV1 ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (!window.confirm("Утвердить бюджет v1?")) return;
                const result = approvePrimaryBudget();
                if (!result.ok) window.alert(result.error);
              }}
            >
              Утвердить v1
            </button>
          ) : null}
          {canCreateDraft ? (
            <button type="button" className="primary-btn" onClick={handleCreateDraft}>
              Создать квартальный черновик
            </button>
          ) : null}
          {canSubmitApproval ? (
            <button type="button" className="secondary-btn" onClick={handleSubmitApproval}>
              Отправить на согласование
            </button>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (!window.confirm("Опубликовать v+1 из черновика?")) return;
                const result = publishWorkingDraft();
                if (!result.ok) window.alert(result.error);
                else window.alert(`Создана ${result.versionLabel}.`);
              }}
            >
              Опубликовать v+1
            </button>
          ) : null}
          <Link className="secondary-btn" to="/versions">
            Реестр версий
          </Link>
        </div>
      </div>

      <ol className="plan-approval-stepper">
        {approvalRoute.map((step, index) => (
          <li
            key={step.id}
            className={`plan-approval-stepper__step plan-approval-stepper__step--${step.state}`}
          >
            <span className="plan-approval-stepper__index">{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="card plan-approval-panel__rules">
        <h3 className="section-title">Правила маршрута (MVP)</h3>
        <p className="muted-line">
          {workingDraft
            ? "Проверка новых событий черновика относительно утверждённой базы. При отправке — подтверждение, если сработали правила."
            : "Создайте квартальный черновик, чтобы увидеть сработавшие правила."}
        </p>
        <ul className="plan-approval-panel__rules-list">
          {APPROVAL_RULE_DEFINITIONS.map((rule) => {
            const triggered = draftApprovalCheck.triggered.find((item) => item.id === rule.id);
            const isActive = triggeredRuleIds.has(rule.id);
            return (
              <li
                key={rule.id}
                className={`plan-approval-panel__rules-item${isActive ? " plan-approval-panel__rules-item--triggered" : ""}`}
              >
                <div className="plan-approval-panel__rules-item-head">
                  <strong>{rule.title}</strong>
                  <span className="plan-approval-panel__rules-route">{rule.route}</span>
                </div>
                {isActive && triggered ? (
                  <ul className="plan-approval-panel__rules-matches">
                    {triggered.matches.map((match) => (
                      <li key={`${match.positionId}-${match.eventId ?? match.summary}`}>{match.summary}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted-line plan-approval-panel__rules-ok">Не требуется в текущем черновике</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {workingDraft && baselinePositions.length > 0 ? (
        <section className="plan-approval-panel__diff">
          <VersionCompareDashboard
            baselineLabel={summary.baselineLabel}
            draftLabel={summary.draftLabel}
            baselinePositions={baselinePositions}
            draftPositions={draftPositions}
          />
          <p className="muted-line">{formatDiffSummaryLine(summary)}</p>
          {rows.length > 0 ? (
            <p className="muted-line">
              Изменено позиций: {rows.length}. Детали событий — на вкладке «Журнал изменений».
            </p>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <p className="muted-line">
            {v1Locked
              ? "Создайте квартальный черновик, чтобы сравнить с базой и отправить на согласование."
              : "Сначала утвердите бюджет v1 на этой вкладке или на странице «Версии»."}
          </p>
        </section>
      )}

      <p className="muted-line plan-approval-panel__foot">
        Активная версия в данных: {planVersionId}
      </p>
    </div>
  );
}
