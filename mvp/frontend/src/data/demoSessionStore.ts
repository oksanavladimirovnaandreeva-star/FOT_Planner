import {
  DEMO_PERSONA_BY_ID,
  DEMO_PERSONAS,
  isDemoPersonaId,
  listLoginPersonaGroups,
  resolvePersonaLoginRoleLabel,
  type DemoPersonaDefinition,
  type DemoPersonaId,
  type LoginPersonaGroup,
} from "./demoPersonas";
import {
  normalizeAccessScope,
  parseStoredAccessScope,
  formatPersonaLoginOption,
  scopeEqValues,
  scopePrimaryEq,
  type PersonaAccessScope,
} from "./personaAccessScope";
import { saveUserRole, type UserRole } from "./userAccess";
import type { SalaryCatalogAccess, CatalogVisibilityRule } from "../types";
import { defaultCatalogVisibilityForRole } from "./catalogVisibility";

const SESSION_PERSONA_KEY = "fot_mvp_demo_persona_id";
const PERSONA_SCOPES_KEY = "fot_mvp_demo_persona_scopes";
const PERSONA_CATALOG_ACCESS_KEY = "fot_mvp_demo_persona_catalog_access";
const PERSONA_CATALOG_VISIBILITY_KEY = "fot_mvp_demo_persona_catalog_visibility";

export type ResolvedDemoPersona = DemoPersonaDefinition & {
  scope: PersonaAccessScope | null;
};

function readScopeOverrides(): Partial<Record<DemoPersonaId, PersonaAccessScope>> {
  try {
    const raw = localStorage.getItem(PERSONA_SCOPES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<DemoPersonaId, unknown>>;
    const next: Partial<Record<DemoPersonaId, PersonaAccessScope>> = {};
    for (const [id, value] of Object.entries(parsed ?? {})) {
      if (!isDemoPersonaId(id)) continue;
      const scope = parseStoredAccessScope(value);
      if (scope) next[id] = scope;
    }
    return next;
  } catch {
    return {};
  }
}

export function readPersonaScopeOverrides(): Partial<Record<DemoPersonaId, PersonaAccessScope>> {
  return readScopeOverrides();
}

export function writePersonaScopeOverrides(overrides: Partial<Record<DemoPersonaId, PersonaAccessScope>>): void {
  const payload: Partial<Record<DemoPersonaId, PersonaAccessScope>> = {};
  for (const persona of DEMO_PERSONAS) {
    const scope = overrides[persona.id];
    if (scope) payload[persona.id] = normalizeAccessScope(scope);
  }
  localStorage.setItem(PERSONA_SCOPES_KEY, JSON.stringify(payload));
}

export function resolveDemoPersona(personaId: DemoPersonaId): ResolvedDemoPersona {
  const definition = DEMO_PERSONA_BY_ID[personaId];
  const overrides = readScopeOverrides();
  const scope = overrides[personaId] ?? definition.defaultScope ?? null;
  return {
    ...definition,
    scope: scope ? normalizeAccessScope(scope) : null,
  };
}

export function loadDemoPersonaId(): DemoPersonaId | null {
  try {
    const stored = localStorage.getItem(SESSION_PERSONA_KEY);
    if (stored === "director") {
      localStorage.setItem(SESSION_PERSONA_KEY, "dir_it");
      return "dir_it";
    }
    return isDemoPersonaId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function loadResolvedDemoPersona(): ResolvedDemoPersona | null {
  const id = loadDemoPersonaId();
  if (!id) return null;
  return resolveDemoPersona(id);
}

/** Орг-срез активной персоны (приоритет над пресетами ролей в Настройках). */
export function resolveActivePersonaOrgScope(): {
  department: string;
  unit: string | null;
  team: string | null;
  departments: string[];
  units: string[];
  teams: string[];
} | null {
  const persona = loadResolvedDemoPersona();
  if (!persona?.scope) return null;
  return {
    department: scopePrimaryEq(persona.scope, "department") ?? "",
    unit: scopePrimaryEq(persona.scope, "unit") ?? null,
    team: scopePrimaryEq(persona.scope, "team") ?? null,
    departments: scopeEqValues(persona.scope, "department"),
    units: scopeEqValues(persona.scope, "unit"),
    teams: scopeEqValues(persona.scope, "team"),
  };
}

export function hasDemoSession(): boolean {
  return loadDemoPersonaId() !== null;
}

export function saveDemoPersonaId(personaId: DemoPersonaId): void {
  localStorage.setItem(SESSION_PERSONA_KEY, personaId);
}

export function clearDemoSession(): void {
  localStorage.removeItem(SESSION_PERSONA_KEY);
}

/** Вход под выбранной персоной: роль + срез для RBAC. */
export function loginAsDemoPersona(personaId: DemoPersonaId): ResolvedDemoPersona {
  const persona = resolveDemoPersona(personaId);
  saveDemoPersonaId(personaId);
  saveUserRole(persona.role);
  return persona;
}

export function activePersonaScopeForRole(role: UserRole): PersonaAccessScope | null {
  const persona = loadResolvedDemoPersona();
  if (!persona || persona.role !== role) return null;
  return persona.scope;
}

export function defaultPersonaScopesForSettings(): Record<DemoPersonaId, PersonaAccessScope | null> {
  const overrides = readScopeOverrides();
  const result = {} as Record<DemoPersonaId, PersonaAccessScope | null>;
  for (const persona of DEMO_PERSONAS) {
    const scope = overrides[persona.id] ?? persona.defaultScope ?? null;
    result[persona.id] = scope ? normalizeAccessScope(scope) : null;
  }
  return result;
}

function defaultCatalogAccessForPersona(role: UserRole): SalaryCatalogAccess {
  return role === "cb_admin" ? "write" : "read";
}

function readCatalogAccessOverrides(): Partial<Record<DemoPersonaId, SalaryCatalogAccess>> {
  try {
    const raw = localStorage.getItem(PERSONA_CATALOG_ACCESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<DemoPersonaId, unknown>>;
    const next: Partial<Record<DemoPersonaId, SalaryCatalogAccess>> = {};
    for (const [id, value] of Object.entries(parsed ?? {})) {
      if (!isDemoPersonaId(id)) continue;
      if (value === "read" || value === "write") next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function readPersonaCatalogAccessOverrides(): Partial<Record<DemoPersonaId, SalaryCatalogAccess>> {
  return readCatalogAccessOverrides();
}

export function writePersonaCatalogAccessOverrides(
  overrides: Partial<Record<DemoPersonaId, SalaryCatalogAccess>>,
): void {
  const payload: Partial<Record<DemoPersonaId, SalaryCatalogAccess>> = {};
  for (const persona of DEMO_PERSONAS) {
    const access = overrides[persona.id];
    if (access === "read" || access === "write") payload[persona.id] = access;
  }
  localStorage.setItem(PERSONA_CATALOG_ACCESS_KEY, JSON.stringify(payload));
}

export function resolvePersonaCatalogAccess(personaId: DemoPersonaId): SalaryCatalogAccess {
  const overrides = readCatalogAccessOverrides();
  if (overrides[personaId]) return overrides[personaId]!;
  return defaultCatalogAccessForPersona(DEMO_PERSONA_BY_ID[personaId].role);
}

export function loadResolvedCatalogAccess(): SalaryCatalogAccess {
  const persona = loadResolvedDemoPersona();
  if (!persona) return "read";
  return resolvePersonaCatalogAccess(persona.id);
}

export function defaultPersonaCatalogAccessForSettings(): Record<DemoPersonaId, SalaryCatalogAccess> {
  const overrides = readCatalogAccessOverrides();
  const result = {} as Record<DemoPersonaId, SalaryCatalogAccess>;
  for (const persona of DEMO_PERSONAS) {
    const visibility = resolvePersonaCatalogVisibility(persona.id);
    result[persona.id] =
      overrides[persona.id] ??
      (visibility.access === "none" ? "read" : visibility.access);
  }
  return result;
}

function readCatalogVisibilityOverrides(): Partial<Record<DemoPersonaId, CatalogVisibilityRule>> {
  try {
    const raw = localStorage.getItem(PERSONA_CATALOG_VISIBILITY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<DemoPersonaId, CatalogVisibilityRule>>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function readPersonaCatalogVisibilityOverrides(): Partial<Record<DemoPersonaId, CatalogVisibilityRule>> {
  return readCatalogVisibilityOverrides();
}

export function writePersonaCatalogVisibilityOverrides(
  overrides: Partial<Record<DemoPersonaId, CatalogVisibilityRule>>,
): void {
  localStorage.setItem(PERSONA_CATALOG_VISIBILITY_KEY, JSON.stringify(overrides));
}

export function resolvePersonaCatalogVisibility(personaId: DemoPersonaId): CatalogVisibilityRule {
  const overrides = readCatalogVisibilityOverrides();
  if (overrides[personaId]) return overrides[personaId]!;
  const legacy = readCatalogAccessOverrides()[personaId];
  const base = defaultCatalogVisibilityForRole(DEMO_PERSONA_BY_ID[personaId].role);
  if (legacy) return { ...base, access: legacy };
  return base;
}

export function loadResolvedCatalogVisibility(): CatalogVisibilityRule {
  const persona = loadResolvedDemoPersona();
  if (!persona) return defaultCatalogVisibilityForRole("viewer");
  return resolvePersonaCatalogVisibility(persona.id);
}

export function defaultPersonaCatalogVisibilityForSettings(): Record<DemoPersonaId, CatalogVisibilityRule> {
  const overrides = readCatalogVisibilityOverrides();
  const result = {} as Record<DemoPersonaId, CatalogVisibilityRule>;
  for (const persona of DEMO_PERSONAS) {
    result[persona.id] = overrides[persona.id] ?? resolvePersonaCatalogVisibility(persona.id);
  }
  return result;
}

/** Список для экрана входа: ФИО + роль, сортировка по ФИО. */
export function listLoginPersonaOptions(): {
  id: DemoPersonaId;
  displayName: string;
  roleLabel: string;
  loginAccount: string;
  optionLabel: string;
}[] {
  return [...DEMO_PERSONAS]
    .map((persona) => {
      const roleLabel = resolvePersonaLoginRoleLabel(persona);
      return {
        id: persona.id,
        displayName: persona.displayName,
        roleLabel,
        loginAccount: persona.loginAccount,
        optionLabel: formatPersonaLoginOption(persona.displayName, roleLabel),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));
}

export { listLoginPersonaGroups, type LoginPersonaGroup };
