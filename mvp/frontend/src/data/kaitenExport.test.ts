import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PositionRecord } from "../types";
import {
  availableKaitenTypesForPosition,
  buildKaitenExportFields,
  dismissKaitenNudge,
  isKaitenNudgeDismissed,
  journalEventKaitenEligible,
  kaitenNudgeForEventType,
  kaitenTypeForEventType,
} from "./kaitenExport";

function samplePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Engineer",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    status: "Occupied",
    employeeName: "Test",
    employeeId: "E001",
    slotType: "new",
    limitFlag: "IN_LIMIT",
    activeFromMonth: 0,
    vacancySinceMonth: null,
    previousDecemberBase: 100_000,
    seedEmployeeName: "Test",
    seedEmployeeId: "E001",
    seedStatus: "Occupied",
    seedVacancySinceMonth: null,
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    monthlyBase: Array(12).fill(100_000),
    monthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: Array(12).fill(100_000),
    seedMonthlyBonus: Array(12).fill(0),
    events: [],
    ...overrides,
  };
}

describe("kaitenExport", () => {
  beforeEach(() => {
    const sessionMemory = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => sessionMemory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        sessionMemory.set(key, value);
      },
      removeItem: (key: string) => {
        sessionMemory.delete(key);
      },
    });
  });

  it("journalEventKaitenEligible для найма и сокращения", () => {
    expect(journalEventKaitenEligible("PLANNED_HIRE")).toBe(true);
    expect(journalEventKaitenEligible("CLOSE_POSITION")).toBe(true);
    expect(journalEventKaitenEligible("INDEXATION")).toBe(false);
    expect(kaitenTypeForEventType("PLANNED_HIRE")).toBe("hire");
    expect(kaitenTypeForEventType("CLOSE_POSITION")).toBe("otiz");
  });

  it("вакансия даёт тип hire", () => {
    const position = samplePosition({
      status: "Vacancy",
      employeeName: null,
      employeeId: null,
      seedStatus: "Vacancy",
      vacancySinceMonth: 3,
      seedVacancySinceMonth: 3,
    });
    expect(availableKaitenTypesForPosition(position)).toEqual(["hire"]);
  });

  it("buildKaitenExportFields для найма содержит org и месяц", () => {
    const position = samplePosition({
      status: "Vacancy",
      employeeName: null,
      employeeId: null,
      seedStatus: "Vacancy",
      vacancySinceMonth: 2,
      seedVacancySinceMonth: 2,
      events: [
        {
          id: "e1",
          type: "PLANNED_HIRE",
          createdAt: "2026-01-01T00:00:00.000Z",
          createdOrder: 1,
          payload: { month: 2, specialization: "Engineering", level: "Middle", base: 120_000, bonus: 10_000 },
        },
      ],
    });
    const fields = buildKaitenExportFields({
      position,
      planYear: 2026,
      requestType: "hire",
      event: position.events[0],
    });
    expect(fields.find((field) => field.key === "position_id")?.value).toBe("P001");
    expect(fields.find((field) => field.key === "start_month")?.value).toBe("Март 2026");
    expect(fields.find((field) => field.key === "base_salary")?.value).toContain("120");
  });

  it("buildKaitenExportFields для ОТиЗ содержит было/стало", () => {
    const position = samplePosition({
      events: [
        {
          id: "e2",
          type: "CLOSE_POSITION",
          createdAt: "2026-02-01T00:00:00.000Z",
          createdOrder: 1,
          payload: { month: 5, comment: "Оптимизация штата" },
        },
      ],
    });
    const fields = buildKaitenExportFields({
      position,
      planYear: 2026,
      requestType: "otiz",
      event: position.events[0],
    });
    expect(fields.find((field) => field.key === "headcount_before")?.value).toBeTruthy();
    expect(fields.find((field) => field.key === "headcount_after")?.value).toBeTruthy();
    expect(fields.find((field) => field.key === "reason")?.value).toContain("Оптимизация");
  });

  it("после увольнения доступны заявки и на найм, и на ОТиЗ", () => {
    const position = samplePosition({
      events: [
        {
          id: "term-1",
          type: "TERMINATION_TO_VACANCY",
          createdAt: "2026-02-01T00:00:00.000Z",
          createdOrder: 1,
          payload: { month: 5 },
        },
      ],
    });
    expect(availableKaitenTypesForPosition(position).sort()).toEqual(["hire", "otiz"]);
  });

  it("kaitenNudgeForEventType и dismiss nudge", () => {
    expect(kaitenNudgeForEventType("CLOSE_POSITION")).toBe("otiz");
    expect(kaitenNudgeForEventType("TERMINATION_TO_VACANCY")).toBe("otiz");
    expect(kaitenNudgeForEventType("PLANNED_HIRE")).toBe("hire");
    expect(kaitenNudgeForEventType("INDEXATION")).toBeNull();
    dismissKaitenNudge("evt-1");
    expect(isKaitenNudgeDismissed("evt-1")).toBe(true);
    expect(isKaitenNudgeDismissed("evt-2")).toBe(false);
  });
});
