import {
  buildPilotPositions,
  DEMO_SEED_VERSION,
  DEMO_SEED_VERSION_KEY,
  PILOT_POSITION_TARGET,
} from "./demoPlanSeed";
import { DEFAULT_ROLE_SCOPES, writeRoleScopes } from "./demoRoleScopeStore";
import { legacyRoleScopeToAccessScope } from "./personaAccessScope";
import { clearFactStore, seedDemoFactFromPlan, type DemoFactSeedResult } from "./factStore";
import { PLAN_SCENARIO_INCLUDES_FACT } from "./planScenario";
import type { PositionRecord } from "../types";
import { countOrgNodes, readOrgTree, resetOrgTreeToSeed } from "./orgStructureStore";
import { applyEvents } from "./planningData";
import { initialPlanVersions, type PlanVersionMeta } from "./planVersions";
import { saveLeadEditFrozen } from "./userAccess";
import { resetWorkflowHints } from "./workflowHints";

/** Подтверждение загрузки тяжёлого пилота — явное предупреждение о подвисании. */
export function formatPilotHeavyLoadConfirm(): string {
  return [
    `Загрузить «Пилот (тяжёлый)» — ${PILOT_POSITION_TARGET}+ позиций, оргструктура и пресеты ролей?`,
    "",
    "Внимание: браузер может подвиснуть на 10–30 секунд (весь план пишется в localStorage).",
    "Для обычной работы достаточно демо-плана ~40 позиций.",
    "",
    "Текущий план в браузере будет заменён.",
  ].join("\n");
}
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

export type PilotPlanBundle = Omit<PilotBundleResult, "fact"> & {
  positions: PositionRecord[];
};

/**
 * План и оргструктура пилота без сида факта — факт лучше грузить async из контекста.
 */
export function buildPilotPlanBundle(): PilotPlanBundle {
  resetOrgTreeToSeed();
  const orgTeamCount = countOrgNodes(readOrgTree()).teamCount;

  writeRoleScopes({
    director: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.director),
    unit_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.unit_lead),
    team_lead: legacyRoleScopeToAccessScope(DEFAULT_ROLE_SCOPES.team_lead),
  });
  saveLeadEditFrozen(false);

  const versions = initialPlanVersions();
  const approvedV1: PlanVersionMeta = {
    ...versions[0],
    status: "APPROVED",
    publishedAt: new Date().toISOString(),
  };
  const positions = buildPilotPositions().map(applyEvents);
  const dataByVersion: Record<string, PositionRecord[]> = {
    [approvedV1.id]: positions,
  };

  return {
    versions: [approvedV1],
    dataByVersion,
    planVersionId: approvedV1.id,
    positionCount: positions.length,
    orgTeamCount,
    positions,
  };
}

/**
 * Полный пилотный набор (синхронно, для тестов).
 */
export function buildPilotTestBundle(): PilotBundleResult {
  const plan = buildPilotPlanBundle();
  let fact: DemoFactSeedResult;
  if (PLAN_SCENARIO_INCLUDES_FACT) {
    fact = seedDemoFactFromPlan(plan.positions);
  } else {
    clearFactStore();
    fact = { employeeCount: 0, assignmentCount: 0, throughMonth: 0 };
  }
  applyPilotBundleSideEffects();
  return {
    versions: plan.versions,
    dataByVersion: plan.dataByVersion,
    planVersionId: plan.planVersionId,
    positionCount: plan.positionCount,
    orgTeamCount: plan.orgTeamCount,
    fact,
  };
}

export function isPilotBundleApplied(): boolean {
  try {
    return localStorage.getItem(PILOT_BUNDLE_KEY) === String(PILOT_BUNDLE_VERSION);
  } catch {
    return false;
  }
}

/** Сброс вспомогательных ключей пилота (версии/план — через state контекста). */
export function applyPilotBundleSideEffects(): void {
  localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
  localStorage.setItem(PILOT_BUNDLE_KEY, String(PILOT_BUNDLE_VERSION));
  localStorage.removeItem(TEAM_SUBMISSIONS_KEY);
  resetWorkflowHints();
}

