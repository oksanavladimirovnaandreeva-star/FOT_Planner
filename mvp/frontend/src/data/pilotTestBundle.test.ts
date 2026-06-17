import { beforeEach, describe, expect, it, vi } from "vitest";
import { PILOT_POSITION_TARGET } from "./demoPlanSeed";
import { hasFactData } from "./factStore";
import { readOrgTree } from "./orgStructureStore";
import { roleScopeFor } from "./demoRoleScopeStore";
import { isBudgetLocked } from "./planVersions";
import { buildPilotTestBundle, isPilotBundleApplied } from "./pilotTestBundle";
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

  it("собирает оргструктуру, доступы, план v1 и факт", () => {
    const bundle = buildPilotTestBundle();

    expect(bundle.positionCount).toBeGreaterThanOrEqual(PILOT_POSITION_TARGET);
    expect(bundle.orgTeamCount).toBeGreaterThan(0);
    expect(isPilotBundleApplied()).toBe(true);
    expect(isBudgetLocked(bundle.versions[0])).toBe(true);
    expect(hasFactData()).toBe(true);
    expect(loadLeadEditFrozen()).toBe(false);

    const teamLead = roleScopeFor("team_lead");
    expect(teamLead).toEqual({
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
    });

    const tree = readOrgTree();
    expect(tree.Engineering?.ProductDev).toContain("Frontend Web");
    expect(bundle.fact.employeeCount).toBeGreaterThan(0);
    expect(bundle.fact.assignmentCount).toBeGreaterThan(0);
  });
});
