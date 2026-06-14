import { describe, expect, it } from "vitest";
import { parseOrgCsv, mergeOrgTrees, countOrgNodes } from "./orgStructureStore";

describe("orgStructureStore", () => {
  it("parses semicolon CSV with header", () => {
    const csv = `department;unit;team
Engineering;Platform;Backend Core
Engineering;Platform;DevOps`;
    const result = parseOrgCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rowCount).toBe(2);
    expect(result.tree.Engineering.Platform).toEqual(["Backend Core", "DevOps"]);
  });

  it("merges trees without dropping existing teams", () => {
    const base = { Engineering: { Platform: ["A"] } };
    const incoming = { Engineering: { Platform: ["B"], Mobile: ["X"] } };
    const merged = mergeOrgTrees(base, incoming);
    expect(merged.Engineering.Platform).toEqual(["A", "B"]);
    expect(merged.Engineering.Mobile).toEqual(["X"]);
  });

  it("counts org nodes", () => {
    const counts = countOrgNodes({
      D1: { U1: ["T1", "T2"], U2: ["T3"] },
      D2: { U3: ["T4"] },
    });
    expect(counts).toEqual({ departmentCount: 2, unitCount: 3, teamCount: 4 });
  });
});
