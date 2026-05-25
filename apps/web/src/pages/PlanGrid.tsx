import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

type Line = {
  employee_external_id: string;
  position_external_id: string;
  org_unit_code: string;
  month: number;
  article: string;
  amount: number;
};

export default function PlanGrid() {
  const { planId } = usePlanContext();
  const [month, setMonth] = useState(1);
  const [article, setArticle] = useState("BASE");
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    setErr(null);
    api<Line[]>(`/api/v1/plans/${planId}/grid?month=${month}`)
      .then((all) => setLines(all.filter((l) => l.article === article)))
      .catch((e) => setErr(e.message));
  }, [planId, month, article]);

  const total = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div>
      <h2>Сетка плана</h2>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="card form-row">
        <label>
          Месяц{" "}
          <select value={month} onChange={(e) => setMonth(+e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          Статья{" "}
          <select value={article} onChange={(e) => setArticle(e.target.value)}>
            <option value="BASE">BASE</option>
            <option value="BONUS_PLAN">BONUS_PLAN</option>
            <option value="RK_SN">RK_SN</option>
          </select>
        </label>
        <strong>Итого: {total.toLocaleString("ru")} ₽</strong>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Позиция</th>
              <th>Подразделение</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.employee_external_id}</td>
                <td>{l.position_external_id}</td>
                <td>{l.org_unit_code}</td>
                <td>{l.amount.toLocaleString("ru")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length === 0 && <p className="empty-hint">Нет данных за выбранный месяц</p>}
      </div>
    </div>
  );
}
