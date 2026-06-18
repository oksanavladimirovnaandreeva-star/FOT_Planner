import { describe, expect, it } from "vitest";
import {
  buildApprovalRoute,
  defaultVersionLabel,
  initialPlanVersions,
  repairVersionLabels,
} from "./planVersions";

describe("planVersions labels", () => {
  it("формирует имя годового бюджета и квартальной корректировки", () => {
    expect(defaultVersionLabel(2026, 1)).toBe("Бюджет 2026");
    expect(defaultVersionLabel(2026, 2)).toBe("1 Квартал 2026");
    expect(defaultVersionLabel(2026, 3)).toBe("2 Квартал 2026");
  });

  it("repairVersionLabels пересчитывает legacy-подписи", () => {
    const repaired = repairVersionLabels([
      {
        ...initialPlanVersions(2026)[0],
        label: "v1",
      },
    ]);
    expect(repaired[0].label).toBe("Бюджет 2026");
  });

  it("buildApprovalRoute без v1 в подписях", () => {
    const versions = initialPlanVersions(2026);
    const approved = { ...versions[0], status: "APPROVED" as const, publishedAt: new Date().toISOString() };
    const steps = buildApprovalRoute([approved], null);
    const labels = steps.map((step) => step.label).join(" ");
    expect(labels).not.toMatch(/\bv1\b/i);
    expect(labels).toContain("Бюджет 2026");
    expect(labels).toContain("1 Квартал 2026");
  });
});
