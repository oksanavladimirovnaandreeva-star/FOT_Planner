import { NavLink } from "react-router-dom";
import { DemoRoleSelect } from "./DemoRoleSelect";
import {
  BarChart3,
  CalendarRange,
  GitBranch,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
import { formatPlanVersionOptionLabel } from "../data/planVersionDisplay";
import { resolvePlanWorkspaceStatus } from "../data/planWorkspaceStatus";
import { roleSettingsNavVisible } from "../data/userAccess";

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}[] = [
  { to: "/", label: "Обзор и итого", icon: LayoutDashboard, end: true },
  { to: "/planning", label: "Планирование", icon: CalendarRange },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/versions", label: "Версии", icon: GitBranch },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    planVersions,
    planVersionId,
    setPlanVersionId,
    activePlan,
    canEditPlan,
    leadEditFrozenForRole,
    workingDraft,
    openVersion,
    viewMode,
    setViewMode,
    userRole,
  } = useMvpApp();

  const showSettingsNav = roleSettingsNavVisible(userRole);

  const workspaceStatus = resolvePlanWorkspaceStatus({
    activePlan,
    canEditPlan,
    leadEditFrozenForRole,
  });

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo" aria-hidden>
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <span className="app-sidebar__title">ФОТ-планировщик</span>
        </div>

        <div className="app-sidebar__section app-sidebar__section--compact">
          <label className="app-field">
            <span>Версия плана</span>
            <select value={planVersionId} onChange={(e) => setPlanVersionId(e.target.value)}>
              {planVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {formatPlanVersionOptionLabel(version)}
                </option>
              ))}
            </select>
          </label>
          <span className={`app-status-chip app-status-chip--${workspaceStatus.tone}`}>{workspaceStatus.label}</span>
          {workingDraft && planVersionId !== workingDraft.id ? (
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--sm app-sidebar__draft-link"
              onClick={() => {
                const result = openVersion(workingDraft.id);
                if (!result.ok) window.alert(result.error);
              }}
            >
              Открыть черновик корректировки
            </button>
          ) : null}
          <label className="app-field">
            <span>Режим просмотра</span>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "base" | "total")}>
              <option value="base">Оклад</option>
              <option value="total">Итого ФОТ</option>
            </select>
          </label>
          <DemoRoleSelect compact />
        </div>

        <nav className="app-sidebar__nav" aria-label="Основное меню">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
            >
              <item.icon className="app-nav__icon" size={20} strokeWidth={2} aria-hidden />
              {item.label}
            </NavLink>
          ))}
          {showSettingsNav ? (
            <NavLink
              to="/settings"
              className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
            >
              <Settings className="app-nav__icon" size={20} strokeWidth={2} aria-hidden />
              Настройки
            </NavLink>
          ) : null}
        </nav>
      </aside>

      <div className="app-main">
        <div className="app-page-scroll">{children}</div>
      </div>
    </div>
  );
}
