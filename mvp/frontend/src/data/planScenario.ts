import { clearFactStore } from "./factStore";

/**
 * Сценарий MVP: годовое планирование без план–факт.
 * Когда включим аналитику по факту — переключить в true и доработать импорт.
 */
export const PLAN_SCENARIO_INCLUDES_FACT = false;

/** Очищает факт в localStorage, если сценарий без план–факт. */
export function applyAnnualPlanningScenarioFactPolicy(): void {
  if (!PLAN_SCENARIO_INCLUDES_FACT) {
    clearFactStore();
  }
}
