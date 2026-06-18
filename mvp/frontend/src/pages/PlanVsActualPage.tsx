import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlanFactBaselineBanner } from "../components/PlanFactBaselineBanner";
import { SliceToolbar, SliceToolbarSelect } from "../components/SliceToolbar";
import { useMvpApp } from "../context/MvpAppContext";
import {
  formatMoney,
  hasPlanFactData,
  planFactByDepartment,
  planFactEconomyAndOverspendTotals,
  planFactPositionRows,
  planFactTotals,
  varianceTone,
} from "../data/planFactMetrics";
import {
  collectPlanFactVarianceDrivers,
  summarizeVarianceDrivers,
} from "../data/planFactVarianceDrivers";

import {
  collectOccupancyMismatches,
  OCCUPANCY_MISMATCH_LABELS,
  type OccupancyMismatchKind,
} from "../data/occupancyReconciliation";
import { departmentOptions } from "../data/planningData";

export function PlanVsActualPage({ embedded = false }: { embedded?: boolean }) {
  const { planFactBaseline: baseline, viewMode } = useMvpApp();
  const [department, setDepartment] = useState("All");
  const [search, setSearch] = useState("");
  const [mismatchKind, setMismatchKind] = useState<OccupancyMismatchKind | "All">("All");

  const appliedPositions = baseline.appliedPositions;

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
  const economyTotals = useMemo(
    () => planFactEconomyAndOverspendTotals(filtered, viewMode),
    [filtered, viewMode],
  );
  const positionVarianceRows = useMemo(
    () => planFactPositionRows(filtered, viewMode).slice(0, 25),
    [filtered, viewMode],
  );
  const rows = useMemo(() => planFactByDepartment(filtered, viewMode), [filtered, viewMode]);
  const driverSummary = useMemo(
    () => summarizeVarianceDrivers(collectPlanFactVarianceDrivers(filtered, viewMode)),
    [filtered, viewMode],
  );

  const occupancyMismatches = useMemo(
    () => collectOccupancyMismatches(appliedPositions),
    [appliedPositions],
  );
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

  const body = (
    <>
      {!embedded ? <PlanFactBaselineBanner baseline={baseline} /> : null}

      {!embedded ? (
      <div className="plan-fact-readonly-note" role="note">
        Всегда <strong>план − факт</strong>: плюс — экономия, минус — перерасход. Факт не меняет план.
      </div>
      ) : null}

      <SliceToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по оргструктуре…"
      >
        <SliceToolbarSelect label="Департамент" value={department} onChange={setDepartment}>
          <option value="All">Все</option>
          {departmentOptions().map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SliceToolbarSelect>
        <SliceToolbarSelect
          label="Занятость"
          value={mismatchKind}
          onChange={(value) => setMismatchKind(value as OccupancyMismatchKind | "All")}
        >
          <option value="All">Все расхождения</option>
          {(Object.keys(OCCUPANCY_MISMATCH_LABELS) as OccupancyMismatchKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {OCCUPANCY_MISMATCH_LABELS[kind]}
            </option>
          ))}
        </SliceToolbarSelect>
      </SliceToolbar>

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
          <span>План − факт</span>
          <strong className={`variance-value variance-value--${varianceTone(totals.variance)}`}>
            {factReady ? formatMoney(totals.variance, true) : "—"}
          </strong>
        </article>
        <article className="kpi-card">
          <span>Экономия / перерасход</span>
          <strong className="muted-line plan-fact-kpi-split">
            {factReady ? (
              <>
                <span className="variance-value variance-value--under">
                  {formatMoney(economyTotals.economy, true)}
                </span>
                {" / "}
                <span className="variance-value variance-value--over">
                  {formatMoney(economyTotals.overspend, true)}
                </span>
              </>
            ) : (
              "—"
            )}
          </strong>
        </article>
      </section>

      {factReady && driverSummary.length > 0 ? (
        <section className="card">
          <h2 className="section-title">Почему отклонение (YTD)</h2>
          <div className="table-scroll">
            <table className="simple-table simple-table--numeric">
              <thead>
                <tr>
                  <th>Причина</th>
                  <th>Экономия</th>
                  <th>Перерасход</th>
                  <th>Нетто</th>
                </tr>
              </thead>
              <tbody>
                {driverSummary.slice(0, 6).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.label}
                      <div className="muted-line">{row.hint}</div>
                    </td>
                    <td className="variance-value variance-value--under">
                      {row.economy > 0 ? formatMoney(row.economy, true) : "—"}
                    </td>
                    <td className="variance-value variance-value--over">
                      {row.overspend > 0 ? formatMoney(row.overspend, true) : "—"}
                    </td>
                    <td className={`variance-value variance-value--${varianceTone(row.netDelta)}`}>
                      {formatMoney(row.netDelta, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted-line">
            Полный разбор — <Link to="/analytics?tab=deviation">Отклонения</Link>.
          </p>
        </section>
      ) : null}

      <section className="card plan-fact-occupancy">
        <h2 className="section-title">Занятость: план ↔ факт</h2>
        <p className="muted-line">
          План — версия «{baseline.planVersion.label}». Расхождения занятости — отдельно от Δ ФОТ.
        </p>
        {!factReady ? (
          <p className="muted-line">Загрузите факт, чтобы увидеть расхождения по занятости.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Позиция</th>
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

      {factReady ? (
        <section className="card">
          <h2 className="section-title">Отклонения ФОТ по позициям (YTD)</h2>
          <p className="muted-line">Одна колонка: план − факт.</p>
          <div className="table-scroll">
            <table className="simple-table simple-table--numeric">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>План YTD</th>
                  <th>Факт YTD</th>
                  <th>План − факт</th>
                </tr>
              </thead>
              <tbody>
                {positionVarianceRows.map((row) => (
                  <tr key={row.positionId}>
                    <td>
                      <Link to={`/planning?position=${row.positionId}`}>{row.positionId}</Link>
                      <div className="muted-line">{row.role}</div>
                    </td>
                    <td>{formatMoney(row.planYtd)}</td>
                    <td className="text-muted-strong">{formatMoney(row.factYtd)}</td>
                    <td className={`variance-value variance-value--${varianceTone(row.delta)}`}>
                      {formatMoney(row.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
                <th>План − факт</th>
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
    </>
  );

  if (embedded) return body;

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
      {body}
    </div>
  );
}
