import { collectDraftDeltaEvents } from "./planApprovalRules";
import {
  collectPlanEventJournalRows,
  eventCommentTooltip,
  eventEmployeeLine,
  summarizeEventChange,
  type EventChangeSummary,
  type PlanEventJournalRow,
} from "./eventJournal";
import { annualTotal, applyEventsUntil } from "./planningData";
import { eventTypeLabel } from "./eventLabels";
import type { EventType, LimitFlagKey, PlannedEvent, PositionRecord } from "../types";

export type TeamApprovalSubmissionMode = "annual" | "quarterly";

const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

export type FotByLimit = Record<LimitFlagKey, number>;

const EMPTY_FOT_BY_LIMIT = (): FotByLimit => ({
  IN_LIMIT: 0,
  OVER_LIMIT: 0,
  UNLIMITED: 0,
});

function deltaFotByLimit(baseline: FotByLimit, draft: FotByLimit): FotByLimit {
  return {
    IN_LIMIT: draft.IN_LIMIT - baseline.IN_LIMIT,
    OVER_LIMIT: draft.OVER_LIMIT - baseline.OVER_LIMIT,
    UNLIMITED: draft.UNLIMITED - baseline.UNLIMITED,
  };
}

function annualFotByLimit(
  positions: PositionRecord[],
  match: (position: PositionRecord) => boolean,
): FotByLimit {
  const totals = EMPTY_FOT_BY_LIMIT();
  for (const position of positions) {
    if (!match(position) || position.status === "Closed") continue;
    totals[position.limitFlag] += annualTotal(position);
  }
  return totals;
}

function annualFotByLimitForTeam(
  positions: PositionRecord[],
  scope: { department: string; unit: string; team: string },
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesTeam(position, scope));
}

function annualFotByLimitForUnit(
  positions: PositionRecord[],
  scope: { department: string; unit: string },
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesUnit(position, scope));
}

const APPROVAL_HIDDEN_EVENT_TYPES = new Set<EventType>(["INDEXATION", "POSITION_CARRYOVER"]);

export type TeamApprovalDiffRow = {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  typeLabel: string;
  employeeLine: string | null;
  change: EventChangeSummary;
  comment: string | null;
  isNewPosition: boolean;
  fotDeltaAnnual: number;
  event: PlannedEvent;
  createdAt: string;
};

export type TeamApprovalDiffSummary = {
  baselineFot: number;
  draftFot: number;
  deltaFot: number;
  baselineHeadcount: number;
  draftHeadcount: number;
  changeCount: number;
  baselineFotByLimit: FotByLimit;
  draftFotByLimit: FotByLimit;
  deltaFotByLimit: FotByLimit;
};

export { DISPLAY_LIMIT_FLAGS as TEAM_APPROVAL_LIMIT_FLAGS };

function matchesTeam(
  position: PositionRecord,
  scope: { department: string; unit: string; team: string },
): boolean {
  return (
    position.department === scope.department &&
    position.unit === scope.unit &&
    position.team === scope.team
  );
}

function matchesUnit(
  position: PositionRecord,
  scope: { department: string; unit: string },
): boolean {
  return position.department === scope.department && position.unit === scope.unit;
}

function matchesDepartment(position: PositionRecord, department: string): boolean {
  return position.department === department;
}

function annualFotByLimitForDepartment(
  positions: PositionRecord[],
  department: string,
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesDepartment(position, department));
}

function headcountForDepartment(positions: PositionRecord[], department: string): number {
  return positions.filter(
    (position) => matchesDepartment(position, department) && position.status !== "Closed",
  ).length;
}

function annualFotForDepartment(positions: PositionRecord[], department: string): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesDepartment(position, department) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function headcountForTeam(positions: PositionRecord[], scope: { department: string; unit: string; team: string }): number {
  return positions.filter(
    (position) => matchesTeam(position, scope) && position.status !== "Closed",
  ).length;
}

function annualFotForTeam(positions: PositionRecord[], scope: { department: string; unit: string; team: string }): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesTeam(position, scope) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function headcountForUnit(positions: PositionRecord[], scope: { department: string; unit: string }): number {
  return positions.filter(
    (position) => matchesUnit(position, scope) && position.status !== "Closed",
  ).length;
}

function annualFotForUnit(positions: PositionRecord[], scope: { department: string; unit: string }): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesUnit(position, scope) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function annualFotDeltaForEvent(position: PositionRecord, event: PlannedEvent): number {
  const before = applyEventsUntil(position, event.id, false);
  const after = applyEventsUntil(position, event.id, true);
  if (before.status === "Closed" && after.status === "Closed") return 0;
  const beforeFot = before.status !== "Closed" ? annualTotal(before) : 0;
  const afterFot = after.status !== "Closed" ? annualTotal(after) : 0;
  return afterFot - beforeFot;
}

function journalRowsToApprovalRows(
  journalRows: PlanEventJournalRow[],
  input: {
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
  },
  mode: TeamApprovalSubmissionMode,
): TeamApprovalDiffRow[] {
  const baselinePositionIds = new Set(input.baselinePositions.map((position) => position.positionId));

  return journalRows.map((row) => {
    const draftPosition =
      input.draftPositions.find((item) => item.positionId === row.positionId) ?? null;
    const isNewPosition =
      mode === "quarterly"
        ? !baselinePositionIds.has(row.positionId)
        : row.event.type === "PLANNED_HIRE" && draftPosition?.slotType === "new";

    return {
      positionId: row.positionId,
      role: row.role,
      department: row.department,
      unit: row.unit,
      team: row.team,
      typeLabel: isNewPosition ? "Новая позиция" : row.typeLabel,
      employeeLine: row.employeeLine,
      change: row.change,
      comment: row.comment?.trim() || row.commentTooltip,
      isNewPosition,
      fotDeltaAnnual: draftPosition ? annualFotDeltaForEvent(draftPosition, row.event) : 0,
      event: row.event,
      createdAt: row.createdAt,
    };
  });
}

function deltaEventsToApprovalRows(
  deltaEvents: { position: PositionRecord; event: PlannedEvent }[],
  input: {
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
  },
): TeamApprovalDiffRow[] {
  const baselineById = new Map(
    input.baselinePositions.map((position) => [position.positionId, position] as const),
  );
  const baselinePositionIds = new Set(input.baselinePositions.map((position) => position.positionId));

  return deltaEvents.map(({ position, event }) => {
    const isNewPosition = !baselinePositionIds.has(position.positionId);
    const baseline = baselineById.get(position.positionId) ?? position;
    const change = summarizeEventChange(baseline, event);

    return {
      positionId: position.positionId,
      role: position.role,
      department: position.department,
      unit: position.unit,
      team: position.team,
      typeLabel: isNewPosition ? "Новая позиция" : eventTypeLabel(event),
      employeeLine: eventEmployeeLine(event, position),
      change,
      comment: event.payload.comment?.trim() || eventCommentTooltip(event),
      isNewPosition,
      fotDeltaAnnual: annualFotDeltaForEvent(baseline, event),
      event,
      createdAt: event.createdAt,
    };
  });
}

/** Годовое планирование: все события команды. Квартальное: только новые события vs утверждённый год. */
export function buildTeamApprovalDiff(input: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  unit: string;
  team: string;
  mode: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const scope = {
    department: input.department,
    unit: input.unit,
    team: input.team,
  };

  const teamDraft = input.draftPositions.filter((position) => matchesTeam(position, scope));

  const rows =
    input.mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(teamDraft), input, input.mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesTeam(position, scope)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForTeam(input.baselinePositions, scope);
  const draftFotByLimit = annualFotByLimitForTeam(input.draftPositions, scope);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForTeam(input.baselinePositions, scope),
    draftFot: annualFotForTeam(input.draftPositions, scope),
    deltaFot:
      annualFotForTeam(input.draftPositions, scope) - annualFotForTeam(input.baselinePositions, scope),
    baselineHeadcount: headcountForTeam(input.baselinePositions, scope),
    draftHeadcount: headcountForTeam(input.draftPositions, scope),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
  };

  return { summary, rows };
}

/** Квартальное: дельта по юниту. Годовое: все события юнита. */
export function buildUnitApprovalDiff(input: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  unit: string;
  mode?: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const mode = input.mode ?? "quarterly";
  const scope = { department: input.department, unit: input.unit };
  const unitDraft = input.draftPositions.filter((position) => matchesUnit(position, scope));

  const rows =
    mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(unitDraft), input, mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesUnit(position, scope)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      a.team.localeCompare(b.team, "ru") ||
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForUnit(input.baselinePositions, scope);
  const draftFotByLimit = annualFotByLimitForUnit(input.draftPositions, scope);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForUnit(input.baselinePositions, scope),
    draftFot: annualFotForUnit(input.draftPositions, scope),
    deltaFot:
      annualFotForUnit(input.draftPositions, scope) - annualFotForUnit(input.baselinePositions, scope),
    baselineHeadcount: headcountForUnit(input.baselinePositions, scope),
    draftHeadcount: headcountForUnit(input.draftPositions, scope),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
  };

  return { summary, rows };
}

/** Квартальное: дельта по департаменту. Годовое: все события департамента. */
export function buildDepartmentApprovalDiff(input: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  mode?: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const mode = input.mode ?? "quarterly";
  const { department } = input;
  const deptDraft = input.draftPositions.filter((position) => matchesDepartment(position, department));

  const rows =
    mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(deptDraft), input, mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesDepartment(position, department)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      a.unit.localeCompare(b.unit, "ru") ||
      a.team.localeCompare(b.team, "ru") ||
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForDepartment(input.baselinePositions, department);
  const draftFotByLimit = annualFotByLimitForDepartment(input.draftPositions, department);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForDepartment(input.baselinePositions, department),
    draftFot: annualFotForDepartment(input.draftPositions, department),
    deltaFot:
      annualFotForDepartment(input.draftPositions, department) -
      annualFotForDepartment(input.baselinePositions, department),
    baselineHeadcount: headcountForDepartment(input.baselinePositions, department),
    draftHeadcount: headcountForDepartment(input.draftPositions, department),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
  };

  return { summary, rows };
}
