import type { UserRole } from "./userAccess";
import { buildAccessScope, type PersonaAccessScope } from "./personaAccessScope";

export type DemoPersonaId = "cb" | "director" | "sidr" | "vasya" | "petya";

export type DemoPersonaDefinition = {
  id: DemoPersonaId;
  /** ФИО на экране входа (или служебное имя для C&B). */
  displayName: string;
  /** Демо-логин; в проде — SSO / email, к нему привязаны доступы. */
  loginAccount: string;
  role: UserRole;
  /** ФИО в штатке — по умолчанию исключается из среза (не равно). */
  selfEmployeeName?: string;
  defaultScope?: PersonaAccessScope;
};

export const DEMO_PERSONAS: DemoPersonaDefinition[] = [
  {
    id: "cb",
    displayName: "Ольга Андреева",
    loginAccount: "o.andreeva",
    role: "cb_admin",
  },
  {
    id: "director",
    displayName: "Алексей Орлов",
    loginAccount: "a.orlov",
    role: "director",
    selfEmployeeName: "Алексей Орлов",
    defaultScope: buildAccessScope({
      department: "Engineering",
      excludeEmployeeNames: ["Алексей Орлов"],
    }),
  },
  {
    id: "sidr",
    displayName: "Сидор Морозов",
    loginAccount: "s.morozov",
    role: "unit_lead",
    selfEmployeeName: "Сидор Морозов",
    defaultScope: buildAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      excludeEmployeeNames: ["Сидор Морозов"],
    }),
  },
  {
    id: "vasya",
    displayName: "Василий Андреев",
    loginAccount: "v.andreev",
    role: "team_lead",
    selfEmployeeName: "Василий Андреев",
    defaultScope: buildAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
      excludeEmployeeNames: ["Василий Андреев"],
    }),
  },
  {
    id: "petya",
    displayName: "Пётр Сидоров",
    loginAccount: "p.sidorov",
    role: "team_lead",
    selfEmployeeName: "Пётр Сидоров",
    defaultScope: buildAccessScope({
      department: "Engineering",
      unit: "ProductDev",
      team: "Mobile",
      excludeEmployeeNames: ["Пётр Сидоров"],
    }),
  },
];

export const DEMO_PERSONA_BY_ID: Record<DemoPersonaId, DemoPersonaDefinition> = Object.fromEntries(
  DEMO_PERSONAS.map((persona) => [persona.id, persona]),
) as Record<DemoPersonaId, DemoPersonaDefinition>;

const PERSONA_IDS = new Set<string>(DEMO_PERSONAS.map((persona) => persona.id));

export function isDemoPersonaId(value: string | null | undefined): value is DemoPersonaId {
  return typeof value === "string" && PERSONA_IDS.has(value);
}

export function personaNeedsScope(persona: DemoPersonaDefinition): persona is DemoPersonaDefinition & {
  defaultScope: PersonaAccessScope;
} {
  return persona.role === "director" || persona.role === "unit_lead" || persona.role === "team_lead";
}
