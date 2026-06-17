import { describe, expect, it } from "vitest";
import { canRolePerformSubmissionAction, submissionPhaseLabel } from "./submissionWorkflowPolicy";

describe("submissionWorkflowPolicy", () => {
  it("team_lead submit только в своей команде", () => {
    expect(
      canRolePerformSubmissionAction("team_submit", {
        actorRole: "team_lead",
        actorDepartment: "Engineering",
        actorUnit: "ProductDev",
        actorTeam: "Frontend Web",
        targetDepartment: "Engineering",
        targetUnit: "ProductDev",
        targetTeam: "Frontend Web",
      }),
    ).toBe(true);
    expect(
      canRolePerformSubmissionAction("team_submit", {
        actorRole: "team_lead",
        actorDepartment: "Engineering",
        actorUnit: "ProductDev",
        actorTeam: "Frontend Web",
        targetDepartment: "Engineering",
        targetUnit: "ProductDev",
        targetTeam: "Backend Core",
      }),
    ).toBe(false);
  });

  it("cb_admin имеет полный доступ, viewer — нет", () => {
    expect(
      canRolePerformSubmissionAction("cb_review", {
        actorRole: "cb_admin",
        targetDepartment: "Engineering",
        targetUnit: "ProductDev",
        targetTeam: "Frontend Web",
      }),
    ).toBe(true);
    expect(
      canRolePerformSubmissionAction("return", {
        actorRole: "viewer",
        targetDepartment: "Engineering",
        targetUnit: "ProductDev",
        targetTeam: "Frontend Web",
      }),
    ).toBe(false);
  });

  it("возвращает человекочитаемый label фазы", () => {
    expect(submissionPhaseLabel("team_submitted")).toContain("Сдано");
  });
});
