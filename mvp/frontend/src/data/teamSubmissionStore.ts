import type { UserRole } from "./userAccess";
import { demoRoleScope } from "./userAccess";
import { scopeEqValues } from "./personaAccessScope";
import { canRolePerformSubmissionAction, type SubmissionWorkflowAction } from "./submissionWorkflowPolicy";

export type TeamSubmissionPhase =
  | "editing"
  | "team_submitted"
  | "returned"
  | "unit_approved"
  | "director_approved"
  | "cb_review";

export type TeamSubmissionRecord = {
  phase: TeamSubmissionPhase;
  teamSubmittedAt?: string;
  unitApprovedAt?: string;
  directorApprovedAt?: string;
  cbReviewAt?: string;
  returnedAt?: string;
  returnedNote?: string;
};

type ActionActor = {
  role: UserRole;
  leadEditFrozen?: boolean;
};

const STORAGE_KEY = "mvp.teamSubmissions";

type StoredSubmissions = Record<string, TeamSubmissionRecord>;

function submissionKey(planVersionId: string, department: string, unit: string, team: string): string {
  return `${planVersionId}\0${department}\0${unit}\0${team}`;
}

function readAll(): StoredSubmissions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredSubmissions;
  } catch {
    return {};
  }
}

function writeAll(data: StoredSubmissions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

const ALLOWED_PHASE_TRANSITIONS: Record<TeamSubmissionPhase, TeamSubmissionPhase[]> = {
  editing: ["team_submitted"],
  team_submitted: ["unit_approved", "returned"],
  unit_approved: ["director_approved", "returned"],
  director_approved: ["cb_review", "returned"],
  cb_review: ["returned"],
  returned: ["editing", "team_submitted"],
};

function canTransition(from: TeamSubmissionPhase, to: TeamSubmissionPhase): boolean {
  return ALLOWED_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

function upsertSubmissionPhase(
  all: StoredSubmissions,
  key: string,
  nextPhase: TeamSubmissionPhase,
  patch: Partial<TeamSubmissionRecord>,
): void {
  const existing = all[key];
  const currentPhase = existing?.phase ?? "editing";
  if (!canTransition(currentPhase, nextPhase)) return;
  all[key] = {
    ...existing,
    phase: nextPhase,
    ...patch,
  };
}

function phaseForAction(action: SubmissionWorkflowAction): TeamSubmissionPhase {
  switch (action) {
    case "team_submit":
      return "team_submitted";
    case "unit_approve":
      return "unit_approved";
    case "director_approve":
      return "director_approved";
    case "cb_review":
      return "cb_review";
    case "return":
      return "returned";
    case "reopen_editing":
      return "editing";
    default:
      return "editing";
  }
}

function actorScope(role: UserRole): {
  departments: string[];
  units: string[];
  teams: string[];
} {
  if (role === "director") {
    const scope = demoRoleScope("director");
    return {
      departments: scopeEqValues(scope, "department"),
      units: [],
      teams: [],
    };
  }
  if (role === "unit_lead") {
    const scope = demoRoleScope("unit_lead");
    return {
      departments: scopeEqValues(scope, "department"),
      units: scopeEqValues(scope, "unit"),
      teams: scopeEqValues(scope, "team"),
    };
  }
  if (role === "team_lead") {
    const scope = demoRoleScope("team_lead");
    return {
      departments: scopeEqValues(scope, "department"),
      units: scopeEqValues(scope, "unit"),
      teams: scopeEqValues(scope, "team"),
    };
  }
  return { departments: [], units: [], teams: [] };
}

export function applySubmissionAction(input: {
  planVersionId: string;
  department: string;
  unit: string;
  team: string;
  action: SubmissionWorkflowAction;
  actor: ActionActor;
  note?: string;
}): { ok: true } | { ok: false; error: string } {
  const { planVersionId, department, unit, team, action, actor, note } = input;
  const all = readAll();
  const key = submissionKey(planVersionId, department, unit, team);
  const nextPhase = phaseForAction(action);
  const existing = all[key];
  const current = existing?.phase ?? "editing";

  if (!canTransition(current, nextPhase)) {
    return { ok: false, error: "Недопустимый переход статуса для выбранного действия." };
  }

  const actorOrg = actorScope(actor.role);
  const allowed = canRolePerformSubmissionAction(action, {
    actorRole: actor.role,
    actorDepartments: actorOrg.departments,
    actorUnits: actorOrg.units,
    actorTeams: actorOrg.teams,
    targetDepartment: department,
    targetUnit: unit,
    targetTeam: team,
    leadEditFrozen: actor.leadEditFrozen,
  });
  if (!allowed) {
    return { ok: false, error: "Недостаточно прав для этого действия." };
  }

  if (action === "return") {
    all[key] = {
      ...existing,
      phase: "returned",
      returnedAt: new Date().toISOString(),
      returnedNote: note?.trim() || undefined,
    };
  } else if (action === "reopen_editing") {
    all[key] = {
      ...existing,
      phase: "editing",
      returnedAt: undefined,
      returnedNote: undefined,
    };
  } else {
    const patch: Partial<TeamSubmissionRecord> = {};
    const now = new Date().toISOString();
    if (action === "team_submit") patch.teamSubmittedAt = now;
    if (action === "unit_approve") patch.unitApprovedAt = now;
    if (action === "director_approve") patch.directorApprovedAt = now;
    if (action === "cb_review") patch.cbReviewAt = now;
    upsertSubmissionPhase(all, key, nextPhase, patch);
  }
  writeAll(all);
  return { ok: true };
}

export function getTeamSubmission(
  planVersionId: string,
  department: string,
  unit: string,
  team: string,
): TeamSubmissionRecord | null {
  const record = readAll()[submissionKey(planVersionId, department, unit, team)];
  return record ?? null;
}

export function listSubmissionsForPlan(planVersionId: string): TeamSubmissionRecord[] {
  const prefix = `${planVersionId}\0`;
  return Object.entries(readAll())
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value);
}

export function listSubmissionEntriesForPlan(
  planVersionId: string,
): { department: string; unit: string; team: string; record: TeamSubmissionRecord }[] {
  const prefix = `${planVersionId}\0`;
  return Object.entries(readAll())
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, record]) => {
      const [, department, unit, team] = key.split("\0");
      return { department, unit, team, record };
    });
}

export type SubmissionProgressSummary = {
  total: number;
  editing: number;
  teamSubmitted: number;
  unitApproved: number;
  directorApproved: number;
  cbReview: number;
  returned: number;
  completionPct: number;
};

export function summarizeSubmissionProgress(
  entries: { record: TeamSubmissionRecord }[],
): SubmissionProgressSummary {
  const counts = {
    editing: 0,
    teamSubmitted: 0,
    unitApproved: 0,
    directorApproved: 0,
    cbReview: 0,
    returned: 0,
  };
  for (const entry of entries) {
    switch (entry.record.phase) {
      case "editing":
        counts.editing += 1;
        break;
      case "team_submitted":
        counts.teamSubmitted += 1;
        break;
      case "unit_approved":
        counts.unitApproved += 1;
        break;
      case "director_approved":
        counts.directorApproved += 1;
        break;
      case "cb_review":
        counts.cbReview += 1;
        break;
      case "returned":
        counts.returned += 1;
        break;
      default:
        break;
    }
  }
  const total = entries.length;
  const done = counts.cbReview;
  return {
    total,
    ...counts,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/** Мягкое предупреждение перед publish: команды не в cb_review (не блокер). */
export function publishSubmissionHint(planVersionId: string): string | null {
  const entries = listSubmissionEntriesForPlan(planVersionId);
  if (entries.length === 0) return null;
  const notReady = entries.filter((entry) => entry.record.phase !== "cb_review").length;
  if (notReady === 0) return null;
  return `${notReady} из ${entries.length} команд ещё не прошли согласование C&B.`;
}

export function markTeamSubmitted(planVersionId: string, department: string, unit: string, team: string): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "team_submit",
    actor: { role: "cb_admin" },
  });
}

export function markUnitApproved(planVersionId: string, department: string, unit: string, team: string): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "unit_approve",
    actor: { role: "cb_admin" },
  });
}

export function markDirectorApproved(planVersionId: string, department: string, unit: string, team: string): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "director_approve",
    actor: { role: "cb_admin" },
  });
}

export function markCbReview(planVersionId: string, department: string, unit: string, team: string): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "cb_review",
    actor: { role: "cb_admin" },
  });
}

export function markUnitApprovedForAllTeams(
  planVersionId: string,
  teams: { department: string; unit: string; team: string }[],
): void {
  for (const item of teams) {
    applySubmissionAction({
      planVersionId,
      department: item.department,
      unit: item.unit,
      team: item.team,
      action: "unit_approve",
      actor: { role: "cb_admin" },
    });
  }
}

export function returnTeamToEditing(
  planVersionId: string,
  department: string,
  unit: string,
  team: string,
  note?: string,
): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "return",
    actor: { role: "cb_admin" },
    note,
  });
}

export function reopenTeamEditing(planVersionId: string, department: string, unit: string, team: string): void {
  applySubmissionAction({
    planVersionId,
    department,
    unit,
    team,
    action: "reopen_editing",
    actor: { role: "cb_admin" },
  });
}

export function clearSubmissionsForPlan(planVersionId: string): void {
  const all = readAll();
  const prefix = `${planVersionId}\0`;
  const next: StoredSubmissions = {};
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(prefix)) next[key] = value;
  }
  writeAll(next);
}

export function isTeamEditingLocked(record: TeamSubmissionRecord | null): boolean {
  return (
    record?.phase === "team_submitted" ||
    record?.phase === "unit_approved" ||
    record?.phase === "director_approved" ||
    record?.phase === "cb_review"
  );
}
