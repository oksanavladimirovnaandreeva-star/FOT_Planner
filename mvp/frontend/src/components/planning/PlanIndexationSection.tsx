import { MassIndexationCompact } from "./MassIndexationCompact";
import { PlanIndexationBanner } from "./PlanIndexationBanner";
import type { CorrectionWindowInfo } from "../../data/planCorrectionWindow";
import type { IndexationBatchLog } from "../../data/planningData";

type Props = {
  batches: IndexationBatchLog[];
  isIndexationAdmin: boolean;
  canEditWorkspace: boolean;
  activeCount: number;
  idxPercent: number;
  idxMonth: number;
  correctionWindow: CorrectionWindowInfo;
  onPercentChange: (value: number) => void;
  onMonthChange: (month: number) => void;
  onApply: () => void;
  onDeleteBatch: (batchId: string) => void;
};

export function PlanIndexationSection({
  batches,
  isIndexationAdmin,
  canEditWorkspace,
  activeCount,
  idxPercent,
  idxMonth,
  correctionWindow,
  onPercentChange,
  onMonthChange,
  onApply,
  onDeleteBatch,
}: Props) {
  if (isIndexationAdmin) {
    return (
      <section className="plan-indexation-section" aria-label="Массовая индексация">
        <MassIndexationCompact
          activeCount={activeCount}
          idxPercent={idxPercent}
          idxMonth={idxMonth}
          correctionWindow={correctionWindow}
          canEditWorkspace={canEditWorkspace}
          indexationBatches={batches}
          onPercentChange={onPercentChange}
          onMonthChange={onMonthChange}
          onApply={onApply}
          onDeleteBatch={onDeleteBatch}
        />
        {!canEditWorkspace ? (
          <p className="plan-indexation-section__hint muted-line">
            Применить или удалить пакет можно в черновике бюджета или квартальном черновике (откройте «Версии» или
            «Квартальное планирование»).
          </p>
        ) : null}
      </section>
    );
  }

  if (batches.length === 0) return null;
  return <PlanIndexationBanner batches={batches} showPositionCount={false} />;
}
