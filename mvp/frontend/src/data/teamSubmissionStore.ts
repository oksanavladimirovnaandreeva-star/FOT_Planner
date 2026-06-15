export type TeamSubmissionPhase = "editing" | "team_submitted" | "returned" | "unit_approved";

export type TeamSubmissionRecord = {
  phase: TeamSubmissionPhase;
  teamSubmittedAt?: string;
  unitApprovedAt?: string;
  returnedAt?: string;
  returnedNote?: string;
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

export function markTeamSubmitted(planVersionId: string, department: string, unit: string, team: string): void {
  const all = readAll();
  all[submissionKey(planVersionId, department, unit, team)] = {
    phase: "team_submitted",
    teamSubmittedAt: new Date().toISOString(),
  };
  writeAll(all);
}

export function markUnitApproved(planVersionId: string, department: string, unit: string, team: string): void {
  const all = readAll();
  const key = submissionKey(planVersionId, department, unit, team);
  const existing = all[key];
  all[key] = {
    ...existing,
    phase: "unit_approved",
    unitApprovedAt: new Date().toISOString(),
  };
  writeAll(all);
}

export function markUnitApprovedForAllTeams(
  planVersionId: string,
  teams: { department: string; unit: string; team: string }[],
): void {
  const all = readAll();
  const now = new Date().toISOString();
  for (const item of teams) {
    const key = submissionKey(planVersionId, item.department, item.unit, item.team);
    const existing = all[key];
    all[key] = {
      ...existing,
      phase: "unit_approved",
      unitApprovedAt: now,
    };
  }
  writeAll(all);
}

export function returnTeamToEditing(
  planVersionId: string,
  department: string,
  unit: string,
  team: string,
  note?: string,
): void {
  const all = readAll();
  all[submissionKey(planVersionId, department, unit, team)] = {
    phase: "returned",
    returnedAt: new Date().toISOString(),
    returnedNote: note?.trim() || undefined,
  };
  writeAll(all);
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
  return record?.phase === "team_submitted" || record?.phase === "unit_approved";
}
