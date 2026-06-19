import {
  DEMO_PERSONAS,
  resolvePersonaLoginRoleLabel,
  type DemoPersonaId,
} from "./demoPersonas";
import { scopeEqValues } from "./personaAccessScope";
import type { OrgTree } from "./orgStructureStore";

export type LoginPersonaLeaf = {
  id: DemoPersonaId;
  displayName: string;
  roleLabel: string;
};

export type LoginOrgTeamNode = {
  id: string;
  team: string;
  personas: LoginPersonaLeaf[];
};

export type LoginOrgUnitNode = {
  id: string;
  unit: string;
  unitLeads: LoginPersonaLeaf[];
  teams: LoginOrgTeamNode[];
};

export type LoginOrgDepartmentNode = {
  id: string;
  department: string;
  directors: LoginPersonaLeaf[];
  units: LoginOrgUnitNode[];
};

export type LoginOrgTree = {
  cbPersonas: LoginPersonaLeaf[];
  departments: LoginOrgDepartmentNode[];
};

function orgKey(parts: string[]): string {
  return parts.join("\0");
}

function personaLeaf(persona: (typeof DEMO_PERSONAS)[number]): LoginPersonaLeaf {
  return {
    id: persona.id,
    displayName: persona.displayName,
    roleLabel: resolvePersonaLoginRoleLabel(persona),
  };
}

function pushPersona(map: Map<string, LoginPersonaLeaf[]>, key: string, leaf: LoginPersonaLeaf): void {
  const list = map.get(key) ?? [];
  list.push(leaf);
  map.set(key, list);
}

function sortPersonas(list: LoginPersonaLeaf[]): LoginPersonaLeaf[] {
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));
}

/** Дерево входа: департамент → юнит → команда → персоны демо. */
export function buildLoginOrgTree(orgTree: OrgTree): LoginOrgTree {
  const cbPersonas: LoginPersonaLeaf[] = [];
  const directorsByDept = new Map<string, LoginPersonaLeaf[]>();
  const unitLeadsByKey = new Map<string, LoginPersonaLeaf[]>();
  const teamLeadsByKey = new Map<string, LoginPersonaLeaf[]>();

  for (const persona of DEMO_PERSONAS) {
    if (persona.role === "cb_admin") {
      cbPersonas.push(personaLeaf(persona));
      continue;
    }
    if (!persona.defaultScope) continue;

    const department = scopeEqValues(persona.defaultScope, "department")[0] ?? null;
    const unit = scopeEqValues(persona.defaultScope, "unit")[0] ?? null;
    const team = scopeEqValues(persona.defaultScope, "team")[0] ?? null;
    const leaf = personaLeaf(persona);

    if (persona.role === "director" && department) {
      pushPersona(directorsByDept, department, leaf);
    } else if (persona.role === "unit_lead" && department && unit) {
      pushPersona(unitLeadsByKey, orgKey([department, unit]), leaf);
    } else if (persona.role === "team_lead" && department && unit && team) {
      pushPersona(teamLeadsByKey, orgKey([department, unit, team]), leaf);
    }
  }

  const departments: LoginOrgDepartmentNode[] = Object.keys(orgTree)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((department) => {
      const units = orgTree[department] ?? {};
      const unitNodes: LoginOrgUnitNode[] = Object.keys(units)
        .sort((a, b) => a.localeCompare(b, "ru"))
        .map((unit) => {
          const teams = units[unit] ?? [];
          const teamNodes: LoginOrgTeamNode[] = teams
            .map((team) => ({
              id: orgKey([department, unit, team]),
              team,
              personas: sortPersonas(teamLeadsByKey.get(orgKey([department, unit, team])) ?? []),
            }))
            .filter((node) => node.personas.length > 0);

          const unitLeads = sortPersonas(unitLeadsByKey.get(orgKey([department, unit])) ?? []);
          if (unitLeads.length === 0 && teamNodes.length === 0) return null;

          return {
            id: orgKey([department, unit]),
            unit,
            unitLeads,
            teams: teamNodes,
          };
        })
        .filter((node): node is LoginOrgUnitNode => node !== null);

      const directors = sortPersonas(directorsByDept.get(department) ?? []);
      if (directors.length === 0 && unitNodes.length === 0) return null;

      return {
        id: department,
        department,
        directors,
        units: unitNodes,
      };
    })
    .filter((node): node is LoginOrgDepartmentNode => node !== null);

  return {
    cbPersonas: sortPersonas(cbPersonas),
    departments,
  };
}

/** Путь в дереве для автраскрытия при выборе персоны. */
export function loginPathForPersona(
  tree: LoginOrgTree,
  personaId: DemoPersonaId,
): { departmentId?: string; unitId?: string; teamId?: string } {
  if (tree.cbPersonas.some((persona) => persona.id === personaId)) {
    return {};
  }

  for (const department of tree.departments) {
    if (department.directors.some((persona) => persona.id === personaId)) {
      return { departmentId: department.id };
    }
    for (const unit of department.units) {
      if (unit.unitLeads.some((persona) => persona.id === personaId)) {
        return { departmentId: department.id, unitId: unit.id };
      }
      for (const team of unit.teams) {
        if (team.personas.some((persona) => persona.id === personaId)) {
          return { departmentId: department.id, unitId: unit.id, teamId: team.id };
        }
      }
    }
  }
  return {};
}
