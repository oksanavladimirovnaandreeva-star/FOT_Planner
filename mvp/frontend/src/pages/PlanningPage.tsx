import { useEffect, useMemo, useState } from "react";
import { Calculator, Filter, Plus, Search, Trash2 } from "lucide-react";
import {
  annualTotal,
  applyEvents,
  departmentOptions,
  getLimitStatus,
  getMonthlyCR,
  initialPositions,
  limitUsagePercent,
  monthLabel,
  normalizeOrgPath,
  removeEvent,
  teamOptions,
  unitOptions,
  upsertEvent,
} from "../data/planningData";
import { PositionDrawer } from "../components/PositionDrawer";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord } from "../types";

interface IndexationBatchLog {
  id: string;
  month: number;
  percent: number;
  affectedCount: number;
  createdAt: string;
}

function nextPositionId(positions: PositionRecord[]): string {
  const maxNumeric = positions.reduce((max, position) => {
    const match = position.positionId.match(/^P(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `P${String(maxNumeric + 1).padStart(3, "0")}`;
}

function avgCR(record: PositionRecord): number {
  const crValues = record.monthlyBase.map((base, index) =>
    getMonthlyCR(base, record.monthlySpec[index], record.monthlyLevel[index]),
  );
  const valid = crValues.filter((value) => value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function transferFromLabel(record: PositionRecord): string | null {
  const latest = [...record.events]
    .filter((event) => event.type === "PLANNED_HIRE" && event.payload.transferFromPositionId)
    .sort((a, b) => b.createdOrder - a.createdOrder)[0];
  if (!latest) return null;
  return `${latest.payload.transferFromPositionId} -> ${monthLabel(latest.payload.month)}`;
}

export function PlanningPage() {
  const [positions, setPositions] = useState<PositionRecord[]>(() => initialPositions().map(applyEvents));
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [unit, setUnit] = useState("All");
  const [team, setTeam] = useState("All");
  const [active, setActive] = useState<PositionRecord | null>(null);
  const [idxPercent, setIdxPercent] = useState(5);
  const [idxMonth, setIdxMonth] = useState(8);
  const [recentlyIndexedIds, setRecentlyIndexedIds] = useState<string[]>([]);
  const [bulkFeedback, setBulkFeedback] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [indexationBatches, setIndexationBatches] = useState<IndexationBatchLog[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const keyId = activeSourceId ?? active.positionId;
    const refreshed = positions.find((position) => position.positionId === keyId) ?? null;
    if (!refreshed) {
      setActive(null);
      setActiveSourceId(null);
      return;
    }
    if (refreshed !== active) {
      setActive(refreshed);
      setActiveSourceId(refreshed.positionId);
    }
  }, [positions, active, activeSourceId]);

  const filtered = useMemo(() => {
    return positions.filter((position) => {
      const departmentMatch = department === "All" || position.department === department;
      const unitMatch = unit === "All" || position.unit === unit;
      const teamMatch = team === "All" || position.team === team;
      const queryText = `${position.positionId} ${position.role} ${position.employeeName ?? ""} ${position.unit} ${position.team}`.toLowerCase();
      return departmentMatch && unitMatch && teamMatch && queryText.includes(query.toLowerCase());
    });
  }, [positions, query, department, unit, team]);

  const occupied = filtered.filter((position) => position.status === "Occupied");
  const vacancies = filtered.filter((position) => position.status === "Vacancy");

  const kpi = useMemo(() => {
    const total = filtered.reduce((sum, position) => sum + annualTotal(position), 0);
    const occupiedCount = filtered.filter((position) => position.status === "Occupied").length;
    const vacancyCount = filtered.filter((position) => position.status === "Vacancy").length;
    const overLimitCount = filtered.filter((position) => getLimitStatus(position).label === "Over Limit").length;
    const avg = filtered.length
      ? filtered.reduce((sum, position) => sum + avgCR(position), 0) / filtered.length
      : 0;
    return { total, occupiedCount, vacancyCount, avgCr: avg, overLimitCount };
  }, [filtered]);

  const applyIndexationToFiltered = () => {
    const targetIds = filtered.filter((item) => item.status !== "Closed").map((item) => item.positionId);
    if (targetIds.length === 0) {
      setBulkFeedback({ tone: "warning", text: "Нет активных позиций для индексации по текущему фильтру." });
      return;
    }
    const confirmed = window.confirm(
      `Применить индексацию +${idxPercent}% с ${monthLabel(idxMonth)} для ${targetIds.length} позиций?`,
    );
    if (!confirmed) return;
    const batchId = crypto.randomUUID();

    setPositions((prev) =>
      prev.map((position) => {
        if (!targetIds.includes(position.positionId)) return position;
        const event: PlannedEvent = {
          id: crypto.randomUUID(),
          type: "INDEXATION",
          createdAt: new Date().toISOString(),
          createdOrder: position.events.length + 1,
          payload: {
            month: idxMonth,
            percent: idxPercent,
            indexationBatchId: batchId,
          },
        };
        return upsertEvent(position, event);
      }),
    );
    setIndexationBatches((prev) => [
      {
        id: batchId,
        month: idxMonth,
        percent: idxPercent,
        affectedCount: targetIds.length,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setRecentlyIndexedIds(targetIds);
    setBulkFeedback({
      tone: "success",
      text: `Индексация +${idxPercent}% с ${monthLabel(idxMonth)} применена к ${targetIds.length} позициям.`,
    });
    window.setTimeout(() => {
      setRecentlyIndexedIds([]);
    }, 4000);
  };

  const deleteIndexationBatch = (batchId: string) => {
    const confirmed = window.confirm("Удалить этот факт индексации и пересчитать значения?");
    if (!confirmed) return;

    setPositions((prev) =>
      prev.map((position) => {
        const filteredEvents = position.events.filter(
          (event) => !(event.type === "INDEXATION" && event.payload.indexationBatchId === batchId),
        );
        if (filteredEvents.length === position.events.length) return position;
        return applyEvents({ ...position, events: filteredEvents });
      }),
    );
    setIndexationBatches((prev) => prev.filter((item) => item.id !== batchId));
    setBulkFeedback({ tone: "success", text: "Факт индексации удален. Значения пересчитаны." });
  };

  const saveDraftPosition = (updated: PositionRecord, sourcePositionId?: string, forceCreate = false) => {
    const sourceId = sourcePositionId ?? updated.positionId;
    const recalculated = applyEvents(updated);
    setPositions((prev) => {
      const existsBySource = prev.some((position) => position.positionId === sourceId);
      if (existsBySource) {
        return prev.map((position) => (position.positionId === sourceId ? recalculated : position));
      }
      if (forceCreate) {
        return [...prev, recalculated];
      }
      return prev;
    });
    setActive(recalculated);
    setActiveSourceId(recalculated.positionId);
  };

  const addEvent = (positionId: string, event: PlannedEvent) => {
    setPositions((prev) => {
      let next = prev.map((position) => (position.positionId === positionId ? upsertEvent(position, event) : position));

      if (event.type === "TRANSFER" && event.payload.transferToPositionId) {
        next = next.map((position) => {
          if (position.positionId === event.payload.transferToPositionId) {
            const hireEvent: PlannedEvent = {
              id: crypto.randomUUID(),
              type: "PLANNED_HIRE",
              createdAt: new Date().toISOString(),
              createdOrder: position.events.length + 1,
              payload: {
                month: event.payload.month,
                employeeName: event.payload.employeeName ?? "Transferred Employee",
                employeeId: event.payload.employeeId ?? "E-TRANSFER",
                transferFromPositionId: positionId,
              },
            };
            return upsertEvent(position, hireEvent);
          }
          return position;
        });
      }

      return next;
    });
  };

  const deleteEvent = (positionId: string, eventId: string) => {
    setPositions((prev) =>
      prev.map((position) => (position.positionId === positionId ? removeEvent(position, eventId) : position)),
    );
  };

  const startAddVacancy = () => {
    const newId = nextPositionId(positions);
    const activeFromMonth = new Date().getMonth();
    const org = normalizeOrgPath(
      department === "All" ? "Engineering" : department,
      unit === "All" ? "" : unit,
      team === "All" ? "" : team,
    );
    const vacancy: PositionRecord = {
      positionId: newId,
      role: "Новая вакансия",
      department: org.department,
      unit: org.unit,
      team: org.team,
      slotType: "new",
      activeFromMonth,
      vacancySinceMonth: activeFromMonth,
      annualLimit: 2_000_000,
      previousDecemberBase: 0,
      employeeName: null,
      employeeId: null,
      status: "Vacancy",
      seedEmployeeName: null,
      seedEmployeeId: null,
      seedStatus: "Vacancy",
      seedVacancySinceMonth: activeFromMonth,
      monthlySpec: Array.from({ length: 12 }, () => "Engineering"),
      monthlyLevel: Array.from({ length: 12 }, () => "Middle"),
      monthlyBase: Array.from({ length: 12 }, () => 150_000),
      monthlyBonus: Array.from({ length: 12 }, () => 0),
      seedMonthlySpec: Array.from({ length: 12 }, () => "Engineering"),
      seedMonthlyLevel: Array.from({ length: 12 }, () => "Middle"),
      seedMonthlyBase: Array.from({ length: 12 }, () => 150_000),
      seedMonthlyBonus: Array.from({ length: 12 }, () => 0),
      events: [],
    };
    setActive(vacancy);
    setActiveSourceId(vacancy.positionId);
  };

  return (
    <div className="planning-page">
      <header className="page-header">
        <div>
          <h1>Planning & Headcount</h1>
          <p>Годовое планирование ФОТ по позициям (занято + вакансия)</p>
        </div>
        <button className="primary-btn" onClick={startAddVacancy}>
          <Plus size={14} /> Добавить вакансию
        </button>
      </header>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span>Total Planned Budget</span>
          <strong>{kpi.total.toLocaleString("ru-RU")} ₽</strong>
        </article>
        <article className="kpi-card">
          <span>Headcount</span>
          <strong>{kpi.occupiedCount}</strong>
        </article>
        <article className="kpi-card">
          <span>Vacancies</span>
          <strong>{kpi.vacancyCount}</strong>
        </article>
        <article className="kpi-card">
          <span>Average CR</span>
          <strong>{kpi.avgCr.toFixed(2)}</strong>
        </article>
        <article className="kpi-card">
          <span>Over Limit</span>
          <strong>{kpi.overLimitCount}</strong>
        </article>
      </section>

      <section className="toolbar-grid">
        <div className="toolbar-main">
          <label className="search-field">
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по позиции/сотруднику" />
          </label>
          <label>
            <Filter size={14} />
            <select
              value={department}
              onChange={(event) => {
                const nextDepartment = event.target.value;
                setDepartment(nextDepartment);
                if (nextDepartment === "All") {
                  setUnit("All");
                  setTeam("All");
                  return;
                }
                const units = unitOptions(nextDepartment);
                const nextUnit = units.includes(unit) ? unit : "All";
                setUnit(nextUnit);
                if (nextUnit === "All") {
                  setTeam("All");
                } else {
                  const teams = teamOptions(nextDepartment, nextUnit);
                  setTeam(teams.includes(team) ? team : "All");
                }
              }}
            >
              <option value="All">All Departments</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <select
              value={unit}
              onChange={(event) => {
                const nextUnit = event.target.value;
                setUnit(nextUnit);
                if (department === "All" || nextUnit === "All") {
                  setTeam("All");
                  return;
                }
                const teams = teamOptions(department, nextUnit);
                setTeam(teams.includes(team) ? team : "All");
              }}
            >
              <option value="All">All Units</option>
              {department !== "All" &&
                unitOptions(department).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
            </select>
          </label>
          <label>
            <select value={team} onChange={(event) => setTeam(event.target.value)}>
              <option value="All">All Teams</option>
              {department !== "All" && unit !== "All" &&
                teamOptions(department, unit).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="toolbar-indexation">
          <h3><Calculator size={14} /> Массовая индексация</h3>
          <label>
            Increase %
            <input type="number" value={idxPercent} onChange={(event) => setIdxPercent(Number(event.target.value))} />
          </label>
          <label>
            From month
            <select value={idxMonth} onChange={(event) => setIdxMonth(Number(event.target.value))}>
              {MONTHS.map((month, monthIndex) => (
                <option key={month} value={monthIndex}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-btn" onClick={applyIndexationToFiltered}>Apply</button>
        </div>
      </section>

      {bulkFeedback && (
        <section className={`bulk-feedback bulk-feedback--${bulkFeedback.tone}`}>
          {bulkFeedback.text}
        </section>
      )}

      {indexationBatches.length > 0 && (
        <section className="table-section">
          <h2>Факты массовой индексации</h2>
          <table>
            <thead>
              <tr>
                <th>Когда</th>
                <th>Месяц</th>
                <th>Процент</th>
                <th>Позиции</th>
                <th>Действие</th>
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
                    <button className="icon-btn danger" onClick={() => deleteIndexationBatch(batch.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="table-section">
        <h2>Объединенный обзор стула</h2>
        <table>
          <thead>
            <tr>
              <th>Position ID</th>
              <th>Role</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Org</th>
              <th>С месяца</th>
              <th>Limit</th>
              <th>Annual Total</th>
              <th>Avg CR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((position) => (
              <tr
                key={position.positionId}
                onClick={() => {
                  setActive(position);
                  setActiveSourceId(position.positionId);
                }}
                className={recentlyIndexedIds.includes(position.positionId) ? "row-updated" : undefined}
              >
                <td>{position.positionId}</td>
                <td>{position.role}</td>
                <td>{position.employeeName ? `${position.employeeName} (${position.employeeId ?? "-"})` : "-"}</td>
                <td>{position.status}</td>
                <td>{position.department} / {position.unit} / {position.team}</td>
                <td>{monthLabel(position.activeFromMonth)}</td>
                <td>
                  <span className={`limit-badge limit-badge--${getLimitStatus(position).tone}`}>
                    {getLimitStatus(position).label} ({limitUsagePercent(position).toFixed(1)}%)
                  </span>
                </td>
                <td>{annualTotal(position).toLocaleString("ru-RU")} ₽</td>
                <td>{avgCR(position).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-split">
        <article className="table-section">
          <h2>Занятые позиции</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Employee</th>
                <th>Кто пришел (transfer)</th>
                <th>Org</th>
                <th>Limit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {occupied.map((position) => (
                <tr
                  key={`occupied-${position.positionId}`}
                  onClick={() => {
                    setActive(position);
                    setActiveSourceId(position.positionId);
                  }}
                >
                  <td>{position.positionId}</td>
                  <td>{position.employeeName ? `${position.employeeName} (${position.employeeId ?? "-"})` : "-"}</td>
                  <td>{transferFromLabel(position) ?? "—"}</td>
                  <td>{position.department} / {position.unit} / {position.team}</td>
                  <td>
                    <span className={`limit-badge limit-badge--${getLimitStatus(position).tone}`}>
                      {getLimitStatus(position).label}
                    </span>
                  </td>
                  <td>{annualTotal(position).toLocaleString("ru-RU")} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="table-section">
          <h2>Вакансии</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Role</th>
                <th>Вакантна с</th>
                <th>Org</th>
                <th>Limit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((position) => (
                <tr
                  key={`vacancy-${position.positionId}`}
                  onClick={() => {
                    setActive(position);
                    setActiveSourceId(position.positionId);
                  }}
                >
                  <td>{position.positionId}</td>
                  <td>{position.role}</td>
                  <td>{position.vacancySinceMonth === null ? "—" : monthLabel(position.vacancySinceMonth)}</td>
                  <td>{position.department} / {position.unit} / {position.team}</td>
                  <td>
                    <span className={`limit-badge limit-badge--${getLimitStatus(position).tone}`}>
                      {getLimitStatus(position).label}
                    </span>
                  </td>
                  <td>{annualTotal(position).toLocaleString("ru-RU")} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <PositionDrawer
        open={Boolean(active)}
        record={active}
        onClose={() => {
          setActive(null);
          setActiveSourceId(null);
        }}
        onSaveDraft={saveDraftPosition}
        onAddEvent={addEvent}
        onDeleteEvent={deleteEvent}
        vacancyPositionOptions={positions.filter((item) => item.status === "Vacancy").map((item) => item.positionId)}
        isPersisted={Boolean(active && positions.some((item) => item.positionId === active.positionId))}
        departmentOptions={departmentOptions}
        unitOptionsForDepartment={unitOptions}
        teamOptionsForUnit={teamOptions}
      />
    </div>
  );
}

