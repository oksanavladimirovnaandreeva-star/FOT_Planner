import { useMemo } from "react";
import { Link } from "react-router-dom";
import { APPROVAL_RULE_DEFINITIONS } from "../../data/planApprovalRules";
import { formatCorrectionCycleBadge, formatPlanVersionTitle } from "../../data/planVersionDisplay";
import { PLAN_VERSION_STATUS_LABELS } from "../../data/planVersions";
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
import { demoRoleActorOrg, type UserRole } from "../../data/userAccess";
import { ConsolidationPage } from "../../pages/ConsolidationPage";
import { TeamLeadApprovalPanel } from "./TeamLeadApprovalPanel";
import { BudgetWorkspacePanel } from "./BudgetWorkspacePanel";

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
    return demoRoleActorOrg("director");
  }
  if (role === "unit_lead") {
    return demoRoleActorOrg("unit_lead");
  }
  if (role === "team_lead") {
    return demoRoleActorOrg("team_lead");
  }
  return { departments: [], units: [], teams: [] };
}

export function PlanApprovalPanel() {
  const {
    activePlan,
    canEditPlan,
    canManagePlanVersions,
    workingDraft,
    draftApprovalCheck,
    userRole,
    refreshTeamSubmissions,
    teamSubmissionRevision,
  } = useMvpApp();

  const canManageSubmissionWorkflow = userRole !== "viewer";
  const showApprovalReference = userRole === "cb_admin" || userRole === "gd" || userRole === "director";
  const triggeredRules = draftApprovalCheck.triggered;
  const triggeredRuleIds = new Set(triggeredRules.map((rule) => rule.id));
  const inactiveRules = APPROVAL_RULE_DEFINITIONS.filter((rule) => !triggeredRuleIds.has(rule.id));

  const submissionRows = useMemo(() => {
    if (!workingDraft) return [];
    void teamSubmissionRevision;
    return listSubmissionEntriesForPlan(workingDraft.id);
  }, [workingDraft, teamSubmissionRevision]);

  const submissionProgress = useMemo(() => summarizeSubmissionProgress(submissionRows), [submissionRows]);

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
  const cycleBadge = formatCorrectionCycleBadge(activePlan);

  if (userRole === "team_lead") {
    return (
      <div className="plan-approval-panel">
        <TeamLeadApprovalPanel />
      </div>
    );
  }

  if (userRole === "unit_lead") {
    return (
      <div className="plan-approval-panel">
        <BudgetWorkspacePanel level="unit" />
      </div>
    );
  }

  if (userRole === "director") {
    return (
      <div className="plan-approval-panel">
        <BudgetWorkspacePanel level="department" />
      </div>
    );
  }

  if (!workingDraft) {
    return (
      <div className="plan-approval-panel">
        <section className="card workflow-hint" role="status">
          <h2 className="section-title">Сдача команд ещё не открыта</h2>
          <p className="workflow-hint__text">
            {canManagePlanVersions
              ? "Квартальный черновик создаётся на вкладке «Версии бюджета»: сначала утвердите годовой бюджет, затем «Создать · 1 Квартал». После этого команды смогут сдавать план здесь."
              : "C&B ещё не открыл квартальный черновик. Когда черновик появится, здесь будет сдача вашей команды."}
          </p>
          {canManagePlanVersions ? (
            <Link className="workflow-hint__link" to="/versions">
              Версии бюджета → создать квартальный черновик
            </Link>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="plan-approval-panel">
      <section className="approval-control-tower card">
        <div className="approval-control-tower__head">
          <div>
            <h2 className="section-title">Согласование</h2>
            <p className="muted-line">
              <strong>{cycleBadge}</strong> · {formatPlanVersionTitle(activePlan)} · {PLAN_VERSION_STATUS_LABELS[activePlan.status]}
              {!canEditPlan ? " · только просмотр" : ""}
            </p>
          </div>
          {canManagePlanVersions ? (
            <Link className="secondary-btn" to="/versions">
              Версии и публикация
            </Link>
          ) : null}
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
            <span className="approval-kpi__label">Нужен C&B</span>
            <strong className="approval-kpi__value">{triggeredRules.length}</strong>
            <span className="approval-kpi__hint">особых случаев</span>
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

      <section className="card approval-consolidation-embed">
        <ConsolidationPage embedded />
      </section>

      <section className="card approval-teams-queue">
          <h3 className="section-title">Очередь команд</h3>
          {submissionRows.length === 0 ? (
            <p className="muted-line">Записей пока нет — сдача начинается в блоке «Ход планирования» выше.</p>
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
                        actorDepartments: actorScope.departments,
                        actorUnits: actorScope.units,
                        actorTeams: actorScope.teams,
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

      {triggeredRules.length > 0 ? (
        <section className="card plan-approval-panel__cb-alert" role="status">
          <h3 className="section-title">Требует внимания C&B</h3>
          <ul className="plan-approval-panel__rules-matches">
            {triggeredRules.flatMap((triggered) => {
              const rule = APPROVAL_RULE_DEFINITIONS.find((item) => item.id === triggered.id);
              return triggered.matches.map((match) => (
                <li key={`${triggered.id}-${match.positionId}-${match.eventId ?? match.summary}`}>
                  <strong>{rule?.title ?? triggered.id}</strong> — {match.summary}
                </li>
              ));
            })}
          </ul>
        </section>
      ) : null}

      {showApprovalReference ? (
      <section className="card plan-approval-panel__rules">
        <h3 className="section-title">Исключения маршрута C&B</h3>
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
      ) : null}

      {showApprovalReference ? (
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
      ) : null}
    </div>
  );
}
