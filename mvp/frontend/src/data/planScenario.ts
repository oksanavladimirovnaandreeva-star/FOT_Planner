import { clearFactStore } from "./factStore";

/** Сценарий MVP: план + факт, аналитика и план–факт на обзоре. */
export const PLAN_SCENARIO_INCLUDES_FACT = true;

/** Очищает факт в localStorage, если сценарий без план–факт. */
export function applyAnnualPlanningScenarioFactPolicy(): void {
  if (!PLAN_SCENARIO_INCLUDES_FACT) {
    clearFactStore();
  }
}
