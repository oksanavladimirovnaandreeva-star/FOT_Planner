import { describe, expect, it } from "vitest";
import type { PlanVersionMeta } from "./planVersions";
import { resolveCanEditWorkspace } from "./planCorrectionWindow";

const annualDraftV1: PlanVersionMeta = {
  id: "budget-2026-v1",
  label: "Бюджет 2026",
  planYear: 2026,
  versionNumber: 1,
  kind: "APPROVED",
  status: "DRAFT",
  parentVersionId: null,
  baselineVersionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const annualApprovedV1: PlanVersionMeta = {
  ...annualDraftV1,
  status: "APPROVED",
  publishedAt: "2026-03-01T00:00:00.000Z",
};

const workingDraft: PlanVersionMeta = {
  id: "draft-2026-budget-2026-v1",
  label: "2 Квартал 2026",
  planYear: 2026,
  versionNumber: 2,
  kind: "WORKING_DRAFT",
  status: "DRAFT",
  parentVersionId: null,
  baselineVersionId: annualApprovedV1.id,
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("resolveCanEditWorkspace", () => {
  it("годовой черновик v1 в режиме планирования — правки доступны", () => {
    expect(
      resolveCanEditWorkspace({
        canEditPlan: true,
        isTeamSliceReadOnly: false,
        workspaceMode: "planning",
        activePlan: annualDraftV1,
        primaryBudget: annualDraftV1,
      }),
    ).toBe(true);
  });

  it("квартальный черновик в режиме планирования — правки доступны (C&B индексация)", () => {
    expect(
      resolveCanEditWorkspace({
        canEditPlan: true,
        isTeamSliceReadOnly: false,
        workspaceMode: "planning",
        activePlan: workingDraft,
        primaryBudget: annualApprovedV1,
      }),
    ).toBe(true);
  });

  it("утверждённый v1 без черновика — только просмотр", () => {
    expect(
      resolveCanEditWorkspace({
        canEditPlan: false,
        isTeamSliceReadOnly: false,
        workspaceMode: "planning",
        activePlan: annualApprovedV1,
        primaryBudget: annualApprovedV1,
      }),
    ).toBe(false);
  });

  it("квартальный черновик в режиме корректировки — правки доступны", () => {
    expect(
      resolveCanEditWorkspace({
        canEditPlan: true,
        isTeamSliceReadOnly: false,
        workspaceMode: "correction",
        activePlan: workingDraft,
        primaryBudget: annualApprovedV1,
      }),
    ).toBe(true);
  });

  it("годовой v1 в режиме корректировки без черновика — правки недоступны", () => {
    expect(
      resolveCanEditWorkspace({
        canEditPlan: true,
        isTeamSliceReadOnly: false,
        workspaceMode: "correction",
        activePlan: annualDraftV1,
        primaryBudget: annualDraftV1,
      }),
    ).toBe(false);
  });
});
