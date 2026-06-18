import { NavLink } from "react-router-dom";
import { DemoUserCard } from "./DemoUserCard";
import { PlanWorkspaceContext } from "./PlanWorkspaceContext";
import {
  CalendarRange,
  GitBranch,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";
import { roleSettingsNavVisible, roleVersionsNavLabel } from "../data/userAccess";
import { PLAN_SCENARIO_INCLUDES_FACT } from "../data/planScenario";
import { HintTooltipLayer } from "./HintTooltipLayer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    viewMode,
    setViewMode,
    userRole,
    canManagePlanVersions,
    canToggleLeadFreeze,
    leadEditFrozen,
    setLeadEditFrozen,
  } = useMvpApp();

  const showSettingsNav = roleSettingsNavVisible(userRole);
  const versionsNavLabel = roleVersionsNavLabel(userRole);
  const versionsNavTo = canManagePlanVersions ? "/versions" : "/versions?tab=approval";

  const overviewLabel = PLAN_SCENARIO_INCLUDES_FACT ? "Обзор и аналитика" : "Обзор";

  const nav = [
    { to: versionsNavTo, label: versionsNavLabel, icon: GitBranch },
    { to: "/planning", label: "Планирование", icon: CalendarRange },
    { to: "/", label: overviewLabel, icon: LayoutDashboard, end: true },
  ];

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo" aria-hidden>
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <span className="app-sidebar__title">ФОТ-планировщик</span>
        </div>

        <DemoUserCard />

        <div className="app-sidebar__section app-sidebar__section--compact">
          <PlanWorkspaceContext />
          <label className="app-field">
            <span>Режим просмотра</span>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "base" | "total")}>
              <option value="base">Оклад</option>
              <option value="total">Итого ФОТ</option>
            </select>
          </label>
          {canToggleLeadFreeze ? (
            <label className="app-sidebar__freeze">
              <input
                type="checkbox"
                checked={leadEditFrozen}
                onChange={(event) => setLeadEditFrozen(event.target.checked)}
              />
              <span>Закрыть правки тимлидов и юнит-лидов</span>
            </label>
          ) : null}
        </div>

        <nav className="app-sidebar__nav" aria-label="Основное меню">
          {nav.map((item) => (
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
      <HintTooltipLayer />
    </div>
  );
}
