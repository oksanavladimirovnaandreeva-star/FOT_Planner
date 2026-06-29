import { describe, expect, it } from "vitest";
import {
  applyPlanningDeepLinkSlice,
  hasPlanningDeepLinkParams,
  readPlanningDeepLinkParams,
  stripPlanningDeepLinkParams,
} from "./planningDeepLink";
import { DEMO_DEPT_IT, DEMO_UNIT_A } from "./demoOrg";

describe("planningDeepLink", () => {
  it("читает и очищает параметры deep-link", () => {
    const params = readPlanningDeepLinkParams(
      new URLSearchParams("tab=positions&unit=Юнит+А&department=Департамент+ИТ&leadOnly=unit_lead"),
    );
    expect(hasPlanningDeepLinkParams(params)).toBe(true);
    expect(params.unit).toBe("Юнит А");
    expect(params.department).toBe("Департамент ИТ");

    const stripped = stripPlanningDeepLinkParams(
      new URLSearchParams("team=Платформа&unit=Юнит+А&department=x&leadOnly=1"),
    );
    expect(stripped.get("team")).toBeNull();
    expect(stripped.get("unit")).toBeNull();
    expect(stripped.get("department")).toBeNull();
    expect(stripped.get("leadOnly")).toBe("1");
  });

  it("директор: unit без team сбрасывает teams в пустой срез", () => {
    const next = applyPlanningDeepLinkSlice(
      { departments: [], units: [], teams: ["Платформа"] },
      { team: null, unit: DEMO_UNIT_A, department: DEMO_DEPT_IT },
      null,
    );
    expect(next.departments).toEqual([DEMO_DEPT_IT]);
    expect(next.units).toEqual([DEMO_UNIT_A]);
    expect(next.teams).toEqual([]);
  });
});
