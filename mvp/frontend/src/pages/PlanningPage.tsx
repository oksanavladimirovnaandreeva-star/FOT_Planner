import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, Plus, Search, Trash2 } from "lucide-react";
import {
  annualTotal,
  applyEvents,
  decToDec,
  departmentOptions,
  defaultLimitFlagForSlotType,
  formatGrowthDelta,
  formatGrowthPct,
  getMonthlyCR,
  growthTone,
  hasCarryoverEvent,
  LIMIT_FLAG_LABELS,
  monthLabel,
  normalizeOrgPath,
  POSITION_STATUS_LABELS,
  removeEvent,
  teamOptions,
  unitOptions,
  upsertEvent,
} from "../data/planningData";
import { useMvpApp } from "../context/MvpAppContext";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { PositionDrawer } from "../components/PositionDrawer";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord, SalaryRangeBand } from "../types";

interface IndexationBatchLog {
  id: string;
  month: number;
  percent: number;
  affectedCount: number;
  createdAt: string;
}
type VacancyOption = {
  positionId: string;
  role: string;
  department: string;
  unit: string;
  team: string;
};
type EmployeeOption = {
  employeeId: string;
  employeeName: string;
  positionId: string;
};

function nextPositionId(positions: PositionRecord[]): string {
  const maxNumeric = positions.reduce((max, position) => {
    const match = position.positionId.match(/^P(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `P${String(maxNumeric + 1).padStart(3, "0")}`;
}

function nextEmployeeId(positions: PositionRecord[]): string {
  const collectIds = (value: string | null | undefined) => {
    if (!value) return;
    const match = value.match(/^E(\d+)$/i);
    if (match) return Number(match[1]);
    return undefined;
  };
  let maxNumeric = 0;
  for (const position of positions) {
    const fromPosition = collectIds(position.employeeId);
    if (fromPosition) maxNumeric = Math.max(maxNumeric, fromPosition);
    for (const event of position.events) {
      const fromPayload = collectIds(event.payload.employeeId);
      if (fromPayload) maxNumeric = Math.max(maxNumeric, fromPayload);
    }
  }
  return `E${String(maxNumeric + 1).padStart(3, "0")}`;
}

function avgCR(record: PositionRecord, bands: SalaryRangeBand[]): number {
  const crValues = record.monthlyBase.map((base, index) =>
    getMonthlyCR(base, record.monthlySpec[index], record.monthlyLevel[index], bands),
  );
  const valid = crValues.filter((value) => value > 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function isTemporaryReplacementVacancy(record: PositionRecord): boolean {
  return record.status === "Vacancy" && record.role.includes("(временная замена");
}

function crTone(value: number): "warn" | "ok" | "danger" {
  if (value < 0.8) return "warn";
  if (value > 1.2) return "danger";
  return "ok";
}

function needsCarryoverEvent(record: PositionRecord): boolean {
  return record.status === "Vacancy" && record.slotType === "carryover" && !hasCarryoverEvent(record);
}

function pluralVacancy(count: number): string {
  const abs = Math.abs(count) % 100;
  const mod = abs % 10;
  if (abs > 10 && abs < 20) return "вакансий";
  if (mod === 1) return "вакансия";
  if (mod >= 2 && mod <= 4) return "вакансии";
  return "вакансий";
}
function employeeCellLabel(record: PositionRecord): string {
  const maternityEvent = [...record.events]
    .filter((event) => event.type === "MANUAL_OVERRIDE" && event.payload.maternityMode === "SHARED_POSITION")
    .sort((a, b) => b.createdOrder - a.createdOrder)[0];
  if (!maternityEvent) {
    return record.employeeName ? `${record.employeeName} (${record.employeeId ?? "-"})` : "-";
  }
  const primaryName = maternityEvent.payload.maternityPrimaryEmployeeName || record.employeeName || "Сотрудник";
  const primaryId = maternityEvent.payload.maternityPrimaryEmployeeId || record.employeeId || "—";
  const replacementName = maternityEvent.payload.employeeName || "Замещение";
  const replacementId = maternityEvent.payload.employeeId || "—";
  return `${primaryName} (${primaryId}) [декрет] + ${replacementName} (${replacementId}) [замещение]`;
}

export function PlanningPage() {
  const { positions, setPositions, activePlan, viewMode, salaryBands } = useMvpApp();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [unit, setUnit] = useState("All");
  const [team, setTeam] = useState("All");
  const [limitFilter, setLimitFilter] = useState<"All" | "IN_LIMIT" | "OVER_LIMIT">("All");
  const [occupancyFilter, setOccupancyFilter] = useState<"All" | "Occupied" | "Vacancy">("All");
  const [active, setActive] = useState<PositionRecord | null>(null);
  const [idxPercent, setIdxPercent] = useState(5);
  const [idxMonth, setIdxMonth] = useState(8);
  const [recentlyIndexedIds, setRecentlyIndexedIds] = useState<string[]>([]);
  const [bulkFeedback, setBulkFeedback] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const bulkFeedbackTimer = useRef<number | null>(null);

  const showBulkFeedback = (tone: "success" | "warning", text: string) => {
    if (bulkFeedbackTimer.current !== null) {
      window.clearTimeout(bulkFeedbackTimer.current);
    }
    setBulkFeedback({ tone, text });
    bulkFeedbackTimer.current = window.setTimeout(() => {
      setBulkFeedback(null);
      bulkFeedbackTimer.current = null;
    }, 5000);
  };

  useEffect(
    () => () => {
      if (bulkFeedbackTimer.current !== null) {
        window.clearTimeout(bulkFeedbackTimer.current);
      }
    },
    [],
  );
  const [indexationBatches, setIndexationBatches] = useState<IndexationBatchLog[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const refreshedByActive = positions.find((position) => position.positionId === active.positionId) ?? null;
    const refreshedBySource =
      activeSourceId && activeSourceId !== active.positionId
        ? positions.find((position) => position.positionId === activeSourceId) ?? null
        : null;
    const refreshed = refreshedByActive ?? refreshedBySource;
    if (!refreshed) {
      const isDraftRecord = !positions.some((position) => position.positionId === active.positionId);
      if (isDraftRecord) return;
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
      const limitMatch = limitFilter === "All" || position.limitFlag === limitFilter;
      const occupancyMatch = occupancyFilter === "All" || position.status === occupancyFilter;
      const queryText = `${position.positionId} ${position.role} ${position.employeeName ?? ""} ${position.unit} ${position.team}`.toLowerCase();
      return departmentMatch && unitMatch && teamMatch && limitMatch && occupancyMatch && queryText.includes(query.toLowerCase());
    });
  }, [positions, query, department, unit, team, limitFilter, occupancyFilter]);

  const tableCounts = useMemo(
    () => ({
      total: filtered.length,
      occupied: filtered.filter((position) => position.status === "Occupied").length,
      vacancy: filtered.filter((position) => position.status === "Vacancy").length,
    }),
    [filtered],
  );


  const carryoverPendingCount = useMemo(
    () =>
      filtered.filter(
        (position) =>
          position.status === "Vacancy" &&
          position.slotType === "carryover" &&
          !hasCarryoverEvent(position),
      ).length,
    [filtered],
  );

  const applyIndexationToFiltered = () => {
    const targetIds = filtered.filter((item) => item.status !== "Closed").map((item) => item.positionId);
    if (targetIds.length === 0) {
      showBulkFeedback("warning", "Нет активных позиций для индексации по текущему фильтру.");
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
    showBulkFeedback(
      "success",
      `Индексация +${idxPercent}% с ${monthLabel(idxMonth)} применена к ${targetIds.length} позициям.`,
    );
    window.setTimeout(() => {
      setRecentlyIndexedIds([]);
    }, 4000);
  };

  const applyCarryoverBatch = () => {
    const targets = filtered.filter(
      (position) =>
        position.status === "Vacancy" &&
        position.slotType === "carryover" &&
        !hasCarryoverEvent(position),
    );
    if (targets.length === 0) {
      showBulkFeedback(
        "warning",
        "Нет вакансий переноса без события в текущем фильтре. Сбросьте фильтры или откройте строку вакансии в drawer.",
      );
      return;
    }
    const ids = targets.map((item) => item.positionId).join(", ");
    const confirmed = window.confirm(
      `Зафиксировать перенос бюджета с января для ${targets.length} ${pluralVacancy(targets.length)} (${ids})?\n\nОклад вакансии не обнуляется — в плане остаётся бюджет прошлого года.`,
    );
    if (!confirmed) return;
    setPositions((prev) =>
      prev.map((position) => {
        if (!targets.some((item) => item.positionId === position.positionId)) return position;
        const event: PlannedEvent = {
          id: crypto.randomUUID(),
          type: "POSITION_CARRYOVER",
          createdAt: new Date().toISOString(),
          createdOrder: position.events.length + 1,
          payload: { month: 0 },
        };
        return upsertEvent(position, event);
      }),
    );
    showBulkFeedback(
      "success",
      `Перенос бюджета зафиксирован: ${targets.length} ${pluralVacancy(targets.length)} (${ids}). Кнопка станет неактивной — повторять не нужно.`,
    );
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
    showBulkFeedback("success", "Факт индексации удален. Значения пересчитаны.");
  };

  const applyExistingIndexationBatches = (record: PositionRecord): PositionRecord => {
    if (indexationBatches.length === 0) return record;
    const existingBatchIds = new Set(
      record.events
        .filter((event) => event.type === "INDEXATION" && typeof event.payload.indexationBatchId === "string")
        .map((event) => event.payload.indexationBatchId as string),
    );
    const missingBatches = [...indexationBatches]
      .filter((batch) => !existingBatchIds.has(batch.id))
      .sort((a, b) => a.month - b.month || a.createdAt.localeCompare(b.createdAt));
    if (missingBatches.length === 0) return record;
    const extraEvents: PlannedEvent[] = missingBatches.map((batch, index) => ({
      id: crypto.randomUUID(),
      type: "INDEXATION",
      createdAt: batch.createdAt,
      createdOrder: record.events.length + index + 1,
      payload: {
        month: batch.month,
        percent: batch.percent,
        indexationBatchId: batch.id,
      },
    }));
    return applyEvents({ ...record, events: [...record.events, ...extraEvents] });
  };

  const saveDraftPosition = (updated: PositionRecord, sourcePositionId?: string, forceCreate = false) => {
    const sourceId = sourcePositionId ?? updated.positionId;
    const recalculated = applyEvents(updated);
    const withIndexation = forceCreate ? applyExistingIndexationBatches(recalculated) : recalculated;
    setPositions((prev) => {
      const existsBySource = prev.some((position) => position.positionId === sourceId);
      if (existsBySource) {
        return prev.map((position) => (position.positionId === sourceId ? recalculated : position));
      }
      if (forceCreate) {
        return [...prev, withIndexation];
      }
      return prev;
    });
    setActive(withIndexation);
    setActiveSourceId(withIndexation.positionId);
  };

  const addEvent = (positionId: string, event: PlannedEvent) => {
    setPositions((prev) => {
      let next = prev.map((position) => (position.positionId === positionId ? upsertEvent(position, event) : position));
      const createInterDepartmentTarget = () => {
        const source = prev.find((position) => position.positionId === positionId);
        if (!source) return;
        const targetDepartment = event.payload.targetDepartment;
        if (!targetDepartment) return;
        const targetUnitCandidates = unitOptions(targetDepartment);
        const targetUnit = event.payload.targetUnit && targetUnitCandidates.includes(event.payload.targetUnit)
          ? event.payload.targetUnit
          : targetUnitCandidates[0] || "";
        const targetTeamCandidates = teamOptions(targetDepartment, targetUnit);
        const targetTeam = event.payload.targetTeam && targetTeamCandidates.includes(event.payload.targetTeam)
          ? event.payload.targetTeam
          : targetTeamCandidates[0] || "";
        const transferMonth = Math.max(0, Math.min(11, event.payload.month));
        const base = typeof event.payload.base === "number" ? event.payload.base : source.monthlyBase[transferMonth] || 0;
        const bonus = typeof event.payload.bonus === "number" ? event.payload.bonus : source.monthlyBonus[transferMonth] || 0;
        const specialization = event.payload.specialization || source.monthlySpec[transferMonth] || source.seedMonthlySpec[transferMonth];
        const level = event.payload.level || source.monthlyLevel[transferMonth] || source.seedMonthlyLevel[transferMonth];
        const seedBase = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : base));
        const seedBonus = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : bonus));
        const seedSpec = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? source.seedMonthlySpec[idx] : specialization));
        const seedLevel = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? source.seedMonthlyLevel[idx] : level));
        const newPositionId = nextPositionId(next);
        const targetPosition: PositionRecord = {
          positionId: newPositionId,
          role: source.role,
          department: targetDepartment,
          unit: targetUnit,
          team: targetTeam,
          slotType: "new",
          activeFromMonth: transferMonth,
          vacancySinceMonth: transferMonth,
          limitFlag: defaultLimitFlagForSlotType("new"),
          previousDecemberBase: 0,
          employeeName: null,
          employeeId: null,
          status: "Vacancy",
          seedEmployeeName: null,
          seedEmployeeId: null,
          seedStatus: "Vacancy",
          seedVacancySinceMonth: transferMonth,
          monthlySpec: [...seedSpec],
          monthlyLevel: [...seedLevel],
          monthlyBase: [...seedBase],
          monthlyBonus: [...seedBonus],
          seedMonthlySpec: seedSpec,
          seedMonthlyLevel: seedLevel,
          seedMonthlyBase: seedBase,
          seedMonthlyBonus: seedBonus,
          events: [],
        };
        const targetWithIndexation = applyExistingIndexationBatches(targetPosition);
        const hireEvent: PlannedEvent = {
          id: crypto.randomUUID(),
          type: "PLANNED_HIRE",
          createdAt: new Date().toISOString(),
          createdOrder: targetWithIndexation.events.length + 1,
          payload: {
            month: transferMonth,
            employeeName: event.payload.employeeName ?? "Transferred Employee",
            employeeId: event.payload.employeeId ?? "E-TRANSFER",
            transferFromPositionId: positionId,
            base,
            bonus,
            specialization,
            level,
          },
        };
        next = [...next, upsertEvent(targetWithIndexation, hireEvent)];
      };

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
                base: event.payload.base,
                bonus: event.payload.bonus,
                specialization: event.payload.specialization,
                level: event.payload.level,
              },
            };
            return upsertEvent(position, hireEvent);
          }
          return position;
        });
      } else if (event.type === "TRANSFER" && event.payload.transferKind === "INTER_DEPARTMENT") {
        createInterDepartmentTarget();
      }

      return next;
    });
  };

  const deleteEvent = (positionId: string, eventId: string) => {
    setPositions((prev) =>
      prev.map((position) => (position.positionId === positionId ? removeEvent(position, eventId) : position)),
    );
  };
  const deleteVacancy = (positionId: string) => {
    const isPersistedVacancy = positions.some((position) => position.positionId === positionId && position.status === "Vacancy");
    const confirmText = isPersistedVacancy
      ? `Удалить вакансию ${positionId} из плана? Это действие нельзя отменить.`
      : "Удалить черновик вакансии?";
    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;
    setPositions((prev) => prev.filter((position) => position.positionId !== positionId));
    setActive(null);
    setActiveSourceId(null);
    showBulkFeedback("success", isPersistedVacancy ? `Вакансия ${positionId} удалена.` : "Черновик вакансии удален.");
  };
  const vacancyOptions: VacancyOption[] = positions
    .filter((item) => item.status === "Vacancy")
    .map((item) => ({
      positionId: item.positionId,
      role: item.role,
      department: item.department,
      unit: item.unit,
      team: item.team,
    }));
  const employeeOptions: EmployeeOption[] = positions
    .filter((item) => item.status === "Occupied" && item.employeeId && item.employeeName)
    .map((item) => ({
      employeeId: item.employeeId as string,
      employeeName: item.employeeName as string,
      positionId: item.positionId,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ru"));

  const startAddVacancy = () => {
    const newId = nextPositionId(positions);
    const activeFromMonth = new Date().getMonth();
    const org = normalizeOrgPath(
      department === "All" ? "Engineering" : department,
      unit === "All" ? "" : unit,
      team === "All" ? "" : team,
    );
    const vacancy: PositionRecord = applyExistingIndexationBatches({
      positionId: newId,
      role: "Новая вакансия",
      department: org.department,
      unit: org.unit,
      team: org.team,
      slotType: "new",
      limitFlag: defaultLimitFlagForSlotType("new"),
      activeFromMonth,
      vacancySinceMonth: activeFromMonth,
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
    });
    setActive(vacancy);
    setActiveSourceId(vacancy.positionId);
  };

  return (
    <div className="content-page planning-page">
      <header className="page-header">
        <div>
          <h1>Планирование и численность</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · {tableCounts.total} поз. (
            {tableCounts.occupied} занято, {tableCounts.vacancy} вакансии)
          </p>
        </div>
        <div className="page-header__actions">
          <Link className="secondary-btn" to="/salary-ranges">
            Диапазоны
          </Link>
          <button className="primary-btn" onClick={startAddVacancy}>
            <Plus size={14} /> Добавить вакансию
          </button>
        </div>
      </header>

      <AnalyticsSummaryStrip
        positions={filtered}
        viewMode={viewMode}
        salaryBands={salaryBands}
        showYtd={false}
        showFactYtd={false}
        showAvgCr={false}
        singleRow
      />

      <section className="card filters-card">
        <div className="filters-grid filters-grid--toolbar">
          <label className="search-field">
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Роль, позиция или сотрудник…" />
          </label>
          <label>
            Департамент
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
                const nextUnit = event.target.value;
                setUnit(nextUnit);
                if (department === "All" || nextUnit === "All") {
                  setTeam("All");
                  return;
                }
                const teams = teamOptions(department, nextUnit);
                setTeam(teams.includes(team) ? team : "All");
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
            <select value={team} onChange={(event) => setTeam(event.target.value)} disabled={department === "All" || unit === "All"}>
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
            Лимит
            <select value={limitFilter} onChange={(event) => setLimitFilter(event.target.value as "All" | "IN_LIMIT" | "OVER_LIMIT")}>
              <option value="All">Все</option>
              <option value="IN_LIMIT">{LIMIT_FLAG_LABELS.IN_LIMIT}</option>
              <option value="OVER_LIMIT">{LIMIT_FLAG_LABELS.OVER_LIMIT}</option>
            </select>
          </label>
          <label>
            Статус
            <select value={occupancyFilter} onChange={(event) => setOccupancyFilter(event.target.value as "All" | "Occupied" | "Vacancy")}>
              <option value="All">Все</option>
              <option value="Occupied">Позиция</option>
              <option value="Vacancy">Вакансия</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card mass-ops-card">
        <h2 className="section-title">
          <Calculator size={16} /> Массовые операции
        </h2>
        <div className="mass-ops-grid">
          <article className="mass-ops-panel mass-ops-panel--carryover">
            <h3 className="subsection-title">Перенос бюджета вакансий</h3>
            <p className="muted-line">
              Для вакансий «перенос с прошлого года» — зафиксировать событие, чтобы оклад не обнулился в плане.
            </p>
            {carryoverPendingCount > 0 ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={applyCarryoverBatch}
                title="Для вакансий «перенос с прошлого года» без события"
              >
                Зафиксировать ({carryoverPendingCount})
              </button>
            ) : (
              <p className="mass-ops-panel__ok">В текущем фильтре все вакансии переноса уже обработаны.</p>
            )}
          </article>
          <article className="mass-ops-panel mass-ops-panel--indexation">
            <h3 className="subsection-title">Индексация по фильтру</h3>
            <div className="mass-ops-indexation">
              <label>
                Процент
                <input type="number" value={idxPercent} onChange={(event) => setIdxPercent(Number(event.target.value))} />
              </label>
              <label>
                С месяца
                <select value={idxMonth} onChange={(event) => setIdxMonth(Number(event.target.value))}>
                  {MONTHS.map((month, monthIndex) => (
                    <option key={month} value={monthIndex}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="primary-btn" onClick={applyIndexationToFiltered}>
                Применить индексацию
              </button>
            </div>
          </article>
        </div>
      </section>

      {bulkFeedback && (
        <section className={`bulk-feedback bulk-feedback--${bulkFeedback.tone}`}>
          {bulkFeedback.text}
        </section>
      )}

      {indexationBatches.length > 0 && (
        <section className="card">
          <h2 className="section-title">Факты массовой индексации</h2>
          <table className="simple-table">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Месяц</th>
                <th>Процент</th>
                <th>Позиции</th>
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
                    <button type="button" className="icon-btn danger" onClick={() => deleteIndexationBatch(batch.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Позиции · {tableCounts.total}</h2>
        <table className="simple-table positions-table positions-table--compact">
          <thead>
            <tr>
              <th>Роль / ID</th>
              <th>Сотрудник / орг.</th>
              <th>Спец. и уровень</th>
              <th>Дек → дек</th>
              <th>ФОТ год</th>
              <th>CR</th>
              <th>Лимит</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((position) => {
              const cr = avgCR(position, salaryBands);
              const decDelta = position.monthlyBase[11] - position.previousDecemberBase;
              const decPct = decToDec(position.previousDecemberBase, position.monthlyBase[11]);
              return (
                <tr
                  key={position.positionId}
                  onClick={() => {
                    setActive(position);
                    setActiveSourceId(position.positionId);
                  }}
                  className={`positions-table__row${recentlyIndexedIds.includes(position.positionId) ? " row-updated" : ""}`}
                >
                  <td>
                    <div className="positions-table__role">{position.role}</div>
                    <div className="muted-line">
                      {position.positionId} · с {monthLabel(position.activeFromMonth)} ·{" "}
                      {POSITION_STATUS_LABELS[position.status]}
                    </div>
                    {isTemporaryReplacementVacancy(position) && <span className="scenario-badge">Временная замена</span>}
                    {needsCarryoverEvent(position) && (
                      <span className="scenario-badge scenario-badge--warn">Нет события переноса</span>
                    )}
                  </td>
                  <td>
                    <div>{employeeCellLabel(position)}</div>
                    <div className="muted-line">
                      {position.department} / {position.unit} / {position.team}
                    </div>
                  </td>
                  <td>
                    {position.monthlySpec[11]}
                    <div className="muted-line">{position.monthlyLevel[11]}</div>
                  </td>
                  <td className={`dec-cell--${growthTone(decDelta)}`}>
                    <div className="positions-table__dec-range">
                      {position.previousDecemberBase.toLocaleString("ru-RU")} →{" "}
                      {position.monthlyBase[11].toLocaleString("ru-RU")} ₽
                    </div>
                    <div>
                      {formatGrowthDelta(decDelta)} · {formatGrowthPct(decPct)}
                    </div>
                  </td>
                  <td>{annualTotal(position).toLocaleString("ru-RU")} ₽</td>
                  <td>
                    <span className={`cr-value cr-value--${crTone(cr)}`}>{cr > 0 ? cr.toFixed(2) : "—"}</span>
                  </td>
                  <td>
                    <span className={`limit-flag-badge limit-flag-badge--${position.limitFlag}`}>
                      {LIMIT_FLAG_LABELS[position.limitFlag]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="muted-line">Нет позиций по текущим фильтрам.</p>}
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
        onDeletePosition={deleteVacancy}
        vacancyOptions={vacancyOptions}
        employeeOptions={employeeOptions}
        suggestedNewEmployeeId={nextEmployeeId(positions)}
        isPersisted={Boolean(active && positions.some((item) => item.positionId === active.positionId))}
        departmentOptions={departmentOptions}
        unitOptionsForDepartment={unitOptions}
        teamOptionsForUnit={teamOptions}
      />
    </div>
  );
}

