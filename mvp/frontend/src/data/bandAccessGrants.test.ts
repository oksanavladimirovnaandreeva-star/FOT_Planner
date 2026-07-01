import { describe, expect, it } from "vitest";
import { DEMO_PERSONA_BY_ID } from "./demoPersonas";
import {
  buildDefaultBandAccessGrants,
  canViewBand,
  viewersForBandFromPositions,
} from "./bandAccessGrants";
import { seedPositionsForCatalogDefaults } from "./personaCatalogDefaults";
import { bandKey, initialSalaryBands } from "./salaryRangeData";

describe("bandAccessGrants", () => {
  const positions = seedPositionsForCatalogDefaults();
  const bands = initialSalaryBands();
  const scopeForPersona = (id: keyof typeof DEMO_PERSONA_BY_ID) =>
    DEMO_PERSONA_BY_ID[id].defaultScope ?? null;

  it("тимлид Платформы: Lead по Engineering скрыт, Lead по Marketing виден (демо-акцент)", () => {
    const grants = buildDefaultBandAccessGrants(bands, positions, scopeForPersona);
    const engLead = bands.find((b) => b.specialization === "Engineering" && b.level === "Lead")!;
    const mktLead = bands.find((b) => b.specialization === "Marketing" && b.level === "Lead")!;

    expect(canViewBand(engLead, "vasya", "team_lead", grants)).toBe(false);
    expect(canViewBand(mktLead, "vasya", "team_lead", grants)).toBe(true);
    expect(canViewBand(engLead, "sidr", "unit_lead", grants)).toBe(true);
  });

  it("C&B видит все строки без записи в grants", () => {
    const grants = buildDefaultBandAccessGrants(bands, positions, scopeForPersona);
    for (const band of bands) {
      expect(canViewBand(band, "cb", "cb_admin", grants)).toBe(true);
    }
  });

  it("viewersForBandFromPositions — только точное совпадение spec×level в срезе", () => {
    const engMiddle = bands.find((b) => b.specialization === "Engineering" && b.level === "Middle")!;
    const viewers = viewersForBandFromPositions(engMiddle, positions, scopeForPersona);
    expect(viewers).toContain("vasya");
    expect(viewers).toContain("sidr");
    expect(viewers).not.toContain("cb");
  });

  it("grants покрывают все строки каталога", () => {
    const grants = buildDefaultBandAccessGrants(bands, positions, scopeForPersona);
    for (const band of bands) {
      const key = bandKey(band.specialization, band.level);
      expect(Array.isArray(grants[key])).toBe(true);
    }
  });
});
