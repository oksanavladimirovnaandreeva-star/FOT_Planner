import { Link } from "react-router-dom";
import { VersionCompareDashboard } from "../VersionCompareDashboard";
import { formatDiffSummaryLine } from "../../data/planVersionDiff";
import {
  APPROVAL_RULE_DEFINITIONS,
  formatApprovalSubmitConfirm,
} from "../../data/planApprovalRules";
import { isBudgetLocked, PLAN_VERSION_STATUS_LABELS } from "../../data/planVersions";
import { useMvpApp } from "../../context/MvpAppContext";
import { canRolePerformSubmissionAction, submissionActionLabel, type SubmissionWorkflowAction } from "../../data/submissionWorkflowPolicy";
import type { UserRole } from "../../data/userAccess";

const ROLE_LABELS: Record<UserRole, string> = {
  cb_admin: "C&B",
  gd: "GD",
  director: "Директор",
  unit_lead: "Юнит-лид",
  team_lead: "Тимлид",
  viewer: "Viewer",
};

const MATRIX_ACTIONS: SubmissionWorkflowAction[] = [
  "team_submit",
  "unit_approve",
  "director_approve",
  "cb_review",
  "return",
  "reopen_editing",
];

const MATRIX_ROLES: UserRole[] = ["cb_admin", "gd", "director", "unit_lead", "team_lead", "viewer"];

export function PlanApprovalPanel() {
  const {
    activePlan,
    canEditPlan,
    canManagePlanVersions,
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
  const firstVersionLocked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveFirstVersion = primaryBudget && !firstVersionLocked && canManagePlanVersions && canEditPlan;
  const canCreateDraft = Boolean(latestApproved && firstVersionLocked && !workingDraft && canManagePlanVersions && canEditPlan);
  const canSubmitApproval =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";
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
          {canApproveFirstVersion ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (!window.confirm("Утвердить Версию 1?")) return;
                const result = approvePrimaryBudget();
                if (!result.ok) window.alert(result.error);
              }}
            >
              Утвердить Версию 1
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
                if (!window.confirm("Опубликовать следующую версию из черновика?")) return;
                const result = publishWorkingDraft();
                if (!result.ok) window.alert(result.error);
                else window.alert(`Создана ${result.versionLabel}.`);
              }}
            >
              Опубликовать следующую версию
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

      <section className="card">
        <h3 className="section-title">Матрица прав по этапам</h3>
        <p className="muted-line">Ориентир MVP для workflow-сдачи команд (frontend-guards).</p>
        <div className="table-scroll">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Роль</th>
                {MATRIX_ACTIONS.map((action) => (
                  <th key={action}>{submissionActionLabel(action)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROLES.map((role) => (
                <tr key={role}>
                  <td>{ROLE_LABELS[role]}</td>
                  {MATRIX_ACTIONS.map((action) => {
                    const allowed = canRolePerformSubmissionAction(action, {
                      actorRole: role,
                      targetDepartment: "Engineering",
                      targetUnit: "ProductDev",
                      targetTeam: "Frontend Web",
                    });
                    return <td key={action}>{allowed ? "✓" : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            {firstVersionLocked
              ? "Создайте квартальный черновик, чтобы сравнить с базой и отправить на согласование."
              : "Сначала утвердите Версию 1 на этой вкладке или на странице «Версии»."}
          </p>
        </section>
      )}

      <p className="muted-line plan-approval-panel__foot">
        Активная версия в данных: {planVersionId}
      </p>
    </div>
  );
}
