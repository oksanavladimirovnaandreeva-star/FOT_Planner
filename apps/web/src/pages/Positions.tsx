import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { usePlanContext } from "../PlanContext";

type Position = {
  external_id: string;
  org_unit_code: string;
  specialization: string;
  level: string;
  limit_flag: string;
  is_vacancy: boolean;
  assignments: { employee_id: string; full_name: string }[];
};

export default function Positions() {
  const [items, setItems] = useState<Position[]>([]);
  const [vacancyOnly, setVacancyOnly] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { refresh: refreshPlan } = usePlanContext();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [newVac, setNewVac] = useState({
    external_id: "P-NEW",
    org_unit_code: "DEPT-IT",
    specialization: "Backend",
    level: "Middle",
    limit_flag: "IN_LIMIT",
  });

  const load = () => {
    setErr(null);
    const q = vacancyOnly ? "?vacancy=true" : "";
    api<Position[]>(`/api/v1/positions${q}`)
      .then(setItems)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, [vacancyOnly]);

  const createVacancy = async () => {
    await api("/api/v1/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newVac, is_vacancy: true }),
    });
    load();
    refreshPlan();
  };

  return (
    <div>
      <h2>Реестр позиций («стульчики»)</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="card">
        <label>
          <input type="checkbox" checked={vacancyOnly} onChange={(e) => setVacancyOnly(e.target.checked)} /> Только
          вакансии
        </label>
      </div>
      {isAdmin && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Добавить вакансию</h3>
          <div className="form-row">
            <input
              placeholder="ID позиции"
              value={newVac.external_id}
              onChange={(e) => setNewVac({ ...newVac, external_id: e.target.value })}
            />
            <input
              placeholder="org_unit_code"
              value={newVac.org_unit_code}
              onChange={(e) => setNewVac({ ...newVac, org_unit_code: e.target.value })}
            />
            <input
              value={newVac.specialization}
              onChange={(e) => setNewVac({ ...newVac, specialization: e.target.value })}
            />
            <input value={newVac.level} onChange={(e) => setNewVac({ ...newVac, level: e.target.value })} />
            <button type="button" onClick={createVacancy}>
              Создать
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID позиции</th>
              <th>Подразделение</th>
              <th>Спец.</th>
              <th>Уровень</th>
              <th>Лимит</th>
              <th>Сотрудники на стуле</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.external_id}>
                <td>
                  <Link to={`/positions/${p.external_id}`}>{p.external_id}</Link>
                  {p.is_vacancy && <span className="badge vacancy"> вакансия</span>}
                </td>
                <td>{p.org_unit_code}</td>
                <td>{p.specialization}</td>
                <td>{p.level}</td>
                <td>{p.limit_flag}</td>
                <td>
                  {p.assignments.length
                    ? p.assignments.map((a) => a.full_name || a.employee_id).join("; ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && !err && (
          <p className="empty-hint">Позиции не загружены — запустите API или импортируйте positions.csv</p>
        )}
      </div>
    </div>
  );
}
