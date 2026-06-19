import { annualTotal } from "./planningData";
import { formatPlanVersionTitle } from "./planVersionDisplay";
import type { PlanVersionMeta } from "./planVersions";
import type { PlanVersionDiffSummary } from "./planVersionDiff";
import {
  buildDepartmentApprovalDiff,
  buildUnitApprovalDiff,
  type TeamApprovalDiffRow,
  type TeamApprovalDiffSummary,
  type TeamApprovalSubmissionMode,
} from "./teamApprovalDiff";
import {
  buildOrgConsolidationReport,
  TEAM_DISPLAY_STATUS_LABELS,
  type OrgConsolidationReport,
  type TeamConsolidationRow,
  type TeamDisplayStatus,
} from "./teamConsolidation";
import {
  getTeamSubmissionForApprovalScope,
  type TeamSubmissionRecord,
} from "./teamSubmissionStore";
import {
  getPackageSubmission,
  resolveBudgetPipelineStep,
  type BudgetPipelineStep,
  type PackageLevel,
  type PackageSubmissionRecord,
} from "./packageSubmissionStore";
import type { PositionRecord } from "../types";

export type BudgetWorkspaceLevel = PackageLevel | "department";

export type BudgetChangeTypeGroup = {
  typeLabel: string;
  changeCount: number;
  fotDeltaAnnual: number;
};

export type BudgetTeamRow = TeamConsolidationRow & {
  submission: TeamSubmissionRecord | null;
  draftFotAnnual: number;
  statusLabel: string;
};

export type BudgetPackage = {
  level: BudgetWorkspaceLevel;
  scopeLabel: string;
  department: string;
  unit: string | null;
  totals: TeamApprovalDiffSummary;
  teams: BudgetTeamRow[];
  changesByType: BudgetChangeTypeGroup[];
  journalRows: TeamApprovalDiffRow[];
  baselineLabel: string;
  draftLabel: string;
  submissionMode: TeamApprovalSubmissionMode;
  report: OrgConsolidationReport;
  packageSubmission: PackageSubmissionRecord | null;
  pipelineStep: BudgetPipelineStep;
  teamsSubmitted: number;
  teamsTotal: number;
  teamsAwaitingUnit: number;
};

function teamDraftFot(
  draftPositions: PositionRecord[],
  team: Pick<TeamConsolidationRow, "department" | "unit" | "team">,
): number {
  let sum = 0;
  for (const position of draftPositions) {
    if (
      position.department !== team.department ||
      position.unit !== team.unit ||
      position.team !== team.team ||
      position.status === "Closed"
    ) {
      continue;
    }
    sum += annualTotal(position);
  }
  return sum;
}

export function groupChangesByType(rows: TeamApprovalDiffRow[]): BudgetChangeTypeGroup[] {
  const map = new Map<string, { changeCount: number; fotDeltaAnnual: number }>();
  for (const row of rows) {
    const prev = map.get(row.typeLabel) ?? { changeCount: 0, fotDeltaAnnual: 0 };
    map.set(row.typeLabel, {
      changeCount: prev.changeCount + 1,
      fotDeltaAnnual: prev.fotDeltaAnnual + row.fotDeltaAnnual,
    });
  }
  return [...map.entries()]
    .map(([typeLabel, stats]) => ({ typeLabel, ...stats }))
    .sort(
      (a, b) =>
        Math.abs(b.fotDeltaAnnual) - Math.abs(a.fotDeltaAnnual) || b.changeCount - a.changeCount,
    );
}

function resolveSubmissionMode(
  workingDraft: PlanVersionMeta | null,
  primaryBudget: PlanVersionMeta | null,
): TeamApprovalSubmissionMode {
  if (workingDraft) return "quarterly";
  if (primaryBudget?.status === "DRAFT" && primaryBudget.versionNumber === 1) return "annual";
  return "quarterly";
}

function flattenTeams(report: OrgConsolidationReport, unit: string | null): TeamConsolidationRow[] {
  if (unit) {
    const group = report.units.find((item) => item.unit === unit);
    return group?.teams ?? [];
  }
  return report.units.flatMap((group) => group.teams);
}

export function buildBudgetPackage(input: {
  level: BudgetWorkspaceLevel;
  department: string;
  unit: string | null;
  scopeLabel: string;
  positions: PositionRecord[];
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
  workingDraft: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
  versionDiffSummary: PlanVersionDiffSummary;
  submissionMode?: TeamApprovalSubmissionMode;
}): BudgetPackage {
  const {
    level,
    department,
    unit,
    scopeLabel,
    positions,
    baselinePositions,
    draftPositions,
    workingDraft,
    primaryBudget,
    versionDiffSummary,
    submissionMode: submissionModeOverride,
  } = input;

  const submissionMode =
    submissionModeOverride ?? resolveSubmissionMode(workingDraft, primaryBudget);
  const planVersionId = workingDraft?.id ?? primaryBudget?.id ?? null;

  const report = buildOrgConsolidationReport(positions, {
    department,
    unit,
    team: null,
    planYear: primaryBudget?.planYear ?? workingDraft?.planYear ?? 2026,
    workingDraft,
    baselinePositions,
    draftPositions,
    submissionPlanVersionId: workingDraft?.id ?? primaryBudget?.id ?? null,
    primaryBudget,
  });

  const diff =
    level === "department"
      ? buildDepartmentApprovalDiff({
          baselinePositions,
          draftPositions,
          department,
          mode: submissionMode,
        })
      : buildUnitApprovalDiff({
          baselinePositions,
          draftPositions,
          department,
          unit: unit ?? report.units[0]?.unit ?? "",
          mode: submissionMode,
        });

  const teamRows = flattenTeams(report, unit).map((team) => {
    const submission =
      planVersionId != null
        ? getTeamSubmissionForApprovalScope(
            workingDraft?.id ?? null,
            primaryBudget,
            team.department,
            team.unit,
            team.team,
          )
        : null;
    return {
      ...team,
      submission,
      draftFotAnnual: teamDraftFot(draftPositions, team),
      statusLabel: TEAM_DISPLAY_STATUS_LABELS[team.displayStatus as TeamDisplayStatus] ?? team.displayStatus,
    };
  });

  const packageSubmission =
    planVersionId != null
      ? getPackageSubmission({
          planVersionId,
          level: level === "department" ? "department" : "unit",
          department,
          unit: level === "unit" ? unit : null,
        })
      : null;

  const teamsSubmitted = teamRows.filter((team) =>
    ["team_submitted", "unit_approved", "director_approved", "cb_review", "cb_submitted"].includes(
      team.displayStatus,
    ),
  ).length;
  const teamsAwaitingUnit = teamRows.filter((team) => team.displayStatus === "team_submitted").length;

  const baselineLabel = versionDiffSummary.baselineLabel || "Утверждённый год";
  const draftLabel =
    submissionMode === "quarterly" && workingDraft
      ? formatPlanVersionTitle(workingDraft)
      : primaryBudget
        ? formatPlanVersionTitle(primaryBudget)
        : "Черновик";

  return {
    level,
    scopeLabel,
    department,
    unit,
    totals: diff.summary,
    teams: teamRows,
    changesByType: groupChangesByType(diff.rows),
    journalRows: diff.rows,
    baselineLabel,
    draftLabel,
    submissionMode,
    report,
    packageSubmission,
    pipelineStep: resolveBudgetPipelineStep({
      level: level === "department" ? "department" : "unit",
      packageSubmission,
      teamsSubmitted,
      teamsTotal: teamRows.length,
      teamsAwaitingUnit,
      workingDraft,
      primaryBudget,
    }),
    teamsSubmitted,
    teamsTotal: teamRows.length,
    teamsAwaitingUnit,
  };
}
