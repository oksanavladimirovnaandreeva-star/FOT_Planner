import { collectDraftDeltaEvents } from "./planApprovalRules";
import {
  collectPlanEventJournalRows,
  eventCommentTooltip,
  eventEmployeeLine,
  summarizeEventChange,
  type EventChangeSummary,
  type PlanEventJournalRow,
} from "./eventJournal";
import { annualTotal } from "./planningData";
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
    const isNewSlot = draftPosition?.slotType === "new";
    const isNewPosition =
      mode === "quarterly"
        ? !baselinePositionIds.has(row.positionId)
        : Boolean(isNewSlot);
    const baseline = input.baselinePositions.find((position) => position.positionId === row.positionId);
    const baselineFot = baseline && baseline.status !== "Closed" ? annualTotal(baseline) : 0;
    const draftFot = draftPosition && draftPosition.status !== "Closed" ? annualTotal(draftPosition) : 0;

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
      fotDeltaAnnual: draftFot - baselineFot,
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
    const draftPosition = input.draftPositions.find((item) => item.positionId === position.positionId) ?? position;
    const baselineFot = baseline.status !== "Closed" ? annualTotal(baseline) : 0;
    const draftFot = draftPosition.status !== "Closed" ? annualTotal(draftPosition) : 0;

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
      fotDeltaAnnual: draftFot - baselineFot,
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
