import { monthLabel } from "../../data/planningData";
import type { IndexationBatchLog } from "../../data/planningData";

export function PlanIndexationBanner({
  batches,
  showPositionCount = true,
}: {
  batches: IndexationBatchLog[];
  /** Для тимлидов — без счётчика позиций по всему плану (задаёт C&B). */
  showPositionCount?: boolean;
}) {
  if (batches.length === 0) return null;

  return (
    <div className="plan-policy-banner plan-policy-banner--indexation" role="status">
      <strong>Индексация в плане</strong>
      <ul className="plan-indexation-banner__list">
        {batches.map((batch) => (
          <li key={batch.id}>
            +{batch.percent}% с {monthLabel(batch.month)}
            {showPositionCount ? ` · ${batch.affectedCount} поз.` : ""} ·{" "}
            {new Date(batch.createdAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
