import type { UserRole } from "./userAccess";

export type SubmissionWorkflowAction =
  | "team_submit"
  | "unit_approve"
  | "director_approve"
  | "cb_review"
  | "return"
  | "reopen_editing"
  | "package_submit_unit"
  | "package_submit_department"
  | "package_approve_unit"
  | "package_approve_department"
  | "package_return"
  | "package_cb_review";

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

export function submissionPhaseBadgeClass(phase: string): string {
  switch (phase) {
    case "cb_review":
      return "submission-phase-badge--done";
    case "returned":
      return "submission-phase-badge--returned";
    case "editing":
      return "submission-phase-badge--editing";
    default:
      return "submission-phase-badge--progress";
  }
}

export function submissionActionLabel(action: SubmissionWorkflowAction): string {
  switch (action) {
    case "team_submit":
      return "Отправить бюджет на согласование";
    case "unit_approve":
      return "Согласовать и отправить дальше";
    case "director_approve":
      return "Согласовать директором";
    case "cb_review":
      return "Принять в C&B";
    case "return":
      return "Вернуть на доработку";
    case "reopen_editing":
      return "Открыть правки";
    case "package_submit_unit":
      return "Отправить бюджет юнита директору";
    case "package_submit_department":
      return "Отправить департамент в C&B";
    case "package_approve_unit":
      return "Согласовать бюджет юнита";
    case "package_approve_department":
      return "Согласовать департамент";
    case "package_return":
      return "Вернуть пакет на доработку";
    case "package_cb_review":
      return "Принять пакет в C&B";
    default:
      return action;
  }
}

type ScopeInput = {
  actorRole: UserRole;
  actorDepartments?: string[];
  actorUnits?: string[];
  actorTeams?: string[];
  targetDepartment: string;
  targetUnit?: string;
  targetTeam?: string;
  leadEditFrozen?: boolean;
};

function actorOrgMatchesTarget(input: ScopeInput): boolean {
  const {
    actorRole,
    actorDepartments = [],
    actorUnits = [],
    actorTeams = [],
    targetDepartment,
    targetUnit = "",
    targetTeam = "",
  } = input;

  if (actorDepartments.length > 0 && !actorDepartments.includes(targetDepartment)) return false;

  if (actorRole === "unit_lead" || actorRole === "team_lead") {
    if (actorUnits.length > 0 && targetUnit && !actorUnits.includes(targetUnit)) return false;
  }

  if (actorRole === "team_lead") {
    if (actorTeams.length > 0 && targetTeam && !actorTeams.includes(targetTeam)) return false;
  }

  return true;
}

export function canRolePerformSubmissionAction(
  action: SubmissionWorkflowAction,
  scope: ScopeInput,
): boolean {
  const { actorRole, leadEditFrozen } = scope;

  if (actorRole === "viewer") return false;
  if (actorRole === "cb_admin") {
    if (action === "team_submit" || action === "unit_approve" || action === "director_approve") {
      return false;
    }
    return (
      action === "return" ||
      action === "reopen_editing" ||
      action === "cb_review" ||
      action === "package_approve_department" ||
      action === "package_return" ||
      action === "package_cb_review"
    );
  }
  if (actorRole === "gd") {
    return action !== "cb_review" && action !== "package_cb_review";
  }

  if (action === "team_submit") {
    if (actorRole !== "team_lead") return false;
    if (leadEditFrozen) return false;
    return actorOrgMatchesTarget(scope);
  }

  if (action === "unit_approve" || action === "return") {
    if (actorRole === "unit_lead") {
      return actorOrgMatchesTarget(scope);
    }
    if (actorRole === "director") {
      return actorOrgMatchesTarget(scope);
    }
    return false;
  }

  if (action === "reopen_editing") {
    if (actorRole === "unit_lead") {
      if (leadEditFrozen) return false;
      return actorOrgMatchesTarget(scope);
    }
    if (actorRole === "director") {
      return actorOrgMatchesTarget(scope);
    }
    return false;
  }

  if (action === "director_approve") {
    return actorRole === "director" && actorOrgMatchesTarget(scope);
  }

  if (action === "cb_review") {
    return false;
  }

  if (action === "package_submit_unit") {
    return actorRole === "unit_lead" && actorOrgMatchesTarget(scope);
  }

  if (action === "package_submit_department") {
    return actorRole === "director" && actorOrgMatchesTarget(scope);
  }

  if (action === "package_approve_unit") {
    return actorRole === "director" && actorOrgMatchesTarget(scope);
  }

  if (action === "package_return") {
    return actorRole === "director" && actorOrgMatchesTarget(scope);
  }

  return false;
}
