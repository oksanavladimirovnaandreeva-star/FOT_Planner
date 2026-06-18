import { describe, expect, it } from "vitest";
import { buildWorkingDraftMeta, initialPlanVersions, type PlanVersionMeta } from "./planVersions";
import { canDeletePlanVersion, deletePlanVersionState } from "./planVersionDelete";

describe("planVersionDelete", () => {
  it("allows resetting the only version", () => {
    const versions = initialPlanVersions(2026);
    expect(canDeletePlanVersion(versions[0].id, versions).ok).toBe(true);
    const result = deletePlanVersionState(versions[0].id, versions, { [versions[0].id]: [] }, versions[0].id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].label).toBe("Бюджет 2026");
      expect(result.versions[0].status).toBe("DRAFT");
    }
  });

  it("allows deleting working draft when another approved exists", () => {
    const approved = initialPlanVersions(2026)[0];
    const locked: PlanVersionMeta = { ...approved, status: "APPROVED" };
    const draft = buildWorkingDraftMeta(locked);
    const versions = [locked, draft];
    expect(canDeletePlanVersion(draft.id, versions).ok).toBe(true);
    const result = deletePlanVersionState(draft.id, versions, { [locked.id]: [], [draft.id]: [] }, draft.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versions).toHaveLength(1);
      expect(result.fallbackVersionId).toBe(locked.id);
    }
  });

  it("blocks deleting approved baseline while draft exists", () => {
    const approved = initialPlanVersions(2026)[0];
    const locked: PlanVersionMeta = { ...approved, status: "APPROVED" };
    const draft = buildWorkingDraftMeta(locked);
    const versions = [locked, draft];
    expect(canDeletePlanVersion(locked.id, versions).ok).toBe(false);
  });
});
