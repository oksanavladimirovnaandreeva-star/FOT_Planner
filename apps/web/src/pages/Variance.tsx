import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";
import { useViewMode } from "../ViewModeContext";

type Report = {
  rows: {
    employee_external_id: string;
    position_external_id: string;
    month: number;
    limit_flag: string;
    article?: string;
    plan_amount: number;
    fact_amount: number;
    variance: number;
    variance_pct: number | null;
  }[];
  totals: { plan: number; fact: number; variance: number; variance_pct: number | null };
  totals_total: { plan: number; fact: number; variance: number; variance_pct: number | null };
  by_limit_plan: Record<string, number>;
  by_limit_fact: Record<string, number>;
  by_limit_plan_total: Record<string, number>;
  by_limit_fact_total: Record<string, number>;
  growth_dec: Record<string, { dec_prev: number; dec_plan: number; net_growth: number; net_growth_pct: number | null }>;
};

export default function Variance() {
  const { plans, planId, plan, setPlanId } = usePlanContext();
  const { viewMode } = useViewMode();
  const [reportPlanId, setReportPlanId] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const yearPlans = plans.filter((p) => (plan ? p.plan_year === plan.plan_year : true));

  useEffect(() => {
    if (planId) setReportPlanId(planId);
  }, [planId]);

  useEffect(() => {
    const id = reportPlanId || planId;
    if (!id) return;
    setErr(null);
    const q = month ? `?month=${month}` : "";
    api<Report>(`/api/v1/plans/${id}/variance-report${q}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [reportPlanId, planId, month]);

  if (!planId && !reportPlanId) return <p>Выберите план в сайдбаре</p>;

  const fmt = (n: number) => n.toLocaleString("ru") + " ₽";
  const totals = viewMode === "total" ? data?.totals_total : data?.totals;
  const byLimitPlan = viewMode === "total" ? data?.by_limit_plan_total : data?.by_limit_plan;
  const byLimitFact = viewMode === "total" ? data?.by_limit_fact_total : data?.by_limit_fact;

  const activeReportId = reportPlanId || planId;

  return (
    <div>
      <h2>План-факт</h2>
      <div className="card form-row">
        <label>
          Версия плана (plan-side)
          <select
            value={activeReportId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setReportPlanId(id);
              setPlanId(id);
            }}
          >
            {yearPlans.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} {p.label} · {p.status}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ margin: 0 }}>
          Факт привязан к выбранной версии плана. Сравнение двух версий — на странице «Планы».
        </p>
      </div>
      {err && <div className="alert alert-error">{err}</div>}

      {data && (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <div className="label">План ({viewMode === "total" ? "TOTAL" : "BASE"})</div>
              <div className="value">{totals ? fmt(totals.plan) : "—"}</div>
            </div>
            <div className="kpi">
              <div className="label">Факт ({viewMode === "total" ? "TOTAL" : "BASE"})</div>
              <div className="value">{totals ? fmt(totals.fact) : "—"}</div>
            </div>
            <div className="kpi">
              <div className="label">Отклонение</div>
              <div className={`value ${totals && totals.variance > 0 ? "text-danger" : "text-success"}`}>
                {totals ? fmt(totals.variance) : "—"}
                {totals?.variance_pct != null && ` (${totals.variance_pct}%)`}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>ФОТ по лимиту (план / факт)</h3>
            <table>
              <thead>
                <tr>
                  <th>Лимит</th>
                  <th>План</th>
                  <th>Факт</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {["IN_LIMIT", "OVER_LIMIT", "TOTAL"].map((lf) => {
                  const p = byLimitPlan?.[lf] ?? 0;
                  const f = byLimitFact?.[lf] ?? 0;
                  if (lf !== "TOTAL" && p === 0 && f === 0) return null;
                  return (
                    <tr key={lf} className={lf === "TOTAL" ? "row-total" : ""}>
                      <td>{lf === "TOTAL" ? "Итого" : lf}</td>
                      <td>{fmt(p)}</td>
                      <td>{fmt(f)}</td>
                      <td className={f - p > 0 ? "text-danger" : "text-success"}>{fmt(f - p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Декабрь → декабрь</h3>
            <table>
              <thead>
                <tr>
                  <th>Лимит</th>
                  <th>Дек пред.</th>
                  <th>Дек план</th>
                  <th>Прирост</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.growth_dec)
                  .sort(([a], [b]) => (a === "TOTAL" ? 1 : b === "TOTAL" ? -1 : 0))
                  .map(([lf, g]) => (
                    <tr key={lf} className={lf === "TOTAL" ? "row-total" : ""}>
                      <td>{lf === "TOTAL" ? "Итого" : lf}</td>
                      <td>{fmt(g.dec_prev)}</td>
                      <td>{fmt(g.dec_plan)}</td>
                      <td>{fmt(g.net_growth)}</td>
                      <td>{g.net_growth_pct != null ? `${g.net_growth_pct}%` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="card form-row">
        <label>
          Месяц (пусто = все)
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value ? +e.target.value : "")}
          />
        </label>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ИД сотр.</th>
              <th>Позиция</th>
              <th>Мес</th>
              <th>Лимит</th>
              {viewMode === "total" && <th>Статья</th>}
              <th>План</th>
              <th>Факт</th>
              <th>Δ</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows
              .filter((r) => (viewMode === "total" ? true : !r.article || r.article === "BASE"))
              .map((r, i) => (
                <tr key={i}>
                  <td>
                    <code>{r.employee_external_id}</code>
                  </td>
                  <td>{r.position_external_id}</td>
                  <td>{r.month}</td>
                  <td>{r.limit_flag}</td>
                  {viewMode === "total" && <td>{r.article || "—"}</td>}
                  <td>{fmt(r.plan_amount)}</td>
                  <td>{fmt(r.fact_amount)}</td>
                  <td className={r.variance > 0 ? "text-danger" : "text-success"}>{fmt(r.variance)}</td>
                  <td>{r.variance_pct != null ? `${r.variance_pct}%` : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!data?.rows.length && <p className="empty-hint">Нет факта — импортируйте fact.csv (админ → Импорт)</p>}
      </div>
      <p className="muted">Режим просмотра: {viewMode === "total" ? "общий ФОТ" : "только оклад"} — переключатель в сайдбаре</p>
    </div>
  );
}
