import { describe, expect, it } from "vitest";
import { resolvePlanWorkspaceStatus } from "./planWorkspaceStatus";
import type { PlanVersionMeta } from "./planVersions";

function version(partial: Partial<PlanVersionMeta>): PlanVersionMeta {
  return {
    id: "v1",
    label: "Бюджет 2026",
    kind: "APPROVED",
    status: "APPROVED",
    planYear: 2026,
    ...partial,
  } as PlanVersionMeta;
}

describe("resolvePlanWorkspaceStatus", () => {
  it("архив и согласование", () => {
    expect(resolvePlanWorkspaceStatus({
      activePlan: version({ status: "ARCHIVED" }),
      canEditPlan: false,
      leadEditFrozenForRole: false,
    }).label).toBe("Архив");

    expect(resolvePlanWorkspaceStatus({
      activePlan: version({ status: "IN_APPROVAL", kind: "WORKING_DRAFT" }),
      canEditPlan: false,
      leadEditFrozenForRole: false,
    }).label).toBe("На согласовании");
  });

  it("можно править и freeze", () => {
    expect(resolvePlanWorkspaceStatus({
      activePlan: version({ status: "DRAFT" }),
      canEditPlan: true,
      leadEditFrozenForRole: false,
    }).label).toBe("Можно править");

    expect(resolvePlanWorkspaceStatus({
      activePlan: version({ status: "APPROVED" }),
      canEditPlan: true,
      leadEditFrozenForRole: true,
    }).label).toBe("Правки закрыты");
  });
});
