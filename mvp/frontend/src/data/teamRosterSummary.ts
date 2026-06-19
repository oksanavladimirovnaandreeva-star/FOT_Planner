import type { PositionRecord } from "../types";

export type TeamRosterSummary = {
  department: string;
  unit: string;
  team: string;
  occupied: number;
  vacancies: number;
  closed: number;
  total: number;
  memberNames: string[];
  teamLeadName: string | null;
};

function teamKey(department: string, unit: string, team: string): string {
  return `${department}\0${unit}\0${team}`;
}

/** Состав команд по позициям плана (без тимлида в отдельной логике — все Occupied). */
export function summarizeTeamRosters(
  positions: PositionRecord[],
  filter?: { department?: string; unit?: string },
): Map<string, TeamRosterSummary> {
  const map = new Map<string, TeamRosterSummary>();

  for (const position of positions) {
    if (filter?.department && position.department !== filter.department) continue;
    if (filter?.unit && position.unit !== filter.unit) continue;

    const key = teamKey(position.department, position.unit, position.team);
    const entry =
      map.get(key) ??
      ({
        department: position.department,
        unit: position.unit,
        team: position.team,
        occupied: 0,
        vacancies: 0,
        closed: 0,
        total: 0,
        memberNames: [],
        teamLeadName: null,
      } satisfies TeamRosterSummary);

    entry.total += 1;
    if (position.status === "Closed") {
      entry.closed += 1;
    } else if (position.status === "Vacancy") {
      entry.vacancies += 1;
    } else {
      entry.occupied += 1;
      if (position.employeeName?.trim()) {
        entry.memberNames.push(position.employeeName.trim());
      }
    }
    map.set(key, entry);
  }

  return map;
}

export function rosterSummaryForTeam(
  positions: PositionRecord[],
  department: string,
  unit: string,
  team: string,
): TeamRosterSummary | null {
  return summarizeTeamRosters(positions, { department, unit }).get(teamKey(department, unit, team)) ?? null;
}

export function formatRosterBrief(summary: TeamRosterSummary | null): string {
  if (!summary) return "—";
  const parts: string[] = [];
  if (summary.occupied > 0) parts.push(`${summary.occupied} в штате`);
  if (summary.vacancies > 0) parts.push(`${summary.vacancies} вак.`);
  return parts.length > 0 ? parts.join(", ") : "нет слотов";
}
