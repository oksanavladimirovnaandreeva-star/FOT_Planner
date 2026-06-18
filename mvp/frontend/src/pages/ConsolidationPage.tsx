import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
import { ConsolidationProgressDonut } from "../components/planning/ConsolidationProgressDonut";
import { teamCorrectionHref } from "../data/consolidationNav";
import { formatMoney } from "../data/formatDisplay";
import { demoRoleActorOrg, demoRolePrimaryOrg } from "../data/userAccess";
import {
  buildOrgConsolidationReport,
  formatDeadlineShort,
  TEAM_DISPLAY_STATUS_LABELS,
  type TeamConsolidationRow,
  type TeamDisplayStatus,
  type UnitConsolidationGroup,
} from "../data/teamConsolidation";
import {
  applySubmissionAction,
} from "../data/teamSubmissionStore";
import { canRolePerformSubmissionAction } from "../data/submissionWorkflowPolicy";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import { isBudgetLocked, PLAN_VERSION_STATUS_LABELS } from "../data/planVersions";
import { formatPlanVersionTitle } from "../data/planVersionDisplay";
import type { UserRole } from "../data/userAccess";

function displayStatusClass(status: TeamDisplayStatus): string {
  return `consolidation-display-status consolidation-display-status--${status}`;
}

function formatSignedFotDelta(value: number): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), true)}`;
}

function resolveConsolidationScope(userRole: UserRole) {
  if (userRole === "unit_lead") {
    const primary = demoRolePrimaryOrg("unit_lead");
    const actor = demoRoleActorOrg("unit_lead");
    const unitLabel = actor.units.length > 1 ? actor.units.join(", ") : primary.unit;
    return {
      department: primary.department,
      unit: primary.unit,
      team: null as string | null,
      departments: actor.departments,
      units: actor.units,
      teams: actor.teams,
      scopeLabel: `юнит ${unitLabel ?? "—"}`,
    };
  }
  if (userRole === "team_lead") {
    const primary = demoRolePrimaryOrg("team_lead");
    const actor = demoRoleActorOrg("team_lead");
    const teamLabel = actor.teams.length > 1 ? actor.teams.join(", ") : primary.team;
    return {
      department: primary.department,
      unit: primary.unit,
      team: primary.team,
      departments: actor.departments,
      units: actor.units,
      teams: actor.teams,
      scopeLabel: `команда ${teamLabel ?? "—"}`,
    };
  }
  const role = userRole === "director" ? ("director" as const) : ("unit_lead" as const);
  const primary = demoRolePrimaryOrg(role);
  const actor = demoRoleActorOrg(role);
  const deptLabel = actor.departments.length > 1 ? actor.departments.join(", ") : primary.department;
  return {
    department: primary.department,
    unit: null as string | null,
    team: null as string | null,
    departments: actor.departments,
    units: actor.units,
    teams: actor.teams,
    scopeLabel: `департамент ${deptLabel}`,
  };
}

function canTeamLeadSubmitTeam(
  userRole: UserRole,
  team: TeamConsolidationRow,
  scope: ReturnType<typeof resolveConsolidationScope>,
  hasDraft: boolean,
  leadFrozen: boolean,
): boolean {
  if (!hasDraft) return false;
  return canRolePerformSubmissionAction("team_submit", {
    actorRole: userRole,
    actorDepartments: scope.departments,
    actorUnits: scope.units,
    actorTeams: scope.teams,
    targetDepartment: team.department,
    targetUnit: team.unit,
    targetTeam: team.team,
    leadEditFrozen: leadFrozen,
  });
}

function canUnitLeadReturnTeam(
  userRole: UserRole,
  team: TeamConsolidationRow,
  scope: ReturnType<typeof resolveConsolidationScope>,
): boolean {
  return canRolePerformSubmissionAction("return", {
    actorRole: userRole,
    actorDepartments: scope.departments,
    actorUnits: scope.units,
    actorTeams: scope.teams,
    targetDepartment: team.department,
    targetUnit: team.unit,
    targetTeam: team.team,
  });
}

function canUnitLeadApproveTeam(
  userRole: UserRole,
  team: TeamConsolidationRow,
  scope: ReturnType<typeof resolveConsolidationScope>,
): boolean {
  return canRolePerformSubmissionAction("unit_approve", {
    actorRole: userRole,
    actorDepartments: scope.departments,
    actorUnits: scope.units,
    actorTeams: scope.teams,
    targetDepartment: team.department,
    targetUnit: team.unit,
    targetTeam: team.team,
  });
}

function canUnitLeadApproveUnit(
  userRole: UserRole,
  group: UnitConsolidationGroup,
  scope: ReturnType<typeof resolveConsolidationScope>,
): boolean {
  if (!canRolePerformSubmissionAction("unit_approve", {
    actorRole: userRole,
    actorDepartments: scope.departments,
    actorUnits: scope.units,
    actorTeams: scope.teams,
    targetDepartment: scope.department,
    targetUnit: group.unit,
    targetTeam: group.teams[0]?.team ?? "",
  })) return false;
  if (group.teams.length === 0) return false;
  return group.teams.every(
    (team) =>
      team.displayStatus === "team_submitted" ||
      team.displayStatus === "returned" ||
      (team.displayStatus === "ready" && team.carryoverGaps === 0),
  );
}

export function ConsolidationPage({ embedded = false }: { embedded?: boolean }) {
  const {
    positions,
    activePlan,
    workingDraft,
    versionDiff,
    userRole,
    roleScopeHint,
    primaryBudget,
    leadEditFrozen,
    refreshTeamSubmissions,
    teamSubmissionRevision,
    canManagePlanVersions,
  } = useMvpApp();

  const annualBudgetOpen = Boolean(primaryBudget && !isBudgetLocked(primaryBudget));

  const scope = useMemo(() => resolveConsolidationScope(userRole), [userRole]);
  const planYear = primaryBudget?.planYear ?? activePlan.planYear ?? 2026;
  const applied = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
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
        submissionPlanVersionId: workingDraft?.id ?? null,
      }),
    [applied, scope, planYear, workingDraft, versionDiff, teamSubmissionRevision],
  );

  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => new Set(report.units.map((unit) => unit.unit)));

  const toggleUnit = (unit: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

  const draftId = workingDraft?.id;

  const handleTeamSubmit = (team: TeamConsolidationRow) => {
    if (!draftId) return;
    const result = applySubmissionAction({
      planVersionId: draftId,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: "team_submit",
      actor: { role: userRole, leadEditFrozen },
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handleReturnTeam = (team: TeamConsolidationRow) => {
    if (!draftId) return;
    const note = window.prompt("Комментарий к возврату (опционально):") ?? undefined;
    const result = applySubmissionAction({
      planVersionId: draftId,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: "return",
      actor: { role: userRole, leadEditFrozen },
      note,
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handleApproveTeam = (team: TeamConsolidationRow) => {
    if (!draftId) return;
    const result = applySubmissionAction({
      planVersionId: draftId,
      department: team.department,
      unit: team.unit,
      team: team.team,
      action: "unit_approve",
      actor: { role: userRole, leadEditFrozen },
    });
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    refreshTeamSubmissions();
  };

  const handleApproveUnit = (group: UnitConsolidationGroup) => {
    if (!draftId) return;
    for (const item of group.teams) {
      applySubmissionAction({
        planVersionId: draftId,
        department: item.department,
        unit: item.unit,
        team: item.team,
        action: "unit_approve",
        actor: { role: userRole, leadEditFrozen },
      });
    }
    refreshTeamSubmissions();
  };

  const renderTeamActions = (team: TeamConsolidationRow) => {
    const actions: ReactNode[] = [];
    if (canTeamLeadSubmitTeam(userRole, team, scope, Boolean(draftId), leadEditFrozen)) {
      actions.push(
        <button key="submit" type="button" className="secondary-btn consolidation-team-actions__btn" onClick={() => handleTeamSubmit(team)}>
          Сдал команду
        </button>,
      );
    }
    if (canUnitLeadReturnTeam(userRole, team, scope)) {
      actions.push(
        <button key="return" type="button" className="secondary-btn consolidation-team-actions__btn" onClick={() => handleReturnTeam(team)}>
          Вернуть на доработку
        </button>,
      );
    }
    if (canUnitLeadApproveTeam(userRole, team, scope)) {
      actions.push(
        <button key="approve-team" type="button" className="primary-btn consolidation-team-actions__btn" onClick={() => handleApproveTeam(team)}>
          Согласовать команду
        </button>,
      );
    }
    return actions.length ? <div className="consolidation-team-actions">{actions}</div> : null;
  };

  const isLeadRole = userRole === "team_lead" || userRole === "unit_lead";

  const body = (
    <>
      {!isLeadRole && workingDraft ? (
        <div className="consolidation-draft-banner" role="status">
          Работаем в <strong>{formatPlanVersionTitle(workingDraft)}</strong> · {PLAN_VERSION_STATUS_LABELS[workingDraft.status]}
          {canManagePlanVersions && workingDraft.status === "DRAFT" ? (
            <>
              {" "}
              · <Link to="/versions?tab=compare">сравнение</Link>
            </>
          ) : null}
        </div>
      ) : !isLeadRole && annualBudgetOpen && primaryBudget ? (
        <div className="consolidation-draft-banner" role="status">
          Годовой <strong>{formatPlanVersionTitle(primaryBudget)}</strong> ещё не утверждён —{" "}
          <Link to="/planning">планирование</Link>
          {canManagePlanVersions ? (
            <>
              {" · "}
              <Link to="/versions">утвердить</Link>
            </>
          ) : null}
        </div>
      ) : !isLeadRole && canManagePlanVersions ? (
        <div className="consolidation-draft-banner consolidation-draft-banner--warn" role="status">
          Квартальный черновик не создан.{" "}
          <Link to="/versions">Создать на «Версиях»</Link>
        </div>
      ) : null}

      {workingDraft && report.totals.filledTeams < report.totals.teams ? (
        <div className="consolidation-submit-banner" role="status">
          Не все команды сдали план: {report.totals.filledTeams} из {report.totals.teams}.
        </div>
      ) : null}

      {userRole === "unit_lead" ? (
        <section className="card consolidation-scope-banner" role="status">
          <strong>Срез: {scope.scopeLabel}</strong>
        </section>
      ) : null}

      <section className="card consolidation-campaign-head">
        <h2 className="section-title">Кампания планирования</h2>
        <p className="muted-line">
          {workingDraft ? formatPlanVersionTitle(workingDraft) : annualBudgetOpen && primaryBudget ? formatPlanVersionTitle(primaryBudget) : "Черновик не создан"} · {scope.scopeLabel}
        </p>
        <div className="consolidation-campaign-head__kpis">
          <span>{report.totals.headcount} поз.</span>
          <span>{report.totals.deltaEvents} событий</span>
          <span>Δ ФОТ {formatSignedFotDelta(report.totals.fotDeltaAnnual)}</span>
        </div>
        <div className="consolidation-campaign-head__donuts">
          <ConsolidationProgressDonut
            filled={report.totals.filledTeams}
            total={report.totals.teams}
            approved={report.totals.approvedTeams}
          />
        </div>
      </section>

      <section className="consolidation-deadlines">
        {report.deadlines.map((deadline) => (
            <article key={deadline.id} className="card consolidation-deadline">
              <h3 className="consolidation-deadline__label">{deadline.label}</h3>
              <p className="consolidation-deadline__date">{formatDeadlineShort(deadline.dueDate)}</p>
            </article>
        ))}
      </section>

      <section className="card consolidation-tree">
        <h2 className="section-title">Дерево юнитов и команд</h2>
        <ul className="consolidation-tree__list">
          {report.units.map((group) => {
            const expanded = expandedUnits.has(group.unit);
            return (
              <li key={group.unit} className="consolidation-tree__unit">
                <button
                  type="button"
                  className="consolidation-tree__unit-head"
                  onClick={() => toggleUnit(group.unit)}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <strong>{group.unit}</strong>
                  <span className="muted-line">
                    {group.teamsTotal} команд · {group.headcount} поз. · {group.deltaEvents} соб.
                    · сдано {group.teamsSubmitted}/{group.teamsTotal}
                  </span>
                  <span className={displayStatusClass(group.displayStatus)}>
                    {TEAM_DISPLAY_STATUS_LABELS[group.displayStatus]}
                  </span>
                  <span className="muted-line">{group.responsibleLabel}</span>
                  {canUnitLeadApproveUnit(userRole, group, scope) ? (
                    <button
                      type="button"
                      className="primary-btn consolidation-tree__unit-approve"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleApproveUnit(group);
                      }}
                    >
                      Согласовать юнит
                    </button>
                  ) : null}
                </button>
                {expanded ? (
                  <table className="simple-table consolidation-tree__teams">
                    <thead>
                      <tr>
                        <th>Команда</th>
                        <th>Ответственный</th>
                        <th>Позиций</th>
                        <th>События</th>
                        <th>Δ ФОТ год</th>
                        <th>Перенос</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={`${team.unit}-${team.team}`}>
                          <td>{team.team}</td>
                          <td>{team.responsibleLabel}</td>
                          <td>{team.headcount}</td>
                          <td>{team.deltaEvents > 0 ? team.deltaEvents : "—"}</td>
                          <td>{formatSignedFotDelta(team.fotDeltaAnnual)}</td>
                          <td>{team.carryoverGaps > 0 ? team.carryoverGaps : "—"}</td>
                          <td>
                            <span className={displayStatusClass(team.displayStatus)}>
                              {TEAM_DISPLAY_STATUS_LABELS[team.displayStatus]}
                            </span>
                          </td>
                          <td className="consolidation-tree__actions">
                            {renderTeamActions(team)}
                            <Link className="ghost-btn" to={teamCorrectionHref(team)}>
                              Планирование
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </li>
            );
          })}
        </ul>
        {report.units.length === 0 && <p className="muted-line">Нет команд в выбранном срезе.</p>}
      </section>
    </>
  );

  if (embedded) return body;

  return (
    <div className="content-page consolidation-page">
      <header className="page-header">
        <div>
          <h1>Ход планирования</h1>
          <p>
            {activePlan.label} · {scope.scopeLabel}
          </p>
          <p className="muted-line">{roleScopeHint}</p>
        </div>
        <div className="page-header__actions">
          {workingDraft ? (
            <Link className="secondary-btn" to="/versions?tab=compare">
              Сравнение
            </Link>
          ) : null}
          <Link className="primary-btn" to="/planning">
            Планирование
          </Link>
        </div>
      </header>
      {body}
    </div>
  );
}
