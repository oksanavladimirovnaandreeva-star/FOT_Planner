import {
  DEMO_PERSONA_BY_ID,
  DEMO_PERSONAS,
  isDemoPersonaId,
  type DemoPersonaDefinition,
  type DemoPersonaId,
} from "./demoPersonas";
import {
  normalizeAccessScope,
  parseStoredAccessScope,
  formatPersonaLoginOption,
  type PersonaAccessScope,
} from "./personaAccessScope";
import { saveUserRole, LOGIN_ROLE_LABELS, type UserRole } from "./userAccess";

const SESSION_PERSONA_KEY = "fot_mvp_demo_persona_id";
const PERSONA_SCOPES_KEY = "fot_mvp_demo_persona_scopes";

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
      const roleLabel = LOGIN_ROLE_LABELS[persona.role];
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
