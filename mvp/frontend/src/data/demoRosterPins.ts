import type { PositionRecord } from "../types";
import { DEMO_PERSONAS } from "./demoPersonas";
import {
  DEMO_DEPT_HR,
  DEMO_DEPT_IT,
  DEMO_TEAM_HR_DIRECT,
  DEMO_TEAM_IT_DIRECT,
  DEMO_UNIT_HR_DIRECT,
  DEMO_UNIT_IT_DIRECT,
} from "./demoOrg";
import { scopeEqValues } from "./personaAccessScope";
import type { UserRole } from "./userAccess";

type RosterPin = {
  role: UserRole;
  department: string;
  unit: string;
  /** null — первая свободная занятая позиция в юните (юнит-лид). */
  team: string | null;
  employeeName: string;
  employeeId: string;
  roleTitle: string;
};

const PIN_ROLE_ORDER: Record<UserRole, number> = {
  team_lead: 0,
  unit_lead: 1,
  director: 2,
  cb_admin: 9,
  gd: 9,
  viewer: 9,
};

const DIRECTOR_DIRECT_SLOT: Record<string, { unit: string; team: string }> = {
  [DEMO_DEPT_IT]: { unit: DEMO_UNIT_IT_DIRECT, team: DEMO_TEAM_IT_DIRECT },
  [DEMO_DEPT_HR]: { unit: DEMO_UNIT_HR_DIRECT, team: DEMO_TEAM_HR_DIRECT },
};

function pinsFromPersonas(): RosterPin[] {
  const pins: RosterPin[] = [];
  for (const persona of DEMO_PERSONAS) {
    if (!persona.selfEmployeeName || !persona.defaultScope) continue;
    if (persona.role !== "team_lead" && persona.role !== "unit_lead" && persona.role !== "director") {
      continue;
    }

    const department = scopeEqValues(persona.defaultScope, "department")[0];
    if (!department) continue;

    let unit = scopeEqValues(persona.defaultScope, "unit")[0];
    let team: string | null = scopeEqValues(persona.defaultScope, "team")[0] ?? null;

    if (persona.role === "director") {
      const direct = DIRECTOR_DIRECT_SLOT[department];
      if (!direct) continue;
      unit = direct.unit;
      team = direct.team;
    }

    if (!unit) continue;
    if (persona.role === "unit_lead") team = null;

    const roleTitle =
      persona.role === "team_lead"
        ? "Team Lead"
        : persona.role === "unit_lead"
          ? "Unit Lead"
          : "Director";

    pins.push({
      role: persona.role,
      department,
      unit,
      team,
      employeeName: persona.selfEmployeeName,
      employeeId: `PERSONA-${persona.id}`,
      roleTitle,
    });
  }

  return pins.sort((a, b) => PIN_ROLE_ORDER[a.role] - PIN_ROLE_ORDER[b.role]);
}

function findPinIndex(copy: PositionRecord[], pin: RosterPin, used: Set<number>): number {
  return copy.findIndex((position, index) => {
    if (used.has(index)) return false;
    if (position.department !== pin.department || position.unit !== pin.unit) return false;
    if (pin.team !== null && position.team !== pin.team) return false;
    return position.status === "Occupied";
  });
}

/** Закрепляет ФИО демо-персон за позициями (тимлид → юнит-лид → директор). */
export function pinDemoPersonasToRoster(positions: PositionRecord[]): PositionRecord[] {
  const copy = positions.map((position) => ({ ...position }));
  const pins = pinsFromPersonas();
  const used = new Set<number>();

  for (const pin of pins) {
    const index = findPinIndex(copy, pin, used);
    if (index < 0) continue;

    const position = copy[index];
    used.add(index);
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

/** Позиция юнит-лида в плане (для deep-link leadOnly). */
export function findUnitLeadPosition(
  positions: PositionRecord[],
  department: string,
  unit: string,
): PositionRecord | null {
  const pinned = pinDemoPersonasToRoster(positions);
  const leadName = DEMO_PERSONAS.find(
    (persona) =>
      persona.role === "unit_lead" &&
      persona.defaultScope &&
      scopeEqValues(persona.defaultScope, "department").includes(department) &&
      scopeEqValues(persona.defaultScope, "unit").includes(unit),
  )?.selfEmployeeName;

  if (!leadName) return null;

  return (
    pinned.find(
      (position) =>
        position.department === department &&
        position.unit === unit &&
        (position.employeeName === leadName || position.seedEmployeeName === leadName),
    ) ?? null
  );
}
