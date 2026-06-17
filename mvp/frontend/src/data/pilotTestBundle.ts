import { DEMO_SEED_VERSION, DEMO_SEED_VERSION_KEY } from "./demoPlanSeed";
import { DEFAULT_ROLE_SCOPES, writeRoleScopes } from "./demoRoleScopeStore";
import { seedDemoFactFromPlan, type DemoFactSeedResult } from "./factStore";
import { countOrgNodes, readOrgTree, resetOrgTreeToSeed } from "./orgStructureStore";
import { applyEvents, initialPositions } from "./planningData";
import {
  initialPlanVersions,
  persistDataByVersion,
  persistVersions,
  type PlanVersionMeta,
} from "./planVersions";
import { saveLeadEditFrozen } from "./userAccess";
import { resetWorkflowHints } from "./workflowHints";
import type { PositionRecord } from "../types";

/** Версия пилотного набора — при смене можно предложить перезагрузку. */
export const PILOT_BUNDLE_VERSION = 1;
export const PILOT_BUNDLE_KEY = "fot_mvp_pilot_bundle_version";
const TEAM_SUBMISSIONS_KEY = "mvp.teamSubmissions";

export type PilotBundleResult = {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
  planVersionId: string;
  positionCount: number;
  orgTeamCount: number;
  fact: DemoFactSeedResult;
};

export function isPilotBundleApplied(): boolean {
  try {
    return localStorage.getItem(PILOT_BUNDLE_KEY) === String(PILOT_BUNDLE_VERSION);
  } catch {
    return false;
  }
}

/**
 * Полный пилотный набор для тестирования ролей на GitHub Pages / локально:
 * оргструктура, срезы ролей, 500+ позиций, утверждённый v1, демо-факт.
 */
export function buildPilotTestBundle(): PilotBundleResult {
  resetOrgTreeToSeed();
  const orgTeamCount = countOrgNodes(readOrgTree()).teamCount;

  writeRoleScopes(DEFAULT_ROLE_SCOPES);
  saveLeadEditFrozen(false);

  const versions = initialPlanVersions();
  const approvedV1: PlanVersionMeta = {
    ...versions[0],
    status: "APPROVED",
    publishedAt: new Date().toISOString(),
  };
  const positions = initialPositions().map(applyEvents);
  const dataByVersion: Record<string, PositionRecord[]> = {
    [approvedV1.id]: positions,
  };

  const fact = seedDemoFactFromPlan(positions);

  persistVersions([approvedV1]);
  persistDataByVersion(dataByVersion);
  localStorage.setItem("fot_mvp_plan_version", approvedV1.id);
  localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
  localStorage.setItem(PILOT_BUNDLE_KEY, String(PILOT_BUNDLE_VERSION));
  localStorage.removeItem(TEAM_SUBMISSIONS_KEY);
  resetWorkflowHints();

  return {
    versions: [approvedV1],
    dataByVersion,
    planVersionId: approvedV1.id,
    positionCount: positions.length,
    orgTeamCount,
    fact,
  };
}
