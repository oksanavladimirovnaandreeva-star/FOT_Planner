import { beforeEach, describe, expect, it, vi } from "vitest";
import { PILOT_POSITION_TARGET } from "./demoPlanSeed";
import { hasFactData } from "./factStore";
import { readOrgTree } from "./orgStructureStore";
import { roleScopeFor } from "./demoRoleScopeStore";
import { scopeEqValues } from "./personaAccessScope";
import { isBudgetLocked } from "./planVersions";
import { buildPilotTestBundle, isPilotBundleApplied } from "./pilotTestBundle";
import { PLAN_SCENARIO_INCLUDES_FACT } from "./planScenario";
import { loadLeadEditFrozen } from "./userAccess";

describe("pilotTestBundle", () => {
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

  it("собирает оргструктуру, доступы и план v1", () => {
    const bundle = buildPilotTestBundle();

    expect(bundle.positionCount).toBeGreaterThanOrEqual(PILOT_POSITION_TARGET);
    expect(bundle.orgTeamCount).toBeGreaterThan(0);
    expect(isPilotBundleApplied()).toBe(true);
    expect(isBudgetLocked(bundle.versions[0])).toBe(true);
    expect(hasFactData()).toBe(PLAN_SCENARIO_INCLUDES_FACT);
    expect(loadLeadEditFrozen()).toBe(false);

    const teamLead = roleScopeFor("team_lead");
    expect(scopeEqValues(teamLead, "department")).toEqual(["Engineering"]);
    expect(scopeEqValues(teamLead, "unit")).toEqual(["ProductDev"]);
    expect(scopeEqValues(teamLead, "team")).toEqual(["Frontend Web"]);

    const tree = readOrgTree();
    expect(tree.Engineering?.ProductDev).toContain("Frontend Web");
    if (PLAN_SCENARIO_INCLUDES_FACT) {
      expect(bundle.fact.employeeCount).toBeGreaterThan(0);
      expect(bundle.fact.assignmentCount).toBeGreaterThan(0);
    } else {
      expect(bundle.fact.employeeCount).toBe(0);
      expect(bundle.fact.assignmentCount).toBe(0);
    }
  });
});
