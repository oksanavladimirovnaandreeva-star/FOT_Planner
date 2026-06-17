import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySubmissionAction,
  clearSubmissionsForPlan,
  getTeamSubmission,
  isTeamEditingLocked,
  markCbReview,
  markDirectorApproved,
  markTeamSubmitted,
  markUnitApproved,
  reopenTeamEditing,
  returnTeamToEditing,
} from "./teamSubmissionStore";

const PLAN = "draft-test";
const DEPT = "Engineering";
const UNIT = "ProductDev";
const TEAM = "Frontend Web";

describe("teamSubmissionStore", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    clearSubmissionsForPlan(PLAN);
    localStorage.removeItem("mvp.teamSubmissions");
  });

  it("markTeamSubmitted → get возвращает phase team_submitted", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    const record = getTeamSubmission(PLAN, DEPT, UNIT, TEAM);
    expect(record?.phase).toBe("team_submitted");
    expect(record?.teamSubmittedAt).toBeTruthy();
  });

  it("returnTeam → returned", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    returnTeamToEditing(PLAN, DEPT, UNIT, TEAM, "Уточните события");
    const record = getTeamSubmission(PLAN, DEPT, UNIT, TEAM);
    expect(record?.phase).toBe("returned");
    expect(record?.returnedNote).toBe("Уточните события");
  });

  it("markUnitApproved → unit_approved", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    markUnitApproved(PLAN, DEPT, UNIT, TEAM);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("unit_approved");
  });

  it("unit_approved -> director_approved -> cb_review", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    markUnitApproved(PLAN, DEPT, UNIT, TEAM);
    markDirectorApproved(PLAN, DEPT, UNIT, TEAM);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("director_approved");
    markCbReview(PLAN, DEPT, UNIT, TEAM);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("cb_review");
  });

  it("reopen после return переводит в editing", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    returnTeamToEditing(PLAN, DEPT, UNIT, TEAM, "Уточните");
    reopenTeamEditing(PLAN, DEPT, UNIT, TEAM);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("editing");
  });

  it("guard запрещает unit approval без submit", () => {
    applySubmissionAction({
      planVersionId: PLAN,
      department: DEPT,
      unit: UNIT,
      team: TEAM,
      action: "unit_approve",
      actor: { role: "unit_lead" },
    });
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)).toBeNull();
  });

  it("guard ограничивает team_submit своим scope", () => {
    const denied = applySubmissionAction({
      planVersionId: PLAN,
      department: "Sales",
      unit: UNIT,
      team: TEAM,
      action: "team_submit",
      actor: { role: "team_lead" },
    });
    expect(denied.ok).toBe(false);
  });

  it("cb_admin может вернуть и открыть правки на любом уровне", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    markUnitApproved(PLAN, DEPT, UNIT, TEAM);
    const returned = applySubmissionAction({
      planVersionId: PLAN,
      department: DEPT,
      unit: UNIT,
      team: TEAM,
      action: "return",
      actor: { role: "cb_admin" },
      note: "Доработать",
    });
    expect(returned.ok).toBe(true);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("returned");

    const reopened = applySubmissionAction({
      planVersionId: PLAN,
      department: DEPT,
      unit: UNIT,
      team: TEAM,
      action: "reopen_editing",
      actor: { role: "cb_admin" },
    });
    expect(reopened.ok).toBe(true);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)?.phase).toBe("editing");
  });

  it("isTeamEditingLocked для этапов согласования", () => {
    expect(isTeamEditingLocked(null)).toBe(false);
    expect(isTeamEditingLocked({ phase: "editing" })).toBe(false);
    expect(isTeamEditingLocked({ phase: "returned" })).toBe(false);
    expect(isTeamEditingLocked({ phase: "team_submitted" })).toBe(true);
    expect(isTeamEditingLocked({ phase: "unit_approved" })).toBe(true);
    expect(isTeamEditingLocked({ phase: "director_approved" })).toBe(true);
    expect(isTeamEditingLocked({ phase: "cb_review" })).toBe(true);
  });

  it("clearSubmissionsForPlan удаляет записи версии", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    markTeamSubmitted("other-plan", DEPT, UNIT, "Other");
    clearSubmissionsForPlan(PLAN);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)).toBeNull();
    expect(getTeamSubmission("other-plan", DEPT, UNIT, "Other")?.phase).toBe("team_submitted");
  });
});
