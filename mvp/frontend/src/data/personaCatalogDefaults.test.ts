import { describe, expect, it } from "vitest";
import { DEMO_PERSONA_BY_ID } from "./demoPersonas";
import {
  catalogSliceFromPositions,
  countCatalogBands,
  defaultCatalogVisibilityForPersona,
  multiSelectToCatalogField,
  seedPositionsForCatalogDefaults,
} from "./personaCatalogDefaults";
import { initialSalaryBands } from "./salaryRangeData";
import { scopeFromOrgMatrixRow } from "./personaAccessMatrix";

describe("personaCatalogDefaults", () => {
  const positions = seedPositionsForCatalogDefaults();
  const bands = initialSalaryBands();

  it("тимлид Платформы — только Engineering и уровни своей команды", () => {
    const vasya = DEMO_PERSONA_BY_ID.vasya;
    const rule = defaultCatalogVisibilityForPersona(vasya, positions);
    expect(rule.specs).toEqual(["Engineering"]);
    expect(rule.levels.length).toBeGreaterThan(0);
    expect(rule.access).toBe("read");
    expect(countCatalogBands(bands, rule)).toBeLessThan(countCatalogBands(bands, { specs: "*", levels: "*", access: "read" }));
  });

  it("C&B — весь справочник и write", () => {
    const cb = DEMO_PERSONA_BY_ID.cb;
    const rule = defaultCatalogVisibilityForPersona(cb, positions);
    expect(rule.specs).toBe("*");
    expect(rule.levels).toBe("*");
    expect(rule.access).toBe("write");
    expect(countCatalogBands(bands, rule)).toBe(bands.length);
  });

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

  it("multiSelectToCatalogField: полный выбор → *", () => {
    const options = ["Engineering", "Product", "Marketing"];
    expect(multiSelectToCatalogField(options, options)).toBe("*");
    expect(multiSelectToCatalogField(["Engineering"], options)).toEqual(["Engineering"]);
    expect(multiSelectToCatalogField([], options)).toEqual([]);
  });
});
