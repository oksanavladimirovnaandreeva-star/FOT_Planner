import type { LimitFlagKey, PlannedEvent, PositionRecord } from "../types";
import { ORG_STRUCTURE } from "./orgStructure";

/** Версия демо-набора: при смене — авто-обновление seed в localStorage. */
export const DEMO_SEED_VERSION = 12;

export const DEMO_SEED_VERSION_KEY = "fot_mvp_demo_seed_version";

/** Обычный демо-план при старте и «Демо-план» в настройках. */
export const DEFAULT_DEMO_POSITION_COUNT = 90;

/** Целевой объём для пилотного стресс-теста (кнопка «Пилот (тяжёлый)»). */
export const PILOT_POSITION_TARGET = 520;

const twelve = <T,>(value: T): T[] => Array.from({ length: 12 }, () => value);

const EMPLOYEE_NAMES = [
  "Ирина Соколова",
  "Алексей Орлов",
  "Марк Чен",
  "Елена Волкова",
  "Дмитрий Кузнецов",
  "Анна Морозова",
  "Пётр Лебедев",
  "Ольга Новикова",
  "Сергей Фёдоров",
  "Мария Козлова",
  "Иван Петров",
  "Наталья Смирнова",
  "Артём Васильев",
  "Екатерина Попова",
  "Михаил Соколов",
  "Юлия Медведева",
  "Андрей Ковалёв",
  "Татьяна Белова",
  "Николай Зайцев",
  "Виктория Соловьёва",
  "Глеб Романов",
  "Алина Егорова",
  "Кирилл Павлов",
  "Дарья Семёнова",
  "Максим Голубев",
  "Светлана Виноградова",
  "Роман Богданов",
  "Ксения Воробьёва",
  "Павел Фролов",
  "Людмила Макарова",
  "Олег Никитин",
  "Вера Захарова",
  "Станислав Баранов",
  "Инна Киселёва",
  "Тимур Абрамов",
  "Полина Орлова",
  "Денис Андреев",
  "Анастасия Мельникова",
  "Владислав Титов",
  "Кристина Маркова",
  "Ярослав Гусев",
  "Валерия Калинина",
  "Георгий Михайлов",
  "Алёна Рыбакова",
  "Борис Комаров",
  "Жанна Осипова",
  "Эдуард Степанов",
  "Лариса Данилова",
  "Фёдор Жуков",
  "Вероника Савельева",
  "Игорь Крылов",
  "Надежда Рогова",
  "Аркадий Тихонов",
  "Зоя Куликова",
  "Лев Назаров",
  "Регина Дементьева",
  "Семён Ефимов",
  "Ульяна Громова",
  "Яна Фомина",
  "Эмилия Давыдова",
  "Матвей Мельников",
  "Агата Антонова",
  "Руслан Тарасов",
  "Милана Жданова",
  "Платон Исаев",
  "Алиса Кудрявцева",
  "Тихон Лазарев",
  "Ева Медведева",
  "Савелий Беляев",
  "Амина Григорьева",
];

const SPEC_BY_DEPARTMENT: Record<string, string> = {
  "Департамент ИТ": "Engineering",
  "Департамент HR": "Product",
  "Департамент Продаж": "Marketing",
};

const ROLE_TITLES: Record<string, string[]> = {
  "Департамент ИТ": ["Engineer", "Senior Engineer", "Tech Lead", "Staff Engineer"],
  "Департамент HR": ["HR Business Partner", "Recruiter", "L&D Specialist", "HR Operations"],
  "Департамент Продаж": ["Account Manager", "Sales Lead", "BDR", "Key Account Manager"],
  Engineering: ["Engineer", "Senior Engineer", "Tech Lead", "Staff Engineer"],
  Product: ["Product Manager", "Senior PM", "Analyst", "Product Owner"],
  Marketing: ["Marketing Manager", "Content Lead", "Growth Manager", "Brand Manager"],
  Sales: ["Account Manager", "Sales Lead", "BDR", "Key Account Manager"],
  HR: ["HR Business Partner", "Recruiter", "L&D Specialist", "HR Operations"],
};

const LEVELS = ["Middle", "Senior", "Lead"] as const;

export type DecemberRosterRow = {
  positionId: string;
  role: string;
  employeeId: string | null;
  employeeName: string | null;
  status: PositionRecord["status"];
  decemberBase: number;
  department: string;
  unit: string;
  team: string;
};

type TeamRef = { department: string; unit: string; team: string };

function listTeams(): TeamRef[] {
  const teams: TeamRef[] = [];
  for (const [department, units] of Object.entries(ORG_STRUCTURE)) {
    for (const [unit, teamList] of Object.entries(units)) {
      for (const team of teamList) {
        teams.push({ department, unit, team });
      }
    }
  }
  return teams;
}

function specForDepartment(department: string): string {
  return SPEC_BY_DEPARTMENT[department] ?? "Engineering";
}

function roleTitle(department: string, index: number): string {
  const titles = ROLE_TITLES[department] ?? ROLE_TITLES.Engineering;
  return titles[index % titles.length];
}

function monthlyBaseFor(level: string): number {
  switch (level) {
    case "Lead":
      return 260_000;
    case "Senior":
      return 210_000;
    default:
      return 165_000;
  }
}

function buildPosition(input: {
  positionId: string;
  employeeId: string | null;
  employeeName: string | null;
  role: string;
  department: string;
  unit: string;
  team: string;
  status: PositionRecord["status"];
  slotType: PositionRecord["slotType"];
  limitFlag: LimitFlagKey;
  level: string;
  previousDecemberBase: number;
  base: number;
  events?: PlannedEvent[];
}): PositionRecord {
  const spec = specForDepartment(input.department);
  const isVacancy = input.status === "Vacancy";
  const carryoverEvents: PlannedEvent[] =
    input.slotType === "carryover"
      ? [
          {
            id: `seed-carryover-${input.positionId.toLowerCase()}`,
            type: "POSITION_CARRYOVER",
            createdAt: "2025-12-31T12:00:00.000Z",
            createdOrder: 1,
            payload: { month: 0 },
          },
        ]
      : [];
  return {
    positionId: input.positionId,
    role: input.role,
    department: input.department,
    unit: input.unit,
    team: input.team,
    slotType: input.slotType,
    limitFlag: input.limitFlag,
    activeFromMonth: 0,
    vacancySinceMonth: isVacancy ? 0 : null,
    previousDecemberBase: input.previousDecemberBase,
    employeeName: input.employeeName,
    employeeId: input.employeeId,
    status: input.status,
    seedEmployeeName: input.employeeName,
    seedEmployeeId: input.employeeId,
    seedStatus: input.status,
    seedVacancySinceMonth: isVacancy ? 0 : null,
    monthlySpec: twelve(spec),
    monthlyLevel: twelve(input.level),
    monthlyBase: twelve(input.base),
    monthlyBonus: twelve(0),
    seedMonthlySpec: twelve(spec),
    seedMonthlyLevel: twelve(input.level),
    seedMonthlyBase: twelve(input.base),
    seedMonthlyBonus: twelve(0),
    events: [...carryoverEvents, ...(input.events ?? [])],
  };
}

function attachPilotPlanningEvents(position: PositionRecord, globalIndex: number): PositionRecord {
  const events = [...position.events];
  let order = events.length + 1;
  const push = (event: Omit<PlannedEvent, "createdOrder">) => {
    events.push({ ...event, createdOrder: order });
    order += 1;
  };

  if (position.status === "Occupied" && globalIndex % 23 === 0) {
    const raised = Math.round(position.monthlyBase[0] * 1.08);
    push({
      id: `seed-review-${position.positionId}`,
      type: "MANUAL_OVERRIDE",
      createdAt: "2026-06-01T09:00:00.000Z",
      payload: {
        month: 5,
        base: raised,
        bonus: 0,
        specialization: position.monthlySpec[0],
        level: position.monthlyLevel[0],
      },
    });
  }

  if (
    position.limitFlag === "IN_LIMIT" &&
    globalIndex % 31 === 0 &&
    position.status !== "Closed"
  ) {
    push({
      id: `seed-idx-${position.positionId}`,
      type: "INDEXATION",
      createdAt: "2026-02-01T09:00:00.000Z",
      payload: { month: 1, percent: 5, indexationBatchId: "seed-batch-q1" },
    });
  }

  if (globalIndex > 0 && globalIndex % 97 === 0 && position.status !== "Closed") {
    push({
      id: `seed-close-${position.positionId}`,
      type: "CLOSE_POSITION",
      createdAt: "2026-09-01T09:00:00.000Z",
      payload: { month: 8 },
    });
  }

  if (events.length === position.events.length) return position;
  return { ...position, events };
}

/** Срез «декабрь → перенос»: кто на каком слоте и оклад до старта плана года. */
export function buildDecemberRosterSnapshot(positions: PositionRecord[]): DecemberRosterRow[] {
  return positions.map((position) => ({
    positionId: position.positionId,
    role: position.role,
    employeeId: position.seedEmployeeId,
    employeeName: position.seedEmployeeName,
    status: position.seedStatus,
    decemberBase: position.previousDecemberBase || position.seedMonthlyBase[11],
    department: position.department,
    unit: position.unit,
    team: position.team,
  }));
}

/** Генератор демо-плана: декабрьский срез + события года. */
export function buildDemoPositions(targetCount = DEFAULT_DEMO_POSITION_COUNT): PositionRecord[] {
  const teams = listTeams();
  /** Минимум 5 — иначе при компактном демо нет вакансий (slotIndex % 5 === 4). */
  const slotsPerTeam = Math.max(5, Math.ceil(targetCount / teams.length));
  const positions: PositionRecord[] = [];
  let positionNum = 1;
  let employeeNum = 1;
  let nameIndex = 0;
  let globalIndex = 0;

  const nextEmployee = (): { id: string; name: string } => {
    const name = EMPLOYEE_NAMES[nameIndex % EMPLOYEE_NAMES.length];
    nameIndex += 1;
    const id = `E${String(employeeNum).padStart(4, "0")}`;
    employeeNum += 1;
    return { id, name };
  };

  for (const { department, unit, team } of teams) {
    for (let slotIndex = 0; slotIndex < slotsPerTeam; slotIndex += 1) {
      const positionId = `P${String(positionNum).padStart(3, "0")}`;
      positionNum += 1;
      const level = LEVELS[slotIndex % LEVELS.length];
      const base = monthlyBaseFor(level);
      const isVacancy = slotIndex % 5 === 4;
      const isClosed = slotIndex % 17 === 16;
      const employee = isVacancy || isClosed ? null : nextEmployee();
      const slotType = slotIndex < 2 ? "carryover" : "new";
      const limitFlag: LimitFlagKey =
        slotType === "carryover" ? "IN_LIMIT" : slotIndex % 3 === 0 ? "IN_LIMIT" : "OVER_LIMIT";

      let status: PositionRecord["status"] = "Occupied";
      if (isClosed) status = "Closed";
      else if (isVacancy) status = "Vacancy";

      const extraEvents: PlannedEvent[] = [];
      if (isClosed) {
        extraEvents.push({
          id: `seed-closed-${positionId}`,
          type: "CLOSE_POSITION",
          createdAt: "2026-01-10T09:00:00.000Z",
          createdOrder: slotType === "carryover" ? 2 : 1,
          payload: { month: 0 },
        });
      }

      const built = buildPosition({
        positionId,
        employeeId: employee?.id ?? null,
        employeeName: employee?.name ?? null,
        role: isVacancy
          ? `${roleTitle(department, slotIndex)} (вакансия)`
          : isClosed
            ? `${roleTitle(department, slotIndex)} (закрыта)`
            : roleTitle(department, slotIndex),
        department,
        unit,
        team,
        status,
        slotType,
        limitFlag,
        level,
        previousDecemberBase: slotType === "carryover" ? Math.round(base * 0.95) : 0,
        base,
        events: extraEvents,
      });

      positions.push(attachPilotPlanningEvents(built, globalIndex));
      globalIndex += 1;
      if (positions.length >= targetCount) {
        return positions;
      }
    }
  }

  return positions;
}

/** Полный пилотный объём (~520 поз.) — только по кнопке «Пилот (тяжёлый)». */
export function buildPilotPositions(): PositionRecord[] {
  return buildDemoPositions(PILOT_POSITION_TARGET);
}
