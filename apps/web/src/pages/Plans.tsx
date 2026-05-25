import { useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";

type Event = {
  id: number;
  event_type: string;
  effective_month: number;
  payload: Record<string, unknown>;
  created_by: string | null;
};

export default function Plans() {
  const { plans, planId, setPlanId, refresh } = usePlanContext();
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!planId) return;
    api<Event[]>(`/api/v1/plans/${planId}/events`).then(setEvents);
  }, [planId]);

  const create = async () => {
    const p = await api<{ id: number }>("/api/v1/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_year: 2026, label: `v${plans.length + 1}` }),
    });
    setPlanId(p.id);
    refresh();
  };

  return (
    <div>
      <h2>Планы и события</h2>
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
                <td>
                  <button
                    type="button"
                    className={planId === p.id ? "" : "secondary"}
                    onClick={() => setPlanId(p.id)}
                  >
                    {planId === p.id ? "Активный" : "Выбрать"}
                  </button>{" "}
                  <a href={`/api/v1/plans/${p.id}/export.csv`} download>
                    CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
