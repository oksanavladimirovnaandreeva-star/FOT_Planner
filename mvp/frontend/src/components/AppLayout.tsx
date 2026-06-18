import { NavLink } from "react-router-dom";
import { DemoUserCard } from "./DemoUserCard";
import { PlanWorkspaceContext } from "./PlanWorkspaceContext";
import {
  BarChart3,
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

const NAV_BASE: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}[] = [
  { to: "/", label: "Обзор и итого", icon: LayoutDashboard, end: true },
  { to: "/planning", label: "Планирование", icon: CalendarRange },
  ...(PLAN_SCENARIO_INCLUDES_FACT ? [{ to: "/analytics", label: "Аналитика", icon: BarChart3 }] : []),
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { viewMode, setViewMode, userRole, canManagePlanVersions } = useMvpApp();

  const showSettingsNav = roleSettingsNavVisible(userRole);
  const versionsNavLabel = roleVersionsNavLabel(userRole);
  const versionsNavTo = canManagePlanVersions ? "/versions" : "/versions?tab=approval";
  const nav = [
    ...NAV_BASE,
    { to: versionsNavTo, label: versionsNavLabel, icon: GitBranch },
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

        <div className="app-sidebar__section app-sidebar__section--compact">
          <PlanWorkspaceContext />
          <label className="app-field">
            <span>Режим просмотра</span>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "base" | "total")}>
              <option value="base">Оклад</option>
              <option value="total">Итого ФОТ</option>
            </select>
          </label>
          <DemoUserCard />
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
