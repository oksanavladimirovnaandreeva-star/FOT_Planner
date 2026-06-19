import { applyEvents, initialPositions } from "./planningData";
import {
  buildWorkingDraftMeta,
  clonePositionList,
  initialPlanVersions,
  repairVersionLabels,
  type PlanVersionMeta,
} from "./planVersions";
import type { PlannedEvent, PositionRecord } from "../types";
import { pinDemoPersonasToRoster } from "./demoRosterPins";
import { seedDemoUnitLeadQueue } from "./teamSubmissionStore";
import {
  DEMO_DEPT_IT,
  DEMO_TEAM_MOBILE,
  DEMO_TEAM_PLATFORM,
  DEMO_UNIT_A,
} from "./demoOrg";

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
  draft = addTeamSalaryReview(draft, DEMO_TEAM_MOBILE, "demo-q1-mobile-review");
  draft = addTeamSalaryReview(draft, DEMO_TEAM_PLATFORM, "demo-q1-frontend-review");
  return draft;
}

function addAnnualMobilePlanningEvents(positions: PositionRecord[]): PositionRecord[] {
  const copy = clonePositionList(positions);
  const teamFilter = (position: PositionRecord) =>
    position.department === DEMO_DEPT_IT && position.unit === DEMO_UNIT_A && position.team === DEMO_TEAM_MOBILE;

  const gradeTarget = copy.find((position) => teamFilter(position) && position.status === "Occupied");
  if (gradeTarget) {
    const idx = copy.indexOf(gradeTarget);
    const order = gradeTarget.events.reduce((max, item) => Math.max(max, item.createdOrder), 0) + 1;
    copy[idx] = appendDraftEvent(gradeTarget, {
      id: "demo-annual-mobile-grade",
      type: "CLASSIFICATION_CHANGE",
      createdAt: "2026-06-19T11:02:00.000Z",
      createdOrder: order,
      payload: {
        month: 5,
        specialization: "Engineering",
        level: "Lead",
        comment: "Повышение по итогам ревью",
      },
    });
  }

  const vacantSlot = copy.find((position) => teamFilter(position) && position.status === "Vacancy");
  if (vacantSlot) {
    const idx = copy.indexOf(vacantSlot);
    const order = vacantSlot.events.reduce((max, item) => Math.max(max, item.createdOrder), 0) + 1;
    copy[idx] = appendDraftEvent(vacantSlot, {
      id: "demo-annual-mobile-hire",
      type: "PLANNED_HIRE",
      createdAt: "2026-06-19T11:20:00.000Z",
      createdOrder: order,
      payload: {
        month: 3,
        base: 175_000,
        bonus: 0,
        specialization: "Engineering",
        level: "Senior",
        employeeName: "Виктория Соловьёва",
        employeeId: "E0099",
      },
    });
  }

  const newSlotIndex = copy.findIndex(
    (position) => teamFilter(position) && position.slotType === "new" && position.status !== "Closed",
  );
  if (newSlotIndex >= 0) {
    const position = copy[newSlotIndex];
    const order = position.events.reduce((max, item) => Math.max(max, item.createdOrder), 0) + 1;
    copy[newSlotIndex] = appendDraftEvent(position, {
      id: "demo-annual-mobile-new",
      type: "PLANNED_HIRE",
      createdAt: "2026-06-19T11:21:00.000Z",
      createdOrder: order,
      payload: {
        month: 5,
        base: 182_083,
        bonus: 0,
        specialization: "Engineering",
        level: "Senior",
        employeeName: "Engineer (вакансия)",
      },
    });
  }

  return copy;
}

/** Демо (июнь 2026): только годовой черновик v1, без квартала. */
export function buildDemoAnnualVersionState(): {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
} {
  const baseline = pinDemoPersonasToRoster(initialPositions().map(applyEvents));
  const annualPositions = addAnnualMobilePlanningEvents(baseline);
  const [annualDraft] = initialPlanVersions();
  return {
    versions: repairVersionLabels([annualDraft]),
    dataByVersion: {
      [annualDraft.id]: annualPositions,
    },
  };
}

export function applyDemoAnnualScenarioSideEffects(planVersionId: string): void {
  seedDemoUnitLeadQueue(planVersionId);
}

/** Демо: утверждённый годовой бюджет + квартальный черновик с правками для тимлидов. */
export function buildDemoQuarterlyVersionState(): {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
} {
  const baseline = pinDemoPersonasToRoster(initialPositions().map(applyEvents));
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

/** @deprecated Используйте buildDemoAnnualVersionState */
export const buildDemoVersionState = buildDemoAnnualVersionState;
