import { Trash2 } from "lucide-react";
import {
  isPlanEventMonthAllowed,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import { monthLabel, type IndexationBatchLog } from "../../data/planningData";
import { MONTHS } from "../../types";

type Props = {
  activeCount: number;
  idxPercent: number;
  idxMonth: number;
  correctionWindow: CorrectionWindowInfo;
  canEditWorkspace: boolean;
  indexationBatches: IndexationBatchLog[];
  onPercentChange: (value: number) => void;
  onMonthChange: (month: number) => void;
  onApply: () => void;
  onDeleteBatch: (batchId: string) => void;
};

const SCOPE_HINT = "По активным позициям в текущем срезе фильтра (глобально по плану).";

export function MassIndexationCompact({
  activeCount,
  idxPercent,
  idxMonth,
  correctionWindow,
  canEditWorkspace,
  indexationBatches,
  onPercentChange,
  onMonthChange,
  onApply,
  onDeleteBatch,
}: Props) {
  const monthBlocked = !isPlanEventMonthAllowed(idxMonth, correctionWindow);

  return (
    <div className="planning-indexation-compact" role="group" aria-label="Массовая индексация">
      <span
        className="planning-indexation-compact__label"
        data-hint={SCOPE_HINT}
      >
        Индексация
      </span>
      <span className="planning-indexation-compact__scope muted-line">{activeCount} поз.</span>
      <label className="planning-indexation-compact__percent">
        <input
          type="number"
          min={0}
          step={0.1}
          value={idxPercent}
          disabled={!canEditWorkspace}
          aria-label="Процент индексации"
          onChange={(event) => onPercentChange(Number(event.target.value))}
        />
        <span>%</span>
      </label>
      <select
        className="planning-indexation-compact__month"
        value={idxMonth}
        disabled={!canEditWorkspace}
        aria-label="Месяц индексации"
        onChange={(event) => onMonthChange(Number(event.target.value))}
      >
        {MONTHS.map((month, monthIndex) => {
          const blocked = !isPlanEventMonthAllowed(monthIndex, correctionWindow);
          return (
            <option key={month} value={monthIndex} disabled={blocked}>
              {month}
              {blocked ? " (закрыт)" : ""}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        className="primary-btn planning-indexation-compact__btn"
        disabled={!canEditWorkspace || monthBlocked}
        data-hint={monthBlocked ? planEventMonthBlockedMessage(correctionWindow) : undefined}
        onClick={onApply}
      >
        Применить
      </button>
      {indexationBatches.length > 0 ? (
        <details className="planning-indexation-compact__batches">
          <summary>Пакеты · {indexationBatches.length}</summary>
          <div className="table-scroll">
            <table className="simple-table planning-indexation-compact__table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Месяц</th>
                  <th>%</th>
                  <th>Поз.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {indexationBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{new Date(batch.createdAt).toLocaleString("ru-RU")}</td>
                    <td>{monthLabel(batch.month)}</td>
                    <td>+{batch.percent}%</td>
                    <td>{batch.affectedCount}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn danger"
                        disabled={!canEditWorkspace}
                        data-hint="Удалить факт индексации"
                        onClick={() => onDeleteBatch(batch.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
