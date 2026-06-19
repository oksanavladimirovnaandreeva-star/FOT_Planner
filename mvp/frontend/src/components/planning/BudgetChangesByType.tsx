import { useMemo, useState } from "react";
import type { BudgetChangeTypeGroup } from "../../data/buildBudgetPackage";
import type { TeamApprovalDiffRow, TeamApprovalSubmissionMode } from "../../data/teamApprovalDiff";
import { TeamLeadApprovalChangesList } from "./TeamLeadApprovalChangesList";
import type { PositionRecord } from "../../types";

type Props = {
  groups: BudgetChangeTypeGroup[];
  rows: TeamApprovalDiffRow[];
  positionsById: Map<string, PositionRecord>;
  versionLabel: string;
  planningLink: string;
  submissionMode: TeamApprovalSubmissionMode;
};

export function BudgetChangesByType({
  groups,
  rows,
  positionsById,
  versionLabel,
  planningLink,
  submissionMode,
}: Props) {
  const [activeType, setActiveType] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!activeType) return rows;
    return rows.filter((row) => row.typeLabel === activeType);
  }, [rows, activeType]);

  if (groups.length === 0) {
    return (
      <section className="card budget-changes-by-type">
        <h2 className="section-title">Изменения по типам</h2>
        <p className="muted-line">В этой версии правок нет.</p>
      </section>
    );
  }

  return (
    <>
      <section className="card budget-changes-by-type">
        <h2 className="section-title">Изменения по типам</h2>
        <p className="muted-line">Клик по типу — список событий с комментариями ниже.</p>
        <div className="budget-changes-by-type__grid">
          {groups.map((group) => {
            const active = activeType === group.typeLabel;
            return (
              <button
                key={group.typeLabel}
                type="button"
                className={`budget-changes-by-type__chip${active ? " budget-changes-by-type__chip--active" : ""}`}
                onClick={() => setActiveType(active ? null : group.typeLabel)}
              >
                <strong>{group.typeLabel}</strong>
                <span className="muted-line">{group.changeCount} соб.</span>
              </button>
            );
          })}
        </div>
      </section>
      <TeamLeadApprovalChangesList
        rows={filteredRows}
        canEdit={false}
        positionsById={positionsById}
        versionLabel={versionLabel}
        submissionMode={submissionMode}
        planningLink={planningLink}
      />
    </>
  );
}
