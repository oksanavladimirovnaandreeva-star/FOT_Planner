import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

type Emp = { external_id: string; full_name: string | null };
type Cr = {
  employee_external_id: string;
  month: number;
  base_amount: number;
  midpoint: number | null;
  cr: number | null;
};

export default function Employees() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const { planId } = usePlanContext();
  const [crMap, setCrMap] = useState<Record<string, Cr>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Emp[]>("/api/v1/employees")
      .then(setEmps)
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!planId || emps.length === 0) return;
    Promise.all(
      emps.map((e) =>
        api<Cr>(`/api/v1/employees/${e.external_id}/cr?month=12&plan_id=${planId}`).then((c) => [e.external_id, c] as const)
      )
    )
      .then((pairs) => {
        const m: Record<string, Cr> = {};
        pairs.forEach(([id, c]) => (m[id] = c));
        setCrMap(m);
      })
      .catch((e) => setErr(e.message));
  }, [emps, planId]);

  return (
    <div>
      <h2>Сотрудники и CR</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Оклад план (дек)</th>
              <th>Midpoint вилки</th>
              <th>CR</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => {
              const c = crMap[e.external_id];
              const crVal = c?.cr != null ? Number(c.cr) : null;
              return (
                <tr key={e.external_id}>
                  <td>{e.external_id}</td>
                  <td>{e.full_name}</td>
                  <td>{c ? Number(c.base_amount).toLocaleString("ru") : "—"}</td>
                  <td>{c?.midpoint != null ? Number(c.midpoint).toLocaleString("ru") : "—"}</td>
                  <td>
                    {crVal != null ? (
                      <span style={{ color: crVal < 0.9 ? "var(--warn)" : crVal > 1.1 ? "var(--danger)" : "inherit" }}>
                        {crVal.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {emps.length === 0 && !err && <p className="empty-hint">Нет сотрудников — импорт или демо при старте API</p>}
      </div>
    </div>
  );
}
