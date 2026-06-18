import { describe, expect, it } from "vitest";
import {
  buildTeamLeadVersionRibbon,
  formatNextQuarterVersionHint,
  resolveTeamLeadKanbanColumn,
} from "./teamLeadApprovalKanban";
import type { PlanVersionMeta } from "./planVersions";

function version(partial: Partial<PlanVersionMeta>): PlanVersionMeta {
  return {
    id: "v1",
    label: "v1",
    planYear: 2026,
    versionNumber: 1,
    kind: "APPROVED",
    status: "APPROVED",
    parentVersionId: null,
    baselineVersionId: null,
    createdAt: "",
    publishedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("resolveTeamLeadKanbanColumn", () => {
  const primary = version({ id: "b1", label: "Бюджет 2026", versionNumber: 1, status: "APPROVED" });
  const draft = version({
    id: "d1",
    label: "1 Квартал 2026",
    versionNumber: 2,
    kind: "WORKING_DRAFT",
    status: "DRAFT",
    publishedAt: undefined,
  });

  it("без черновика — в работе (ожидание)", () => {
    expect(
      resolveTeamLeadKanbanColumn({
        workingDraft: null,
        latestApproved: primary,
        primaryBudget: primary,
        submission: null,
      }),
    ).toBe("in_progress");
  });

  it("сдано — на согласовании", () => {
    expect(
      resolveTeamLeadKanbanColumn({
        workingDraft: draft,
        latestApproved: primary,
        primaryBudget: primary,
        submission: { phase: "team_submitted" },
      }),
    ).toBe("in_approval");
  });

  it("возврат — на доработке", () => {
    expect(
      resolveTeamLeadKanbanColumn({
        workingDraft: draft,
        latestApproved: primary,
        primaryBudget: primary,
        submission: { phase: "returned", returnedNote: "уточнить ФОТ" },
      }),
    ).toBe("returned");
  });

  it("опубликован v2 без черновика — бюджет опубликован", () => {
    const q1 = version({ id: "v2", label: "1 Квартал 2026", versionNumber: 2 });
    expect(
      resolveTeamLeadKanbanColumn({
        workingDraft: null,
        latestApproved: q1,
        primaryBudget: primary,
        submission: null,
      }),
    ).toBe("published");
  });
});

describe("buildTeamLeadVersionRibbon", () => {
  it("утверждённый год и открытый черновик", () => {
    const steps = buildTeamLeadVersionRibbon({
      primaryBudget: version({ label: "Бюджет 2026", status: "APPROVED" }),
      workingDraft: version({
        kind: "WORKING_DRAFT",
        status: "DRAFT",
        label: "1 Квартал 2026",
        versionNumber: 2,
        publishedAt: undefined,
      }),
      latestApproved: version({ label: "Бюджет 2026", versionNumber: 1, status: "APPROVED" }),
    });
    expect(steps[0].state).toBe("done");
    expect(steps[1].state).toBe("current");
    expect(steps[2].state).toBe("pending");
  });
});

describe("formatNextQuarterVersionHint", () => {
  it("после Q1 указывает Q2", () => {
    const text = formatNextQuarterVersionHint({ planYear: 2026, latestPublishedVersionNumber: 2 });
    expect(text).toContain("2 Квартал 2026");
  });
});
