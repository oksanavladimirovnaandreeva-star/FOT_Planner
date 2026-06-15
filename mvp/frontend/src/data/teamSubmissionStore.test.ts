import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSubmissionsForPlan,
  getTeamSubmission,
  isTeamEditingLocked,
  markTeamSubmitted,
  markUnitApproved,
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

  it("isTeamEditingLocked для team_submitted и unit_approved", () => {
    expect(isTeamEditingLocked(null)).toBe(false);
    expect(isTeamEditingLocked({ phase: "editing" })).toBe(false);
    expect(isTeamEditingLocked({ phase: "returned" })).toBe(false);
    expect(isTeamEditingLocked({ phase: "team_submitted" })).toBe(true);
    expect(isTeamEditingLocked({ phase: "unit_approved" })).toBe(true);
  });

  it("clearSubmissionsForPlan удаляет записи версии", () => {
    markTeamSubmitted(PLAN, DEPT, UNIT, TEAM);
    markTeamSubmitted("other-plan", DEPT, UNIT, "Other");
    clearSubmissionsForPlan(PLAN);
    expect(getTeamSubmission(PLAN, DEPT, UNIT, TEAM)).toBeNull();
    expect(getTeamSubmission("other-plan", DEPT, UNIT, "Other")?.phase).toBe("team_submitted");
  });
});
