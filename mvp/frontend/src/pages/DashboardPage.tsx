import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { OrgSliceMultiSelect } from "../components/OrgSliceMultiSelect";
import { SliceToolbar, SliceToolbarSelect } from "../components/SliceToolbar";
import { useMvpApp } from "../context/MvpAppContext";
import {
  DEFAULT_DASHBOARD_FILTERS,
  filterPositionsForDashboard,
  monthlyPlanFactByLimit,
  monthlyPlanFactSeries,
  planFactByLimitYear,
  sliceAnalytics,
  type DashboardFilters,
} from "../data/dashboardMetrics";
import {
  availableTeamsForSlice,
  availableUnitsForSlice,
  updateOrgSliceDepartments,
  updateOrgSliceTeams,
  updateOrgSliceUnits,
} from "../data/orgSliceFilters";
import { PlanByLimitDonut, PlanFactMonthlyChart } from "../components/PlanLimitCharts";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import { departmentOptions, LIMIT_FLAG_LABELS } from "../data/planningData";
import { loadPersistedOrgSlice, savePersistedOrgSlice } from "../data/persistedOrgSlice";
import { roleOrgFilterDefaults } from "../data/userAccess";
import { ExportCsvActions } from "../components/ExportCsvActions";
import { PilotWelcomeBanner } from "../components/PilotWelcomeBanner";
import { PLAN_SCENARIO_INCLUDES_FACT } from "../data/planScenario";
import { WorkflowHint } from "../components/WorkflowHint";
import { formatMoneyPlain } from "../data/formatDisplay";
import type { LimitFlagKey } from "../types";
const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

export function DashboardPage() {
  const { positions, viewMode, activePlan, planVersionId, salaryBands, userRole } = useMvpApp();
  const orgFilterDefaults = useMemo(() => roleOrgFilterDefaults(userRole), [userRole]);
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const persisted = loadPersistedOrgSlice();
    if (persisted) {
      return {
        ...DEFAULT_DASHBOARD_FILTERS,
        departments: persisted.departments,
        units: persisted.units,
        teams: persisted.teams,
      };
    }
    return DEFAULT_DASHBOARD_FILTERS;
  });

  useEffect(() => {
    if (!orgFilterDefaults) return;
    setFilters((prev) => ({
      ...prev,
      departments: orgFilterDefaults.departments,
      units: orgFilterDefaults.units,
      teams: orgFilterDefaults.teams,
    }));
  }, [orgFilterDefaults]);

  useEffect(() => {
    if (orgFilterDefaults) return;
    savePersistedOrgSlice({
      departments: filters.departments,
      units: filters.units,
      teams: filters.teams,
    });
  }, [filters.departments, filters.units, filters.teams, orgFilterDefaults]);

  const unitOptionsList = useMemo(
    () => availableUnitsForSlice({ departments: filters.departments }),
    [filters.departments],
  );
  const teamOptionsList = useMemo(
    () => availableTeamsForSlice({ departments: filters.departments, units: filters.units }),
    [filters.departments, filters.units],
  );

  const displayPositions = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const filtered = useMemo(
    () => filterPositionsForDashboard(displayPositions, filters),
    [displayPositions, filters],
  );
  const analytics = useMemo(() => sliceAnalytics(filtered, viewMode), [filtered, viewMode]);
  const monthlyPf = useMemo(() => monthlyPlanFactSeries(filtered, viewMode), [filtered, viewMode]);
  const monthlyByLimit = useMemo(() => monthlyPlanFactByLimit(filtered, viewMode), [filtered, viewMode]);
  const limitYear = useMemo(() => planFactByLimitYear(filtered, viewMode), [filtered, viewMode]);

  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="content-page dashboard-page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title-row">Обзор и итого</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"}
          </p>
        </div>
        <div className="page-header__actions">
          <ExportCsvActions
            positions={filtered}
            viewMode={viewMode}
            planVersionId={planVersionId}
            planYear={activePlan.planYear}
            userRole={userRole}
            scope={{
              departments: filters.departments,
              units: filters.units,
              teams: filters.teams,
            }}
          />
          <Link className="primary-btn" to="/planning">
            Планирование
          </Link>
        </div>
      </header>

      <PilotWelcomeBanner />

      <SliceToolbar
        footer={<>{planVersionId} · {filtered.length} поз.</>}
      >
        <OrgSliceMultiSelect
          layout="toolbar"
          label="Департамент"
          options={departmentOptions()}
          value={filters.departments}
          disabled={orgFilterDefaults?.lockDepartment}
          onChange={(departments) =>
            setFilters((prev) => ({
              ...prev,
              ...updateOrgSliceDepartments(prev, departments),
            }))
          }
        />
        <OrgSliceMultiSelect
          layout="toolbar"
          label="Юнит"
          options={unitOptionsList}
          value={filters.units}
          disabled={orgFilterDefaults?.lockUnit}
          onChange={(units) =>
            setFilters((prev) => ({
              ...prev,
              ...updateOrgSliceUnits(prev, units),
            }))
          }
        />
        <OrgSliceMultiSelect
          layout="toolbar"
          label="Команда"
          options={teamOptionsList}
          value={filters.teams}
          disabled={orgFilterDefaults?.lockTeam}
          onChange={(teams) =>
            setFilters((prev) => ({
              ...prev,
              ...updateOrgSliceTeams(prev, teams),
            }))
          }
        />
        <SliceToolbarSelect
          label="Лимит"
          value={filters.limitFlag}
          onChange={(value) => updateFilter("limitFlag", value as DashboardFilters["limitFlag"])}
        >
          <option value="All">Все</option>
          <option value="IN_LIMIT">{LIMIT_FLAG_LABELS.IN_LIMIT}</option>
          <option value="OVER_LIMIT">{LIMIT_FLAG_LABELS.OVER_LIMIT}</option>
        </SliceToolbarSelect>
        <SliceToolbarSelect
          label="Статус"
          value={filters.status}
          onChange={(value) => updateFilter("status", value as DashboardFilters["status"])}
        >
          <option value="All">Все</option>
          <option value="Occupied">В штате</option>
          <option value="Vacancy">Вакансия</option>
          <option value="Closed">Закрыта</option>
        </SliceToolbarSelect>
      </SliceToolbar>

      {userRole === "cb_admin" && PLAN_SCENARIO_INCLUDES_FACT && !analytics.hasFactData ? (
        <WorkflowHint hintId="dashboard-fact" linkTo="/settings" linkLabel="Настройки → Данные">
          Импорт факта — в настройках (для раздела «Аналитика»).
        </WorkflowHint>
      ) : null}

        <AnalyticsSummaryStrip positions={filtered} viewMode={viewMode} salaryBands={salaryBands} showYtd />

      {PLAN_SCENARIO_INCLUDES_FACT && analytics.hasFactData ? (
      <section className="card dashboard-chart-card">
        <h2 className="section-title">План и факт</h2>
        <p className="muted-line">
          Подробнее — в <Link to="/analytics">аналитике</Link>.
        </p>
        <div className="dashboard-charts-grid">
          <div className="dashboard-charts-grid__main">
            <PlanFactMonthlyChart monthlyByLimit={monthlyByLimit} hasFactData={analytics.hasFactData} />
          </div>
          <aside className="dashboard-charts-grid__side">
            <h3 className="subsection-title">План за год по лимиту</h3>
            <PlanByLimitDonut byLimit={limitYear} hasFactData={analytics.hasFactData} />
          </aside>
        </div>
      </section>
      ) : null}

      <div className="dashboard-split">
          <section className="card">
            <h2 className="section-title">План по месяцам</h2>
            <table className="month-table">
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>План</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPf.map((row) => (
                  <tr key={row.month}>
                    <td>{row.label}</td>
                    <td>{formatMoneyPlain(row.plan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2 className="section-title">План по лимиту (год)</h2>
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Лимит</th>
                  <th>План</th>
                </tr>
              </thead>
              <tbody>
                {DISPLAY_LIMIT_FLAGS.map((flag) => {
                  const cell = limitYear[flag];
                  return (
                    <tr key={flag}>
                      <td>
                        <span className={`limit-flag-badge limit-flag-badge--${flag}`}>{LIMIT_FLAG_LABELS[flag]}</span>
                      </td>
                      <td>{formatMoneyPlain(cell.plan)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
    </div>
  );
}
