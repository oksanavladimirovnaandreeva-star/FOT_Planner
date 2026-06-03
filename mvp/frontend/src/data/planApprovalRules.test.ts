import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { collectDraftDeltaEvents, evaluateDraftApprovalRules } from "./planApprovalRules";
import type { PlannedEvent, PositionRecord } from "../types";

function clonePositions(): PositionRecord[] {
  return JSON.parse(JSON.stringify(initialPositions().map(applyEvents))) as PositionRecord[];
}

function addEvent(position: PositionRecord, event: Omit<PlannedEvent, "createdOrder"> & { createdOrder?: number }): PositionRecord {
  return {
    ...position,
    events: [
      ...position.events,
      {
        ...event,
        createdOrder: event.createdOrder ?? position.events.length + 1,
      },
    ],
  };
}

describe("planApprovalRules", () => {
  it("collectDraftDeltaEvents видит только новые события", () => {
    const baseline = clonePositions();
    const draft = clonePositions();
    const p001 = draft.find((item) => item.positionId === "P001")!;
    draft[draft.indexOf(p001)] = addEvent(p001, {
      id: "evt-new",
      type: "TERMINATION_TO_VACANCY",
      createdAt: new Date().toISOString(),
      payload: { month: 4 },
    });

    const delta = collectDraftDeltaEvents(baseline, draft);
    expect(delta.some((item) => item.event.id === "evt-new")).toBe(true);
    expect(delta.length).toBe(1);
  });

  it("срабатывает transfer-inter для INTER_DEPARTMENT", () => {
    const baseline = clonePositions();
    const draft = clonePositions();
    const source = draft.find((item) => item.positionId === "P001")!;
    const idx = draft.indexOf(source);
    draft[idx] = addEvent(source, {
      id: "tr-inter",
      type: "TRANSFER",
      createdAt: new Date().toISOString(),
      payload: {
        month: 3,
        transferKind: "INTER_DEPARTMENT",
        targetDepartment: "Sales",
        targetUnit: "Enterprise",
        employeeId: source.employeeId!,
        employeeName: source.employeeName!,
      },
    });

    const check = evaluateDraftApprovalRules(baseline, draft);
    expect(check.triggered.some((rule) => rule.id === "transfer-inter")).toBe(true);
  });

  it("срабатывает indexation-mass при пакете >5% на 2+ позициях", () => {
    const baseline = clonePositions();
    const draft = clonePositions();
    const batchId = "batch-mass";
    for (const positionId of ["P001", "P002"]) {
      const position = draft.find((item) => item.positionId === positionId)!;
      const idx = draft.indexOf(position);
      draft[idx] = addEvent(position, {
        id: `idx-${positionId}`,
        type: "INDEXATION",
        createdAt: new Date().toISOString(),
        payload: { month: 6, percent: 7, indexationBatchId: batchId },
      });
    }

    const check = evaluateDraftApprovalRules(baseline, draft);
    expect(check.triggered.some((rule) => rule.id === "indexation-mass")).toBe(true);
  });

  it("срабатывает headcount-down на CLOSE_POSITION", () => {
    const baseline = clonePositions();
    const draft = clonePositions();
    const source = draft.find((item) => item.positionId === "P001")!;
    draft[draft.indexOf(source)] = addEvent(source, {
      id: "close-1",
      type: "CLOSE_POSITION",
      createdAt: new Date().toISOString(),
      payload: { month: 8 },
    });

    const check = evaluateDraftApprovalRules(baseline, draft);
    expect(check.triggered.some((rule) => rule.id === "headcount-down")).toBe(true);
  });
});
