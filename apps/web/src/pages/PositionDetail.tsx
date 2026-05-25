import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

export default function PositionDetail() {
  const { id } = useParams();
  const { planId } = usePlanContext();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    const q = planId ? `?plan_id=${planId}` : "";
    api<Record<string, unknown>>(`/api/v1/positions/${id}${q}`).then(setData);
  }, [id, planId]);

  if (!data) return <p>Загрузка…</p>;

  const grid = (data.plan_grid as { month: number; article: string; amount: number; employee_external_id: string }[]) || [];

  return (
    <div>
      <h2>Позиция {String(data.external_id)}</h2>
      <div className="card">
        <p>
          {String(data.org_unit_code)} · {String(data.specialization)} · {String(data.level)} ·{" "}
          {String(data.limit_flag)}
        </p>
        <h3>Назначения</h3>
        <ul>
          {((data.assignments as { employee_id: string; full_name: string }[]) || []).map((a) => (
            <li key={a.employee_id}>
              {a.full_name} ({a.employee_id})
            </li>
          ))}
        </ul>
      </div>
      {planId && (
        <div className="card">
          <h3>План помесячно</h3>
          <table>
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Сотрудник</th>
                <th>Статья</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((g, i) => (
                <tr key={i}>
                  <td>{g.month}</td>
                  <td>{g.employee_external_id}</td>
                  <td>{g.article}</td>
                  <td>{g.amount.toLocaleString("ru")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
