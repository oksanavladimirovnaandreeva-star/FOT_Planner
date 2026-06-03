import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calculator, Plus, Search, Trash2 } from "lucide-react";
import { PlanApprovalPanel } from "../components/planning/PlanApprovalPanel";
import { PlanJournalPanel } from "../components/planning/PlanJournalPanel";
import { PlanMonthMatrixPanel } from "../components/planning/PlanMonthMatrixPanel";
import {
  annualTotal,
  applyEvents,
  applyExistingIndexationBatches,
  collectIndexationBatchesFromPositions,
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
  teamOptions,
  unitOptions,
  upsertEvent,
} from "../data/planningData";
import { positionTableRowClass } from "../data/eventJournal";
import {
  applyPlanTransferFromDrawerEvent,
  applyTerminationToVacancy,
  mapPositionsWithAppliedEvents,
  mergePlanPositionsWithDraft,
  removePlanEvent,
} from "../data/planOperations";
import { useMvpApp } from "../context/MvpAppContext";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { PositionDrawer } from "../components/PositionDrawer";
import { MONTHS } from "../types";
import type { PlannedEvent, PositionRecord, SalaryRangeBand } from "../types";

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

function employeeCellLabel(record: PositionRecord): string {
  const maternityEvent = [...record.events]
    .filter((event) => event.type === "MANUAL_OVERRIDE" && event.payload.maternityMode === "SHARED_POSITION")
    .sort((a, b) => b.createdOrder - a.createdOrder)[0];
  if (!maternityEvent) {
    return record.employeeName ? `${record.employeeName} (${record.employeeId ?? "-"})` : "-";
  }
  const primaryName = maternityEvent.payload.maternityPrimaryEmployeeName || record.employeeName || "Сотрудник";
  const primaryId = maternityEvent.payload.maternityPrimaryEmployeeId || record.employeeId || "—";
  const replacementLabel =
    maternityEvent.payload.maternityReplacementKind === "VACANCY"
      ? "Вакансия (замещение)"
      : `${maternityEvent.payload.employeeName || "Замещение"} (${maternityEvent.payload.employeeId || "—"})`;
  return `${primaryName} (${primaryId}) [декрет] + ${replacementLabel} [замещение]`;
}

type WorkspaceTab = "positions" | "matrix" | "journal" | "approval";

function parseWorkspaceTab(value: string | null): WorkspaceTab {
  if (value === "matrix" || value === "journal" || value === "approval") return value;
  return "positions";
}

export function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceTab = parseWorkspaceTab(searchParams.get("tab"));
  const {
    positions,
    setPositions,
    activePlan,
    viewMode,
    salaryBands,
    canEditPlan,
    workingDraft,
    roleScopeHint,
  } = useMvpApp();

  const blockEdit = () => {
    window.alert("Правки только в рабочем черновике. Создайте черновик на странице «Версии».");
  };
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [unit, setUnit] = useState("All");
  const [team, setTeam] = useState("All");
  const [limitFilter, setLimitFilter] = useState<"All" | "IN_LIMIT" | "OVER_LIMIT">("All");
  const [occupancyFilter, setOccupancyFilter] = useState<"All" | "Occupied" | "Vacancy" | "Closed">("All");
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
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addSlotKind, setAddSlotKind] = useState<"vacancy" | "occupied">("vacancy");
  const [addSlotEmployeeId, setAddSlotEmployeeId] = useState("");
  const [addSlotEmployeeName, setAddSlotEmployeeName] = useState("");

  const indexationBatches = useMemo(() => collectIndexationBatchesFromPositions(positions), [positions]);
  const appliedPositions = useMemo(() => mapPositionsWithAppliedEvents(positions), [positions]);
  const planPositionsForDrawer = useMemo(
    () => mergePlanPositionsWithDraft(positions, active),
    [positions, active],
  );

  const journalDiffPositionIds = useMemo(() => {
    const raw = searchParams.get("positions");
    if (!raw || searchParams.get("diff") !== "1") return undefined;
    return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
  }, [searchParams]);

  const journalHighlightPositionId = searchParams.get("position");

  const setWorkspaceTab = (tab: WorkspaceTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    if (tab !== "journal") {
      next.delete("position");
      next.delete("positions");
      next.delete("diff");
    }
    setSearchParams(next, { replace: true });
  };

  const openPositionFromJournal = (positionId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "positions");
    next.set("position", positionId);
    next.delete("positions");
    next.delete("diff");
    setSearchParams(next);
  };

  const openPositionInDrawer = (positionId: string) => {
    const raw = positions.find((item) => item.positionId === positionId);
    if (!raw) return;
    const row = mapPositionsWithAppliedEvents([raw])[0];
    setActive(row);
    setActiveSourceId(positionId);
  };

  useEffect(() => {
    const positionId = searchParams.get("position");
    if (!positionId) return;
    openPositionInDrawer(positionId);
    if (workspaceTab === "journal" || workspaceTab === "approval") return;
    const next = new URLSearchParams(searchParams);
    next.delete("position");
    setSearchParams(next, { replace: true });
  }, [searchParams, positions, setSearchParams, workspaceTab]);

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
    return appliedPositions.filter((position) => {
      const departmentMatch = department === "All" || position.department === department;
      const unitMatch = unit === "All" || position.unit === unit;
      const teamMatch = team === "All" || position.team === team;
      const limitMatch = limitFilter === "All" || position.limitFlag === limitFilter;
      const occupancyMatch = occupancyFilter === "All" || position.status === occupancyFilter;
      const queryText = `${position.positionId} ${position.role} ${position.employeeName ?? ""} ${position.unit} ${position.team}`.toLowerCase();
      return departmentMatch && unitMatch && teamMatch && limitMatch && occupancyMatch && queryText.includes(query.toLowerCase());
    });
  }, [appliedPositions, query, department, unit, team, limitFilter, occupancyFilter]);

  const tableCounts = useMemo(() => {
    const open = filtered.filter((position) => position.status !== "Closed");
    return {
      total: open.length,
      occupied: open.filter((position) => position.status === "Occupied").length,
      vacancy: open.filter((position) => position.status === "Vacancy").length,
      closed: filtered.filter((position) => position.status === "Closed").length,
    };
  }, [filtered]);


  const applyIndexationToFiltered = () => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
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
    setRecentlyIndexedIds(targetIds);
    showBulkFeedback(
      "success",
      `Индексация +${idxPercent}% с ${monthLabel(idxMonth)} применена к ${targetIds.length} позициям.`,
    );
    window.setTimeout(() => {
      setRecentlyIndexedIds([]);
    }, 4000);
  };

  const deleteIndexationBatch = (batchId: string) => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
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
    showBulkFeedback("success", "Факт индексации удален. Значения пересчитаны.");
  };

  const saveDraftPosition = (updated: PositionRecord, sourcePositionId?: string, forceCreate = false) => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
    const sourceId = sourcePositionId ?? updated.positionId;
    const recalculated = applyEvents(updated);
    const withIndexation = forceCreate ? applyExistingIndexationBatches(recalculated, positions) : recalculated;
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
    if (!canEditPlan) {
      blockEdit();
      return;
    }
    if (event.type === "TERMINATION_TO_VACANCY") {
      const result = applyTerminationToVacancy(positions, positionId, event.payload.month);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setPositions(result.positions);
      return;
    }
    if (event.type === "TRANSFER") {
      const result = applyPlanTransferFromDrawerEvent(positions, positionId, event, {
        nextPositionId: (list) => nextPositionId(list),
        applyIndexationBatches: (record, all) => applyExistingIndexationBatches(record, all),
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setPositions(result.positions);
      return;
    }
    setPositions((prev) =>
      prev.map((position) => (position.positionId === positionId ? upsertEvent(position, event) : position)),
    );
  };

  const deleteEvent = (positionId: string, eventId: string) => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
    setPositions((prev) => removePlanEvent(prev, positionId, eventId));
  };
  const deleteVacancy = (positionId: string) => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
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
  const employeeOptions: EmployeeOption[] = appliedPositions
    .filter((item) => item.status === "Occupied" && item.employeeId && item.employeeName)
    .map((item) => ({
      employeeId: item.employeeId as string,
      employeeName: item.employeeName as string,
      positionId: item.positionId,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ru"));

  const openAddSlotDialog = () => {
    if (!canEditPlan) {
      blockEdit();
      return;
    }
    setAddSlotKind("vacancy");
    setAddSlotEmployeeId(nextEmployeeId(positions));
    setAddSlotEmployeeName("");
    setAddSlotOpen(true);
  };

  const createSlotFromDialog = () => {
    const newId = nextPositionId(positions);
    const activeFromMonth = new Date().getMonth();
    const org = normalizeOrgPath(
      department === "All" ? "Engineering" : department,
      unit === "All" ? "" : unit,
      team === "All" ? "" : team,
    );
    const isOccupied = addSlotKind === "occupied";
    const employeeId = addSlotEmployeeId.trim() || nextEmployeeId(positions);
    const employeeName = addSlotEmployeeName.trim();

    if (isOccupied && !employeeName) {
      window.alert("Укажите ФИО сотрудника для занятого слота.");
      return;
    }

    const baseSalary = 150_000;
    const record: PositionRecord = applyExistingIndexationBatches(
      {
        positionId: newId,
        role: isOccupied ? employeeName : "Новая вакансия",
        department: org.department,
        unit: org.unit,
        team: org.team,
        slotType: "new",
        limitFlag: defaultLimitFlagForSlotType("new"),
        activeFromMonth,
        vacancySinceMonth: isOccupied ? null : activeFromMonth,
        previousDecemberBase: 0,
        employeeName: isOccupied ? employeeName : null,
        employeeId: isOccupied ? employeeId : null,
        status: isOccupied ? "Occupied" : "Vacancy",
        seedEmployeeName: isOccupied ? employeeName : null,
        seedEmployeeId: isOccupied ? employeeId : null,
        seedStatus: isOccupied ? "Occupied" : "Vacancy",
        seedVacancySinceMonth: isOccupied ? null : activeFromMonth,
        monthlySpec: Array.from({ length: 12 }, () => "Engineering"),
        monthlyLevel: Array.from({ length: 12 }, () => "Middle"),
        monthlyBase: Array.from({ length: 12 }, () => baseSalary),
        monthlyBonus: Array.from({ length: 12 }, () => 0),
        seedMonthlySpec: Array.from({ length: 12 }, () => "Engineering"),
        seedMonthlyLevel: Array.from({ length: 12 }, () => "Middle"),
        seedMonthlyBase: Array.from({ length: 12 }, () => baseSalary),
        seedMonthlyBonus: Array.from({ length: 12 }, () => 0),
        events: [],
      },
      positions,
    );
    setAddSlotOpen(false);
    setActive(record);
    setActiveSourceId(record.positionId);
  };

  return (
    <div className="content-page planning-page">
      <header className="page-header">
        <div>
          <h1>Планирование ФОТ</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · {tableCounts.total} слотов (
            {tableCounts.occupied} занято, {tableCounts.vacancy} вакансии
            {tableCounts.closed > 0 ? `, ${tableCounts.closed} закрыто` : ""})
          </p>
          <p className="muted-line">{roleScopeHint}</p>
        </div>
        <div className="page-header__actions planning-toolbar">
          <div className="planning-indexation-compact" title="По позициям текущего фильтра таблицы">
            <Calculator size={14} strokeWidth={2} aria-hidden />
            <span className="planning-indexation-compact__label">Индексация</span>
            <div className="planning-indexation-compact__percent">
              <input
                type="number"
                min={0}
                step={0.1}
                value={idxPercent}
                onChange={(event) => setIdxPercent(Number(event.target.value))}
                aria-label="Процент"
              />
              <span>%</span>
            </div>
            <select
              className="planning-indexation-compact__month"
              value={idxMonth}
              onChange={(event) => setIdxMonth(Number(event.target.value))}
              aria-label="С месяца"
            >
              {MONTHS.map((month, monthIndex) => (
                <option key={month} value={monthIndex}>
                  {month}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primary-btn planning-indexation-compact__btn"
              onClick={applyIndexationToFiltered}
              disabled={!canEditPlan}
            >
              Применить
            </button>
          </div>
          <div className="planning-toolbar__actions">
            <Link className="secondary-btn" to="/salary-ranges">
              Диапазоны
            </Link>
            {workspaceTab === "positions" ? (
              <button type="button" className="primary-btn" onClick={openAddSlotDialog} disabled={!canEditPlan}>
                <Plus size={14} /> Добавить слот
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="planning-workspace-tabs" aria-label="Разделы планирования">
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "positions" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("positions")}
        >
          Позиции
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "matrix" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("matrix")}
        >
          По месяцам
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "journal" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("journal")}
        >
          Журнал изменений
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "approval" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("approval")}
        >
          Согласование
        </button>
      </nav>

      {workspaceTab === "positions" ? (
        <p className="planning-workspace-hint">
          Клик по строке → drawer: «Слот и занятость» · «События и ФОТ». Журнал — вкладка «Журнал изменений».
        </p>
      ) : null}
      {workspaceTab === "matrix" ? (
        <p className="planning-workspace-hint">
          Матрица на конец месяца: план (З/В/—) и факт. Отклонения только для просмотра — план из факта не меняется.
        </p>
      ) : null}
      {workspaceTab === "journal" ? (
        <p className="planning-workspace-hint">
          Все события текущей версии. Клик по строке откроет позицию для правки.
        </p>
      ) : null}
      {workspaceTab === "approval" ? (
        <p className="planning-workspace-hint">
          Маршрут версии бюджета: утверждение v1 → черновик → согласование → публикация v+1.
        </p>
      ) : null}

      {!canEditPlan ? (
        <div className="planning-readonly-banner" role="status">
          Эта версия только для просмотра. Правки:{" "}
          <Link to="/versions">{workingDraft ? "квартальный черновик" : "создайте черновик на «Версии»"}</Link>
          {activePlan.versionNumber === 1 && activePlan.status === "DRAFT" ? null : "."}
        </div>
      ) : activePlan.versionNumber === 1 && activePlan.status === "DRAFT" ? (
        <div className="planning-readonly-banner planning-readonly-banner--edit" role="status">
          Бюджет v1 ещё не утверждён — можно править здесь. Затем «Утвердить» на <Link to="/versions">Версии</Link>.
        </div>
      ) : null}

      {workspaceTab === "positions" || workspaceTab === "matrix" ? (
        <>
      {workspaceTab === "positions" ? (
      <AnalyticsSummaryStrip
        positions={filtered}
        viewMode={viewMode}
        salaryBands={salaryBands}
        showYtd={false}
        showFactYtd={false}
        showAvgCr={false}
        planningLayout
      />
      ) : null}

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
            <select
              value={occupancyFilter}
              onChange={(event) =>
                setOccupancyFilter(event.target.value as "All" | "Occupied" | "Vacancy" | "Closed")
              }
            >
              <option value="All">Все</option>
              <option value="Occupied">Позиция</option>
              <option value="Vacancy">Вакансия</option>
              <option value="Closed">Закрыта</option>
            </select>
          </label>
        </div>
      </section>

      {bulkFeedback && workspaceTab === "positions" ? (
        <section className={`bulk-feedback bulk-feedback--${bulkFeedback.tone}`}>
          {bulkFeedback.text}
        </section>
      ) : null}

      {workspaceTab === "matrix" ? (
        <section className="card planning-workspace-panel">
          <PlanMonthMatrixPanel
            positions={filtered}
            viewMode={viewMode}
            viewModeLabel={viewMode === "total" ? "полный ФОТ" : "тарифный оклад"}
            onOpenPosition={openPositionInDrawer}
          />
        </section>
      ) : null}

      {workspaceTab === "positions" && indexationBatches.length > 0 ? (
        <section className="card">
          <h2 className="section-title">Факты массовой индексации</h2>
          <p className="muted-line">По событиям текущей версии · {indexationBatches.length} факт(ов)</p>
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
                    <button
                      type="button"
                      className="icon-btn danger"
                      disabled={!canEditPlan}
                      title={canEditPlan ? "Удалить факт индексации" : "Только в режиме редактирования"}
                      onClick={() => deleteIndexationBatch(batch.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {workspaceTab === "positions" ? (
      <section className="card">
        <h2 className="section-title">Позиции · {tableCounts.total}</h2>
        <div className="table-scroll">
        <table className="simple-table positions-table positions-table--compact">
          <thead>
            <tr>
              <th className="positions-table__sticky-col">Роль / ID</th>
              <th>Занятость / орг.</th>
              <th>Спец. и уровень</th>
              <th>Дек → дек</th>
              <th>ФОТ год</th>
              <th>CR</th>
              <th>Лимит</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const cr = avgCR(row, salaryBands);
              const decDelta = row.monthlyBase[11] - row.previousDecemberBase;
              const decPct = decToDec(row.previousDecemberBase, row.monthlyBase[11]);
              const rowExtra = recentlyIndexedIds.includes(row.positionId) ? "row-updated" : undefined;
              const eventCount = (positions.find((item) => item.positionId === row.positionId) ?? row).events.length;
              return (
                <tr
                  key={row.positionId}
                  onClick={() => {
                    setActive(row);
                    setActiveSourceId(row.positionId);
                  }}
                  className={positionTableRowClass(row.status, rowExtra)}
                  title="Открыть карточку позиции"
                >
                  <td>
                    <div className="positions-table__role">{row.role}</div>
                    <div className="muted-line">
                      {row.positionId} · с {monthLabel(row.activeFromMonth)} ·{" "}
                      {POSITION_STATUS_LABELS[row.status]}
                      {eventCount > 0 ? (
                        <span className="position-state-badge position-state-badge--events"> · {eventCount} соб.</span>
                      ) : null}
                      {active?.positionId === row.positionId && !positions.some((p) => p.positionId === row.positionId) ? (
                        <span className="position-state-badge position-state-badge--draft"> · черновик</span>
                      ) : null}
                    </div>
                    {isTemporaryReplacementVacancy(row) && <span className="scenario-badge">Временная замена</span>}
                    {needsCarryoverEvent(row) && (
                      <span className="scenario-badge scenario-badge--warn">Нет события переноса</span>
                    )}
                  </td>
                  <td>
                    <div className="positions-table__occupancy-line">
                      <span className="position-state-badge position-state-badge--status">
                        {POSITION_STATUS_LABELS[row.status]}
                      </span>
                      <span>{employeeCellLabel(row)}</span>
                    </div>
                    <div className="muted-line">
                      {row.department} / {row.unit} / {row.team}
                    </div>
                  </td>
                  <td>
                    {row.monthlySpec[11]}
                    <div className="muted-line">{row.monthlyLevel[11]}</div>
                  </td>
                  <td className={`dec-cell--${growthTone(decDelta)}`}>
                    <div className="positions-table__dec-range">
                      {row.previousDecemberBase.toLocaleString("ru-RU")} →{" "}
                      {row.monthlyBase[11].toLocaleString("ru-RU")} ₽
                    </div>
                    <div>
                      {formatGrowthDelta(decDelta)} · {formatGrowthPct(decPct)}
                    </div>
                  </td>
                  <td>{annualTotal(row).toLocaleString("ru-RU")} ₽</td>
                  <td>
                    <span className={`cr-value cr-value--${crTone(cr)}`}>{cr > 0 ? cr.toFixed(2) : "—"}</span>
                  </td>
                  <td>
                    <span className={`limit-flag-badge limit-flag-badge--${row.limitFlag}`}>
                      {LIMIT_FLAG_LABELS[row.limitFlag]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <p className="muted-line">Нет позиций по текущим фильтрам.</p>}
      </section>
      ) : null}
        </>
      ) : null}

      {workspaceTab === "journal" ? (
        <section className="card planning-workspace-panel">
          <PlanJournalPanel
            onOpenPosition={openPositionFromJournal}
            highlightPositionId={journalHighlightPositionId}
            filterPositionIds={journalDiffPositionIds}
          />
        </section>
      ) : null}

      {workspaceTab === "approval" ? (
        <section className="planning-workspace-panel">
          <PlanApprovalPanel />
        </section>
      ) : null}

      {addSlotOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-slot-title">
          <div className="modal-card">
            <h2 id="add-slot-title" className="section-title">
              Новый слот в плане
            </h2>
            <p className="muted-line">Позиция — штатная единица. Сразу выберите: вакансия или сотрудник на слоте.</p>
            <div className="add-slot-kind">
              <label>
                <input
                  type="radio"
                  name="addSlotKind"
                  checked={addSlotKind === "vacancy"}
                  onChange={() => setAddSlotKind("vacancy")}
                />
                Вакансия
              </label>
              <label>
                <input
                  type="radio"
                  name="addSlotKind"
                  checked={addSlotKind === "occupied"}
                  onChange={() => setAddSlotKind("occupied")}
                />
                С сотрудником
              </label>
            </div>
            {addSlotKind === "occupied" ? (
              <div className="add-slot-employee-fields">
                <label>
                  ФИО
                  <input
                    type="text"
                    value={addSlotEmployeeName}
                    onChange={(event) => setAddSlotEmployeeName(event.target.value)}
                    placeholder="Иванов Иван"
                  />
                </label>
                <label>
                  ID сотрудника
                  <input
                    type="text"
                    value={addSlotEmployeeId}
                    onChange={(event) => setAddSlotEmployeeId(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
            <div className="modal-card__actions">
              <button type="button" className="secondary-btn" onClick={() => setAddSlotOpen(false)}>
                Отмена
              </button>
              <button type="button" className="primary-btn" onClick={createSlotFromDialog}>
                Создать и открыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        readOnly={!canEditPlan}
        planPositions={planPositionsForDrawer}
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

