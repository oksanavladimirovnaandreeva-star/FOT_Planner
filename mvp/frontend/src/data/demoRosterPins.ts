import type { PositionRecord } from "../types";
import { DEMO_PERSONAS } from "./demoPersonas";
import { scopeEqValues } from "./personaAccessScope";

type RosterPin = {
  department: string;
  unit: string;
  team: string;
  employeeName: string;
  employeeId: string;
  roleTitle: string;
};

function pinsFromPersonas(positions: PositionRecord[]): RosterPin[] {
  const pins: RosterPin[] = [];
  for (const persona of DEMO_PERSONAS) {
    if (!persona.selfEmployeeName || !persona.defaultScope) continue;
    const department = scopeEqValues(persona.defaultScope, "department")[0];
    const unit = scopeEqValues(persona.defaultScope, "unit")[0];
    let team: string | undefined = scopeEqValues(persona.defaultScope, "team")[0];
    if (!department || !unit) continue;

    if (!team && persona.role === "unit_lead") {
      const slot = positions.find(
        (position) =>
          position.department === department &&
          position.unit === unit &&
          position.status === "Occupied",
      );
      team = slot?.team ?? undefined;
    }

    if (!team) continue;
    const roleTitle =
      persona.role === "team_lead"
        ? "Team Lead"
        : persona.role === "unit_lead"
          ? "Unit Lead"
          : persona.role === "director"
            ? "Director"
            : "Staff";
    pins.push({
      department,
      unit,
      team,
      employeeName: persona.selfEmployeeName,
      employeeId: `PERSONA-${persona.id}`,
      roleTitle,
    });
  }
  return pins;
}

/** Закрепляет ФИО демо-персон за первой занятой позицией команды (тимлид / лид / директор). */
export function pinDemoPersonasToRoster(positions: PositionRecord[]): PositionRecord[] {
  const copy = positions.map((position) => ({ ...position }));
  const pins = pinsFromPersonas(copy);

  for (const pin of pins) {
    const index = copy.findIndex(
      (position) =>
        position.department === pin.department &&
        position.unit === pin.unit &&
        position.team === pin.team &&
        position.status === "Occupied",
    );
    if (index < 0) continue;

    const position = copy[index];
    copy[index] = {
      ...position,
      role: pin.roleTitle,
      employeeName: pin.employeeName,
      employeeId: pin.employeeId,
      seedEmployeeName: pin.employeeName,
      seedEmployeeId: pin.employeeId,
    };
  }

  return copy;
}
