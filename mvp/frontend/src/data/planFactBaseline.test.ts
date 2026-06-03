import { describe, expect, it } from "vitest";
import { resolvePlanFactBaseline } from "./planFactBaseline";
import { initialPlanVersions } from "./planVersions";
import { initialPositions } from "./planningData";

describe("resolvePlanFactBaseline", () => {
  it("берёт последнюю утверждённую, а не черновик в сайдбаре", () => {
    const versions = initialPlanVersions(2026);
    const v1 = versions[0];
    const draft = {
      ...versions[0],
      id: "draft-2026-test",
      label: "Черновик Q2",
      kind: "WORKING_DRAFT" as const,
      status: "DRAFT" as const,
      versionNumber: 2,
      baselineVersionId: v1.id,
    };
    const allVersions = [
      { ...v1, status: "APPROVED" as const },
      draft,
    ];
    const dataByVersion = {
      [v1.id]: initialPositions(),
      [draft.id]: initialPositions(),
    };
    const baseline = resolvePlanFactBaseline(allVersions, dataByVersion, draft.id);
    expect(baseline.planVersion.id).toBe(v1.id);
    expect(baseline.differsFromSidebar).toBe(true);
  });
});
