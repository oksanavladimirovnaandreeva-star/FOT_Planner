import type { UserRole } from "./userAccess";

export const LANDING_APPLIED_KEY = "mvp.landingApplied";

/** Стартовый маршрут после выбора роли (UX-2). */
export function landingRouteForRole(role: UserRole): string {
  switch (role) {
    case "team_lead":
    case "unit_lead":
      return "/planning?tab=positions";
    case "admin":
    case "director":
    case "viewer":
    default:
      return "/";
  }
}
