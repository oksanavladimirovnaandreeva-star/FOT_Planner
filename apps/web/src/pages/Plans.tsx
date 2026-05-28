import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { usePlanContext } from "../PlanContext";

type Event = {
  id: number;
  event_type: string;
  effective_month: number;
  payload: Record<string, unknown>;
  created_by: string | null;
};

type CompareRow = {
  position_external_id: string;
  employee_external_id: string;
  month: number;
  left_amount: number;
  right_amount: number;
  delta: number;
  delta_pct: number;
};

type CompareReport = {
  left_plan_id: number;
  left_label: string;
  right_plan_id: number;
  right_label: string;
  article: string;
  changed_rows: number;
  totals: { left: number; right: number; delta: number; delta_pct: number };
  rows: CompareRow[];
};

export default function Plans() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { plans, planId, plan, setPlanId, refresh } = usePlanContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [compareLeft, setCompareLeft] = useState<number | "">("");
  const [compareRight, setCompareRight] = useState<number | "">("");
  const [compareData, setCompareData] = useState<CompareReport | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const sameYearPlans = useMemo(() => {
    if (!plan) return plans;
    return plans.filter((p) => p.plan_year === plan.plan_year);
  }, [plans, plan]);

  useEffect(() => {
    if (!planId) return;
    api<Event[]>(`/api/v1/plans/${planId}/events`).then(setEvents);
    setCompareLeft(planId);
    const other = sameYearPlans.find((p) => p.id !== planId);
    setCompareRight(other?.id ?? "");
  }, [planId, sameYearPlans]);

  const create = async () => {
    setActionErr(null);
    const p = await api<{ id: number }>("/api/v1/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_year: 2026, label: `v${plans.length + 1}` }),
    });
    setPlanId(p.id);
    refresh();
  };

  const approve = async (id: number) => {
    setActionErr(null);
    try {
      await api(`/api/v1/plans/${id}/approve`, { method: "POST" });
      refresh();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Ошибка утверждения");
    }
  };

  const correction = async (id: number) => {
    setActionErr(null);
    try {
      const child = await api<{ id: number }>(`/api/v1/plans/${id}/correction`, { method: "POST" });
      setPlanId(child.id);
      refresh();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Ошибка корректировки");
    }
  };

  const runCompare = async () => {
    if (!compareLeft || !compareRight) return;
    setActionErr(null);
    try {
      const data = await api<CompareReport>(
        `/api/v1/plans/compare?left_plan_id=${compareLeft}&right_plan_id=${compareRight}&article=BASE`,
      );
      setCompareData(data);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Ошибка сравнения");
      setCompareData(null);
    }
  };

  return (
    <div>
      <h2>Планы и события</h2>
      {actionErr && <div className="alert alert-error">{actionErr}</div>}
      <div className="card">
        <button type="button" onClick={create}>
          Новая версия плана 2026
        </button>
        <table style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Год</th>
              <th>Версия</th>
              <th>Статус</th>
              <th>Родитель</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.plan_year}</td>
                <td>{p.label}</td>
                <td>{p.status}</td>
                <td>{p.parent_version_id ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    className={planId === p.id ? "" : "secondary"}
                    onClick={() => setPlanId(p.id)}
                  >
                    {planId === p.id ? "Активный" : "Выбрать"}
                  </button>{" "}
                  {isAdmin && p.status === "DRAFT" && (
                    <button type="button" className="secondary" onClick={() => approve(p.id)}>
                      Утвердить
                    </button>
                  )}{" "}
                  {isAdmin && (p.status === "APPROVED" || p.status === "LOCKED") && (
                    <button type="button" className="secondary" onClick={() => correction(p.id)}>
                      Корректировка
                    </button>
                  )}{" "}
                  <a href={`/api/v1/plans/${p.id}/export.csv`} download>
                    CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Сравнение версий (read-only)</h3>
        <div className="form-row">
          <label>
            База (левая)
            <select value={compareLeft} onChange={(e) => setCompareLeft(e.target.value ? Number(e.target.value) : "")}>
              <option value="">—</option>
              {sameYearPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.label} ({p.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            Сравнить с (правая)
            <select value={compareRight} onChange={(e) => setCompareRight(e.target.value ? Number(e.target.value) : "")}>
              <option value="">—</option>
              {sameYearPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.label} ({p.status})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={runCompare} disabled={!compareLeft || !compareRight || compareLeft === compareRight}>
            Сравнить BASE
          </button>
        </div>
        {compareData && (
          <>
            <p className="muted">
              Изменённых строк: {compareData.changed_rows}. Итого Δ {compareData.totals.delta.toLocaleString("ru")} ₽ (
              {compareData.totals.delta_pct}%)
            </p>
            <table>
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Сотрудник</th>
                  <th>Мес</th>
                  <th>{compareData.left_label}</th>
                  <th>{compareData.right_label}</th>
                  <th>Δ</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {compareData.rows.slice(0, 100).map((row, index) => (
                  <tr key={`${row.position_external_id}-${row.month}-${index}`}>
                    <td>{row.position_external_id}</td>
                    <td>
                      <code>{row.employee_external_id}</code>
                    </td>
                    <td>{row.month}</td>
                    <td>{row.left_amount.toLocaleString("ru")} ₽</td>
                    <td>{row.right_amount.toLocaleString("ru")} ₽</td>
                    <td>{row.delta.toLocaleString("ru")} ₽</td>
                    <td>{row.delta_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compareData.rows.length > 100 && (
              <p className="muted">Показаны первые 100 из {compareData.rows.length} отличий</p>
            )}
          </>
        )}
      </div>

      {planId && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>События плана #{planId}</h3>
          <table>
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Тип</th>
                <th>Детали</th>
                <th>Кто</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.effective_month}</td>
                  <td>{e.event_type}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem" }}>{JSON.stringify(e.payload)}</code>
                  </td>
                  <td>{e.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && <p className="empty-hint">Событий пока нет — добавьте индексацию или пересмотр</p>}
        </div>
      )}
    </div>
  );
}
