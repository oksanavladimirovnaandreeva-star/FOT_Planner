import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { buildOrgConsolidationReport, getQuarterDeadlines } from "./teamConsolidation";
import type { PlanVersionMeta } from "./planVersions";
import type { PositionRecord } from "../types";

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
  it("группирует команды департамента Engineering", () => {
    const positions = clonePositions();
    const report = buildOrgConsolidationReport(positions, {
      department: "Engineering",
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
      department: "Engineering",
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
      department: "Engineering",
      planYear: 2026,
      workingDraft: null,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
    });
    const scoped = buildOrgConsolidationReport(positions, {
      department: "Engineering",
      unit: "ProductDev",
      planYear: 2026,
      workingDraft: null,
      baselinePositions: positions,
      draftPositions: positions,
      now: new Date(2026, 4, 1),
    });
    expect(scoped.totals.teams).toBeLessThan(full.totals.teams);
    expect(scoped.units.every((group) => group.unit === "ProductDev")).toBe(true);
  });
});
