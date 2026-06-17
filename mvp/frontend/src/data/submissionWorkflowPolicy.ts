import type { UserRole } from "./userAccess";

export type SubmissionWorkflowAction =
  | "team_submit"
  | "unit_approve"
  | "director_approve"
  | "cb_review"
  | "return"
  | "reopen_editing";

export const SUBMISSION_PHASE_LABELS: Record<string, string> = {
  editing: "В работе",
  team_submitted: "Сдано тимлидом",
  unit_approved: "Согласовано юнит-лидом",
  director_approved: "Согласовано директором",
  cb_review: "Проверка C&B",
  returned: "Возврат на доработку",
};

export function submissionPhaseLabel(phase: string): string {
  return SUBMISSION_PHASE_LABELS[phase] ?? phase;
}

export function submissionActionLabel(action: SubmissionWorkflowAction): string {
  switch (action) {
    case "team_submit":
      return "Сдать команду";
    case "unit_approve":
      return "Согласовать команду";
    case "director_approve":
      return "Согласовать директором";
    case "cb_review":
      return "Принять в C&B";
    case "return":
      return "Вернуть на доработку";
    case "reopen_editing":
      return "Открыть правки";
    default:
      return action;
  }
}

type ScopeInput = {
  actorRole: UserRole;
  actorDepartment?: string;
  actorUnit?: string | null;
  actorTeam?: string | null;
  targetDepartment: string;
  targetUnit: string;
  targetTeam: string;
  leadEditFrozen?: boolean;
};

export function canRolePerformSubmissionAction(action: SubmissionWorkflowAction, scope: ScopeInput): boolean {
  const { actorRole, actorDepartment, actorUnit, actorTeam, targetDepartment, targetUnit, targetTeam, leadEditFrozen } = scope;

  if (actorRole === "viewer") return false;
  if (actorRole === "cb_admin") return true;
  if (actorRole === "gd") return action !== "cb_review";

  if (action === "team_submit") {
    if (actorRole !== "team_lead") return false;
    if (leadEditFrozen) return false;
    return actorDepartment === targetDepartment && actorUnit === targetUnit && actorTeam === targetTeam;
  }

  if (action === "unit_approve" || action === "return" || action === "reopen_editing") {
    if (actorRole === "unit_lead") {
      if (leadEditFrozen) return false;
      return actorDepartment === targetDepartment && actorUnit === targetUnit;
    }
    if (actorRole === "director") {
      return actorDepartment === targetDepartment;
    }
    return false;
  }

  if (action === "director_approve") {
    return actorRole === "director" && actorDepartment === targetDepartment;
  }

  if (action === "cb_review") {
    return false;
  }

  return false;
}
