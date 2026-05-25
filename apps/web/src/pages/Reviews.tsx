import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

type Emp = { external_id: string; full_name: string | null };
type Band = { specialization: string; level: string; min_salary: number; midpoint: number; max_salary: number };

export default function Reviews() {
  const { planId, refresh } = usePlanContext();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState("E001");
  const [month, setMonth] = useState(6);
  const [targetCr, setTargetCr] = useState(1.0);
  const [bandAnchor, setBandAnchor] = useState("");
  const [band, setBand] = useState<Band | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Emp[]>("/api/v1/employees").then((list) => {
      setEmps(list);
      if (list[0]) setEmployeeId(list[0].external_id);
    });
  }, []);

  useEffect(() => {
    const emp = emps.find((e) => e.external_id === employeeId);
    if (!emp) return;
    api<Band>(`/api/v1/salary-ranges/lookup?specialization=Backend&level=Senior&plan_year=2026`)
      .then(setBand)
      .catch(() => setBand(null));
  }, [employeeId, emps]);

  const submit = async () => {
    if (!planId) return;
    const body: Record<string, unknown> = {
      effective_month: month,
      employee_external_id: employeeId,
    };
    if (bandAnchor) body.band_anchor = bandAnchor;
    else body.target_cr = targetCr;
    await api(`/api/v1/plans/${planId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg("Пересмотр применён с пересчётом плана");
    refresh();
  };

  if (!planId) return <p>Выберите план в сайдбаре</p>;

  return (
    <div>
      <h2>Пересмотр ЗП (грейд-сетка + CR)</h2>
      <div className="card">
        {band && (
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            Вилка Backend/Senior: {Number(band.min_salary).toLocaleString("ru")} —{" "}
            <strong>{Number(band.midpoint).toLocaleString("ru")}</strong> —{" "}
            {Number(band.max_salary).toLocaleString("ru")} ₽
          </p>
        )}
        <div className="form-row">
          <label>
            Сотрудник{" "}
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {emps.map((e) => (
                <option key={e.external_id} value={e.external_id}>
                  {e.full_name} ({e.external_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Месяц{" "}
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(+e.target.value)} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Целевой CR{" "}
            <input
              type="number"
              step={0.01}
              value={targetCr}
              disabled={!!bandAnchor}
              onChange={(e) => setTargetCr(+e.target.value)}
            />
            → оклад ≈ {band ? Math.round(targetCr * Number(band.midpoint)).toLocaleString("ru") : "?"} ₽
          </label>
          <label>
            или точка вилки{" "}
            <select value={bandAnchor} onChange={(e) => setBandAnchor(e.target.value)}>
              <option value="">—</option>
              <option value="min">min</option>
              <option value="midpoint">midpoint</option>
              <option value="max">max</option>
            </select>
          </label>
          <button type="button" onClick={submit}>
            Применить пересмотр
          </button>
        </div>
        {msg && <p style={{ color: "var(--success)" }}>{msg}</p>}
      </div>
    </div>
  );
}
