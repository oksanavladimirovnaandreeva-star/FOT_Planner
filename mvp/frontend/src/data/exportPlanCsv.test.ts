import { describe, expect, it } from "vitest";
import { buildOrgScopeHash, buildPlanPositionsCsv } from "./exportPlanCsv";
import { initialPositions } from "./planningData";

describe("exportPlanCsv", () => {
  it("buildOrgScopeHash стабилен для одного среза", () => {
    const scope = { departments: ["Engineering"], units: [], teams: [] };
    expect(buildOrgScopeHash(scope)).toBe(buildOrgScopeHash(scope));
  });

  it("CSV содержит заголовок и строки позиций", () => {
    const positions = initialPositions().slice(0, 2);
    const csv = buildPlanPositionsCsv({
      positions,
      viewMode: "base",
      planVersionId: "v1",
      planYear: 2026,
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain("position_id");
    expect(lines.length).toBe(1 + positions.length);
    expect(lines[1]).toContain(positions[0].positionId);
  });
});
