import type { PositionRecord } from "../types";
import { DEMO_PERSONAS, DEMO_PERSONA_BY_ID, type DemoPersonaId } from "./demoPersonas";
import { scopeEqValues } from "./personaAccessScope";

/** Режим среза «только позиция лида» на /planning. */
export type LeadOnlyMode = "team_lead" | "unit_lead" | "director";

export function personaEmployeeId(personaId: DemoPersonaId): string {
  return `PERSONA-${personaId}`;
}

export function positionEmployeeLabel(position: PositionRecord): string {
  return position.employeeName?.trim() || position.seedEmployeeName?.trim() || "";
}

export function positionMatchesPersona(
  position: PositionRecord,
  personaId: DemoPersonaId,
): boolean {
  if (position.employeeId === personaEmployeeId(personaId)) return true;
  const persona = DEMO_PERSONA_BY_ID[personaId];
  const expectedName = persona?.selfEmployeeName ?? persona?.displayName;
  return Boolean(expectedName && positionEmployeeLabel(position) === expectedName);
}

export function resolveTeamLeadPersonaId(
  department: string,
  unit: string,
  team: string,
): DemoPersonaId | null {
  for (const persona of DEMO_PERSONAS) {
    if (persona.role !== "team_lead" || !persona.defaultScope) continue;
    const depts = scopeEqValues(persona.defaultScope, "department");
    const units = scopeEqValues(persona.defaultScope, "unit");
    const teams = scopeEqValues(persona.defaultScope, "team");
    if (depts.includes(department) && units.includes(unit) && teams.includes(team)) {
      return persona.id;
    }
  }
  return null;
}

export function resolveUnitLeadPersonaId(department: string, unit: string): DemoPersonaId | null {
  for (const persona of DEMO_PERSONAS) {
    if (persona.role !== "unit_lead" || !persona.defaultScope) continue;
    const depts = scopeEqValues(persona.defaultScope, "department");
    const units = scopeEqValues(persona.defaultScope, "unit");
    if (depts.includes(department) && units.includes(unit)) {
      return persona.id;
    }
  }
  return null;
}

export function resolveDirectorPersonaId(department: string): DemoPersonaId | null {
  for (const persona of DEMO_PERSONAS) {
    if (persona.role !== "director" || !persona.defaultScope) continue;
    const depts = scopeEqValues(persona.defaultScope, "department");
    if (depts.includes(department)) {
      return persona.id;
    }
  }
  return null;
}

export function parseLeadOnlyMode(raw: string | null): LeadOnlyMode | null {
  if (!raw) return null;
  if (raw === "1" || raw === "team_lead") return "team_lead";
  if (raw === "unit_lead") return "unit_lead";
  if (raw === "director") return "director";
  return null;
}

export function matchesLeadOnlyFilter(
  position: PositionRecord,
  mode: LeadOnlyMode | null,
): boolean {
  if (!mode) return true;

  if (mode === "team_lead") {
    const personaId = resolveTeamLeadPersonaId(position.department, position.unit, position.team);
    return personaId ? positionMatchesPersona(position, personaId) : false;
  }

  if (mode === "unit_lead") {
    const personaId = resolveUnitLeadPersonaId(position.department, position.unit);
    return personaId ? positionMatchesPersona(position, personaId) : false;
  }

  const personaId = resolveDirectorPersonaId(position.department);
  return personaId ? positionMatchesPersona(position, personaId) : false;
}

export function findPersonaPosition(
  positions: PositionRecord[],
  personaId: DemoPersonaId,
): PositionRecord | null {
  return positions.find((position) => positionMatchesPersona(position, personaId)) ?? null;
}
