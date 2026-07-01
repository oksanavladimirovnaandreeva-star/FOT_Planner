import { describe, expect, it } from "vitest";
import { DEMO_PERSONA_BY_ID } from "./demoPersonas";
import { catalogSliceFromPositions, seedPositionsForCatalogDefaults } from "./personaCatalogDefaults";
import { scopeFromOrgMatrixRow } from "./personaAccessMatrix";

describe("personaCatalogDefaults", () => {
  const positions = seedPositionsForCatalogDefaults();

  it("catalogSliceFromPositions учитывает орг-срез", () => {
    const vasyaScope = scopeFromOrgMatrixRow(
      {
        departments: ["Департамент ИТ"],
        units: ["Юнит А"],
        teams: ["Платформа"],
        excludeSelf: true,
      },
      "Василий Андреев",
    );
    const platform = catalogSliceFromPositions(positions, vasyaScope);
    const allIt = catalogSliceFromPositions(
      positions,
      scopeFromOrgMatrixRow(
        { departments: ["Департамент ИТ"], units: [], teams: [], excludeSelf: false },
        undefined,
      ),
    );
    expect(platform.levels.length).toBeLessThanOrEqual(allIt.levels.length);
    expect(platform.specs).toEqual(["Engineering"]);
  });

  it("тимлид Платформы — Engineering в срезе команды", () => {
    const vasya = DEMO_PERSONA_BY_ID.vasya;
    const slice = catalogSliceFromPositions(positions, vasya.defaultScope);
    expect(slice.specs).toEqual(["Engineering"]);
    expect(slice.levels.length).toBeGreaterThan(0);
  });
});
