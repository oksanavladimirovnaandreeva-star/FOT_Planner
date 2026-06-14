import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import {
  collectPlanEventJournalRows,
  formatEventChangeLine,
  JOURNAL_EVENT_TYPE_OPTIONS,
  tableRowStatusClass,
} from "../../data/eventJournal";
import { mapPositionsWithAppliedEvents } from "../../data/planOperations";
import { formatIsoDateTime } from "../../data/formatDisplay";
import { departmentOptions, monthLabel, teamOptions, unitOptions } from "../../data/planningData";
import { useMvpApp } from "../../context/MvpAppContext";
import type { EventType } from "../../types";

export type PlanJournalOrgFilter = {
  department: string;
  unit: string;
  team: string;
};

export type PlanJournalPanelProps = {
  onOpenPosition: (positionId: string) => void;
  highlightPositionId?: string | null;
  filterPositionIds?: Set<string>;
  /** Полный журнал (вкладка) или компактная колонка рядом с таблицей позиций. */
  variant?: "full" | "sidebar";
  /** Синхронизация с фильтрами таблицы планирования (department/unit/team = All — без ограничения). */
  orgFilter?: PlanJournalOrgFilter;
};

export function PlanJournalPanel({
  onOpenPosition,
  highlightPositionId,
  filterPositionIds,
  variant = "full",
  orgFilter,
}: PlanJournalPanelProps) {
  const isSidebar = variant === "sidebar";
  const { positions, activePlan } = useMvpApp();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [unit, setUnit] = useState("All");
  const [team, setTeam] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState<EventType | "All">("All");

  const appliedPositions = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const allRows = useMemo(() => collectPlanEventJournalRows(appliedPositions), [appliedPositions]);

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (filterPositionIds && filterPositionIds.size > 0 && !filterPositionIds.has(row.positionId)) {
        return false;
      }
      if (highlightPositionId && row.positionId !== highlightPositionId) {
        return false;
      }
      if (orgFilter) {
        if (orgFilter.department !== "All" && row.department !== orgFilter.department) return false;
        if (orgFilter.unit !== "All" && row.unit !== orgFilter.unit) return false;
        if (orgFilter.team !== "All" && row.team !== orgFilter.team) return false;
      }
      if (department !== "All" && row.department !== department) return false;
      if (unit !== "All" && row.unit !== unit) return false;
      if (team !== "All" && row.team !== team) return false;
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
  }, [
    allRows,
    department,
    unit,
    team,
    monthFilter,
    typeFilter,
    query,
    filterPositionIds,
    highlightPositionId,
    orgFilter,
  ]);

  const displayRows = isSidebar ? filtered.slice(0, 40) : filtered;

  return (
    <div className={`plan-journal-panel${isSidebar ? " plan-journal-panel--sidebar" : ""}`}>
      {!isSidebar ? (
        <p className="plan-journal-panel__lead">
          Все события версии <strong>{activePlan.label}</strong>. Клик по строке откроет карточку позиции на вкладке
          «Позиции».
        </p>
      ) : (
        <div className="plan-journal-panel__sidebar-head">
          <h3 className="section-title">Журнал</h3>
          <p className="muted-line">По фильтрам таблицы · клик → позиция</p>
        </div>
      )}

      {!isSidebar ? (
      <div className="filters-grid filters-grid--toolbar">
        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Позиция, сотрудник, комментарий…"
          />
        </label>
        <label>
          Департамент
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setUnit("All");
              setTeam("All");
            }}
          >
            <option value="All">Все</option>
            {departmentOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Юнит
          <select
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setTeam("All");
            }}
            disabled={department === "All"}
          >
            <option value="All">Все</option>
            {department !== "All" &&
              unitOptions(department).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
          </select>
        </label>
        <label>
          Команда
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            disabled={department === "All" || unit === "All"}
          >
            <option value="All">Все</option>
            {department !== "All" &&
              unit !== "All" &&
              teamOptions(department, unit).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
          </select>
        </label>
        <label>
          Месяц
          <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
            <option value="All">Все</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index}>
                {monthLabel(index)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тип
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as EventType | "All")}
          >
            {JOURNAL_EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      ) : (
        <label className="search-field plan-journal-panel__sidebar-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск в журнале…"
          />
        </label>
      )}

      {highlightPositionId ? (
        <div className="plan-journal-panel__chip">
          Показаны события позиции {highlightPositionId}. Откройте строку, чтобы перейти к карточке.
        </div>
      ) : null}

      <div className="table-scroll plan-journal-panel__table-wrap">
        <table className={`simple-table plan-journal-table${isSidebar ? " plan-journal-table--sidebar" : ""}`}>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Позиция</th>
              {!isSidebar ? <th>Сотрудник</th> : null}
              <th>Событие</th>
              {!isSidebar ? <th>Было → стало</th> : null}
              <th>{isSidebar ? "Комм." : "Комментарий"}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={`${row.positionId}-${row.event.id}`}
                className={`plan-journal-table__row ${tableRowStatusClass(row.statusAfter)}`}
                onClick={() => onOpenPosition(row.positionId)}
              >
                <td>{formatIsoDateTime(row.createdAt)}</td>
                <td>
                  <strong>{row.positionId}</strong>
                  <div className="muted-line">{row.role}</div>
                </td>
                {!isSidebar ? <td>{row.employeeLine ?? "—"}</td> : null}
                <td>
                  <span className={`event-type-pill${isSidebar ? "" : " event-type-pill--lg"}`}>{row.typeLabel}</span>
                </td>
                {!isSidebar ? <td>{formatEventChangeLine(row.change)}</td> : null}
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
            ))}
          </tbody>
        </table>
      </div>
      {displayRows.length === 0 && <p className="muted-line">Нет событий по фильтру.</p>}
      <p className="muted-line plan-journal-panel__count">
        {isSidebar && filtered.length > displayRows.length
          ? `Показано ${displayRows.length} из ${filtered.length} (всего ${allRows.length})`
          : `Показано ${filtered.length} из ${allRows.length} событий`}
      </p>
    </div>
  );
}
