import type { PositionRecord } from "../types";

export type UserRole = "admin" | "unit_lead" | "team_lead" | "viewer";

const STORAGE_KEY = "fot_mvp_user_role";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор (вся оргструктура)",
  unit_lead: "Юнит-лид (департамент)",
  team_lead: "Тимлид (команда)",
  viewer: "Просмотр (аудит)",
};

/** Демо-срез для ролей в MVP (позже — из профиля / API). */
export const DEMO_ROLE_SCOPE: Record<Exclude<UserRole, "admin" | "viewer">, { department: string; unit?: string; team?: string }> = {
  unit_lead: { department: "Engineering" },
  team_lead: { department: "Engineering", unit: "ProductDev", team: "Frontend Web" },
};

export function loadUserRole(): UserRole {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "admin" || stored === "unit_lead" || stored === "team_lead" || stored === "viewer") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "admin";
}

export function saveUserRole(role: UserRole): void {
  localStorage.setItem(STORAGE_KEY, role);
}

export function roleCanEdit(role: UserRole): boolean {
  return role !== "viewer";
}

/** Массовая индексация C&B — не для тимлида и viewer. */
export function roleCanApplyMassIndexation(role: UserRole): boolean {
  return role === "admin" || role === "unit_lead";
}

export function roleScopeDescription(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Видны все позиции плана.";
    case "viewer":
      return "Только просмотр и аудит, без правок.";
    case "unit_lead":
      return `Срез: ${DEMO_ROLE_SCOPE.unit_lead.department} (все юниты).`;
    case "team_lead":
      return `Срез: ${DEMO_ROLE_SCOPE.team_lead.department} / ${DEMO_ROLE_SCOPE.team_lead.unit} / ${DEMO_ROLE_SCOPE.team_lead.team}.`;
    default:
      return "";
  }
}

export function positionMatchesRole(position: PositionRecord, role: UserRole): boolean {
  if (role === "admin" || role === "viewer") return true;
  if (role === "unit_lead") {
    return position.department === DEMO_ROLE_SCOPE.unit_lead.department;
  }
  const scope = DEMO_ROLE_SCOPE.team_lead;
  return (
    position.department === scope.department &&
    position.unit === scope.unit &&
    position.team === scope.team
  );
}

export function filterPositionsByRole(positions: PositionRecord[], role: UserRole): PositionRecord[] {
  if (role === "admin" || role === "viewer") return positions;
  return positions.filter((position) => positionMatchesRole(position, role));
}

/** Применяет правки только в рамках видимого среза, остальные позиции не трогает. */
export function mergeScopedPositionUpdates(
  allPositions: PositionRecord[],
  previousScoped: PositionRecord[],
  nextScoped: PositionRecord[],
): PositionRecord[] {
  const patch = new Map(nextScoped.map((position) => [position.positionId, position]));
  const previousIds = new Set(previousScoped.map((position) => position.positionId));
  const added = nextScoped.filter((position) => !allPositions.some((item) => item.positionId === position.positionId));
  const merged = allPositions.map((position) => patch.get(position.positionId) ?? position);
  for (const position of added) {
    if (!merged.some((item) => item.positionId === position.positionId)) {
      merged.push(position);
    }
  }
  void previousIds;
  return merged;
}
