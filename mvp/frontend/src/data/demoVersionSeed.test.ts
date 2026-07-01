import { describe, expect, it } from "vitest";
import { applyEvents, annualTotal } from "./planningData";
import { buildTeamApprovalDiff } from "./teamApprovalDiff";
import { buildDemoAnnualVersionState, buildDemoQuarterlyVersionState } from "./demoVersionSeed";
import { isBudgetLocked } from "./planVersions";
import { DEMO_DEPT_IT, DEMO_TEAM_MOBILE, DEMO_TEAM_PLATFORM, DEMO_UNIT_A } from "./demoOrg";

function teamFot(positions: ReturnType<typeof applyEvents>[]) {
  return positions
    .filter(
      (p) =>
        p.status !== "Closed" &&
        p.department === DEMO_DEPT_IT &&
        p.unit === DEMO_UNIT_A &&
        p.team === DEMO_TEAM_PLATFORM,
    )
    .reduce((sum, p) => sum + annualTotal(p), 0);
}

describe("buildDemoQuarterlyVersionState", () => {
  it("создаёт утверждённый v1 и квартальный черновик с правками", () => {
    const { versions, dataByVersion } = buildDemoQuarterlyVersionState();
    const annual = versions.find((version) => version.versionNumber === 1);
    const draft = versions.find((version) => version.kind === "WORKING_DRAFT");

    expect(annual).toBeTruthy();
    expect(annual && isBudgetLocked(annual)).toBe(true);
    expect(draft).toBeTruthy();
    expect(draft?.baselineVersionId).toBe(annual?.id);

    const baseline = dataByVersion[annual!.id];
    const draftRows = dataByVersion[draft!.id];
    expect(baseline.length).toBeGreaterThan(0);
    expect(draftRows.length).toBe(baseline.length);

    const mobileDiff = buildTeamApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draftRows,
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_MOBILE,
      mode: "quarterly",
    });
    expect(mobileDiff.rows.length).toBeGreaterThan(0);

    const frontendDiff = buildTeamApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draftRows,
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_PLATFORM,
      mode: "quarterly",
    });
    expect(frontendDiff.rows.length).toBeGreaterThan(0);
    const reviewRow = frontendDiff.rows.find((row) => row.event.id === "demo-q1-frontend-review");
    expect(reviewRow?.fotDeltaAnnual ?? 0).toBeGreaterThan(0);
  });

  it("Платформа: планирование (утверждённый) vs Мой бюджет (Q1 черновик)", () => {
    const annual = buildDemoAnnualVersionState();
    const quarterly = buildDemoQuarterlyVersionState();
    const approvedAnnual = annual.versions.find((v) => v.versionNumber === 1)!;
    const approvedQ = quarterly.versions.find((v) => v.status === "APPROVED")!;
    const draftQ = quarterly.versions.find((v) => v.kind === "WORKING_DRAFT")!;

    const scope = {
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_PLATFORM,
    };

    const planningApproved = teamFot(annual.dataByVersion[approvedAnnual.id].map(applyEvents));
    const planningApprovedQ = teamFot(quarterly.dataByVersion[approvedQ.id].map(applyEvents));
    const budgetDraft = teamFot(quarterly.dataByVersion[draftQ.id].map(applyEvents));

    const diff = buildTeamApprovalDiff({
      baselinePositions: quarterly.dataByVersion[approvedQ.id],
      draftPositions: quarterly.dataByVersion[draftQ.id],
      ...scope,
      mode: "quarterly",
    });

    expect(planningApproved).toBe(planningApprovedQ);
    expect(diff.summary.baselineFot).toBe(planningApprovedQ);
    expect(diff.summary.draftFot).toBe(budgetDraft);
    expect(diff.summary.draftFot).toBeGreaterThan(diff.summary.baselineFot);
    // Демо-сид: ~12.7M на планировании (утверждённый), ~12.74M в Q1-черновике (+пересмотр).
    // У вас в браузере может быть богаче (новые позиции в Q1 → ~19M) — смотрите «Работаем в» в сайдбаре.
    expect(planningApprovedQ).toBeCloseTo(12_710_150, -4);
    expect(budgetDraft).toBeCloseTo(12_744_800, -4);
  });

  it("Платформа: «Мой бюджет» и планирование совпадают после applyEvents", () => {
    const { versions, dataByVersion } = buildDemoQuarterlyVersionState();
    const draft = versions.find((v) => v.kind === "WORKING_DRAFT")!;
    const baseline = versions.find((v) => v.id === draft.baselineVersionId)!;
    const scope = {
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_PLATFORM,
    };

    const rawDiff = buildTeamApprovalDiff({
      baselinePositions: dataByVersion[baseline.id],
      draftPositions: dataByVersion[draft.id],
      ...scope,
      mode: "quarterly",
    });
    const appliedDraft = dataByVersion[draft.id].map(applyEvents);
    const appliedBaseline = dataByVersion[baseline.id].map(applyEvents);
    const appliedDiff = buildTeamApprovalDiff({
      baselinePositions: appliedBaseline,
      draftPositions: appliedDraft,
      ...scope,
      mode: "quarterly",
    });

    const teamApplied = appliedDraft.filter(
      (p) =>
        p.department === scope.department &&
        p.unit === scope.unit &&
        p.team === scope.team &&
        p.status !== "Closed",
    );
    const planningTotal = teamApplied.reduce((sum, p) => sum + annualTotal(p), 0);

    expect(appliedDiff.summary.draftFot).toBe(planningTotal);
    expect(rawDiff.summary.draftFot).toBe(appliedDiff.summary.draftFot);
  });
});
