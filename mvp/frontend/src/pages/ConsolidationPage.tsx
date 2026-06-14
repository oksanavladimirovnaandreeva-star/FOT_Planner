import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
import { teamCorrectionHref, unitCorrectionHref } from "../data/consolidationNav";
import { formatMoney } from "../data/formatDisplay";
import { DEMO_ROLE_SCOPE } from "../data/userAccess";
import {
  buildOrgConsolidationReport,
  formatDeadlineShort,
  TEAM_LEAD_STATUS_LABELS,
  type TeamLeadStatus,
} from "../data/teamConsolidation";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import { PLAN_VERSION_STATUS_LABELS } from "../data/planVersions";

function statusClass(status: TeamLeadStatus): string {
  return `consolidation-status consolidation-status--${status}`;
}

function formatSignedFotDelta(value: number): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), true)}`;
}

function resolveConsolidationScope(userRole: import("../data/userAccess").UserRole) {
  if (userRole === "unit_lead") {
    return {
      department: DEMO_ROLE_SCOPE.unit_lead.department,
      unit: DEMO_ROLE_SCOPE.unit_lead.unit ?? null,
      team: null,
      scopeLabel: `юнит ${DEMO_ROLE_SCOPE.unit_lead.unit}`,
    };
  }
  if (userRole === "team_lead") {
    return {
      department: DEMO_ROLE_SCOPE.team_lead.department,
      unit: DEMO_ROLE_SCOPE.team_lead.unit ?? null,
      team: DEMO_ROLE_SCOPE.team_lead.team ?? null,
      scopeLabel: `команда ${DEMO_ROLE_SCOPE.team_lead.team}`,
    };
  }
  const department =
    userRole === "director" ? DEMO_ROLE_SCOPE.director.department : DEMO_ROLE_SCOPE.unit_lead.department;
  return { department, unit: null, team: null, scopeLabel: `департамент ${department}` };
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
  } = useMvpApp();

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
      }),
    [applied, scope, planYear, workingDraft, versionDiff],
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

  const now = new Date();

  const body = (
    <>
      {workingDraft ? (
        <div className="consolidation-draft-banner" role="status">
          Черновик <strong>{workingDraft.label}</strong> · {PLAN_VERSION_STATUS_LABELS[workingDraft.status]}
          {workingDraft.status === "DRAFT" ? (
            <>
              {" "}
              · <Link to="/versions?tab=approval">отправить на согласование</Link>
              {" · "}
              <Link to="/versions?tab=compare">сравнение и лимит</Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="consolidation-draft-banner consolidation-draft-banner--warn" role="status">
          Квартальный черновик не создан.{" "}
          <Link to="/versions">Создайте на «Версии»</Link>, чтобы отслеживать сдачу команд.
        </div>
      )}

      {userRole === "unit_lead" || userRole === "team_lead" ? (
        <section className="card consolidation-scope-banner" role="status">
          <strong>Срез: {scope.scopeLabel}</strong>
          <span className="muted-line">
            {userRole === "unit_lead"
              ? "Сводка по командам вашего юнита · правки — в корректировке"
              : "Сводка по вашей команде · правки — в корректировке"}
          </span>
          {scope.unit ? (
            <Link className="secondary-btn consolidation-scope-banner__cta" to={unitCorrectionHref(scope.department, scope.unit)}>
              Открыть корректировку юнита
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="consolidation-deadlines">
        {report.deadlines.map((deadline) => {
          const past = now.getTime() > deadline.dueDate.getTime();
          return (
            <article
              key={deadline.id}
              className={`card consolidation-deadline${past ? " consolidation-deadline--past" : ""}`}
            >
              <h3 className="consolidation-deadline__label">{deadline.label}</h3>
              <p className="consolidation-deadline__date">{formatDeadlineShort(deadline.dueDate)}</p>
              <p className="muted-line">{deadline.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="card consolidation-summary">
        <h2 className="section-title">
          Сводка · {scope.scopeLabel}
        </h2>
        <div className="consolidation-summary__grid">
          <div>
            <span className="consolidation-summary__value">{report.totals.teams}</span>
            <span className="muted-line">команд</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.headcount}</span>
            <span className="muted-line">позиций</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.deltaEvents}</span>
            <span className="muted-line">новых событий</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{formatSignedFotDelta(report.totals.fotDeltaAnnual)}</span>
            <span className="muted-line">Δ ФОТ год (черновик)</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.readyTeams}</span>
            <span className="muted-line">готово</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.overdueTeams}</span>
            <span className="muted-line">просрочено</span>
          </div>
        </div>
        <div className="consolidation-summary__status-row">
          {(["ready", "in_progress", "not_started", "submitted", "overdue"] as TeamLeadStatus[]).map((status) => {
            const count = report.units
              .flatMap((unit) => unit.teams)
              .filter((team) => team.status === status).length;
            if (count === 0) return null;
            return (
              <span key={status} className={statusClass(status)}>
                {TEAM_LEAD_STATUS_LABELS[status]}: {count}
              </span>
            );
          })}
        </div>
      </section>

      <section className="card consolidation-tree">
        <h2 className="section-title">Дерево юнитов и команд</h2>
        <p className="muted-line">
          Статус — по событиям черновика и дедлайну. «Корректировка» откроет срез команды; при событиях — журнал diff.
        </p>
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
                    {group.teams.length} команд · {group.headcount} поз. · {group.deltaEvents} соб.
                    {group.teams.reduce((sum, team) => sum + team.fotDeltaAnnual, 0) !== 0
                      ? ` · Δ ${formatSignedFotDelta(group.teams.reduce((sum, team) => sum + team.fotDeltaAnnual, 0))}`
                      : ""}
                  </span>
                  <Link
                    className="consolidation-tree__unit-link secondary-btn"
                    to={unitCorrectionHref(scope.department, group.unit)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Корректировка
                  </Link>
                </button>
                {expanded ? (
                  <table className="simple-table consolidation-tree__teams">
                    <thead>
                      <tr>
                        <th>Команда</th>
                        <th>Позиций</th>
                        <th>События</th>
                        <th>Δ ФОТ год</th>
                        <th>Перенос</th>
                        <th>Статус</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={`${team.unit}-${team.team}`}>
                          <td>{team.team}</td>
                          <td>{team.headcount}</td>
                          <td>{team.deltaEvents > 0 ? team.deltaEvents : "—"}</td>
                          <td>{formatSignedFotDelta(team.fotDeltaAnnual)}</td>
                          <td>{team.carryoverGaps > 0 ? team.carryoverGaps : "—"}</td>
                          <td>
                            <span className={statusClass(team.status)}>{TEAM_LEAD_STATUS_LABELS[team.status]}</span>
                          </td>
                          <td className="consolidation-tree__actions">
                            <Link className="ghost-btn" to={teamCorrectionHref(team)}>
                              {team.deltaEvents > 0 ? "Журнал diff" : "Корректировка"}
                            </Link>
                            {team.deltaEvents > 0 ? (
                              <Link className="ghost-btn" to="/versions?tab=compare">
                                Compare
                              </Link>
                            ) : null}
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

      {userRole === "team_lead" && scope.unit && scope.team ? (
        <p className="muted-line">
          Ваш срез —{" "}
          <Link
            to={teamCorrectionHref({
              department: scope.department,
              unit: scope.unit,
              team: scope.team,
              deltaPositionIds: [],
            })}
          >
            открыть корректировку команды
          </Link>
          .
        </p>
      ) : null}
    </>
  );

  if (embedded) return body;

  return (
    <div className="content-page consolidation-page">
      <header className="page-header">
        <div>
          <h1>Консолидация тимлидов</h1>
          <p>
            {activePlan.label} · {scope.scopeLabel}
          </p>
          <p className="muted-line">{roleScopeHint}</p>
        </div>
        <div className="page-header__actions">
          <Link className="secondary-btn" to="/planning?mode=correction">
            Корректировка
          </Link>
          {workingDraft ? (
            <Link className="secondary-btn" to="/versions?tab=compare">
              Сравнение
            </Link>
          ) : null}
          <Link className="secondary-btn" to="/versions?tab=approval">
            Согласование
          </Link>
          <Link className="primary-btn" to="/planning">
            Планирование
          </Link>
        </div>
      </header>
      {body}
    </div>
  );
}
