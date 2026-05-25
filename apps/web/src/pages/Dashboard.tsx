import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";
import { useViewMode } from "../ViewModeContext";

type MonthRow = { month: number; total_base: number; total_bonus: number; total: number };

type BudgetKpis = {
  positions: number;
  vacancies: number;
  fte_year: number;
  year_base: number;
  year_bonus: number;
  year_total: number;
  by_limit: Record<string, { year_base: number; year_bonus: number; year_total: number }>;
  growth_dec: Record<
    string,
    { dec_prev: number; dec_plan: number; net_growth: number; net_growth_pct: number | null }
  >;
};

export default function Dashboard() {
  const { planId, summary, error } = usePlanContext();
  const { viewMode } = useViewMode();
  const [data, setData] = useState<MonthRow[]>([]);
  const [kpis, setKpis] = useState<BudgetKpis | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    setLoadErr(null);
    Promise.all([
      api<{ months: MonthRow[] }>(`/api/v1/plans/${planId}/dashboard`),
      api<{ kpis: BudgetKpis }>(`/api/v1/plans/${planId}/budget`),
    ])
      .then(([d, b]) => {
        setData(d.months);
        setKpis(b.kpis);
      })
      .catch((e) => setLoadErr(e.message));
  }, [planId]);

  if (!planId && !error) {
    return (
      <div>
        <h2>Бюджет ФОТ</h2>
        <p className="empty-hint">Нет плана. Перезапустите API (демо-данные создаются при старте).</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => (viewMode === "total" ? d.total : d.total_base)), 1);
  const monthNames = ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

  const fmt = (n: number) => (n / 1e6).toFixed(2) + " млн";
  const yearDisplay = viewMode === "total" ? kpis?.year_total : kpis?.year_base;
  const yearLabel = viewMode === "total" ? "Общий ФОТ год" : "Оклад год";
  const limitTotal = viewMode === "total" ? kpis?.year_total : kpis?.year_base;

  return (
    <div>
      <h2>Бюджет ФОТ</h2>
      {loadErr && <div className="alert alert-error">{loadErr}</div>}
      {kpis && (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <div className="label">Позиции</div>
              <div className="value">{kpis.positions}</div>
            </div>
            <div className="kpi">
              <div className="label">Headcount (год)</div>
              <div className="value">{kpis.fte_year}</div>
            </div>
            <div className="kpi">
              <div className="label">Вакансии</div>
              <div className="value">{kpis.vacancies}</div>
            </div>
            <div className="kpi">
              <div className="label">{yearLabel}</div>
              <div className="value">{yearDisplay != null ? fmt(yearDisplay) : "—"}</div>
            </div>
            {viewMode === "total" && (
              <div className="kpi">
                <div className="label">в т.ч. премии</div>
                <div className="value">{fmt(kpis.year_bonus)}</div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>ФОТ по лимиту</h3>
            <div className="budget-split">
              {Object.entries(kpis.by_limit)
                .filter(([lf]) => lf !== "TOTAL")
                .map(([lf, v]) => (
                  <div className="kpi" key={lf}>
                    <div className="label">{lf}</div>
                    <div className="value">{fmt(viewMode === "total" ? v.year_total : v.year_base)}</div>
                  </div>
                ))}
              <div className="kpi">
                <div className="label">Итого</div>
                <div className="value">{limitTotal != null ? fmt(limitTotal) : "—"}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Чистый прирост (дек → дек)</h3>
            <table>
              <thead>
                <tr>
                  <th>Лимит</th>
                  <th>Дек пред. год</th>
                  <th>Дек план</th>
                  <th>Прирост</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(kpis.growth_dec)
                  .sort(([a], [b]) => (a === "TOTAL" ? 1 : b === "TOTAL" ? -1 : a.localeCompare(b)))
                  .map(([lf, g]) => (
                    <tr key={lf} className={lf === "TOTAL" ? "row-total" : ""}>
                      <td>{lf === "TOTAL" ? "Итого" : lf}</td>
                      <td>{g.dec_prev.toLocaleString("ru")}</td>
                      <td>{g.dec_plan.toLocaleString("ru")}</td>
                      <td>{g.net_growth.toLocaleString("ru")}</td>
                      <td>{g.net_growth_pct != null ? `${g.net_growth_pct}%` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {summary && !kpis && (
        <div className="kpi-row">
          <div className="kpi">
            <div className="label">ФОТ год (BASE)</div>
            <div className="value">{(summary.year_total_base / 1e6).toFixed(2)} млн</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{viewMode === "total" ? "Общий ФОТ по месяцам" : "Оклад BASE по месяцам"}</h3>
        {data.length === 0 ? (
          <p className="empty-hint">
            Нет строк плана. Нажмите «Пересчитать план» в сайдбаре или перейдите в{" "}
            <Link to="/planning">Планирование ФОТ</Link>.
          </p>
        ) : (
          <div className="chart-bars">
            {data.map((d) => (
              <div
                key={d.month}
                className="bar"
                style={{ height: `${((viewMode === "total" ? d.total : d.total_base) / max) * 100}%` }}
                title={`${monthNames[d.month]}: ${(viewMode === "total" ? d.total : d.total_base).toLocaleString("ru")} ₽`}
              />
            ))}
          </div>
        )}
      </div>

      <p>
        <Link to="/planning">Планирование ФОТ</Link> · <Link to="/variance">План-факт</Link>
      </p>
    </div>
  );
}
