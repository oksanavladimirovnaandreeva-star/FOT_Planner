import {
  DEMO_PERSONA_BY_ID,
  resolveTeamLeadDisplayForTeam,
  resolveUnitLeadDisplayForUnit,
  type DemoPersonaId,
} from "./demoPersonas";
import { DEMO_UNIT_IT_DIRECT } from "./demoOrg";
import { loadResolvedDemoPersona } from "./demoSessionStore";
import { formatMoney } from "./formatDisplay";
import { annualTotal } from "./planningData";
import { formatRosterBrief, rosterSummaryForTeam } from "./teamRosterSummary";
import { planTeamPlanningPath, planUnitLeadContourPath, planUnitPlanningPath } from "./planWorkspaceMode";
import type { BudgetTeamRow, BudgetWorkspaceLevel } from "./buildBudgetPackage";
import type { PositionRecord } from "../types";

export type BudgetContourTeamTile = {
  id: string;
  team: string;
  unit: string;
  department: string;
  teamLeadName: string | null;
  /** Подпись роли в плитке (тимлид / юнит-лид). */
  leadRoleLabel?: "team_lead" | "unit_lead";
  rosterBrief: string;
  fotBrief: string;
  statusLabel: string;
  isDirectReport: boolean;
  /** Планирование всей команды (из таблицы «Команды»). */
  planningHref: string;
  /** Весь юнит (для плитки юнит-лида у директора). */
  unitPlanningHref: string | null;
  /** Позиция тимлида / юнит-лида (из «Ваш контур»). */
  leadPlanningHref: string | null;
};

export type BudgetContourUnitGroup = {
  id: string;
  unit: string;
  teamCount: number;
  teams: BudgetContourTeamTile[];
};

export type BudgetContour = {
  title: string;
  leadLine: string;
  /** Юнит-лид: плоский список команд. Директор: группы по юнитам. */
  unitGroups: BudgetContourUnitGroup[];
};

function aggregateRosterBrief(
  teams: BudgetTeamRow[],
  positions: PositionRecord[],
  department: string,
): string {
  let occupied = 0;
  let vacancies = 0;
  for (const team of teams) {
    const summary = rosterSummaryForTeam(positions, department, team.unit, team.team);
    if (!summary) continue;
    occupied += summary.occupied;
    vacancies += summary.vacancies;
  }
  const parts: string[] = [];
  if (occupied > 0) parts.push(`${occupied} в штате`);
  if (vacancies > 0) parts.push(`${vacancies} вак.`);
  return parts.length > 0 ? parts.join(", ") : "нет слотов";
}

function teamTile(
  team: BudgetTeamRow,
  positions: PositionRecord[],
  directReportTeams: Set<string>,
): BudgetContourTeamTile {
  const teamLeadName = resolveTeamLeadDisplayForTeam(team.department, team.unit, team.team);
  const roster = rosterSummaryForTeam(positions, team.department, team.unit, team.team);
  return {
    id: `${team.unit}-${team.team}`,
    team: team.team,
    unit: team.unit,
    department: team.department,
    teamLeadName,
    leadRoleLabel: "team_lead",
    rosterBrief: formatRosterBrief(roster),
    fotBrief: formatMoney(team.draftFotAnnual, true),
    statusLabel: team.statusLabel,
    isDirectReport: directReportTeams.has(team.team),
    planningHref: planTeamPlanningPath(team.team, "planning", {
      unit: team.unit,
      department: team.department,
    }),
    unitPlanningHref: null,
    leadPlanningHref: teamLeadName
      ? planTeamPlanningPath(team.team, "planning", {
          leadOnly: true,
          unit: team.unit,
          department: team.department,
        })
      : null,
  };
}

function unitLeadTile(
  unit: string,
  teams: BudgetTeamRow[],
  positions: PositionRecord[],
  department: string,
): BudgetContourTeamTile {
  const unitTeams = teams.filter((team) => team.unit === unit);
  const draftFot = unitTeams.reduce((sum, team) => sum + team.draftFotAnnual, 0);
  const statusLabel =
    unitTeams.find((team) => team.displayStatus === "team_submitted")?.statusLabel ??
    unitTeams.find((team) => team.displayStatus === "ready")?.statusLabel ??
    unitTeams[0]?.statusLabel ??
    "В работе";

  return {
    id: `unit-${unit}`,
    team: unit,
    unit,
    department,
    teamLeadName: resolveUnitLeadDisplayForUnit(department, unit),
    leadRoleLabel: "unit_lead",
    rosterBrief: aggregateRosterBrief(unitTeams, positions, department),
    fotBrief: formatMoney(draftFot, true),
    statusLabel,
    isDirectReport: false,
    planningHref: planUnitLeadContourPath(unit, "planning", department),
    unitPlanningHref: planUnitPlanningPath(unit, "planning", department),
    leadPlanningHref: resolveUnitLeadDisplayForUnit(department, unit)
      ? planUnitLeadContourPath(unit, "planning", department)
      : null,
  };
}

export function buildBudgetContour(input: {
  level: BudgetWorkspaceLevel;
  department: string;
  unit: string | null;
  teams: BudgetTeamRow[];
  positions: PositionRecord[];
  directReportPersonaIds?: DemoPersonaId[];
}): BudgetContour {
  const persona = loadResolvedDemoPersona();
  const directReportTeams = new Set<string>();

  if (input.directReportPersonaIds?.length) {
    for (const id of input.directReportPersonaIds) {
      const report = DEMO_PERSONA_BY_ID[id];
      const team = report.defaultScope?.rules.find((rule) => rule.field === "team")?.values[0];
      if (typeof team === "string") directReportTeams.add(team);
    }
  }

  const youName = persona?.displayName ?? "Вы";

  if (input.level === "unit" && input.unit) {
    return {
      title: "Ваш контур",
      leadLine: `${youName} · юнит-лид · ${input.unit}`,
      unitGroups: [
        {
          id: `unit-${input.unit}`,
          unit: input.unit,
          teamCount: input.teams.length,
          teams: input.teams.map((team) => teamTile(team, input.positions, directReportTeams)),
        },
      ],
    };
  }

  const byUnit = new Map<string, BudgetTeamRow[]>();
  for (const team of input.teams) {
    const list = byUnit.get(team.unit) ?? [];
    list.push(team);
    byUnit.set(team.unit, list);
  }

  const unitGroups: BudgetContourUnitGroup[] = [];
  const directTeams = byUnit.get(DEMO_UNIT_IT_DIRECT);
  if (directTeams?.length) {
    unitGroups.push({
      id: "direct",
      unit: "Прямое подчинение",
      teamCount: directTeams.length,
      teams: directTeams.map((team) => teamTile(team, input.positions, directReportTeams)),
    });
    byUnit.delete(DEMO_UNIT_IT_DIRECT);
  }

  for (const [unit, teams] of [...byUnit.entries()].sort(([a], [b]) => a.localeCompare(b, "ru"))) {
    unitGroups.push({
      id: `unit-${unit}`,
      unit,
      teamCount: teams.length,
      teams: [unitLeadTile(unit, teams, input.positions, input.department)],
    });
  }

  return {
    title: "Ваш контур",
    leadLine: `${youName} · директор · ${input.department}`,
    unitGroups,
  };
}

/** Контур тимлида на «Мой бюджет»: команда, численность, ФОТ. */
export function buildTeamLeadBudgetContour(input: {
  department: string;
  unit: string;
  team: string;
  positions: PositionRecord[];
}): BudgetContour {
  const persona = loadResolvedDemoPersona();
  const roster = rosterSummaryForTeam(input.positions, input.department, input.unit, input.team);
  let fotAnnual = 0;
  for (const position of input.positions) {
    if (
      position.department !== input.department ||
      position.unit !== input.unit ||
      position.team !== input.team ||
      position.status === "Closed"
    ) {
      continue;
    }
    fotAnnual += annualTotal(position);
  }
  const rosterBrief = formatRosterBrief(roster);
  const fotBrief = formatMoney(fotAnnual, true);

  return {
    title: "Ваш контур",
    leadLine: `${persona?.displayName ?? "Вы"} · тимлид · ${input.team}`,
    unitGroups: [
      {
        id: `team-${input.team}`,
        unit: input.unit,
        teamCount: 1,
        teams: [
          {
            id: input.team,
            team: input.team,
            unit: input.unit,
            department: input.department,
            teamLeadName: persona?.displayName ?? null,
            leadRoleLabel: "team_lead",
            rosterBrief: `${rosterBrief} · ${fotBrief}`,
            fotBrief,
            statusLabel: "В работе",
            isDirectReport: false,
            planningHref: planTeamPlanningPath(input.team, "planning", {
              unit: input.unit,
              department: input.department,
            }),
            unitPlanningHref: null,
            leadPlanningHref: persona
              ? planTeamPlanningPath(input.team, "planning", {
                  leadOnly: true,
                  unit: input.unit,
                  department: input.department,
                })
              : null,
          },
        ],
      },
    ],
  };
}
