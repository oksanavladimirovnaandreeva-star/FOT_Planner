import { useMemo, useState } from "react";
import { ExternalLink, MessageSquare } from "lucide-react";
import {
  collectPlanEventJournalRows,
  formatEventChangeLine,
  tableRowStatusClass,
} from "../../data/eventJournal";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { formatIsoDateTime } from "../../data/formatDisplay";
import { matchesOrgSlice, type OrgSliceSelection } from "../../data/orgSliceFilters";
import { useMvpApp } from "../../context/MvpAppContext";
import { journalEventKaitenEligible, kaitenTypeForEventType, type KaitenRequestType } from "../../data/kaitenExport";
import { canShowKaitenExport } from "../../data/userAccess";
import { KaitenExportModal } from "../KaitenExportModal";
import { PositionIdentityCell } from "./PositionIdentityCell";
import type { EventType } from "../../types";

export type PlanJournalPanelProps = {
  onOpenPosition: (positionId: string) => void;
  highlightPositionId?: string | null;
  filterPositionIds?: Set<string>;
  variant?: "full" | "sidebar";
  orgSlice: OrgSliceSelection;
  query: string;
  monthFilter: string;
  typeFilter: EventType | "All";
};

export function PlanJournalPanel({
  onOpenPosition,
  highlightPositionId,
  filterPositionIds,
  variant = "full",
  orgSlice,
  query,
  monthFilter,
  typeFilter,
}: PlanJournalPanelProps) {
  const isSidebar = variant === "sidebar";
  const { positions, activePlan, planVersionId, userRole, leadEditFrozen } = useMvpApp();
  const [kaitenTarget, setKaitenTarget] = useState<{
    positionId: string;
    eventId: string;
    initialType: KaitenRequestType;
  } | null>(null);

  const appliedPositions = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const positionsById = useMemo(
    () => new Map(appliedPositions.map((position) => [position.positionId, position])),
    [appliedPositions],
  );
  const allRows = useMemo(() => collectPlanEventJournalRows(appliedPositions), [appliedPositions]);

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (filterPositionIds && filterPositionIds.size > 0 && !filterPositionIds.has(row.positionId)) {
        return false;
      }
      if (highlightPositionId && row.positionId !== highlightPositionId) {
        return false;
      }
      if (
        !matchesOrgSlice(
          { department: row.department, unit: row.unit, team: row.team },
          orgSlice,
        )
      ) {
        return false;
      }
      if (monthFilter !== "All" && row.change.month !== Number(monthFilter)) return false;
      if (typeFilter !== "All" && row.event.type !== typeFilter) return false;
      const haystack = [
        row.positionId,
        row.role,
        row.employeeLine ?? "",
        row.typeLabel,
        row.comment ?? "",
        row.department,
        row.unit,
        row.team,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [allRows, orgSlice, monthFilter, typeFilter, query, filterPositionIds, highlightPositionId]);

  const displayRows = isSidebar ? filtered.slice(0, 40) : filtered;
  const kaitenPosition = kaitenTarget ? positionsById.get(kaitenTarget.positionId) ?? null : null;
  const kaitenEvent =
    kaitenPosition && kaitenTarget
      ? kaitenPosition.events.find((event) => event.id === kaitenTarget.eventId)
      : undefined;
  const canExportKaiten = canShowKaitenExport(userRole, leadEditFrozen);

  return (
    <div className={`plan-journal-panel${isSidebar ? " plan-journal-panel--sidebar" : ""}`}>
      {!isSidebar ? (
        <p className="plan-journal-panel__lead">
          События версии <strong>{activePlan.label}</strong> в текущем срезе. Клик по строке → карточка позиции.
        </p>
      ) : (
        <div className="plan-journal-panel__sidebar-head">
          <h3 className="section-title">Журнал</h3>
          <p className="muted-line">По срезу таблицы · клик → позиция</p>
        </div>
      )}

      {highlightPositionId ? (
        <div className="plan-journal-panel__chip">
          Показаны события позиции {highlightPositionId}.
        </div>
      ) : null}

      <div className="table-scroll plan-journal-panel__table-wrap">
        <table className={`simple-table plan-journal-table${isSidebar ? " plan-journal-table--sidebar" : ""}`}>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Позиция</th>
              {!isSidebar ? <th>Было → стало</th> : null}
              <th>Событие</th>
              {!isSidebar && canExportKaiten ? <th>Kaiten</th> : null}
              <th>{isSidebar ? "Комм." : "Комментарий"}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const position = positionsById.get(row.positionId);
              return (
                <tr
                  key={`${row.positionId}-${row.event.id}`}
                  className={`plan-journal-table__row ${tableRowStatusClass(row.statusAfter)}`}
                  onClick={() => onOpenPosition(row.positionId)}
                >
                  <td>{formatIsoDateTime(row.createdAt)}</td>
                  <td>
                    {position ? (
                      <PositionIdentityCell record={position} userRole={userRole} compact />
                    ) : (
                      <>
                        <strong>{row.positionId}</strong>
                        <div className="muted-line">{row.role}</div>
                      </>
                    )}
                  </td>
                  {!isSidebar ? <td>{formatEventChangeLine(row.change)}</td> : null}
                  <td>
                    <span className={`event-type-pill${isSidebar ? "" : " event-type-pill--lg"}`}>{row.typeLabel}</span>
                    {!isSidebar && row.employeeLine ? (
                      <div className="muted-line plan-journal-table__employee">{row.employeeLine}</div>
                    ) : null}
                  </td>
                  {!isSidebar && canExportKaiten ? (
                    <td>
                      {journalEventKaitenEligible(row.event.type) ? (
                        <button
                          type="button"
                          className="secondary-btn plan-journal-table__kaiten-btn"
                          title="Создать заявку в Kaiten"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            const initialType = kaitenTypeForEventType(row.event.type);
                            if (!initialType) return;
                            setKaitenTarget({
                              positionId: row.positionId,
                              eventId: row.event.id,
                              initialType,
                            });
                          }}
                        >
                          <ExternalLink size={12} aria-hidden />
                          Заявка
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  <td>
                    {row.comment ? (
                      <span className="plan-journal-table__comment">
                        <MessageSquare size={14} aria-hidden />
                        {row.comment}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {displayRows.length === 0 && <p className="muted-line">Нет событий по фильтру.</p>}
      <p className="muted-line plan-journal-panel__count">
        {isSidebar && filtered.length > displayRows.length
          ? `Показано ${displayRows.length} из ${filtered.length} (всего ${allRows.length})`
          : `Показано ${filtered.length} из ${allRows.length} событий`}
      </p>
      {kaitenPosition && kaitenEvent && kaitenTarget ? (
        <KaitenExportModal
          open
          onClose={() => setKaitenTarget(null)}
          position={kaitenPosition}
          planVersionId={planVersionId}
          planYear={activePlan.planYear}
          userRole={userRole}
          initialType={kaitenTarget.initialType}
          event={kaitenEvent}
        />
      ) : null}
    </div>
  );
}
