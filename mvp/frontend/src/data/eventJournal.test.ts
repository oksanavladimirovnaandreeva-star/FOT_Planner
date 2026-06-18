import { describe, expect, it } from "vitest";
import {
  formatEventChangeLine,
  formatGradeChangeRange,
  gradeChanged,
  positionGradeYearRange,
  salaryChanged,
} from "./eventJournal";
import type { EventChangeSummary } from "./eventJournal";
import type { PositionRecord } from "../types";

const baseChange = (patch: Partial<EventChangeSummary>): EventChangeSummary => ({
  month: 2,
  monthLabel: "Март",
  statusBefore: "В штате",
  statusAfter: "В штате",
  baseBefore: 150_000,
  baseAfter: 150_000,
  specBefore: "Engineering",
  specAfter: "Engineering",
  levelBefore: "Middle",
  levelAfter: "Middle",
  ...patch,
});

describe("eventJournal change display", () => {
  it("показывает оклад и грейд вместе", () => {
    const line = formatEventChangeLine(
      baseChange({
        baseAfter: 180_000,
        levelAfter: "Senior",
      }),
    );
    expect(line).toMatch(/180[\s\u00a0]000 ₽/);
    expect(line).toContain("Engineering/Middle → Engineering/Senior");
  });

  it("показывает только смену грейда", () => {
    const line = formatEventChangeLine(
      baseChange({
        levelAfter: "Lead",
      }),
    );
    expect(line).toContain("Engineering/Lead");
    expect(line).not.toContain("₽");
  });

  it("определяет изменение грейда в позиции январь→декабрь", () => {
    const record = {
      monthlySpec: Array.from({ length: 12 }, (_, index) => (index < 6 ? "Product" : "Engineering")),
      monthlyLevel: Array.from({ length: 12 }, (_, index) => (index < 6 ? "Middle" : "Senior")),
    } as PositionRecord;
    const range = positionGradeYearRange(record);
    expect(range.changed).toBe(true);
    expect(range.before).toBe("Product/Middle");
    expect(range.after).toBe("Engineering/Senior");
    expect(formatGradeChangeRange(baseChange({ levelAfter: "Senior" }))).toBe(
      "Engineering/Middle → Engineering/Senior",
    );
    expect(salaryChanged(baseChange({}))).toBe(false);
    expect(gradeChanged(baseChange({ levelAfter: "Senior" }))).toBe(true);
  });
});
