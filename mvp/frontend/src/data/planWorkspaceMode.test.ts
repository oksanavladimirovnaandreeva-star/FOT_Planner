import { describe, expect, it } from "vitest";
import { planWorkspaceBasePath, planWorkspacePath, PLAN_WORKSPACE_LABELS } from "./planWorkspaceMode";

describe("planWorkspaceMode", () => {
  it("маршруты planning / correction", () => {
    expect(planWorkspaceBasePath("planning")).toBe("/planning");
    expect(planWorkspaceBasePath("correction")).toBe("/planning?mode=correction");
    expect(planWorkspacePath("correction", { tab: "compare" })).toBe("/planning?mode=correction&tab=compare");
    expect(PLAN_WORKSPACE_LABELS.correction).toBe("Корректировка");
  });
});
