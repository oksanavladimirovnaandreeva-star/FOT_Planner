import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { pinDemoPersonasToRoster } from "./demoRosterPins";
import { DEMO_DEPT_IT, DEMO_TEAM_PLATFORM, DEMO_UNIT_A } from "./demoOrg";

describe("pinDemoPersonasToRoster", () => {
  it("не перезаписывает юнит-лида тимлидом команды", () => {
    const pinned = pinDemoPersonasToRoster(initialPositions().map(applyEvents));

    const platformLead = pinned.find(
      (position) =>
        position.department === DEMO_DEPT_IT &&
        position.unit === DEMO_UNIT_A &&
        position.team === DEMO_TEAM_PLATFORM &&
        position.employeeId === "PERSONA-vasya",
    );
    expect(platformLead?.employeeName).toBe("Василий Андреев");

    const unitLead = pinned.find(
      (position) =>
        position.department === DEMO_DEPT_IT &&
        position.unit === DEMO_UNIT_A &&
        position.employeeId === "PERSONA-sidr",
    );
    expect(unitLead).toBeTruthy();
    expect(unitLead?.employeeName).toBe("Сидор Морозов");
    expect(unitLead?.positionId).not.toBe(platformLead?.positionId);
  });

  it("закрепляет директора ИТ за дирекцией", () => {
    const pinned = pinDemoPersonasToRoster(initialPositions().map(applyEvents));
    const director = pinned.find((position) => position.employeeId === "PERSONA-dir_it");
    expect(director?.employeeName).toBe("Алексей Орлов");
  });
});
