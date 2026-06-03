import { Link } from "react-router-dom";
import { PLAN_VERSION_STATUS_LABELS } from "../data/planVersions";
import { formatPlanFactComparisonLine, type PlanFactBaseline } from "../data/planFactBaseline";

type PlanFactBaselineBannerProps = {
  baseline: PlanFactBaseline;
};

export function PlanFactBaselineBanner({ baseline }: PlanFactBaselineBannerProps) {
  return (
    <div className="plan-fact-baseline-banner" role="status">
      <p className="plan-fact-baseline-banner__main">{formatPlanFactComparisonLine(baseline)}</p>
      {baseline.differsFromSidebar ? (
        <p className="plan-fact-baseline-banner__note muted-line">
          В сайдбаре открыта «{baseline.sidebarVersion.label}» (
          {PLAN_VERSION_STATUS_LABELS[baseline.sidebarVersion.status]}) — для план–факт используется утверждённая
          версия. <Link to="/versions">Версии</Link>
        </p>
      ) : null}
    </div>
  );
}
