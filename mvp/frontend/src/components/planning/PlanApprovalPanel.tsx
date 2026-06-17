import { useMemo } from "react";
import { Link } from "react-router-dom";
import { VersionCompareDashboard } from "../VersionCompareDashboard";
import { formatDiffSummaryLine } from "../../data/planVersionDiff";
import {
  APPROVAL_RULE_DEFINITIONS,
  formatApprovalSubmitConfirm,
} from "../../data/planApprovalRules";
import { isBudgetLocked, PLAN_VERSION_STATUS_LABELS } from "../../data/planVersions";
import { useMvpApp } from "../../context/MvpAppContext";
import {
  applySubmissionAction,
  listSubmissionEntriesForPlan,
  summarizeSubmissionProgress,
} from "../../data/teamSubmissionStore";
import {
  canRolePerformSubmissionAction,
  submissionActionLabel,
  submissionPhaseBadgeClass,
  submissionPhaseLabel,
  type SubmissionWorkflowAction,
} from "../../data/submissionWorkflowPolicy";
import { demoRoleScope, type UserRole } from "../../data/userAccess";
import { planWorkspacePath } from "../../data/planWorkspaceMode";

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

const WORKFLOW_ACTIONS: SubmissionWorkflowAction[] = [
  "unit_approve",
  "director_approve",
  "cb_review",
  "return",
  "reopen_editing",
];

function actorOrgScope(role: UserRole) {
  if (role === "director") {
    const scope = demoRoleScope("director");
    return { department: scope.department, unit: null as string | null, team: null as string | null };
  }
  if (role === "unit_lead") {
    const scope = demoRoleScope("unit_lead");
    return { department: scope.department, unit: scope.unit ?? null, team: null as string | null };
  }
  if (role === "team_lead") {
    const scope = demoRoleScope("team_lead");
    return {
      department: scope.department,
      unit: scope.unit ?? null,
      team: scope.team ?? null,
    };
  }
  return { department: undefined, unit: null as string | null, team: null as string | null };
}

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
    userRole,
    refreshTeamSubmissions,
    teamSubmissionRevision,
  } = useMvpApp();

  const { rows, summary, baselinePositions, draftPositions } = versionDiff;
  const firstVersionLocked = primaryBudget ? isBudgetLocked(primaryBudget) : false;
  const canApproveFirstVersion = primaryBudget && !firstVersionLocked && canManagePlanVersions && canEditPlan;
  const canCreateDraft = Boolean(latestApproved && firstVersionLocked && !workingDraft && canManagePlanVersions && canEditPlan);
  const canSubmitApproval =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "DRAFT";
  const canPublish =
    canManagePlanVersions && canEditPlan && activePlan.kind === "WORKING_DRAFT" && activePlan.status === "IN_APPROVAL";
  const canManageSubmissionWorkflow = userRole !== "viewer";
  const triggeredRules = draftApprovalCheck.triggered;
  const triggeredRuleIds = new Set(triggeredRules.map((rule) => rule.id));
  const inactiveRules = APPROVAL_RULE_DEFINITIONS.filter((rule) => !triggeredRuleIds.has(rule.id));

  const submissionRows = useMemo(() => {
    if (!workingDraft) return [];
    void teamSubmissionRevision;
    return listSubmissionEntriesForPlan(workingDraft.id);
  }, [workingDraft, teamSubmissionRevision]);

  const submissionProgress = useMemo(() => summarizeSubmissionProgress(submissionRows), [submissionRows]);

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

  const updateSubmissionWorkflow = (
    action: SubmissionWorkflowAction,
    row: { department: string; unit: string; team: string },
  ) => {
    if (!workingDraft) return;
    if (action === "return") {
      const note = window.prompt("Комментарий к возврату (опционально):") ?? undefined;
      const result = applySubmissionAction({
        planVersionId: workingDraft.id,
        department: row.department,
        unit: row.unit,
        team: row.team,
        action,
        actor: { role: userRole },
        note,
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
    } else {
      const result = applySubmissionAction({
        planVersionId: workingDraft.id,
        department: row.department,
        unit: row.unit,
        team: row.team,
        action,
        actor: { role: userRole },
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
    }
    refreshTeamSubmissions();
  };

  const actorScope = actorOrgScope(userRole);

  return (
    <div className="plan-approval-panel">
      <section className="approval-control-tower card">
        <div className="approval-control-tower__head">
          <div>
            <h2 className="section-title">Control Tower</h2>
            <p className="muted-line">
              <strong>{activePlan.label}</strong> · {PLAN_VERSION_STATUS_LABELS[activePlan.status]}
              {!canEditPlan ? " · только просмотр" : ""}
            </p>
          </div>
          <div className="approval-control-tower__actions">
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
                Создать черновик
              </button>
            ) : null}
            {canSubmitApproval ? (
              <button type="button" className="secondary-btn" onClick={handleSubmitApproval}>
                На согласование
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
                Опубликовать
              </button>
            ) : null}
            <Link className="secondary-btn" to="/versions">
              Реестр
            </Link>
          </div>
        </div>

        <div className="approval-control-tower__kpi versions-page__kpi-grid">
          <article className="approval-kpi">
            <span className="approval-kpi__label">Команды</span>
            <strong className="approval-kpi__value">{submissionProgress.total}</strong>
            <span className="approval-kpi__hint">в очереди сдачи</span>
          </article>
          <article className="approval-kpi">
            <span className="approval-kpi__label">Принято C&B</span>
            <strong className="approval-kpi__value">{submissionProgress.cbReview}</strong>
            <span className="approval-kpi__hint">
              {submissionProgress.returned > 0 ? `${submissionProgress.returned} возврат(ов)` : "без возвратов"}
            </span>
          </article>
          <article className={`approval-kpi${triggeredRules.length > 0 ? " approval-kpi--warn" : ""}`}>
            <span className="approval-kpi__label">Исключения C&B</span>
            <strong className="approval-kpi__value">{triggeredRules.length}</strong>
            <span className="approval-kpi__hint">правил маршрута</span>
          </article>
          <article className="approval-kpi">
            <span className="approval-kpi__label">Δ черновика</span>
            <strong className="approval-kpi__value">{rows.length}</strong>
            <span className="approval-kpi__hint">позиций vs база</span>
          </article>
        </div>

        {workingDraft && submissionProgress.total > 0 ? (
          <div className="approval-control-tower__progress">
            <div className="approval-progress__meta">
              <span>Прогресс сдачи команд</span>
              <strong>{submissionProgress.completionPct}%</strong>
            </div>
            <div className="approval-progress__track" aria-hidden>
              <span
                className="approval-progress__fill"
                style={{ width: `${submissionProgress.completionPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <ol className="plan-approval-stepper plan-approval-stepper--rail">
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

      {workingDraft ? (
        <section className="card approval-teams-queue">
          <div className="approval-teams-queue__head">
            <h3 className="section-title">Очередь команд</h3>
            <Link className="secondary-btn approval-teams-queue__link" to="/versions?tab=consolidation">
              Ход планирования
            </Link>
          </div>
          {submissionRows.length === 0 ? (
            <p className="muted-line">Записей пока нет. Сдача начинается на вкладке «Ход планирования».</p>
          ) : (
            <div className="table-scroll">
              <table className="simple-table approval-teams-table">
                <thead>
                  <tr>
                    <th>Команда</th>
                    <th>Юнит</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {submissionRows.map((row) => {
                    const actions = WORKFLOW_ACTIONS.filter((action) =>
                      canRolePerformSubmissionAction(action, {
                        actorRole: userRole,
                        actorDepartment: actorScope.department,
                        actorUnit: actorScope.unit,
                        actorTeam: actorScope.team,
                        targetDepartment: row.department,
                        targetUnit: row.unit,
                        targetTeam: row.team,
                      }),
                    );
                    return (
                      <tr key={`${row.department}-${row.unit}-${row.team}`}>
                        <td>
                          <strong>{row.team}</strong>
                          <div className="muted-line">{row.department}</div>
                        </td>
                        <td>{row.unit}</td>
                        <td>
                          <span
                            className={`submission-phase-badge ${submissionPhaseBadgeClass(row.record.phase)}`}
                          >
                            {submissionPhaseLabel(row.record.phase)}
                          </span>
                          {row.record.returnedNote ? (
                            <div className="muted-line approval-teams-table__note">{row.record.returnedNote}</div>
                          ) : null}
                        </td>
                        <td>
                          {canManageSubmissionWorkflow && actions.length > 0 ? (
                            <div className="versions-page__row-actions">
                              {actions.map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  className="app-btn app-btn--ghost app-btn--sm"
                                  onClick={() => updateSubmissionWorkflow(action, row)}
                                >
                                  {submissionActionLabel(action)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="muted-line">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <section className="card plan-approval-panel__rules">
        <h3 className="section-title">Исключения маршрута C&B</h3>
        <p className="muted-line">
          Сработавшие правила по событиям черновика. При отправке на согласование потребуется подтверждение.
        </p>
        {triggeredRules.length === 0 ? (
          <p className="muted-line plan-approval-panel__rules-ok">Исключений нет — стандартный маршрут.</p>
        ) : (
          <ul className="plan-approval-panel__rules-list">
            {triggeredRules.map((triggered) => {
              const rule = APPROVAL_RULE_DEFINITIONS.find((item) => item.id === triggered.id);
              return (
                <li key={triggered.id} className="plan-approval-panel__rules-item plan-approval-panel__rules-item--triggered">
                  <div className="plan-approval-panel__rules-item-head">
                    <strong>{rule?.title ?? triggered.id}</strong>
                    {rule ? <span className="plan-approval-panel__rules-route">{rule.route}</span> : null}
                  </div>
                  <ul className="plan-approval-panel__rules-matches">
                    {triggered.matches.map((match) => (
                      <li key={`${match.positionId}-${match.eventId ?? match.summary}`}>{match.summary}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
        {inactiveRules.length > 0 ? (
          <details className="plan-approval-panel__rules-details">
            <summary>Все правила маршрута ({APPROVAL_RULE_DEFINITIONS.length})</summary>
            <ul className="plan-approval-panel__rules-list plan-approval-panel__rules-list--compact">
              {inactiveRules.map((rule) => (
                <li key={rule.id} className="plan-approval-panel__rules-item">
                  <div className="plan-approval-panel__rules-item-head">
                    <strong>{rule.title}</strong>
                    <span className="plan-approval-panel__rules-route">{rule.route}</span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {workingDraft && baselinePositions.length > 0 ? (
        <section className="plan-approval-panel__diff card">
          <div className="plan-approval-panel__diff-head">
            <h3 className="section-title">Сравнение с базой</h3>
            {rows.length > 0 ? (
              <Link
                className="secondary-btn"
                to={planWorkspacePath("correction", {
                  tab: "journal",
                  diff: "1",
                  positions: rows.map((row) => row.positionId).join(","),
                })}
              >
                Журнал ({rows.length})
              </Link>
            ) : null}
          </div>
          <VersionCompareDashboard
            baselineLabel={summary.baselineLabel}
            draftLabel={summary.draftLabel}
            baselinePositions={baselinePositions}
            draftPositions={draftPositions}
          />
          <p className="muted-line">{formatDiffSummaryLine(summary)}</p>
        </section>
      ) : (
        <section className="card">
          <p className="muted-line">
            {firstVersionLocked
              ? "Создайте квартальный черновик, чтобы сравнить с базой и отправить на согласование."
              : "Сначала утвердите Версию 1."}
          </p>
        </section>
      )}

      <details className="card plan-approval-panel__matrix-details">
        <summary className="section-title">Матрица прав по этапам (MVP)</summary>
        <p className="muted-line">Ориентир frontend-guards для workflow-сдачи команд.</p>
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
      </details>
    </div>
  );
}
