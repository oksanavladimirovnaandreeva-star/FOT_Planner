import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
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

export function ConsolidationPage() {
  const {
    positions,
    activePlan,
    workingDraft,
    versionDiff,
    userRole,
    roleScopeHint,
    primaryBudget,
  } = useMvpApp();

  const department =
    userRole === "team_lead"
      ? DEMO_ROLE_SCOPE.team_lead.department
      : DEMO_ROLE_SCOPE.unit_lead.department;

  const planYear = primaryBudget?.planYear ?? activePlan.planYear ?? 2026;
  const applied = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const report = useMemo(
    () =>
      buildOrgConsolidationReport(applied, {
        department,
        planYear,
        workingDraft,
        baselinePositions: versionDiff.baselinePositions,
        draftPositions: versionDiff.draftPositions,
      }),
    [applied, department, planYear, workingDraft, versionDiff],
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

  return (
    <div className="content-page consolidation-page">
      <header className="page-header">
        <div>
          <h1>Консолидация тимлидов</h1>
          <p>
            {activePlan.label} · {department} · сводка по командам для юнит-лида
          </p>
          <p className="muted-line">{roleScopeHint}</p>
        </div>
        <div className="page-header__actions">
          <Link className="secondary-btn" to="/planning?tab=approval">
            Согласование
          </Link>
          <Link className="primary-btn" to="/planning">
            Планирование
          </Link>
        </div>
      </header>

      {workingDraft ? (
        <div className="consolidation-draft-banner" role="status">
          Черновик <strong>{workingDraft.label}</strong> · {PLAN_VERSION_STATUS_LABELS[workingDraft.status]}
          {workingDraft.status === "DRAFT" ? (
            <>
              {" "}
              · <Link to="/planning?tab=approval">отправить на согласование</Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="consolidation-draft-banner consolidation-draft-banner--warn" role="status">
          Квартальный черновик не создан.{" "}
          <Link to="/versions">Создайте на «Версии»</Link>, чтобы отслеживать сдачу команд.
        </div>
      )}

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
        <h2 className="section-title">Сводка · {department}</h2>
        <div className="consolidation-summary__grid">
          <div>
            <span className="consolidation-summary__value">{report.totals.teams}</span>
            <span className="muted-line">команд</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.headcount}</span>
            <span className="muted-line">слотов</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.deltaEvents}</span>
            <span className="muted-line">новых событий в черновике</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.carryoverGaps}</span>
            <span className="muted-line">без события переноса</span>
          </div>
          <div>
            <span className="consolidation-summary__value">{report.totals.overdueTeams}</span>
            <span className="muted-line">просрочено</span>
          </div>
        </div>
      </section>

      <section className="card consolidation-tree">
        <h2 className="section-title">Дерево юнитов и команд</h2>
        <p className="muted-line">Клик по юниту — свернуть/развернуть команды. Статус — по событиям черновика и дедлайну правок.</p>
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
                    {group.teams.length} команд · {group.headcount} слотов · {group.deltaEvents} соб.
                  </span>
                </button>
                {expanded ? (
                  <table className="simple-table consolidation-tree__teams">
                    <thead>
                      <tr>
                        <th>Команда</th>
                        <th>Слотов</th>
                        <th>События в черновике</th>
                        <th>Перенос</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={`${team.unit}-${team.team}`}>
                          <td>{team.team}</td>
                          <td>{team.headcount}</td>
                          <td>{team.deltaEvents}</td>
                          <td>{team.carryoverGaps > 0 ? team.carryoverGaps : "—"}</td>
                          <td>
                            <span className={statusClass(team.status)}>{TEAM_LEAD_STATUS_LABELS[team.status]}</span>
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
        {report.units.length === 0 && <p className="muted-line">Нет команд в выбранном департаменте.</p>}
      </section>

      {userRole === "team_lead" ? (
        <p className="muted-line">
          Режим тимлида: в таблице видны все команды департамента; ваш срез —{" "}
          {DEMO_ROLE_SCOPE.team_lead.unit} / {DEMO_ROLE_SCOPE.team_lead.team}. Полные правки — в{" "}
          <Link to="/planning">планировании</Link>.
        </p>
      ) : null}
    </div>
  );
}
