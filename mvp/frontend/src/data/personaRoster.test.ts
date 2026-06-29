import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { pinDemoPersonasToRoster } from "./demoRosterPins";
import {
  findPersonaPosition,
  matchesLeadOnlyFilter,
  parseLeadOnlyMode,
  positionMatchesPersona,
  resolveUnitLeadPersonaId,
} from "./personaRoster";
import { DEMO_DEPT_IT, DEMO_UNIT_A } from "./demoOrg";

describe("personaRoster", () => {
  const positions = pinDemoPersonasToRoster(initialPositions().map(applyEvents));

  it("parseLeadOnlyMode понимает legacy и новые значения", () => {
    expect(parseLeadOnlyMode(null)).toBeNull();
    expect(parseLeadOnlyMode("1")).toBe("team_lead");
    expect(parseLeadOnlyMode("unit_lead")).toBe("unit_lead");
  });

  it("находит позицию Сидора и фильтрует leadOnly=unit_lead", () => {
    const sidrId = resolveUnitLeadPersonaId(DEMO_DEPT_IT, DEMO_UNIT_A);
    expect(sidrId).toBe("sidr");

    const sidorPosition = findPersonaPosition(positions, "sidr");
    expect(sidorPosition).toBeTruthy();
    expect(positionMatchesPersona(sidorPosition!, "sidr")).toBe(true);

    const unitSlice = positions.filter(
      (position) =>
        position.department === DEMO_DEPT_IT &&
        position.unit === DEMO_UNIT_A &&
        matchesLeadOnlyFilter(position, "unit_lead"),
    );
    expect(unitSlice).toHaveLength(1);
    expect(unitSlice[0]?.employeeName).toBe("Сидор Морозов");
  });
});
