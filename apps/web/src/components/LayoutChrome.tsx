import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { usePlanContext } from "../PlanContext";
import { useViewMode } from "../ViewModeContext";

export function LayoutChrome({ children }: { children: React.ReactNode }) {
  const { user, setUserId } = useAuth();
  const { plans, planId, plan, summary, loading, error, setPlanId, recalculate } = usePlanContext();
  const { viewMode, setViewMode } = useViewMode();
  const isAdmin = user?.role === "admin";

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>ФОТ Планировщик</h1>
        <div className="plan-picker card" style={{ marginBottom: "1rem", padding: "0.75rem" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Активный план</label>
          <select
            value={planId ?? ""}
            onChange={(e) => setPlanId(Number(e.target.value))}
            style={{ width: "100%", marginTop: "0.25rem" }}
            disabled={!plans.length}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.plan_year} — {p.label} ({p.status})
              </option>
            ))}
          </select>
          {summary && (
            <div style={{ fontSize: "0.75rem", marginTop: "0.5rem", color: "var(--muted)" }}>
              ФОТ год BASE: {(summary.year_total_base / 1e6).toFixed(2)} млн ₽
            </div>
          )}
          <button type="button" className="secondary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => recalculate()}>
            Пересчитать план
          </button>
        </div>
        <div className="view-mode-toggle card" style={{ padding: "0.75rem", marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Режим просмотра</label>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "base" | "total")} style={{ width: "100%", marginTop: "0.25rem" }}>
            <option value="base">Только оклад</option>
            <option value="total">Общий ФОТ</option>
          </select>
        </div>
        <nav>
          <NavLink to="/" end>
            Бюджет
          </NavLink>
          <NavLink to="/planning">Планирование ФОТ</NavLink>
          <NavLink to="/salary-ranges">Диапазоны</NavLink>
          <NavLink to="/variance">План-факт</NavLink>
          <NavLink to="/plans">Планы</NavLink>
          {isAdmin && <NavLink to="/imports">Импорт</NavLink>}
          <NavLink to="/audit">Журнал</NavLink>
        </nav>
        <p className="muted" style={{ fontSize: "0.7rem", marginTop: "1rem" }}>
          Позиция («стул») — одна строка бюджета; на ней может быть несколько сотрудников. Новые вакансии: ИД П001, П002… Демо P-100 — старый формат.
        </p>
        <div className="user-bar">
          <div>{user?.display_name || "…"}</div>
          <div>{isAdmin ? "Администратор" : "Пользователь"}</div>
          <select
            value={localStorage.getItem("fot_user") || "admin"}
            onChange={(e) => setUserId(e.target.value)}
            style={{ marginTop: "0.5rem", width: "100%" }}
          >
            <option value="admin">admin</option>
            <option value="user_it">user_it (срез IT)</option>
          </select>
        </div>
      </aside>
      <main className="main">
        {error && (
          <div className="alert alert-error">
            {error}
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              <a href="http://127.0.0.1:8000/api/health" target="_blank" rel="noreferrer">
                API health
              </a>
            </div>
          </div>
        )}
        {loading && !error && <div className="alert">Загрузка…</div>}
        {children}
      </main>
    </div>
  );
}
