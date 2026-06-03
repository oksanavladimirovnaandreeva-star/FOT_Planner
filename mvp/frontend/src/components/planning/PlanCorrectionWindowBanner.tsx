import type { CorrectionWindowInfo } from "../../data/planCorrectionWindow";
import { planEventMonthBlockedMessage } from "../../data/planCorrectionWindow";

export function PlanCorrectionWindowBanner({ window }: { window: CorrectionWindowInfo }) {
  if (!window.enforced) return null;
  return (
    <div className="plan-policy-banner plan-policy-banner--quarter" role="status">
      <strong>Окно квартальной корректировки</strong>
      <span>{planEventMonthBlockedMessage(window)}</span>
    </div>
  );
}
