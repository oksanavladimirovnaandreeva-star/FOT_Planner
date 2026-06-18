import { describe, expect, it } from "vitest";
import { buildWorkingDraftMeta, initialPlanVersions } from "./planVersions";
import { canCreateQuarterlyWorkingDraft, canReopenPrimaryBudget, reopenPrimaryBudgetMeta } from "./planVersionLifecycle";

describe("planVersionLifecycle", () => {
  it("разрешает откат только утверждённого v1 без черновика и v2", () => {
    const versions = initialPlanVersions(2026);
    const approved = {
      ...versions[0],
      status: "APPROVED" as const,
      publishedAt: new Date().toISOString(),
    };
    expect(canReopenPrimaryBudget([approved])).toEqual({ ok: true });
  });

  it("блокирует откат при черновике корректировки", () => {
    const versions = initialPlanVersions(2026);
    const approved = {
      ...versions[0],
      status: "APPROVED" as const,
      publishedAt: new Date().toISOString(),
    };
    const draft = buildWorkingDraftMeta(approved);
    const result = canReopenPrimaryBudget([approved, draft]);
    expect(result.ok).toBe(false);
  });

  it("reopenPrimaryBudgetMeta снимает утверждение", () => {
    const version = {
      ...initialPlanVersions(2026)[0],
      status: "APPROVED" as const,
      publishedAt: "2026-01-01T00:00:00.000Z",
    };
    const reopened = reopenPrimaryBudgetMeta(version);
    expect(reopened.status).toBe("DRAFT");
    expect(reopened.publishedAt).toBeUndefined();
  });

  it("разрешает создать квартальный черновик после утверждения v1 без права править v1", () => {
    const approved = {
      ...initialPlanVersions(2026)[0],
      status: "APPROVED" as const,
      publishedAt: new Date().toISOString(),
    };
    expect(
      canCreateQuarterlyWorkingDraft({
        canManagePlanVersions: true,
        latestApproved: approved,
        primaryBudget: approved,
        workingDraft: null,
      }),
    ).toBe(true);
  });

  it("не предлагает квартальный черновик до утверждения v1", () => {
    const draft = initialPlanVersions(2026)[0];
    expect(
      canCreateQuarterlyWorkingDraft({
        canManagePlanVersions: true,
        latestApproved: null,
        primaryBudget: draft,
        workingDraft: null,
      }),
    ).toBe(false);
  });
});
