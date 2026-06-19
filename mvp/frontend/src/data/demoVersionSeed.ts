import { applyEvents, initialPositions } from "./planningData";
import {
  buildWorkingDraftMeta,
  clonePositionList,
  initialPlanVersions,
  repairVersionLabels,
  type PlanVersionMeta,
} from "./planVersions";
import type { PlannedEvent, PositionRecord } from "../types";
import { seedDemoUnitLeadQueue } from "./teamSubmissionStore";

const DEMO_QUARTERLY_REVIEW_MONTH = 3;

function appendDraftEvent(position: PositionRecord, event: PlannedEvent): PositionRecord {
  return applyEvents({
    ...position,
    events: [...position.events, event],
  });
}

function addTeamSalaryReview(
  positions: PositionRecord[],
  team: string,
  eventId: string,
): PositionRecord[] {
  const index = positions.findIndex((position) => position.team === team && position.status === "Occupied");
  if (index < 0) return positions;

  const position = positions[index];
  const month = DEMO_QUARTERLY_REVIEW_MONTH;
  const base = position.monthlyBase[month] ?? position.monthlyBase[0];
  const raised = Math.round(base * 1.1);
  const createdOrder = position.events.reduce((max, item) => Math.max(max, item.createdOrder), 0) + 1;

  const next = appendDraftEvent(position, {
    id: eventId,
    type: "TARGET_SALARY",
    createdAt: "2026-06-10T09:00:00.000Z",
    createdOrder,
    payload: {
      month,
      base: raised,
      bonus: 0,
      specialization: position.monthlySpec[month],
      level: position.monthlyLevel[month],
      employeeId: position.employeeId ?? undefined,
      employeeName: position.employeeName ?? undefined,
    },
  });

  const copy = [...positions];
  copy[index] = next;
  return copy;
}

function buildQuarterlyDraftPositions(baseline: PositionRecord[]): PositionRecord[] {
  let draft = clonePositionList(baseline);
  draft = addTeamSalaryReview(draft, "Mobile", "demo-q1-mobile-review");
  draft = addTeamSalaryReview(draft, "Frontend Web", "demo-q1-frontend-review");
  return draft;
}

/** Демо: утверждённый годовой бюджет + квартальный черновик с правками для тимлидов. */
export function buildDemoQuarterlyVersionState(): {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
} {
  const baseline = initialPositions().map(applyEvents);
  const [annualDraft] = initialPlanVersions();
  const approvedV1: PlanVersionMeta = {
    ...annualDraft,
    status: "APPROVED",
    publishedAt: "2026-01-20T10:00:00.000Z",
  };
  const draftMeta = buildWorkingDraftMeta(approvedV1);
  const draftPositions = buildQuarterlyDraftPositions(baseline);

  return {
    versions: repairVersionLabels([approvedV1, draftMeta]),
    dataByVersion: {
      [approvedV1.id]: baseline,
      [draftMeta.id]: draftPositions,
    },
  };
}

export function applyDemoQuarterlyScenarioSideEffects(draftId: string): void {
  seedDemoUnitLeadQueue(draftId);
}
