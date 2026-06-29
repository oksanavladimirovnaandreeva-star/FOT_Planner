import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_DEPT_IT, DEMO_TEAM_MOBILE, DEMO_UNIT_A } from "./demoOrg";
import { loginAsDemoPersona } from "./demoSessionStore";
import { initialPlanVersions } from "./planVersions";
import {
  applyPackageSubmissionAction,
  clearPackageSubmissionsForPlan,
  getPackageSubmission,
} from "./packageSubmissionStore";
import { applySubmissionAction, clearSubmissionsForPlan } from "./teamSubmissionStore";

const PLAN_ID = initialPlanVersions(2026)[0]!.id;

describe("annual approval workflow W1", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });
    clearSubmissionsForPlan(PLAN_ID);
    clearPackageSubmissionsForPlan(PLAN_ID);
  });

  it("тимлид → юнит → директор → C&B по годовому циклу", () => {
    const dept = DEMO_DEPT_IT;
    const unit = DEMO_UNIT_A;
    const team = DEMO_TEAM_MOBILE;

    loginAsDemoPersona("petya");
    expect(
      applySubmissionAction({
        planVersionId: PLAN_ID,
        department: dept,
        unit,
        team,
        action: "team_submit",
        actor: { role: "team_lead" },
      }).ok,
    ).toBe(true);

    loginAsDemoPersona("sidr");
    expect(
      applySubmissionAction({
        planVersionId: PLAN_ID,
        department: dept,
        unit,
        team,
        action: "unit_approve",
        actor: { role: "unit_lead" },
      }).ok,
    ).toBe(true);

    expect(
      applyPackageSubmissionAction({
        planVersionId: PLAN_ID,
        level: "unit",
        department: dept,
        unit,
        action: "package_submit_unit",
        actorRole: "unit_lead",
      }).ok,
    ).toBe(true);

    loginAsDemoPersona("dir_it");
    expect(
      applyPackageSubmissionAction({
        planVersionId: PLAN_ID,
        level: "department",
        department: dept,
        unit: null,
        action: "package_submit_department",
        actorRole: "director",
      }).ok,
    ).toBe(true);

    const deptPkg = getPackageSubmission({
      planVersionId: PLAN_ID,
      level: "department",
      department: dept,
      unit: null,
    });
    expect(deptPkg?.phase).toBe("submitted");

    loginAsDemoPersona("cb");
    expect(
      applyPackageSubmissionAction({
        planVersionId: PLAN_ID,
        level: "department",
        department: dept,
        unit: null,
        action: "package_approve_department",
        actorRole: "cb_admin",
      }).ok,
    ).toBe(true);

    expect(
      applyPackageSubmissionAction({
        planVersionId: PLAN_ID,
        level: "department",
        department: dept,
        unit: null,
        action: "package_cb_review",
        actorRole: "cb_admin",
      }).ok,
    ).toBe(true);

    expect(
      getPackageSubmission({
        planVersionId: PLAN_ID,
        level: "department",
        department: dept,
        unit: null,
      })?.phase,
    ).toBe("cb_review");
  });
});
