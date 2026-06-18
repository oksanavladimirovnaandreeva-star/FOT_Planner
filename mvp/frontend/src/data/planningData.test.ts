import { describe, expect, it } from "vitest";
import type { PlannedEvent, PositionRecord } from "../types";
import {
  applyEvents,
  collectIndexationBatchesFromPositions,
  decToDec,
  initialPositions,
  removeEvent,
  removeIndexationBatchFromPositions,
  sortEventsForApply,
  upsertEvent,
} from "./planningData";
import { planAmountAtMonth } from "./planMonthMatrix";

function isolatedPosition(): PositionRecord {
  const base = initialPositions().find((position) => position.status === "Occupied" && position.events.length <= 1);
  const record = JSON.parse(JSON.stringify(base ?? initialPositions()[0])) as PositionRecord;
  return { ...record, events: [] };
}

function withEvents(record: PositionRecord, events: PlannedEvent[]): PositionRecord {
  return { ...record, events };
}

function closeEvent(month: number, order = 1): PlannedEvent {
  return {
    id: `close-${month}`,
    type: "CLOSE_POSITION",
    createdAt: new Date().toISOString(),
    createdOrder: order,
    payload: { month },
  };
}

function indexationEvent(month: number, percent: number, order = 1): PlannedEvent {
  return {
    id: `idx-${month}-${percent}`,
    type: "INDEXATION",
    createdAt: new Date().toISOString(),
    createdOrder: order,
    payload: { month, percent, indexationBatchId: `batch-${month}` },
  };
}

describe("sortEventsForApply", () => {
  it("сортирует по месяцу, затем по приоритету типа", () => {
    const review: PlannedEvent = {
      id: "review",
      type: "MANUAL_OVERRIDE",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdOrder: 2,
      payload: { month: 3, base: 200_000 },
    };
    const close: PlannedEvent = {
      id: "close",
      type: "CLOSE_POSITION",
      createdAt: "2026-01-02T00:00:00.000Z",
      createdOrder: 1,
      payload: { month: 3 },
    };
    const sorted = sortEventsForApply([close, review]);
    expect(sorted.map((event) => event.id)).toEqual(["review", "close"]);
  });
});

describe("applyEvents — CLOSE_POSITION", () => {
  it("с месяца M статус Closed и ФОТ = 0", () => {
    const base = isolatedPosition();
    const applied = applyEvents(withEvents(base, [closeEvent(5)]));
    expect(applied.status).toBe("Closed");
    expect(planAmountAtMonth(applied, 4, "total")).toBeGreaterThan(0);
    expect(planAmountAtMonth(applied, 5, "total")).toBe(0);
    expect(planAmountAtMonth(applied, 11, "total")).toBe(0);
  });
});

describe("applyEvents — INDEXATION", () => {
  it("повышает оклад и премию с месяца M до конца года", () => {
    const base = isolatedPosition();
    const before = applyEvents(base);
    const baseBefore = before.monthlyBase[6];
    const bonusBefore = before.monthlyBonus[6];
    const applied = applyEvents(withEvents(base, [indexationEvent(6, 10)]));
    expect(applied.monthlyBase[5]).toBe(before.monthlyBase[5]);
    expect(applied.monthlyBase[6]).toBe(Math.round(baseBefore * 1.1));
    expect(applied.monthlyBase[11]).toBe(Math.round(before.monthlyBase[11] * 1.1));
    expect(applied.monthlyBonus[6]).toBe(Math.round(bonusBefore * 1.1));
  });
});

describe("upsertEvent / removeEvent", () => {
  it("upsert заменяет событие с тем же id", () => {
    const base = isolatedPosition();
    const event = indexationEvent(2, 5);
    const withFirst = upsertEvent(base, event);
    const updated = upsertEvent(withFirst, { ...event, payload: { ...event.payload, percent: 7 } });
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0].payload.percent).toBe(7);
    expect(applyEvents(updated).monthlyBase[2]).toBe(
      Math.round(applyEvents(base).monthlyBase[2] * 1.07),
    );
  });

  it("remove удаляет событие и откатывает эффект", () => {
    const base = isolatedPosition();
    const event = indexationEvent(4, 10);
    const withEvent = upsertEvent(base, event);
    const without = removeEvent(withEvent, event.id);
    expect(without.events).toHaveLength(0);
    expect(applyEvents(without).monthlyBase[4]).toBe(applyEvents(base).monthlyBase[4]);
  });
});

describe("decToDec", () => {
  it("0 → 0 даёт 0%, рост с нуля — 100%", () => {
    expect(decToDec(0, 0)).toBe(0);
    expect(decToDec(0, 100_000)).toBe(100);
    expect(decToDec(100_000, 110_000)).toBeCloseTo(10);
  });
});

describe("indexation batches", () => {
  it("собирает пакеты по batchId из всех позиций", () => {
    const a = isolatedPosition();
    const b = { ...isolatedPosition(), positionId: "P999" };
    const batchId = "batch-a";
    const eventA = { ...indexationEvent(3, 5), payload: { month: 3, percent: 5, indexationBatchId: batchId } };
    const eventB = { ...indexationEvent(3, 5, 2), payload: { month: 3, percent: 5, indexationBatchId: batchId } };
    const batches = collectIndexationBatchesFromPositions([
      upsertEvent(a, eventA),
      upsertEvent(b, eventB),
    ]);
    expect(batches).toHaveLength(1);
    expect(batches[0].affectedCount).toBe(2);
    expect(batches[0].percent).toBe(5);
    expect(batches[0].positionIds).toEqual(expect.arrayContaining([a.positionId, b.positionId]));
  });

  it("удаляет пакет и откатывает оклады", () => {
    const base = isolatedPosition();
    const before = applyEvents(base);
    const withIdx = upsertEvent(base, indexationEvent(6, 10));
    const indexed = applyEvents(withIdx);
    expect(indexed.monthlyBase[6]).toBeGreaterThan(before.monthlyBase[6]);

    const restored = removeIndexationBatchFromPositions([withIdx], "batch-6")[0];
    expect(restored.events).toHaveLength(0);
    expect(applyEvents(restored).monthlyBase[6]).toBe(before.monthlyBase[6]);
  });
});
