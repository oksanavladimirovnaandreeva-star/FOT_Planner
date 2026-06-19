import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { buildOrgConsolidationReport, getQuarterDeadlines, resolveTeamDisplayStatus } from "./teamConsolidation";
import { markTeamSubmitted, markUnitApproved, clearSubmissionsForPlan, markDirectorApproved, markCbReview } from "./teamSubmissionStore";
import type { PlanVersionMeta } from "./planVersions";
import type { PositionRecord } from "../types";
import { DEMO_DEPT_IT, DEMO_TEAM_PLATFORM, DEMO_UNIT_A } from "./demoOrg";

function clonePositions(): PositionRecord[] {
  return JSON.parse(JSON.stringify(initialPositions().map(applyEvents))) as PositionRecord[];
}

const draftMeta: PlanVersionMeta = {
  id: "draft-1",
  label: "Черновик Q2",
  kind: "WORKING_DRAFT",
  status: "DRAFT",
  versionNumber: 2,
  planYear: 2026,
  parentVersionId: null,
  baselineVersionId: "v1",
  createdAt: "2026-06-01T00:00:00.000Z",
};

describe("teamConsolidation", () => {
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
  });

  it("группирует команды департамента ИТ", () => {
    const positions = clonePositions();
    const report = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: null,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
    });
    expect(report.units.length).toBeGreaterThan(0);
    expect(report.totals.teams).toBeGreaterThan(0);
    expect(report.totals.headcount).toBeGreaterThan(0);
  });

  it("помечает команду in_progress при новых событиях в черновике", () => {
    const baseline = clonePositions();
    const draft = clonePositions();
    const source = draft.find((item) => item.positionId === "P001")!;
    draft[draft.indexOf(source)] = {
      ...source,
      events: [
        ...source.events,
        {
          id: "new-evt",
          type: "TERMINATION_TO_VACANCY",
          createdAt: "2026-06-02T00:00:00.000Z",
          createdOrder: source.events.length + 1,
          payload: { month: 4 },
        },
      ],
    };

    const report = buildOrgConsolidationReport(draft, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: draftMeta,
      baselinePositions: baseline,
      draftPositions: draft,
      now: new Date(2026, 4, 1),
    });
    const team = report.units.flatMap((unit) => unit.teams).find((row) => row.team === source.team);
    expect(team?.deltaEvents).toBeGreaterThan(0);
    expect(team?.status).not.toBe("not_started");
  });

  it("возвращает три квартальных дедлайна", () => {
    expect(getQuarterDeadlines(2026)).toHaveLength(3);
  });

  it("unit_lead видит только команды своего юнита", () => {
    const positions = clonePositions();
    const full = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: null,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
    });
    const scoped = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      planYear: 2026,
      workingDraft: null,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
    });
    expect(scoped.totals.teams).toBeLessThan(full.totals.teams);
    expect(scoped.units.every((group) => group.unit === DEMO_UNIT_A)).toBe(true);
  });

  it("resolveTeamDisplayStatus — приоритет cb_submitted и submission", () => {
    expect(resolveTeamDisplayStatus("ready", null, true)).toBe("cb_submitted");
    expect(resolveTeamDisplayStatus("ready", { phase: "team_submitted" }, false)).toBe("team_submitted");
    expect(resolveTeamDisplayStatus("ready", { phase: "unit_approved" }, false)).toBe("unit_approved");
    expect(resolveTeamDisplayStatus("ready", { phase: "director_approved" }, false)).toBe("director_approved");
    expect(resolveTeamDisplayStatus("ready", { phase: "cb_review" }, false)).toBe("cb_review");
    expect(resolveTeamDisplayStatus("ready", { phase: "returned" }, false)).toBe("returned");
    expect(resolveTeamDisplayStatus("in_progress", null, false)).toBe("in_progress");
  });

  it("totals filled/approved для donut", () => {
    const positions = clonePositions();
    clearSubmissionsForPlan(draftMeta.id);
    const source = positions.find((item) => item.team === DEMO_TEAM_PLATFORM)!;
    markTeamSubmitted(draftMeta.id, source.department, source.unit, source.team);

    const report = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: draftMeta,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
      submissionPlanVersionId: draftMeta.id,
    });
    expect(report.totals.filledTeams).toBeGreaterThan(0);
    expect(report.totals.approvedTeams).toBe(0);

    markUnitApproved(draftMeta.id, source.department, source.unit, source.team);
    const approved = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: draftMeta,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
      submissionPlanVersionId: draftMeta.id,
    });
    expect(approved.totals.approvedTeams).toBeGreaterThan(0);

    markDirectorApproved(draftMeta.id, source.department, source.unit, source.team);
    markCbReview(draftMeta.id, source.department, source.unit, source.team);
    const cbReviewed = buildOrgConsolidationReport(positions, {
      department: DEMO_DEPT_IT,
      planYear: 2026,
      workingDraft: draftMeta,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
      submissionPlanVersionId: draftMeta.id,
    });
    expect(cbReviewed.totals.approvedTeams).toBeGreaterThan(0);
  });
});
