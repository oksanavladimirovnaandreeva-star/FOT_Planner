import { describe, expect, it } from "vitest";
import type { PlannedEvent } from "../types";
import { buildDemoPositions } from "./demoPlanSeed";
import {
  collectIndexationBatchesFromPositions,
  removeIndexationBatchFromPositions,
  upsertEvent,
} from "./planningData";
import { filterPositionsByRole, mergeScopedPositionUpdates } from "./userAccess";

function applyMassIndexation(
  allPositions: ReturnType<typeof buildDemoPositions>,
  batchId: string,
  month: number,
  percent: number,
) {
  const role = "cb_admin" as const;
  const scopedBefore = filterPositionsByRole(allPositions, role);
  const scopedNext = scopedBefore.map((position) => {
    const event: PlannedEvent = {
      id: `idx-${batchId}-${position.positionId}`,
      type: "INDEXATION",
      createdAt: "2026-06-01T09:00:00.000Z",
      createdOrder: position.events.length + 1,
      payload: { month, percent, indexationBatchId: batchId },
    };
    return upsertEvent(position, event);
  });
  return mergeScopedPositionUpdates(allPositions, scopedBefore, scopedNext);
}

describe("mass indexation for C&B", () => {
  it("добавляет и удаляет пакет по всему плану", () => {
    const batchId = "test-batch-cb-unique";
    const before = buildDemoPositions(20);
    expect(collectIndexationBatchesFromPositions(before).some((batch) => batch.id === batchId)).toBe(false);

    const afterApply = applyMassIndexation(before, batchId, 5, 10);
    const appliedBatch = collectIndexationBatchesFromPositions(afterApply).find((batch) => batch.id === batchId);
    expect(appliedBatch?.percent).toBe(10);
    expect(appliedBatch?.affectedCount).toBeGreaterThan(0);

    const afterDelete = removeIndexationBatchFromPositions(afterApply, batchId);
    expect(collectIndexationBatchesFromPositions(afterDelete).some((batch) => batch.id === batchId)).toBe(false);
  });
});
