import { monthLabel } from "../../data/planningData";
import type { IndexationBatchLog } from "../../data/planningData";

export function PlanIndexationBanner({ batches }: { batches: IndexationBatchLog[] }) {
  if (batches.length === 0) return null;
  const latest = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return (
    <div className="plan-policy-banner plan-policy-banner--indexation" role="status">
      <strong>Индексация в плане</strong>
      <span>
        Применён пакет +{latest.percent}% с {monthLabel(latest.month)} · {latest.affectedCount} поз.
        {batches.length > 1 ? ` · всего пакетов: ${batches.length}` : ""}
      </span>
    </div>
  );
}
