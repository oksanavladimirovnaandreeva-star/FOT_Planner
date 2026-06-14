import { collectDraftDeltaEvents } from "./planApprovalRules";
import { annualTotal, hasCarryoverEvent } from "./planningData";
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
  deltaPositionIds: string[];
  /** Δ годового ФОТ черновика vs база по позициям с новыми событиями. */
  fotDeltaAnnual: number;
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
  /** Срез юнита (unit_lead) или весь департамент. */
  unitScope: string | null;
  deadlines: ConsolidationDeadline[];
  units: UnitConsolidationGroup[];
  totals: {
    teams: number;
    headcount: number;
    deltaEvents: number;
    fotDeltaAnnual: number;
    carryoverGaps: number;
    submittedTeams: number;
    readyTeams: number;
    inProgressTeams: number;
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
    /** Если задан — только команды этого юнита (срез unit_lead). */
    unit?: string | null;
    /** Если задан — только одна команда (срез team_lead). */
    team?: string | null;
    planYear: number;
    workingDraft: PlanVersionMeta | null;
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
    now?: Date;
  },
): OrgConsolidationReport {
  const { department, planYear, workingDraft, baselinePositions, draftPositions } = options;
  const unitScope = options.unit?.trim() || null;
  const teamScope = options.team?.trim() || null;
  const now = options.now ?? new Date();
  const deadlines = getQuarterDeadlines(planYear);
  const editDeadlinePast = isPastDue(deadlines[0], now);
  const draftSubmitted = workingDraft?.status === "IN_APPROVAL";

  const deltaByTeam = new Map<string, number>();
  const deltaPositionsByTeam = new Map<string, Set<string>>();
  const fotDeltaByTeam = new Map<string, number>();

  if (workingDraft && baselinePositions.length > 0) {
    const baselineById = new Map(baselinePositions.map((position) => [position.positionId, position]));
    const draftById = new Map(draftPositions.map((position) => [position.positionId, position]));
    const touchedIds = new Set<string>();

    for (const { position, event } of collectDraftDeltaEvents(baselinePositions, draftPositions)) {
      if (position.department !== department) continue;
      if (unitScope && position.unit !== unitScope) continue;
      if (teamScope && position.team !== teamScope) continue;
      void event;
      const key = teamKey(position.department, position.unit, position.team);
      deltaByTeam.set(key, (deltaByTeam.get(key) ?? 0) + 1);
      const ids = deltaPositionsByTeam.get(key) ?? new Set<string>();
      ids.add(position.positionId);
      deltaPositionsByTeam.set(key, ids);
      touchedIds.add(position.positionId);
    }

    for (const positionId of touchedIds) {
      const draft = draftById.get(positionId);
      const baseline = baselineById.get(positionId);
      if (!draft || draft.department !== department) continue;
      if (unitScope && draft.unit !== unitScope) continue;
      if (teamScope && draft.team !== teamScope) continue;
      const key = teamKey(draft.department, draft.unit, draft.team);
      const delta = annualTotal(draft) - (baseline ? annualTotal(baseline) : 0);
      fotDeltaByTeam.set(key, (fotDeltaByTeam.get(key) ?? 0) + delta);
    }
  }

  const carryoverByTeam = new Map<string, number>();
  const headcountByTeam = new Map<string, number>();
  for (const position of positions) {
    if (position.department !== department) continue;
    if (unitScope && position.unit !== unitScope) continue;
    if (teamScope && position.team !== teamScope) continue;
    if (position.status === "Closed") continue;
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
    const deltaPositionIds = [...(deltaPositionsByTeam.get(key) ?? new Set<string>())].sort();
    const carryoverGaps = carryoverByTeam.get(key) ?? 0;
    teamRows.push({
      department,
      unit,
      team,
      headcount: headcountByTeam.get(key) ?? 0,
      deltaEvents,
      deltaPositionIds,
      fotDeltaAnnual: fotDeltaByTeam.get(key) ?? 0,
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
    fotDeltaAnnual: teamRows.reduce((sum, row) => sum + row.fotDeltaAnnual, 0),
    carryoverGaps: teamRows.reduce((sum, row) => sum + row.carryoverGaps, 0),
    submittedTeams: teamRows.filter((row) => row.status === "submitted").length,
    readyTeams: teamRows.filter((row) => row.status === "ready").length,
    inProgressTeams: teamRows.filter((row) => row.status === "in_progress").length,
    overdueTeams: teamRows.filter((row) => row.status === "overdue").length,
  };

  return { department, unitScope, deadlines, units, totals };
}

export function formatDeadlineShort(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
