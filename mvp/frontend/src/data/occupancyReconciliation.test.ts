import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPilotPositions } from "./demoPlanSeed";
import { applyEvents } from "./planningData";
import { planOccupancyAtMonth } from "./occupancyTimeline";
import { collectOccupancyMismatches } from "./occupancyReconciliation";
import { clearFactStore, importEmployeeFacts, importFactPositionAssignments } from "./factStore";
import type { PositionRecord } from "../types";

function clonePositions(): PositionRecord[] {
  return JSON.parse(JSON.stringify(buildPilotPositions().map(applyEvents))) as PositionRecord[];
}

describe("occupancyTimeline", () => {
  it("учитывает события до месяца", () => {
    const positions = clonePositions();
    const source = positions.find((item) => item.positionId === "P001")!;
    const withTermination = {
      ...source,
      events: [
        ...source.events,
        {
          id: "term-1",
          type: "TERMINATION_TO_VACANCY" as const,
          createdAt: "2026-06-01T00:00:00.000Z",
          createdOrder: source.events.length + 1,
          payload: { month: 5 },
        },
      ],
    };
    const before = planOccupancyAtMonth(withTermination, 4);
    const after = planOccupancyAtMonth(withTermination, 5);
    expect(before.status).toBe("Occupied");
    expect(after.status).toBe("Vacancy");
  });
});

describe("collectOccupancyMismatches", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
  });

  it("находит вакансию в плане и сотрудника в факте по position_id", () => {
    clearFactStore();
    const positions = clonePositions();
    const vacancy = positions.find((item) => item.status === "Vacancy");
    expect(vacancy).toBeTruthy();

    importEmployeeFacts(
      {
        E999: {
          monthlyFactBase: Array.from({ length: 12 }, (_, index) => (index === 3 ? 100_000 : 0)),
          monthlyFactBonus: Array.from({ length: 12 }, () => 0),
        },
      },
      "replace",
    );
    importFactPositionAssignments([{ positionId: vacancy!.positionId, employeeId: "E999", month: 3 }], "replace");

    const mismatches = collectOccupancyMismatches(positions);
    expect(
      mismatches.some(
        (item) => item.kind === "PLAN_VACANCY_FACT_OCCUPIED" && item.positionId === vacancy!.positionId,
      ),
    ).toBe(true);
    clearFactStore();
  });

  it("находит двух сотрудников на одной позиции", () => {
    clearFactStore();
    const positions = clonePositions();
    const occupied = positions.find((item) => item.status === "Occupied");
    expect(occupied).toBeTruthy();

    importEmployeeFacts(
      {
        E901: {
          monthlyFactBase: Array.from({ length: 12 }, (_, index) => (index === 2 ? 90_000 : 0)),
          monthlyFactBonus: Array.from({ length: 12 }, () => 0),
        },
        E902: {
          monthlyFactBase: Array.from({ length: 12 }, (_, index) => (index === 2 ? 95_000 : 0)),
          monthlyFactBonus: Array.from({ length: 12 }, () => 0),
        },
      },
      "replace",
    );
    importFactPositionAssignments(
      [
        { positionId: occupied!.positionId, employeeId: "E901", month: 2 },
        { positionId: occupied!.positionId, employeeId: "E902", month: 2 },
      ],
      "replace",
    );

    const mismatches = collectOccupancyMismatches(positions);
    expect(mismatches.some((item) => item.kind === "MULTI_ON_SEAT" && item.positionId === occupied!.positionId)).toBe(
      true,
    );
    clearFactStore();
  });
});
