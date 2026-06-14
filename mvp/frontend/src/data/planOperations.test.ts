import { describe, expect, it } from "vitest";
import { annualTotal, applyEvents, initialPositions } from "./planningData";
import {
  applyPlanTransfer,
  applyTerminationToVacancy,
  mapPositionsWithAppliedEvents,
  mergePlanPositionsWithDraft,
  removePlanEvent,
  removePlanPosition,
} from "./planOperations";
import type { PositionRecord } from "../types";

function clonePositions(): PositionRecord[] {
  return JSON.parse(JSON.stringify(initialPositions())) as PositionRecord[];
}

const transferOptions = {
  nextPositionId: (list: PositionRecord[]) => {
    const max = list.reduce((acc, position) => {
      const match = position.positionId.match(/^P(\d+)$/);
      return match ? Math.max(acc, Number(match[1])) : acc;
    }, 0);
    return `P${String(max + 1).padStart(3, "0")}`;
  },
  applyIndexationBatches: (record: PositionRecord) => record,
};

function firstOccupiedId(positions: PositionRecord[]): string {
  const row = mapPositionsWithAppliedEvents(positions).find(
    (position) => position.status === "Occupied" && position.employeeId,
  );
  if (!row) throw new Error("no occupied position in demo seed");
  return row.positionId;
}

describe("applyTerminationToVacancy", () => {
  it("освобождает позицию и сохраняет годовой ФОТ", () => {
    const positions = clonePositions();
    const positionId = firstOccupiedId(positions);
    const result = applyTerminationToVacancy(positions, positionId, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.positions.find((item) => item.positionId === positionId);
    expect(updated?.status).toBe("Vacancy");
    expect(annualTotal(updated!)).toBeGreaterThan(0);
  });
});

function findIntraUnitPair(positions: PositionRecord[]): { source: PositionRecord; target: PositionRecord } {
  const applied = mapPositionsWithAppliedEvents(positions);
  const byUnit = new Map<string, PositionRecord[]>();
  for (const position of applied) {
    const key = `${position.department}\0${position.unit}`;
    const list = byUnit.get(key) ?? [];
    list.push(position);
    byUnit.set(key, list);
  }
  for (const group of byUnit.values()) {
    const source = group.find((item) => item.status === "Occupied" && item.employeeId);
    const target = group.find((item) => item.status === "Vacancy");
    if (source && target) return { source, target };
  }
  throw new Error("no intra-unit pair in demo seed");
}

describe("applyPlanTransfer", () => {
  it("intra: освобождает источник и занимает целевую вакансию", () => {
    const positions = clonePositions();
    const { source, target } = findIntraUnitPair(positions);
    const result = applyPlanTransfer(
      positions,
      {
        sourcePositionId: source.positionId,
        month: 3,
        transferKind: "INTRA_UNIT",
        transferToPositionId: target.positionId,
        employeeId: source.employeeId!,
        employeeName: source.employeeName!,
        base: 185_000,
        bonus: 0,
        specialization: "Engineering",
        level: "Senior",
      },
      transferOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceAfter = applyEvents(result.positions.find((item) => item.positionId === source.positionId)!);
    const targetAfter = applyEvents(result.positions.find((item) => item.positionId === target.positionId)!);
    expect(sourceAfter.status).toBe("Vacancy");
    expect(targetAfter.status).toBe("Occupied");
    expect(targetAfter.employeeId).toBe(source.employeeId);
  });

  it("intra: создаёт вакансию в юните, если целевая не выбрана", () => {
    const positions = clonePositions();
    const { source, target } = findIntraUnitPair(positions);
    const withoutTarget = positions.filter((item) => item.positionId !== target.positionId);
    const result = applyPlanTransfer(
      withoutTarget,
      {
        sourcePositionId: source.positionId,
        month: 3,
        transferKind: "INTRA_UNIT",
        employeeId: source.employeeId!,
        employeeName: source.employeeName!,
        base: 185_000,
        bonus: 0,
        specialization: "Engineering",
        level: "Senior",
      },
      transferOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.positions.length).toBe(withoutTarget.length + 1);
    const sourceAfter = applyEvents(result.positions.find((item) => item.positionId === source.positionId)!);
    expect(sourceAfter.status).toBe("Vacancy");
    const created = result.positions.find(
      (item) =>
        !withoutTarget.some((position) => position.positionId === item.positionId) &&
        item.events.some((event) => event.type === "PLANNED_HIRE"),
    );
    expect(created).toBeTruthy();
    expect(applyEvents(created!).status).toBe("Occupied");
    expect(created!.department).toBe(source.department);
    expect(created!.unit).toBe(source.unit);
  });

  it("inter: создаёт целевую позицию при отсутствии вакансии", () => {
    const positions = clonePositions();
    const sourceId = firstOccupiedId(positions);
    const source = positions.find((item) => item.positionId === sourceId)!;
    const result = applyPlanTransfer(
      positions,
      {
        sourcePositionId: sourceId,
        month: 4,
        transferKind: "INTER_DEPARTMENT",
        targetDepartment: "Product",
        targetUnit: "Core",
        targetTeam: "PM Team A",
        employeeId: source.employeeId!,
        employeeName: source.employeeName!,
        base: 190_000,
        bonus: 0,
        specialization: "Product",
        level: "Senior",
      },
      transferOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.positions.length).toBe(positions.length + 1);
    const sourceAfter = applyEvents(result.positions.find((item) => item.positionId === sourceId)!);
    expect(sourceAfter.status).toBe("Vacancy");
    const originalIds = new Set(positions.map((item) => item.positionId));
    const hired = result.positions.find(
      (item) =>
        !originalIds.has(item.positionId) &&
        item.events.some((event) => event.type === "PLANNED_HIRE"),
    );
    expect(hired?.department).toBe("Product");
    expect(applyEvents(hired!).status).toBe("Occupied");
  });
});

describe("removePlanEvent", () => {
  it("каскадно удаляет TRANSFER и PLANNED_HIRE по transferPairId", () => {
    const positions = clonePositions();
    const { source, target } = findIntraUnitPair(positions);
    const transferred = applyPlanTransfer(
      positions,
      {
        sourcePositionId: source.positionId,
        month: 2,
        transferKind: "INTRA_UNIT",
        transferToPositionId: target.positionId,
        employeeId: source.employeeId!,
        employeeName: source.employeeName!,
        base: 180_000,
        bonus: 0,
        specialization: "Engineering",
        level: "Senior",
      },
      transferOptions,
    );
    expect(transferred.ok).toBe(true);
    if (!transferred.ok) return;

    const transferEvent = transferred.positions
      .find((item) => item.positionId === source.positionId)!
      .events.find((event) => event.type === "TRANSFER");
    expect(transferEvent).toBeDefined();

    const rolledBack = removePlanEvent(transferred.positions, source.positionId, transferEvent!.id);
    const sourceAfter = applyEvents(rolledBack.find((item) => item.positionId === source.positionId)!);
    const targetAfter = applyEvents(rolledBack.find((item) => item.positionId === target.positionId)!);
    expect(sourceAfter.status).toBe("Occupied");
    expect(targetAfter.status).toBe("Vacancy");
    expect(
      rolledBack.some((position) => position.events.some((event) => event.payload.transferPairId)),
    ).toBe(false);
  });
});

describe("mergePlanPositionsWithDraft", () => {
  it("добавляет черновик вакансии в список для перевода", () => {
    const positions = clonePositions();
    const draft: PositionRecord = {
      ...positions[1],
      positionId: "P999",
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
      status: "Vacancy",
      seedStatus: "Vacancy",
      employeeName: null,
      employeeId: null,
      events: [],
    };
    const merged = mergePlanPositionsWithDraft(positions, draft);
    expect(merged.some((item) => item.positionId === "P999")).toBe(true);
    expect(merged.length).toBe(positions.length + 1);
  });
});

describe("removePlanPosition", () => {
  it("удаляет позицию из списка", () => {
    const positions = clonePositions();
    const targetId = positions[0].positionId;
    const result = removePlanPosition(positions, targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.positions.some((item) => item.positionId === targetId)).toBe(false);
    expect(result.positions.length).toBe(positions.length - 1);
  });
});
