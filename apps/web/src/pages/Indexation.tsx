import { useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

export default function Indexation() {
  const { planId, refresh } = usePlanContext();
  const [month, setMonth] = useState(4);
  const [pct, setPct] = useState(5);
  const [scopeOrg, setScopeOrg] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!planId) return;
    await api(`/api/v1/plans/${planId}/indexation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        effective_month: month,
        index_percent: pct,
        index_article: "BASE",
        scope_org_unit: scopeOrg || null,
      }),
    });
    setMsg(`Индексация +${pct}% с месяца ${month} применена`);
    refresh();
  };

  if (!planId) return <p>Выберите план в сайдбаре</p>;

  return (
    <div>
      <h2>Массовая индексация</h2>
      <div className="card">
        <div className="form-row">
          <label>
            Месяц с{" "}
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(+e.target.value)} />
          </label>
          <label>
            % к BASE{" "}
            <input type="number" value={pct} onChange={(e) => setPct(+e.target.value)} />
          </label>
          <label>
            Срез org (пусто = все){" "}
            <input value={scopeOrg} placeholder="DEPT-IT" onChange={(e) => setScopeOrg(e.target.value)} />
          </label>
          <button type="button" onClick={submit}>
            Применить
          </button>
        </div>
        {msg && <p style={{ color: "var(--success)" }}>{msg}</p>}
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "1rem" }}>
          В демо-плане уже есть индексация +5% с апреля. Повторное применение добавит ещё одно событие.
        </p>
      </div>
    </div>
  );
}
