import type { UserRole } from "./userAccess";
import { buildAccessScope, scopeEqValues, formatPersonaLoginOption, type PersonaAccessScope } from "./personaAccessScope";
import { loadDemoPersonaId } from "./demoSessionStore";
import {
  DEMO_DEPT_HR,
  DEMO_DEPT_IT,
  DEMO_DEPT_SALES,
  DEMO_TEAM_HR_LND,
  DEMO_TEAM_HR_RECRUITING,
  DEMO_TEAM_MOBILE,
  DEMO_TEAM_PLATFORM,
  DEMO_TEAM_INFRA,
  DEMO_TEAM_QA,
  DEMO_TEAM_SALES_B2B,
  DEMO_TEAM_SALES_B2C,
  DEMO_TEAM_PROD1,
  DEMO_TEAM_PROD2,
  DEMO_TEAM_ANALYTICS,
  DEMO_TEAM_DESIGN,
  DEMO_TEAM_BACKEND,
  DEMO_TEAM_FRONTEND,
  DEMO_TEAM_DEVOPS,
  DEMO_TEAM_DATA,
  DEMO_UNIT_A,
  DEMO_UNIT_A_TEAMS,
  DEMO_UNIT_B,
  DEMO_UNIT_C,
  DEMO_UNIT_HR_OPS,
  DEMO_UNIT_SALES,
} from "./demoOrg";

export type DemoPersonaId =
  | "cb"
  | "dir_it"
  | "dir_hr"
  | "dir_sales"
  | "sidr"
  | "ul_b"
  | "ul_c"
  | "vasya"
  | "petya"
  | "tl_infra"
  | "tl_qa"
  | "tl_b_prod1"
  | "tl_b_prod2"
  | "tl_b_analytics"
  | "tl_b_design"
  | "tl_c_backend"
  | "tl_c_frontend"
  | "tl_c_devops"
  | "tl_c_data"
  | "tl_hr_rec"
  | "tl_hr_lnd"
  | "tl_sales_b2b"
  | "tl_sales_b2c";

export type DemoPersonaDefinition = {
  id: DemoPersonaId;
  displayName: string;
  loginAccount: string;
  role: UserRole;
  selfEmployeeName?: string;
  defaultScope?: PersonaAccessScope;
  /** Прямые подчинённые (тимлиды) для unit_lead. */
  directReportPersonaIds?: DemoPersonaId[];
};

/** Команды юнита А (для widen slice). */
export const DEMO_UNIT_A_TEAMS_LIST = [...DEMO_UNIT_A_TEAMS];

/** @deprecated Используйте DEMO_UNIT_A_TEAMS_LIST */
export const DEMO_UNIT_PRODUCTDEV_TEAMS = DEMO_UNIT_A_TEAMS_LIST;

export const DEMO_PERSONAS: DemoPersonaDefinition[] = [
  {
    id: "cb",
    displayName: "Ольга Андреева",
    loginAccount: "o.andreeva",
    role: "cb_admin",
  },
  {
    id: "dir_it",
    displayName: "Алексей Орлов",
    loginAccount: "a.orlov",
    role: "director",
    selfEmployeeName: "Алексей Орлов",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      excludeEmployeeNames: ["Алексей Орлов"],
    }),
  },
  {
    id: "dir_hr",
    displayName: "Елена Волкова",
    loginAccount: "e.volkova",
    role: "director",
    selfEmployeeName: "Елена Волкова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_HR,
      excludeEmployeeNames: ["Елена Волкова"],
    }),
  },
  {
    id: "dir_sales",
    displayName: "Марк Чен",
    loginAccount: "m.chen",
    role: "director",
    selfEmployeeName: "Марк Чен",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_SALES,
      excludeEmployeeNames: ["Марк Чен"],
    }),
  },
  {
    id: "sidr",
    displayName: "Сидор Морозов",
    loginAccount: "s.morozov",
    role: "unit_lead",
    selfEmployeeName: "Сидор Морозов",
    directReportPersonaIds: ["vasya", "petya", "tl_infra", "tl_qa"],
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      excludeEmployeeNames: ["Сидор Морозов"],
    }),
  },
  {
    id: "ul_b",
    displayName: "Дмитрий Кузнецов",
    loginAccount: "d.kuznetsov",
    role: "unit_lead",
    selfEmployeeName: "Дмитрий Кузнецов",
    directReportPersonaIds: ["tl_b_prod1", "tl_b_prod2", "tl_b_analytics", "tl_b_design"],
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_B,
      excludeEmployeeNames: ["Дмитрий Кузнецов"],
    }),
  },
  {
    id: "ul_c",
    displayName: "Анна Морозова",
    loginAccount: "a.morozova",
    role: "unit_lead",
    selfEmployeeName: "Анна Морозова",
    directReportPersonaIds: ["tl_c_backend", "tl_c_frontend", "tl_c_devops", "tl_c_data"],
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_C,
      excludeEmployeeNames: ["Анна Морозова"],
    }),
  },
  {
    id: "vasya",
    displayName: "Василий Андреев",
    loginAccount: "v.andreev",
    role: "team_lead",
    selfEmployeeName: "Василий Андреев",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_PLATFORM,
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
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_MOBILE,
      excludeEmployeeNames: ["Пётр Сидоров"],
    }),
  },
  {
    id: "tl_infra",
    displayName: "Николай Зайцев",
    loginAccount: "n.zaitsev",
    role: "team_lead",
    selfEmployeeName: "Николай Зайцев",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_INFRA,
      excludeEmployeeNames: ["Николай Зайцев"],
    }),
  },
  {
    id: "tl_qa",
    displayName: "Татьяна Белова",
    loginAccount: "t.belova",
    role: "team_lead",
    selfEmployeeName: "Татьяна Белова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_A,
      team: DEMO_TEAM_QA,
      excludeEmployeeNames: ["Татьяна Белова"],
    }),
  },
  {
    id: "tl_b_prod1",
    displayName: "Сергей Фёдоров",
    loginAccount: "s.fedorov",
    role: "team_lead",
    selfEmployeeName: "Сергей Фёдоров",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_B,
      team: DEMO_TEAM_PROD1,
      excludeEmployeeNames: ["Сергей Фёдоров"],
    }),
  },
  {
    id: "tl_b_prod2",
    displayName: "Мария Козлова",
    loginAccount: "m.kozlova",
    role: "team_lead",
    selfEmployeeName: "Мария Козлова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_B,
      team: DEMO_TEAM_PROD2,
      excludeEmployeeNames: ["Мария Козлова"],
    }),
  },
  {
    id: "tl_b_analytics",
    displayName: "Игорь Лебедев",
    loginAccount: "i.lebedev",
    role: "team_lead",
    selfEmployeeName: "Игорь Лебедев",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_B,
      team: DEMO_TEAM_ANALYTICS,
      excludeEmployeeNames: ["Игорь Лебедев"],
    }),
  },
  {
    id: "tl_b_design",
    displayName: "Анна Смирнова",
    loginAccount: "a.smirnova",
    role: "team_lead",
    selfEmployeeName: "Анна Смирнова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_B,
      team: DEMO_TEAM_DESIGN,
      excludeEmployeeNames: ["Анна Смирнова"],
    }),
  },
  {
    id: "tl_c_backend",
    displayName: "Андрей Волков",
    loginAccount: "a.volkov",
    role: "team_lead",
    selfEmployeeName: "Андрей Волков",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_C,
      team: DEMO_TEAM_BACKEND,
      excludeEmployeeNames: ["Андрей Волков"],
    }),
  },
  {
    id: "tl_c_frontend",
    displayName: "Елена Громова",
    loginAccount: "e.gromova",
    role: "team_lead",
    selfEmployeeName: "Елена Громова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_C,
      team: DEMO_TEAM_FRONTEND,
      excludeEmployeeNames: ["Елена Громова"],
    }),
  },
  {
    id: "tl_c_devops",
    displayName: "Константин Романов",
    loginAccount: "k.romanov",
    role: "team_lead",
    selfEmployeeName: "Константин Романов",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_C,
      team: DEMO_TEAM_DEVOPS,
      excludeEmployeeNames: ["Константин Романов"],
    }),
  },
  {
    id: "tl_c_data",
    displayName: "Дарья Михайлова",
    loginAccount: "d.mikhailova",
    role: "team_lead",
    selfEmployeeName: "Дарья Михайлова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_IT,
      unit: DEMO_UNIT_C,
      team: DEMO_TEAM_DATA,
      excludeEmployeeNames: ["Дарья Михайлова"],
    }),
  },
  {
    id: "tl_hr_rec",
    displayName: "Ольга Новикова",
    loginAccount: "o.novikova",
    role: "team_lead",
    selfEmployeeName: "Ольга Новикова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_HR,
      unit: DEMO_UNIT_HR_OPS,
      team: DEMO_TEAM_HR_RECRUITING,
      excludeEmployeeNames: ["Ольга Новикова"],
    }),
  },
  {
    id: "tl_hr_lnd",
    displayName: "Сергей Фёдоров",
    loginAccount: "s.fedorov",
    role: "team_lead",
    selfEmployeeName: "Сергей Фёдоров",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_HR,
      unit: DEMO_UNIT_HR_OPS,
      team: DEMO_TEAM_HR_LND,
      excludeEmployeeNames: ["Сергей Фёдоров"],
    }),
  },
  {
    id: "tl_sales_b2b",
    displayName: "Ирина Соколова",
    loginAccount: "i.sokolova",
    role: "team_lead",
    selfEmployeeName: "Ирина Соколова",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_SALES,
      unit: DEMO_UNIT_SALES,
      team: DEMO_TEAM_SALES_B2B,
      excludeEmployeeNames: ["Ирина Соколова"],
    }),
  },
  {
    id: "tl_sales_b2c",
    displayName: "Павел Фролов",
    loginAccount: "p.frolov",
    role: "team_lead",
    selfEmployeeName: "Павел Фролов",
    defaultScope: buildAccessScope({
      department: DEMO_DEPT_SALES,
      unit: DEMO_UNIT_SALES,
      team: DEMO_TEAM_SALES_B2C,
      excludeEmployeeNames: ["Павел Фролов"],
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

export function resolvePlanningTeamsForPersona(personaId: DemoPersonaId): string[] {
  const persona = DEMO_PERSONA_BY_ID[personaId];
  if (!persona.directReportPersonaIds?.length) return [];
  const teams = new Set<string>();
  for (const reportId of persona.directReportPersonaIds) {
    const report = DEMO_PERSONA_BY_ID[reportId];
    if (!report.defaultScope) continue;
    for (const team of scopeEqValues(report.defaultScope, "team")) {
      teams.add(team);
    }
  }
  return [...teams];
}

export function resolvePlanningTeamsForActivePersona(): string[] {
  const personaId = loadDemoPersonaId();
  if (!personaId) return [];
  return resolvePlanningTeamsForPersona(personaId);
}

/** Подпись роли на экране входа (с департаментом / командой). */
export function resolvePersonaLoginRoleLabel(persona: DemoPersonaDefinition): string {
  switch (persona.id) {
    case "cb":
      return "C&B";
    case "dir_it":
      return "Директор · Департамент ИТ";
    case "dir_hr":
      return "Директор · Департамент HR";
    case "dir_sales":
      return "Директор · Департамент Продаж";
    case "sidr":
      return "Юнит-лид · Юнит А";
    case "ul_b":
      return "Юнит-лид · Юнит Б";
    case "ul_c":
      return "Юнит-лид · Юнит С";
    case "vasya":
      return "Тимлид · Платформа";
    case "petya":
      return "Тимлид · Мобильная разработка";
    case "tl_infra":
      return "Тимлид · Инфраструктура";
    case "tl_qa":
      return "Тимлид · Качество";
    case "tl_b_prod1":
      return "Тимлид · Продукт 1";
    case "tl_b_prod2":
      return "Тимлид · Продукт 2";
    case "tl_b_analytics":
      return "Тимлид · Аналитика";
    case "tl_b_design":
      return "Тимлид · Дизайн";
    case "tl_c_backend":
      return "Тимлид · Backend";
    case "tl_c_frontend":
      return "Тимлид · Frontend";
    case "tl_c_devops":
      return "Тимлид · DevOps";
    case "tl_c_data":
      return "Тимлид · Data";
    case "tl_hr_rec":
      return "Тимлид · Рекрутинг";
    case "tl_hr_lnd":
      return "Тимлид · Обучение и развитие";
    case "tl_sales_b2b":
      return "Тимлид · Корпоративные продажи";
    case "tl_sales_b2c":
      return "Тимлид · Розница";
    default:
      return persona.role;
  }
}

/** ФИО юнит-лида (для контура директора). */
export function resolveUnitLeadDisplayForUnit(department: string, unit: string): string | null {
  return resolveUnitLeadPersona(department, unit)?.displayName ?? null;
}

function resolveUnitLeadPersona(
  department: string,
  unit: string,
): DemoPersonaDefinition | null {
  for (const persona of DEMO_PERSONAS) {
    if (persona.role !== "unit_lead" || !persona.defaultScope) continue;
    const depts = scopeEqValues(persona.defaultScope, "department");
    const units = scopeEqValues(persona.defaultScope, "unit");
    if (depts.includes(department) && units.includes(unit)) {
      return persona;
    }
  }
  return null;
}

/** Id персоны юнит-лида (для фильтра leadOnly в планировании). */
export function resolveUnitLeadPersonaId(department: string, unit: string): DemoPersonaId | null {
  return resolveUnitLeadPersona(department, unit)?.id ?? null;
}

/** ФИО тимлида команды (для таблицы юнит-лида). */
export function resolveTeamLeadDisplayForTeam(
  department: string,
  unit: string,
  team: string,
): string | null {
  for (const persona of DEMO_PERSONAS) {
    if (persona.role !== "team_lead" || !persona.defaultScope) continue;
    const depts = scopeEqValues(persona.defaultScope, "department");
    const units = scopeEqValues(persona.defaultScope, "unit");
    const teams = scopeEqValues(persona.defaultScope, "team");
    if (depts.includes(department) && units.includes(unit) && teams.includes(team)) {
      return persona.displayName;
    }
  }
  return null;
}

/** Группы для экрана входа: департамент → юнит → роль. */
export type LoginPersonaGroup = {
  label: string;
  options: { id: DemoPersonaId; optionLabel: string }[];
};

const LOGIN_PERSONA_GROUPS: { label: string; ids: DemoPersonaId[] }[] = [
  { label: "C&B", ids: ["cb"] },
  { label: "Департамент ИТ — руководство", ids: ["dir_it"] },
  { label: "Департамент ИТ — Юнит А", ids: ["sidr", "vasya", "petya", "tl_infra", "tl_qa"] },
  { label: "Департамент ИТ — Юнит Б", ids: ["ul_b", "tl_b_prod1", "tl_b_prod2", "tl_b_analytics", "tl_b_design"] },
  { label: "Департамент ИТ — Юнит С", ids: ["ul_c", "tl_c_backend", "tl_c_frontend", "tl_c_devops", "tl_c_data"] },
  { label: "Департамент HR", ids: ["dir_hr"] },
  { label: "Департамент HR — команды", ids: ["tl_hr_rec", "tl_hr_lnd"] },
  { label: "Департамент Продаж", ids: ["dir_sales"] },
  { label: "Департамент Продаж — команды", ids: ["tl_sales_b2b", "tl_sales_b2c"] },
];

export function listLoginPersonaGroups(): LoginPersonaGroup[] {
  return LOGIN_PERSONA_GROUPS.map((group) => ({
    label: group.label,
    options: group.ids.map((id) => {
      const persona = DEMO_PERSONA_BY_ID[id];
      const roleLabel = resolvePersonaLoginRoleLabel(persona);
      return {
        id,
        optionLabel: formatPersonaLoginOption(persona.displayName, roleLabel),
      };
    }),
  }));
}

export function migrateLegacyPersonaId(id: string | null): DemoPersonaId | null {
  if (id === "director") return "dir_it";
  return isDemoPersonaId(id) ? id : null;
}
