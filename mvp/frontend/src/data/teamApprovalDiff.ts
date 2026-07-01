import { collectDraftDeltaEvents } from "./planApprovalRules";
import {
  collectPlanEventJournalRows,
  eventCommentTooltip,
  eventEmployeeLine,
  type EventChangeSummary,
  type PlanEventJournalRow,
} from "./eventJournal";
import { annualTotal, applyEvents, applyEventsUntil, decToDec, monthLabel, POSITION_STATUS_LABELS } from "./planningData";
import { eventTypeLabel } from "./eventLabels";
import type { EventType, LimitFlagKey, PlannedEvent, PositionRecord } from "../types";

export type TeamApprovalSubmissionMode = "annual" | "quarterly";

const DISPLAY_LIMIT_FLAGS: LimitFlagKey[] = ["IN_LIMIT", "OVER_LIMIT"];

export type FotByLimit = Record<LimitFlagKey, number>;

const EMPTY_FOT_BY_LIMIT = (): FotByLimit => ({
  IN_LIMIT: 0,
  OVER_LIMIT: 0,
  UNLIMITED: 0,
});

function deltaFotByLimit(baseline: FotByLimit, draft: FotByLimit): FotByLimit {
  return {
    IN_LIMIT: draft.IN_LIMIT - baseline.IN_LIMIT,
    OVER_LIMIT: draft.OVER_LIMIT - baseline.OVER_LIMIT,
    UNLIMITED: draft.UNLIMITED - baseline.UNLIMITED,
  };
}

function annualFotByLimit(
  positions: PositionRecord[],
  match: (position: PositionRecord) => boolean,
): FotByLimit {
  const totals = EMPTY_FOT_BY_LIMIT();
  for (const position of positions) {
    if (!match(position) || position.status === "Closed") continue;
    totals[position.limitFlag] += annualTotal(position);
  }
  return totals;
}

function annualFotByLimitForTeam(
  positions: PositionRecord[],
  scope: { department: string; unit: string; team: string },
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesTeam(position, scope));
}

function annualFotByLimitForUnit(
  positions: PositionRecord[],
  scope: { department: string; unit: string },
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesUnit(position, scope));
}

const APPROVAL_HIDDEN_EVENT_TYPES = new Set<EventType>(["INDEXATION", "POSITION_CARRYOVER"]);

/** Пересчёт помесячных полей по событиям — как на «Планировании». */
function approvalPositionsWithEvents(positions: PositionRecord[]): PositionRecord[] {
  return positions.map(applyEvents);
}

type ApprovalDiffInput = {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
};

function normalizeApprovalDiffInput<T extends ApprovalDiffInput>(input: T): T {
  return {
    ...input,
    baselinePositions: approvalPositionsWithEvents(input.baselinePositions),
    draftPositions: approvalPositionsWithEvents(input.draftPositions),
  };
}

export type TeamApprovalDiffRow = {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
  typeLabel: string;
  employeeLine: string | null;
  change: EventChangeSummary;
  comment: string | null;
  isNewPosition: boolean;
  fotDeltaAnnual: number;
  event: PlannedEvent;
  createdAt: string;
};

export type TeamApprovalDiffSummary = {
  baselineFot: number;
  draftFot: number;
  deltaFot: number;
  baselineHeadcount: number;
  draftHeadcount: number;
  changeCount: number;
  baselineFotByLimit: FotByLimit;
  draftFotByLimit: FotByLimit;
  deltaFotByLimit: FotByLimit;
  /** Прирост оклада дек→дек (план декабрь − прошлый декабрь) по лимиту. */
  draftDecGrowthByLimit: FotByLimit;
  /** Сумма previousDecemberBase по лимиту (база для % дек→дек). */
  draftPrevDecByLimit: FotByLimit;
};

export { DISPLAY_LIMIT_FLAGS as TEAM_APPROVAL_LIMIT_FLAGS };

/** Доля суммы в общем годовом ФОТ среза (команда / юнит / департамент). */
export function shareOfAnnualBudget(part: number, annualBudget: number): number | null {
  if (annualBudget === 0) return null;
  return (part / annualBudget) * 100;
}

/** Доля части в общем приросте (Δ ФОТ или дек→дек по срезу). */
export function shareOfTotalGrowth(part: number, totalGrowth: number): number | null {
  if (totalGrowth === 0) return part === 0 ? 0 : null;
  return (part / totalGrowth) * 100;
}

export function sumLimitBucketValues(
  values: FotByLimit,
  flags: LimitFlagKey[] = DISPLAY_LIMIT_FLAGS,
): number {
  return flags.reduce((sum, flag) => sum + values[flag], 0);
}

export type LimitGrowthMetrics = {
  growth: number;
  baseline: number;
  /** % к базе блока (прошлый дек / утверждённый год). null — н/п (новые без базы). */
  relativePct: number | null;
  /**
   * Вклад блока в общий % дек→дек среза, п.п.:
   * (прирост блока ₽ / общий прирост ₽) × общий % дек→дек.
   */
  contributionToTotalRelativePct: number | null;
};

export function computeLimitGrowthMetrics(
  growth: number,
  baseline: number,
  totalGrowth: number,
  totalBaseline: number,
): LimitGrowthMetrics {
  let relativePct: number | null = null;
  if (baseline > 0) {
    relativePct = decToDec(baseline, baseline + growth);
  } else if (growth === 0) {
    relativePct = 0;
  }

  let contributionToTotalRelativePct: number | null = null;
  if (growth === 0 && totalGrowth === 0) {
    contributionToTotalRelativePct = 0;
  } else if (totalGrowth !== 0 && totalBaseline > 0) {
    const totalRelativePct = decToDec(totalBaseline, totalBaseline + totalGrowth);
    contributionToTotalRelativePct = (growth / totalGrowth) * totalRelativePct;
  }

  return {
    growth,
    baseline,
    relativePct,
    contributionToTotalRelativePct,
  };
}

function matchesTeam(
  position: PositionRecord,
  scope: { department: string; unit: string; team: string },
): boolean {
  return (
    position.department === scope.department &&
    position.unit === scope.unit &&
    position.team === scope.team
  );
}

function matchesUnit(
  position: PositionRecord,
  scope: { department: string; unit: string },
): boolean {
  return position.department === scope.department && position.unit === scope.unit;
}

function matchesDepartment(position: PositionRecord, department: string): boolean {
  return position.department === department;
}

function annualFotByLimitForDepartment(
  positions: PositionRecord[],
  department: string,
): FotByLimit {
  return annualFotByLimit(positions, (position) => matchesDepartment(position, department));
}

function decemberGrowthByLimit(
  positions: PositionRecord[],
  match: (position: PositionRecord) => boolean,
): FotByLimit {
  const totals = EMPTY_FOT_BY_LIMIT();
  for (const position of positions) {
    if (!match(position) || position.status === "Closed") continue;
    totals[position.limitFlag] +=
      (position.monthlyBase[11] ?? 0) - (position.previousDecemberBase ?? 0);
  }
  return totals;
}

function previousDecemberByLimit(
  positions: PositionRecord[],
  match: (position: PositionRecord) => boolean,
): FotByLimit {
  const totals = EMPTY_FOT_BY_LIMIT();
  for (const position of positions) {
    if (!match(position) || position.status === "Closed") continue;
    totals[position.limitFlag] += position.previousDecemberBase ?? 0;
  }
  return totals;
}

function headcountForDepartment(positions: PositionRecord[], department: string): number {
  return positions.filter(
    (position) => matchesDepartment(position, department) && position.status !== "Closed",
  ).length;
}

function annualFotForDepartment(positions: PositionRecord[], department: string): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesDepartment(position, department) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function headcountForTeam(positions: PositionRecord[], scope: { department: string; unit: string; team: string }): number {
  return positions.filter(
    (position) => matchesTeam(position, scope) && position.status !== "Closed",
  ).length;
}

function annualFotForTeam(positions: PositionRecord[], scope: { department: string; unit: string; team: string }): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesTeam(position, scope) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function headcountForUnit(positions: PositionRecord[], scope: { department: string; unit: string }): number {
  return positions.filter(
    (position) => matchesUnit(position, scope) && position.status !== "Closed",
  ).length;
}

function annualFotForUnit(positions: PositionRecord[], scope: { department: string; unit: string }): number {
  let sum = 0;
  for (const position of positions) {
    if (!matchesUnit(position, scope) || position.status === "Closed") continue;
    sum += annualTotal(position);
  }
  return sum;
}

function annualFotDeltaForEvent(position: PositionRecord, event: PlannedEvent): number {
  const before = applyEventsUntil(position, event.id, false);
  const after = applyEventsUntil(position, event.id, true);
  if (before.status === "Closed" && after.status === "Closed") return 0;
  const beforeFot = before.status !== "Closed" ? annualTotal(before) : 0;
  const afterFot = after.status !== "Closed" ? annualTotal(after) : 0;
  return afterFot - beforeFot;
}

/** Δ годового ФОТ события: baseline (утверждённый) → состояние после события в черновике. */
function annualFotDeltaForDraftEvent(
  baseline: PositionRecord | undefined,
  draftPosition: PositionRecord,
  event: PlannedEvent,
): number {
  const beforeFot =
    baseline && baseline.status !== "Closed" ? annualTotal(applyEvents(baseline)) : 0;
  const afterState = applyEventsUntil(draftPosition, event.id, true);
  const afterFot = afterState.status !== "Closed" ? annualTotal(afterState) : 0;
  return afterFot - beforeFot;
}

function summarizeDraftDeltaEvent(
  baseline: PositionRecord | undefined,
  draftPosition: PositionRecord,
  event: PlannedEvent,
): EventChangeSummary {
  const month = Math.max(0, Math.min(11, event.payload.month));
  const before = baseline ? applyEvents(baseline) : applyEvents({ ...draftPosition, events: [] });
  const after = applyEventsUntil(draftPosition, event.id, true);
  return {
    month,
    monthLabel: monthLabel(month),
    statusBefore: POSITION_STATUS_LABELS[before.status],
    statusAfter: POSITION_STATUS_LABELS[after.status],
    baseBefore: before.monthlyBase[month] ?? 0,
    baseAfter: after.monthlyBase[month] ?? 0,
    specBefore: before.monthlySpec[month] ?? "",
    specAfter: after.monthlySpec[month] ?? "",
    levelBefore: before.monthlyLevel[month] ?? "",
    levelAfter: after.monthlyLevel[month] ?? "",
  };
}

function journalRowsToApprovalRows(
  journalRows: PlanEventJournalRow[],
  input: {
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
  },
  mode: TeamApprovalSubmissionMode,
): TeamApprovalDiffRow[] {
  const baselinePositionIds = new Set(input.baselinePositions.map((position) => position.positionId));

  return journalRows.map((row) => {
    const draftPosition =
      input.draftPositions.find((item) => item.positionId === row.positionId) ?? null;
    const isNewPosition =
      mode === "quarterly"
        ? !baselinePositionIds.has(row.positionId)
        : row.event.type === "PLANNED_HIRE" && draftPosition?.slotType === "new";

    return {
      positionId: row.positionId,
      role: row.role,
      department: row.department,
      unit: row.unit,
      team: row.team,
      typeLabel: isNewPosition ? "Новая позиция" : row.typeLabel,
      employeeLine: row.employeeLine,
      change: row.change,
      comment: row.comment?.trim() || row.commentTooltip,
      isNewPosition,
      fotDeltaAnnual: draftPosition ? annualFotDeltaForEvent(draftPosition, row.event) : 0,
      event: row.event,
      createdAt: row.createdAt,
    };
  });
}

function deltaEventsToApprovalRows(
  deltaEvents: { position: PositionRecord; event: PlannedEvent }[],
  input: {
    baselinePositions: PositionRecord[];
    draftPositions: PositionRecord[];
  },
): TeamApprovalDiffRow[] {
  const baselineById = new Map(
    input.baselinePositions.map((position) => [position.positionId, position] as const),
  );
  const draftById = new Map(
    input.draftPositions.map((position) => [position.positionId, position] as const),
  );
  const baselinePositionIds = new Set(input.baselinePositions.map((position) => position.positionId));

  return deltaEvents.map(({ position, event }) => {
    const isNewPosition = !baselinePositionIds.has(position.positionId);
    const baseline = baselineById.get(position.positionId);
    const draftPosition = draftById.get(position.positionId) ?? position;
    const change = summarizeDraftDeltaEvent(baseline, draftPosition, event);

    return {
      positionId: position.positionId,
      role: position.role,
      department: position.department,
      unit: position.unit,
      team: position.team,
      typeLabel: isNewPosition ? "Новая позиция" : eventTypeLabel(event),
      employeeLine: eventEmployeeLine(event, position),
      change,
      comment: event.payload.comment?.trim() || eventCommentTooltip(event),
      isNewPosition,
      fotDeltaAnnual: annualFotDeltaForDraftEvent(baseline, draftPosition, event),
      event,
      createdAt: event.createdAt,
    };
  });
}

/** Годовое планирование: все события команды. Квартальное: только новые события vs утверждённый год. */
export function buildTeamApprovalDiff(rawInput: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  unit: string;
  team: string;
  mode: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const input = normalizeApprovalDiffInput({
    baselinePositions: rawInput.baselinePositions,
    draftPositions: rawInput.draftPositions,
  });
  const scope = {
    department: rawInput.department,
    unit: rawInput.unit,
    team: rawInput.team,
  };

  const teamDraft = input.draftPositions.filter((position) => matchesTeam(position, scope));

  const rows =
    rawInput.mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(teamDraft), input, rawInput.mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesTeam(position, scope)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForTeam(input.baselinePositions, scope);
  const draftFotByLimit = annualFotByLimitForTeam(input.draftPositions, scope);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForTeam(input.baselinePositions, scope),
    draftFot: annualFotForTeam(input.draftPositions, scope),
    deltaFot:
      annualFotForTeam(input.draftPositions, scope) - annualFotForTeam(input.baselinePositions, scope),
    baselineHeadcount: headcountForTeam(input.baselinePositions, scope),
    draftHeadcount: headcountForTeam(input.draftPositions, scope),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
    draftDecGrowthByLimit: decemberGrowthByLimit(input.draftPositions, (position) =>
      matchesTeam(position, scope),
    ),
    draftPrevDecByLimit: previousDecemberByLimit(input.draftPositions, (position) =>
      matchesTeam(position, scope),
    ),
  };

  return { summary, rows };
}

/** Квартальное: дельта по юниту. Годовое: все события юнита. */
export function buildUnitApprovalDiff(rawInput: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  unit: string;
  mode?: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const input = normalizeApprovalDiffInput({
    baselinePositions: rawInput.baselinePositions,
    draftPositions: rawInput.draftPositions,
  });
  const mode = rawInput.mode ?? "quarterly";
  const scope = { department: rawInput.department, unit: rawInput.unit };
  const unitDraft = input.draftPositions.filter((position) => matchesUnit(position, scope));

  const rows =
    mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(unitDraft), input, mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesUnit(position, scope)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      a.team.localeCompare(b.team, "ru") ||
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForUnit(input.baselinePositions, scope);
  const draftFotByLimit = annualFotByLimitForUnit(input.draftPositions, scope);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForUnit(input.baselinePositions, scope),
    draftFot: annualFotForUnit(input.draftPositions, scope),
    deltaFot:
      annualFotForUnit(input.draftPositions, scope) - annualFotForUnit(input.baselinePositions, scope),
    baselineHeadcount: headcountForUnit(input.baselinePositions, scope),
    draftHeadcount: headcountForUnit(input.draftPositions, scope),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
    draftDecGrowthByLimit: decemberGrowthByLimit(input.draftPositions, (position) =>
      matchesUnit(position, scope),
    ),
    draftPrevDecByLimit: previousDecemberByLimit(input.draftPositions, (position) =>
      matchesUnit(position, scope),
    ),
  };

  return { summary, rows };
}

/** Квартальное: дельта по департаменту. Годовое: все события департамента. */
export function buildDepartmentApprovalDiff(rawInput: {
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  department: string;
  mode?: TeamApprovalSubmissionMode;
}): { summary: TeamApprovalDiffSummary; rows: TeamApprovalDiffRow[] } {
  const input = normalizeApprovalDiffInput({
    baselinePositions: rawInput.baselinePositions,
    draftPositions: rawInput.draftPositions,
  });
  const mode = rawInput.mode ?? "quarterly";
  const { department } = rawInput;
  const deptDraft = input.draftPositions.filter((position) => matchesDepartment(position, department));

  const rows =
    mode === "annual"
      ? journalRowsToApprovalRows(collectPlanEventJournalRows(deptDraft), input, mode)
      : deltaEventsToApprovalRows(
          collectDraftDeltaEvents(input.baselinePositions, input.draftPositions).filter(
            ({ position, event }) => {
              if (!matchesDepartment(position, department)) return false;
              if (APPROVAL_HIDDEN_EVENT_TYPES.has(event.type)) return false;
              return true;
            },
          ),
          input,
        );

  rows.sort(
    (a, b) =>
      a.unit.localeCompare(b.unit, "ru") ||
      a.team.localeCompare(b.team, "ru") ||
      b.event.payload.month - a.event.payload.month ||
      b.event.createdOrder - a.event.createdOrder,
  );

  const baselineFotByLimit = annualFotByLimitForDepartment(input.baselinePositions, department);
  const draftFotByLimit = annualFotByLimitForDepartment(input.draftPositions, department);

  const summary: TeamApprovalDiffSummary = {
    baselineFot: annualFotForDepartment(input.baselinePositions, department),
    draftFot: annualFotForDepartment(input.draftPositions, department),
    deltaFot:
      annualFotForDepartment(input.draftPositions, department) -
      annualFotForDepartment(input.baselinePositions, department),
    baselineHeadcount: headcountForDepartment(input.baselinePositions, department),
    draftHeadcount: headcountForDepartment(input.draftPositions, department),
    changeCount: rows.length,
    baselineFotByLimit,
    draftFotByLimit,
    deltaFotByLimit: deltaFotByLimit(baselineFotByLimit, draftFotByLimit),
    draftDecGrowthByLimit: decemberGrowthByLimit(input.draftPositions, (position) =>
      matchesDepartment(position, department),
    ),
    draftPrevDecByLimit: previousDecemberByLimit(input.draftPositions, (position) =>
      matchesDepartment(position, department),
    ),
  };

  return { summary, rows };
}
