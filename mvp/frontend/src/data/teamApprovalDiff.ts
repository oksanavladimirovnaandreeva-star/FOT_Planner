import { collectDraftDeltaEvents } from "./planApprovalRules";
import {
  eventCommentTooltip,
  eventEmployeeLine,
  summarizeEventChange,
  type EventChangeSummary,
} from "./eventJournal";
import { annualTotal } from "./planningData";
import { eventTypeLabel } from "./eventLabels";
import type { EventType, PlannedEvent, PositionRecord } from "../types";

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
};

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

/** Только новые события черновика vs база — для экрана сдачи (не полный журнал). */
export function buildTeamApprovalDiff(input: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  unit: string;
  team: string;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const scope = {
    department: input.department,
    unit: input.unit,
    team: input.team,
  };
  const baselineById = new Map(
    input.baselinePositions.map((position) => [position.positionId, position] as const),
  );
  const baselinePositionIds = new Set(input.baselinePositions.map((position) => position.positionId));

  const deltaEvents = collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(({ position, event }) => {
    if (!matchesTeam(position, scope)) return false;
    if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
    return true;
  });

  const rows: TeamApprovalDiffRow[] = deltaEvents.map(({ position, event }) => {
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

  rows.sort(
    (a, b) =>
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForTeam(input.baselinePositions, scope),
    draftFot: annualFotForTeam(input.draftPositions, scope),
    deltaFot:
      annualFotForTeam(input.draftPositions, scope) - annualFotForTeam(input.baselinePositions, scope),
    baselineHeadcount: headcountForTeam(input.baselinePositions, scope),
    draftHeadcount: headcountForTeam(input.draftPositions, scope),
    changeCount: rows.length,
  };

  return { summary, rows };
}
