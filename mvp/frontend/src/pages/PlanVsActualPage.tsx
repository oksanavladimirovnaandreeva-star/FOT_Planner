import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { PlanFactBaselineBanner } from "../components/PlanFactBaselineBanner";
import { useMvpApp } from "../context/MvpAppContext";
import {
  formatMoney,
  hasPlanFactData,
  planFactByDepartment,
  planFactTotals,
  varianceTone,
} from "../data/planFactMetrics";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import {
  collectOccupancyMismatches,
  OCCUPANCY_MISMATCH_LABELS,
  type OccupancyMismatchKind,
} from "../data/occupancyReconciliation";
import { departmentOptions } from "../data/planningData";

export function PlanVsActualPage() {
  const { planFactBaseline: baseline, viewMode } = useMvpApp();
  const [department, setDepartment] = useState("All");
  const [search, setSearch] = useState("");
  const [mismatchKind, setMismatchKind] = useState<OccupancyMismatchKind | "All">("All");

  const appliedPositions = useMemo(
    () => mapPositionsWithAppliedEvents(baseline.positions),
    [baseline.positions],
  );

  const filtered = useMemo(() => {
    return appliedPositions.filter((position) => {
      if (department !== "All" && position.department !== department) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${position.department} ${position.unit} ${position.team}`.toLowerCase().includes(q)) return false;
      }
      return position.status !== "Closed";
    });
  }, [appliedPositions, department, search]);

  const factReady = hasPlanFactData();
  const totals = useMemo(() => planFactTotals(filtered, viewMode), [filtered, viewMode]);
  const rows = useMemo(() => planFactByDepartment(filtered, viewMode), [filtered, viewMode]);

  const occupancyMismatches = useMemo(() => collectOccupancyMismatches(appliedPositions), [appliedPositions]);
  const filteredMismatches = useMemo(() => {
    return occupancyMismatches.filter((item) => {
      if (mismatchKind !== "All" && item.kind !== mismatchKind) return false;
      if (department !== "All" && item.department !== department && item.positionId !== "—") return false;
      if (search && item.positionId !== "—") {
        const q = search.toLowerCase();
        if (!`${item.positionId} ${item.department} ${item.unit} ${item.team}`.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [occupancyMismatches, mismatchKind, department, search]);

  return (
    <div className="content-page plan-fact-page">
      <header className="page-header">
        <div>
          <h1>План и факт</h1>
          <p>
            {viewMode === "total" ? "Суммы: полный ФОТ" : "Суммы: тарифный оклад"} · {totals.ytdLabel}
            {!factReady && " · загрузите факт в «Данные»"}
          </p>
        </div>
      </header>

      <PlanFactBaselineBanner baseline={baseline} />

      <section className="kpi-grid kpi-grid--compact">
        <article className="kpi-card">
          <span>План YTD</span>
          <strong>{formatMoney(totals.plan, true)}</strong>
        </article>
        <article className="kpi-card">
          <span>Факт YTD</span>
          <strong className="text-muted-strong">{factReady ? formatMoney(totals.fact, true) : "—"}</strong>
        </article>
        <article className="kpi-card">
          <span>Отклонение</span>
          <strong className={`variance-value variance-value--${varianceTone(totals.variance)}`}>
            {factReady ? formatMoney(totals.variance, true) : "—"}
          </strong>
        </article>
        <article className="kpi-card">
          <span>% отклонения</span>
          <strong className={`variance-value variance-value--${varianceTone(totals.variance)}`}>
            {factReady ? `${totals.variancePct.toFixed(1)}%` : "—"}
          </strong>
        </article>
      </section>

      <section className="card filters-card">
        <h2 className="section-title">Срезы</h2>
        <div className="filters-grid filters-grid--toolbar">
          <label>
            Департамент
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="All">Все</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по оргструктуре…" />
          </label>
        </div>
      </section>

      <section className="card plan-fact-occupancy">
        <h2 className="section-title">Занятость: план ↔ факт</h2>
        <p className="muted-line">
          План — версия «{baseline.planVersion.label}». Только просмотр расхождений; план из факта не меняется. В импорте{" "}
          <code>lines</code> — <code>position_id</code> для посадки на слот.
        </p>
        {!factReady ? (
          <p className="muted-line">Загрузите факт, чтобы увидеть расхождения по занятости.</p>
        ) : (
          <>
            <div className="filters-grid filters-grid--toolbar">
              <label>
                Тип расхождения
                <select
                  value={mismatchKind}
                  onChange={(event) => setMismatchKind(event.target.value as OccupancyMismatchKind | "All")}
                >
                  <option value="All">Все</option>
                  {(Object.keys(OCCUPANCY_MISMATCH_LABELS) as OccupancyMismatchKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {OCCUPANCY_MISMATCH_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-scroll">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Слот</th>
                    <th>Месяц</th>
                    <th>План</th>
                    <th>Факт</th>
                    <th>Орг.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMismatches.map((item, index) => (
                    <tr key={`${item.kind}-${item.positionId}-${item.month}-${index}`}>
                      <td>{OCCUPANCY_MISMATCH_LABELS[item.kind]}</td>
                      <td>
                        {item.positionId !== "—" ? (
                          <Link to={`/planning?position=${item.positionId}`}>{item.positionId}</Link>
                        ) : (
                          "—"
                        )}
                        {item.role !== "—" ? <div className="muted-line">{item.role}</div> : null}
                      </td>
                      <td>{item.monthLabel}</td>
                      <td>
                        {item.planEmployeeId
                          ? `${item.planEmployeeName ?? item.planEmployeeId} (${item.planEmployeeId})`
                          : "вакансия"}
                      </td>
                      <td>{item.factEmployeeId ?? "—"}</td>
                      <td className="muted-line">
                        {item.department} / {item.unit} / {item.team}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredMismatches.length === 0 ? (
              <p className="muted-line">Расхождений по занятости нет (или не попали в фильтр).</p>
            ) : (
              <p className="muted-line">Найдено расхождений: {filteredMismatches.length}</p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">
          План / факт по департаментам · {baseline.planVersion.label}
        </h2>
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric">
            <thead>
              <tr>
                <th>Департамент</th>
                <th>План YTD</th>
                <th>Факт YTD</th>
                <th>Отклонение</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{formatMoney(row.plan)}</td>
                  <td className="text-muted-strong">{factReady ? formatMoney(row.fact) : "—"}</td>
                  <td className={`variance-value variance-value--${varianceTone(row.variance)}`}>
                    {factReady ? formatMoney(row.variance) : "—"}
                  </td>
                  <td className={`variance-value variance-value--${varianceTone(row.variance)}`}>
                    {factReady ? `${row.variancePct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="muted-line">Нет данных по фильтру.</p>}
      </section>
    </div>
  );
}
