export const WORKFLOW_HINT_IDS = ["dashboard-fact", "planning-lead"] as const;

export function resetWorkflowHints(): void {
  try {
    for (const id of WORKFLOW_HINT_IDS) {
      localStorage.removeItem(`mvp.hint.${id}`);
    }
  } catch {
    /* ignore */
  }
}
