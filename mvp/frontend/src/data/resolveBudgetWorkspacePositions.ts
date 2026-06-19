import { applyEvents } from "./planningData";
import type { PlanVersionMeta } from "./planVersions";
import type { TeamApprovalSubmissionMode } from "./teamApprovalDiff";
import type { PositionRecord } from "../types";

export type ResolvedBudgetPositions = {
  submissionMode: TeamApprovalSubmissionMode;
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
};

/** Позиции для экрана «Мой бюджет»: квартал из versionDiff, годовой — из активного плана. */
export function resolveBudgetWorkspacePositions(input: {
  workingDraft: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
  versionDiffBaseline: PositionRecord[];
  versionDiffDraft: PositionRecord[];
  appliedPlanPositions: PositionRecord[];
}): ResolvedBudgetPositions {
  const {
    workingDraft,
    primaryBudget,
    versionDiffBaseline,
    versionDiffDraft,
    appliedPlanPositions,
  } = input;

  if (workingDraft?.baselineVersionId && versionDiffDraft.length > 0) {
    return {
      submissionMode: "quarterly",
      baselinePositions: versionDiffBaseline.map(applyEvents),
      draftPositions: versionDiffDraft.map(applyEvents),
    };
  }

  if (primaryBudget?.versionNumber === 1 && appliedPlanPositions.length > 0) {
    return {
      submissionMode: "annual",
      baselinePositions: appliedPlanPositions,
      draftPositions: appliedPlanPositions,
    };
  }

  return {
    submissionMode: workingDraft ? "quarterly" : "annual",
    baselinePositions: versionDiffBaseline.map(applyEvents),
    draftPositions: versionDiffDraft.map(applyEvents),
  };
}
