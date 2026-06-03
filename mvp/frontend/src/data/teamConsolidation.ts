import { collectDraftDeltaEvents } from "./planApprovalRules";
import { hasCarryoverEvent } from "./planningData";
import type { PlanVersionMeta } from "./planVersions";
import type { PositionRecord } from "../types";

export type TeamLeadStatus = "not_started" | "in_progress" | "ready" | "submitted" | "overdue";

export const TEAM_LEAD_STATUS_LABELS: Record<TeamLeadStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  ready: "Готово к сдаче",
  submitted: "Сдано",
  overdue: "Просрочено",
};

export interface ConsolidationDeadline {
  id: string;
  label: string;
  dueDate: Date;
  hint: string;
}

export interface TeamConsolidationRow {
  department: string;
  unit: string;
  team: string;
  headcount: number;
  deltaEvents: number;
  carryoverGaps: number;
  status: TeamLeadStatus;
}

export interface UnitConsolidationGroup {
  unit: string;
  teams: TeamConsolidationRow[];
  headcount: number;
  deltaEvents: number;
  carryoverGaps: number;
}

export interface OrgConsolidationReport {
  department: string;
  deadlines: ConsolidationDeadline[];
  units: UnitConsolidationGroup[];
  totals: {
    teams: number;
    headcount: number;
    deltaEvents: number;
    carryoverGaps: number;
    submittedTeams: number;
    overdueTeams: number;
  };
}

function teamKey(department: string, unit: string, team: string): string {
  return `${department}\0${unit}\0${team}`;
}

function parseTeamKey(key: string): { department: string; unit: string; team: string } {
  const [department, unit, team] = key.split("\0");
  return { department, unit, team };
}

/** Квартальные дедлайны MVP (календарь плана). */
export function getQuarterDeadlines(planYear: number): ConsolidationDeadline[] {
  return [
    {
      id: "draft-edits",
      label: "Правки в черновике",
      dueDate: new Date(planYear, 5, 15, 23, 59),
      hint: "Тимлиды вносят события по своим командам",
    },
    {
      id: "submit-approval",
      label: "Отправка на согласование",
      dueDate: new Date(planYear, 5, 22, 23, 59),
      hint: "Юнит-лид отправляет сводный черновик",
    },
    {
      id: "publish",
      label: "Публикация v+1",
      dueDate: new Date(planYear, 5, 30, 23, 59),
      hint: "Финальная версия бюджета",
    },
  ];
}

function isPastDue(deadline: ConsolidationDeadline, now = new Date()): boolean {
  return now.getTime() > deadline.dueDate.getTime();
}

function resolveTeamStatus(params: {
  deltaEvents: number;
  carryoverGaps: number;
  draftSubmitted: boolean;
  editDeadlinePast: boolean;
}): TeamLeadStatus {
  if (params.draftSubmitted) return "submitted";
  if (params.deltaEvents === 0 && params.carryoverGaps === 0) {
    return params.editDeadlinePast ? "overdue" : "not_started";
  }
  if (params.deltaEvents > 0 && params.carryoverGaps === 0) {
    return "ready";
  }
  if (params.deltaEvents > 0) return "in_progress";
  if (params.carryoverGaps > 0) return params.editDeadlinePast ? "overdue" : "in_progress";
  return params.editDeadlinePast ? "overdue" : "not_started";
}

export function buildOrgConsolidationReport(
  positions: PositionRecord[],
  options: {
    department: string;
    planYear: number;
    workingDraft: PlanVersionMeta | null;
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
    now?: Date;
  },
): OrgConsolidationReport {
  const { department, planYear, workingDraft, baselinePositions, draftPositions } = options;
  const now = options.now ?? new Date();
  const deadlines = getQuarterDeadlines(planYear);
  const editDeadlinePast = isPastDue(deadlines[0], now);
  const draftSubmitted = workingDraft?.status === "IN_APPROVAL";

  const deltaByTeam = new Map<string, number>();
  if (workingDraft && baselinePositions.length > 0) {
    for (const { position, event } of collectDraftDeltaEvents(baselinePositions, draftPositions)) {
      if (position.department !== department) continue;
      void event;
      const key = teamKey(position.department, position.unit, position.team);
      deltaByTeam.set(key, (deltaByTeam.get(key) ?? 0) + 1);
    }
  }

  const carryoverByTeam = new Map<string, number>();
  const headcountByTeam = new Map<string, number>();
  for (const position of positions) {
    if (position.department !== department || position.status === "Closed") continue;
    const key = teamKey(position.department, position.unit, position.team);
    headcountByTeam.set(key, (headcountByTeam.get(key) ?? 0) + 1);
    if (position.status === "Vacancy" && position.slotType === "carryover" && !hasCarryoverEvent(position)) {
      carryoverByTeam.set(key, (carryoverByTeam.get(key) ?? 0) + 1);
    }
  }

  const teamRows: TeamConsolidationRow[] = [];
  for (const key of new Set([...headcountByTeam.keys(), ...deltaByTeam.keys()])) {
    const { unit, team } = parseTeamKey(key);
    const deltaEvents = deltaByTeam.get(key) ?? 0;
    const carryoverGaps = carryoverByTeam.get(key) ?? 0;
    teamRows.push({
      department,
      unit,
      team,
      headcount: headcountByTeam.get(key) ?? 0,
      deltaEvents,
      carryoverGaps,
      status: resolveTeamStatus({
        deltaEvents,
        carryoverGaps,
        draftSubmitted,
        editDeadlinePast,
      }),
    });
  }

  teamRows.sort((a, b) => a.unit.localeCompare(b.unit, "ru") || a.team.localeCompare(b.team, "ru"));

  const unitMap = new Map<string, UnitConsolidationGroup>();
  for (const row of teamRows) {
    const group = unitMap.get(row.unit) ?? { unit: row.unit, teams: [], headcount: 0, deltaEvents: 0, carryoverGaps: 0 };
    group.teams.push(row);
    group.headcount += row.headcount;
    group.deltaEvents += row.deltaEvents;
    group.carryoverGaps += row.carryoverGaps;
    unitMap.set(row.unit, group);
  }

  const units = [...unitMap.values()].sort((a, b) => a.unit.localeCompare(b.unit, "ru"));
  const totals = {
    teams: teamRows.length,
    headcount: teamRows.reduce((sum, row) => sum + row.headcount, 0),
    deltaEvents: teamRows.reduce((sum, row) => sum + row.deltaEvents, 0),
    carryoverGaps: teamRows.reduce((sum, row) => sum + row.carryoverGaps, 0),
    submittedTeams: teamRows.filter((row) => row.status === "submitted").length,
    overdueTeams: teamRows.filter((row) => row.status === "overdue").length,
  };

  return { department, deadlines, units, totals };
}

export function formatDeadlineShort(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
