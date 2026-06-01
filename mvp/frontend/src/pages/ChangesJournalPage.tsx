import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  collectPlanEventJournalRows,
  formatEventChangeLine,
  JOURNAL_EVENT_TYPE_OPTIONS,
  tableRowStatusClass,
} from "../data/eventJournal";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import { departmentOptions, monthLabel, teamOptions, unitOptions } from "../data/planningData";
import { useMvpApp } from "../context/MvpAppContext";
import type { EventType } from "../types";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChangesJournalPage() {
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
  }, [allRows, department, unit, team, monthFilter, typeFilter, query]);

  return (
    <div className="content-page changes-journal-page">
      <header className="content-page__header">
        <div>
          <h1>Журнал изменений</h1>
          <p className="content-page__lead">
            {activePlan.label} · все события плана по позициям · {filtered.length} из {allRows.length}
          </p>
        </div>
        <Link className="secondary-btn" to="/planning">
          К планированию
        </Link>
      </header>

      <section className="card filters-card">
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
            Тип события
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
      </section>

      <section className="card">
        <div className="table-scroll">
          <table className="simple-table changes-journal-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Позиция</th>
                <th>Сотрудник</th>
                <th>Событие</th>
                <th>Месяц / изменение</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={`${row.positionId}-${row.event.id}`}
                  className={tableRowStatusClass(row.statusAfter)}
                  title={row.commentTooltip ?? undefined}
                >
                  <td className="changes-journal-table__when">{formatWhen(row.createdAt)}</td>
                  <td>
                    <strong>{row.positionId}</strong>
                    <div className="muted-line">{row.role}</div>
                    <div className="muted-line">
                      {row.department} / {row.unit}
                    </div>
                  </td>
                  <td>{row.employeeLine ?? "—"}</td>
                  <td>
                    <span className="event-type-pill">{row.typeLabel}</span>
                  </td>
                  <td>
                    <div>{formatEventChangeLine(row.change)}</div>
                  </td>
                  <td className="changes-journal-table__comment">
                    {row.comment ? (
                      <span title={row.comment}>{row.comment}</span>
                    ) : (
                      <span className="muted-line">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="muted-line">Нет событий по текущим фильтрам.</p>}
      </section>
    </div>
  );
}
