import { describe, expect, it } from "vitest";
import { annualTotal, applyEvents, initialPositions } from "./planningData";
import {
  applyPlanTransfer,
  applyTerminationToVacancy,
  mergePlanPositionsWithDraft,
  removePlanEvent,
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

describe("applyTerminationToVacancy", () => {
  it("освобождает позицию и сохраняет годовой ФОТ", () => {
    const positions = clonePositions();
    const result = applyTerminationToVacancy(positions, "P001", 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.positions.find((item) => item.positionId === "P001");
    expect(updated?.status).toBe("Vacancy");
    expect(annualTotal(updated!)).toBeGreaterThan(0);
  });
});

describe("applyPlanTransfer", () => {
  it("intra: освобождает источник и занимает целевую вакансию", () => {
    const positions = clonePositions();
    const source = positions.find((item) => item.positionId === "P001")!;
    const result = applyPlanTransfer(
      positions,
      {
        sourcePositionId: "P001",
        month: 3,
        transferKind: "INTRA_UNIT",
        transferToPositionId: "P004",
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
    const sourceAfter = applyEvents(result.positions.find((item) => item.positionId === "P001")!);
    const targetAfter = applyEvents(result.positions.find((item) => item.positionId === "P004")!);
    expect(sourceAfter.status).toBe("Vacancy");
    expect(targetAfter.status).toBe("Occupied");
    expect(targetAfter.employeeId).toBe("E001");
  });

  it("inter: создаёт целевую позицию при отсутствии вакансии", () => {
    const positions = clonePositions();
    const source = positions.find((item) => item.positionId === "P001")!;
    const result = applyPlanTransfer(
      positions,
      {
        sourcePositionId: "P001",
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
    const sourceAfter = applyEvents(result.positions.find((item) => item.positionId === "P001")!);
    expect(sourceAfter.status).toBe("Vacancy");
    const hired = result.positions.find(
      (item) => item.positionId !== "P001" && item.events.some((event) => event.type === "PLANNED_HIRE"),
    );
    expect(hired?.department).toBe("Product");
    expect(applyEvents(hired!).status).toBe("Occupied");
  });
});

describe("removePlanEvent", () => {
  it("каскадно удаляет TRANSFER и PLANNED_HIRE по transferPairId", () => {
    const positions = clonePositions();
    const source = positions.find((item) => item.positionId === "P001")!;
    const transferred = applyPlanTransfer(
      positions,
      {
        sourcePositionId: "P001",
        month: 2,
        transferKind: "INTRA_UNIT",
        transferToPositionId: "P004",
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
      .find((item) => item.positionId === "P001")!
      .events.find((event) => event.type === "TRANSFER");
    expect(transferEvent).toBeDefined();

    const rolledBack = removePlanEvent(transferred.positions, "P001", transferEvent!.id);
    const sourceAfter = applyEvents(rolledBack.find((item) => item.positionId === "P001")!);
    const targetAfter = applyEvents(rolledBack.find((item) => item.positionId === "P004")!);
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
      positionId: "P099",
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
    expect(merged.some((item) => item.positionId === "P099")).toBe(true);
    expect(merged.length).toBe(positions.length + 1);
  });
});
