import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { PlanContextBar } from "../components/planning/PlanContextBar";
import { PlanJournalPanel } from "../components/planning/PlanJournalPanel";
import { PlanMonthMatrixPanel } from "../components/planning/PlanMonthMatrixPanel";
import {
  isPlanEventMonthAllowed,
  planEventMonthBlockedMessage,
  isAnnualPlanningDraft,
  isQuarterWorkingDraft,
  resolveCorrectionWindow,
} from "../data/planCorrectionWindow";
import { PLAN_WORKSPACE_LABELS, type PlanWorkspaceMode } from "../data/planWorkspaceMode";
import {
  availableTeamsForSlice,
  availableUnitsForSlice,
  EMPTY_ORG_SLICE,
  matchesOrgSlice,
  primaryDepartmentForOrg,
  primaryTeamForOrg,
  primaryUnitForOrg,
  updateOrgSliceDepartments,
  updateOrgSliceTeams,
  updateOrgSliceUnits,
  type OrgSliceSelection,
} from "../data/orgSliceFilters";
import { OrgSliceMultiSelect } from "../components/OrgSliceMultiSelect";
import { SliceToolbar, SliceToolbarSelect } from "../components/SliceToolbar";
import { loadPersistedOrgSlice, savePersistedOrgSlice } from "../data/persistedOrgSlice";
import { roleCanApplyMassIndexation, roleCanEdit, roleOrgFilterDefaults } from "../data/userAccess";
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
  teamOptions,
  unitOptions,
  upsertEvent,
} from "../data/planningData";
import { positionTableRowClass, JOURNAL_EVENT_TYPE_OPTIONS } from "../data/eventJournal";
import {
  applyPlanTransferFromDrawerEvent,
  applyTerminationToVacancy,
  mapPositionsWithAppliedEvents,
  mergePlanPositionsWithDraft,
  removePlanEvent,
  removePlanPosition,
} from "../data/planOperations";
import { useMvpApp } from "../context/MvpAppContext";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { ExportCsvActions } from "../components/ExportCsvActions";
import { PositionIdentityCell } from "../components/planning/PositionIdentityCell";
import { PositionDrawer } from "../components/PositionDrawer";
import { formatCrCoefficient } from "../data/positionDisplay";
import { WorkflowHint } from "../components/WorkflowHint";
import type { PlannedEvent, PositionRecord, SalaryRangeBand, EventType } from "../types";
import { MONTHS } from "../types";

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

type WorkspaceTab = "positions" | "matrix" | "journal";

function parseWorkspaceTab(value: string | null): WorkspaceTab {
  if (value === "matrix" || value === "journal") return value;
  return "positions";
}

function parseWorkspaceMode(value: string | null): PlanWorkspaceMode {
  return value === "correction" ? "correction" : "planning";
}

export function PlanningPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceMode = parseWorkspaceMode(searchParams.get("mode"));
  const rawTab = searchParams.get("tab");
  const workspaceTab = parseWorkspaceTab(rawTab);

  useEffect(() => {
    if (rawTab === "approval") {
      navigate("/versions?tab=approval", { replace: true });
    } else if (rawTab === "compare") {
      navigate("/versions?tab=compare", { replace: true });
    }
  }, [rawTab, navigate]);

  const {
    positions,
    allPositions,
    setPositions,
    activePlan,
    viewMode,
    salaryBands,
    canEditPlan,
    workingDraft,
    latestApproved,
    createWorkingDraft,
    roleScopeHint,
    primaryBudget,
    userRole,
    leadEditFrozenForRole,
    leadEditFrozen,
    canToggleLeadFreeze,
    openVersion,
    planVersionId,
    isTeamSliceReadOnly,
  } = useMvpApp();

  const orgFilterDefaults = useMemo(() => roleOrgFilterDefaults(userRole), [userRole]);

  const correctionWindow = useMemo(
    () => resolveCorrectionWindow(activePlan, primaryBudget, { workspaceMode }),
    [activePlan, primaryBudget, workspaceMode],
  );
  const isOnWorkingDraft = activePlan.kind === "WORKING_DRAFT";
  const isAnnualDraft = isAnnualPlanningDraft(activePlan);
  const canEditWorkspace = useMemo(() => {
    if (!canEditPlan) return false;
    if (isTeamSliceReadOnly) return false;
    if (isQuarterWorkingDraft(activePlan, primaryBudget)) return true;
    if (workspaceMode === "correction") return false;
    return isAnnualDraft;
  }, [canEditPlan, isTeamSliceReadOnly, workspaceMode, activePlan, primaryBudget, isAnnualDraft]);

  useEffect(() => {
    if (workspaceMode !== "correction" || !workingDraft) return;
    if (planVersionId !== workingDraft.id) {
      openVersion(workingDraft.id);
    }
  }, [workspaceMode, workingDraft, planVersionId, openVersion]);

  const canMassIndexation = roleCanApplyMassIndexation(userRole) && canEditWorkspace;

  const canAddPosition =
    roleCanEdit(userRole, leadEditFrozen) &&
    (canEditWorkspace || Boolean(workingDraft) || Boolean(latestApproved) || isAnnualDraft);

  const blockEdit = () => {
    if (workspaceMode === "correction") {
      window.alert(
        workingDraft
          ? "Правки только в квартальном черновике с допустимым месяцем события."
          : "Создайте квартальный черновик на странице «Версии» (C&B).",
      );
      return;
    }
    window.alert("Годовые правки — в неутверждённом бюджете v1. Квартальные — переключитесь на «Корректировка».");
  };
  const [query, setQuery] = useState("");
  const [orgSlice, setOrgSlice] = useState<OrgSliceSelection>(() => {
    if (orgFilterDefaults) {
      return {
        departments: orgFilterDefaults.departments,
        units: orgFilterDefaults.units,
        teams: orgFilterDefaults.teams,
      };
    }
    return loadPersistedOrgSlice() ?? EMPTY_ORG_SLICE;
  });

  useEffect(() => {
    if (!orgFilterDefaults) return;
    setOrgSlice({
      departments: orgFilterDefaults.departments,
      units: orgFilterDefaults.units,
      teams: orgFilterDefaults.teams,
    });
  }, [orgFilterDefaults]);

  useEffect(() => {
    if (orgFilterDefaults) return;
    savePersistedOrgSlice(orgSlice);
  }, [orgSlice, orgFilterDefaults]);

  useEffect(() => {
    if (orgFilterDefaults) return;
    const sliceDept = searchParams.get("sliceDept");
    const sliceUnit = searchParams.get("sliceUnit");
    const sliceTeam = searchParams.get("sliceTeam");
    if (!sliceDept && !sliceUnit && !sliceTeam) return;
    setOrgSlice({
      departments: sliceDept ? sliceDept.split(",").filter(Boolean) : [],
      units: sliceUnit ? sliceUnit.split(",").filter(Boolean) : [],
      teams: sliceTeam ? sliceTeam.split(",").filter(Boolean) : [],
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("sliceDept");
        next.delete("sliceUnit");
        next.delete("sliceTeam");
        return next;
      },
      { replace: true },
    );
  }, [orgFilterDefaults, searchParams, setSearchParams]);

  const unitOptionsList = useMemo(
    () => availableUnitsForSlice({ departments: orgSlice.departments }),
    [orgSlice.departments],
  );
  const teamOptionsList = useMemo(
    () => availableTeamsForSlice({ departments: orgSlice.departments, units: orgSlice.units }),
    [orgSlice.departments, orgSlice.units],
  );

  const [limitFilter, setLimitFilter] = useState<"All" | "IN_LIMIT" | "OVER_LIMIT">("All");
  const [occupancyFilter, setOccupancyFilter] = useState<"All" | "Occupied" | "Vacancy" | "Closed">("All");
  const [journalMonthFilter, setJournalMonthFilter] = useState("All");
  const [journalTypeFilter, setJournalTypeFilter] = useState<EventType | "All">("All");
  const [active, setActive] = useState<PositionRecord | null>(null);
  const [idxPercent, setIdxPercent] = useState(5);
  const [idxMonth, setIdxMonth] = useState(8);
  useEffect(() => {
    if (workspaceMode !== "correction" || correctionWindow.startMonth == null) return;
    setIdxMonth((current) =>
      isPlanEventMonthAllowed(current, correctionWindow) ? current : correctionWindow.startMonth!,
    );
  }, [workspaceMode, correctionWindow]);
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
  const [pendingAddSlot, setPendingAddSlot] = useState(false);

  useEffect(() => {
    if (!pendingAddSlot || !canEditWorkspace) return;
    setPendingAddSlot(false);
    setAddSlotKind("vacancy");
    setAddSlotEmployeeId(nextEmployeeId(allPositions));
    setAddSlotEmployeeName("");
    setAddSlotOpen(true);
  }, [pendingAddSlot, canEditWorkspace, allPositions]);

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

  const setWorkspaceMode = (mode: PlanWorkspaceMode) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === "correction") next.set("mode", "correction");
        else next.delete("mode");
        return next;
      },
      { replace: true },
    );
  };

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
    if (workspaceTab === "journal") return;
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
      const limitMatch = limitFilter === "All" || position.limitFlag === limitFilter;
      const occupancyMatch = occupancyFilter === "All" || position.status === occupancyFilter;
      const queryText = `${position.positionId} ${position.role} ${position.employeeName ?? ""} ${position.unit} ${position.team}`.toLowerCase();
      return (
        matchesOrgSlice(position, orgSlice) &&
        limitMatch &&
        occupancyMatch &&
        queryText.includes(query.toLowerCase())
      );
    });
  }, [appliedPositions, query, orgSlice, limitFilter, occupancyFilter]);

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
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    if (!canMassIndexation) {
      window.alert("Массовая индексация доступна только C&B и юнит-лиду.");
      return;
    }
    if (!isPlanEventMonthAllowed(idxMonth, correctionWindow)) {
      window.alert(planEventMonthBlockedMessage(correctionWindow));
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
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const confirmed = window.confirm("Удалить факт массовой индексации для всех затронутых позиций?");
    if (!confirmed) return;
    setPositions((prev) =>
      prev.map((position) => ({
        ...position,
        events: position.events.filter(
          (event) => !(event.type === "INDEXATION" && event.payload.indexationBatchId === batchId),
        ),
      })),
    );
    showBulkFeedback("success", "Факт массовой индексации удалён.");
  };

  const saveDraftPosition = (updated: PositionRecord, sourcePositionId?: string, forceCreate = false) => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const sourceId = sourcePositionId ?? updated.positionId;
    const recalculated = applyEvents(updated);
    const withIndexation = forceCreate ? applyExistingIndexationBatches(recalculated, positions) : recalculated;
    setPositions((prev) => {
      const existsBySource = prev.some((position) => position.positionId === sourceId);
      if (existsBySource) {
        return prev.map((position) => (position.positionId === sourceId ? withIndexation : position));
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
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const eventMonth = event.payload.month;
    if (typeof eventMonth === "number" && !isPlanEventMonthAllowed(eventMonth, correctionWindow)) {
      window.alert(planEventMonthBlockedMessage(correctionWindow));
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
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    setPositions((prev) => removePlanEvent(prev, positionId, eventId));
  };
  const deletePosition = (positionId: string) => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const target = positions.find((position) => position.positionId === positionId) ?? active;
    const isPersisted = positions.some((position) => position.positionId === positionId);
    const status = target?.status ?? "Vacancy";
    const eventCount = target?.events.length ?? 0;
    const confirmText = !isPersisted
      ? "Удалить черновик позиции?"
      : status === "Vacancy"
        ? `Удалить вакансию ${positionId} из плана?`
        : status === "Closed"
          ? `Удалить закрытую позицию ${positionId} из плана?`
          : `Удалить позицию ${positionId} (${target?.employeeName ?? "занята"}) из плана?${
              eventCount > 0 ? ` Будут удалены ${eventCount} событий.` : ""
            }`;
    const confirmed = window.confirm(`${confirmText}\n\nДействие нельзя отменить.`);
    if (!confirmed) return;
    const result = removePlanPosition(positions, positionId);
    if (!result.ok) {
      if (!isPersisted && active?.positionId === positionId) {
        setActive(null);
        setActiveSourceId(null);
        showBulkFeedback("success", "Черновик позиции удалён.");
        return;
      }
      window.alert(result.error);
      return;
    }
    setPositions(result.positions);
    setActive(null);
    setActiveSourceId(null);
    showBulkFeedback("success", `Позиция ${positionId} удалена из плана.`);
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
    if (canEditWorkspace) {
      setAddSlotKind("vacancy");
      setAddSlotEmployeeId(nextEmployeeId(allPositions));
      setAddSlotEmployeeName("");
      setAddSlotOpen(true);
      return;
    }
    if (!roleCanEdit(userRole, leadEditFrozen)) {
      blockEdit();
      return;
    }
    const draftId = workingDraft?.id;
    if (draftId) {
      if (workspaceMode !== "correction") setWorkspaceMode("correction");
      if (planVersionId !== draftId) openVersion(draftId);
      setPendingAddSlot(true);
      showBulkFeedback("success", "Открываем квартальный черновик для добавления позиции…");
      return;
    }
    const created = createWorkingDraft(latestApproved?.id);
    if (created.ok) {
      if (workspaceMode !== "correction") setWorkspaceMode("correction");
      openVersion(created.draftId);
      setPendingAddSlot(true);
      showBulkFeedback("success", "Создан черновик — добавьте позицию.");
      return;
    }
    window.alert(created.error);
  };

  const createSlotFromDialog = () => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const newId = nextPositionId(allPositions);
    const activeFromMonth = new Date().getMonth();
    const org = normalizeOrgPath(
      primaryDepartmentForOrg(orgSlice),
      primaryUnitForOrg(orgSlice),
      primaryTeamForOrg(orgSlice),
    );
    const isOccupied = addSlotKind === "occupied";
    const employeeId = addSlotEmployeeId.trim() || nextEmployeeId(allPositions);
    const employeeName = addSlotEmployeeName.trim();

    if (isOccupied && !employeeName) {
      window.alert("Укажите ФИО сотрудника для занятой позиции.");
      return;
    }

    const baseSalary = 150_000;
    const record: PositionRecord = {
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
    };
    saveDraftPosition(record, record.positionId, true);
    setAddSlotOpen(false);
    showBulkFeedback("success", `Позиция ${newId} добавлена в план.`);
  };

  return (
    <div className="content-page planning-page">
      {(userRole === "team_lead" || userRole === "unit_lead") && canEditWorkspace && !leadEditFrozenForRole ? (
        <WorkflowHint hintId="planning-lead">
          Выберите позицию в таблице и добавьте событие в карточке позиции.
        </WorkflowHint>
      ) : null}
      <header className="page-header">
        <div>
          <h1>{PLAN_WORKSPACE_LABELS[workspaceMode]} ФОТ</h1>
          <p>
            {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · {tableCounts.total} поз. (
            {tableCounts.occupied} занято, {tableCounts.vacancy} вакансии
            {tableCounts.closed > 0 ? `, ${tableCounts.closed} закрыто` : ""})
          </p>
          <p className="muted-line">{roleScopeHint}</p>
        </div>
        <div className="page-header__actions planning-toolbar">
          <ExportCsvActions
            positions={filtered}
            viewMode={viewMode}
            planVersionId={planVersionId}
            planYear={activePlan.planYear}
            userRole={userRole}
            scope={orgSlice}
            compact
          />
          <div className="planning-toolbar__actions">
            <Link className="secondary-btn" to="/salary-ranges">
              Диапазоны
            </Link>
            {workspaceTab === "positions" ? (
              <button
                type="button"
                className="primary-btn"
                onClick={openAddSlotDialog}
                disabled={!canAddPosition}
                title={
                  !canAddPosition
                    ? !roleCanEdit(userRole, leadEditFrozen)
                      ? "Нет прав на правку плана для этой роли"
                      : "Нет базы для правок — откройте «Версии»"
                    : !canEditWorkspace
                      ? "Откроет квартальный черновик для добавления"
                      : undefined
                }
              >
                <Plus size={14} /> Добавить позицию
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="planning-workspace-tabs planning-mode-tabs" aria-label="Режим планирования">
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceMode === "planning" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceMode("planning")}
        >
          Годовое планирование
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceMode === "correction" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceMode("correction")}
        >
          Корректировка
        </button>
      </nav>

      <nav
        className="planning-workspace-tabs"
        aria-label={workspaceMode === "correction" ? "Разделы корректировки" : "Разделы планирования"}
      >
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "positions" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("positions")}
          title="Таблица позиций; клик по строке откроет карточку"
        >
          Позиции
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "matrix" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("matrix")}
          title="План и факт на конец месяца; отклонения только для просмотра"
        >
          По месяцам
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "journal" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("journal")}
          title="Все события версии; клик откроет позицию"
        >
          Журнал изменений
        </button>
      </nav>

      <PlanContextBar
        workspaceMode={workspaceMode}
        correctionWindow={correctionWindow}
        hasWorkingDraft={Boolean(workingDraft)}
        isOnWorkingDraft={isOnWorkingDraft}
        isAnnualDraft={isAnnualDraft}
        canEditWorkspace={canEditWorkspace}
        canEditPlan={canEditPlan}
        leadEditFrozenForRole={leadEditFrozenForRole}
        leadEditFrozen={leadEditFrozen}
        canToggleLeadFreeze={canToggleLeadFreeze}
        indexationBatches={indexationBatches}
      />

      {canMassIndexation ? (
        <section className="card mass-indexation-panel">
          <h2 className="section-title">Массовая индексация</h2>
          <p className="muted-line">
            По позициям текущего фильтра · {filtered.filter((item) => item.status !== "Closed").length} активных
          </p>
          <div className="mass-indexation-panel__form">
            <label>
              Процент
              <input
                type="number"
                min={0}
                step={0.1}
                value={idxPercent}
                onChange={(event) => setIdxPercent(Number(event.target.value))}
              />
            </label>
            <label>
              С месяца
              <select value={idxMonth} onChange={(event) => setIdxMonth(Number(event.target.value))}>
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
            </label>
            <button
              type="button"
              className="primary-btn"
              onClick={applyIndexationToFiltered}
              disabled={!canEditWorkspace}
            >
              Применить
            </button>
          </div>
          {!isPlanEventMonthAllowed(idxMonth, correctionWindow) ? (
            <p className="muted-line">{planEventMonthBlockedMessage(correctionWindow)}</p>
          ) : null}
          {indexationBatches.length > 0 ? (
            <div className="table-scroll mass-indexation-panel__batches">
              <table className="simple-table">
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
                          onClick={() => deleteIndexationBatch(batch.id)}
                          title="Удалить факт индексации"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {workspaceTab === "positions" || workspaceTab === "matrix" || workspaceTab === "journal" ? (
        <SliceToolbar
          sticky
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder={
            workspaceTab === "journal" ? "Позиция, сотрудник, комментарий…" : "Роль, позиция или сотрудник…"
          }
          footer={
            workspaceTab === "journal"
              ? `Журнал · срез применён`
              : `${filtered.length} поз. в срезе`
          }
        >
          <OrgSliceMultiSelect
            layout="toolbar"
            label="Департамент"
            options={departmentOptions()}
            value={orgSlice.departments}
            disabled={orgFilterDefaults?.lockDepartment}
            onChange={(departments) => setOrgSlice((prev) => updateOrgSliceDepartments(prev, departments))}
          />
          <OrgSliceMultiSelect
            layout="toolbar"
            label="Юнит"
            options={unitOptionsList}
            value={orgSlice.units}
            disabled={orgFilterDefaults?.lockUnit}
            onChange={(units) => setOrgSlice((prev) => updateOrgSliceUnits(prev, units))}
          />
          <OrgSliceMultiSelect
            layout="toolbar"
            label="Команда"
            options={teamOptionsList}
            value={orgSlice.teams}
            disabled={orgFilterDefaults?.lockTeam}
            onChange={(teams) => setOrgSlice((prev) => updateOrgSliceTeams(prev, teams))}
          />
          {workspaceTab !== "journal" ? (
            <>
          <SliceToolbarSelect label="Лимит" value={limitFilter} onChange={(value) => setLimitFilter(value as typeof limitFilter)}>
            <option value="All">Все</option>
            <option value="IN_LIMIT">{LIMIT_FLAG_LABELS.IN_LIMIT}</option>
            <option value="OVER_LIMIT">{LIMIT_FLAG_LABELS.OVER_LIMIT}</option>
          </SliceToolbarSelect>
          <SliceToolbarSelect
            label="Статус"
            value={occupancyFilter}
            onChange={(value) => setOccupancyFilter(value as typeof occupancyFilter)}
          >
            <option value="All">Все</option>
            <option value="Occupied">В штате</option>
            <option value="Vacancy">Вакансия</option>
            <option value="Closed">Закрыта</option>
          </SliceToolbarSelect>
            </>
          ) : null}
          {workspaceTab === "journal" ? (
            <>
              <SliceToolbarSelect label="Месяц" value={journalMonthFilter} onChange={setJournalMonthFilter}>
                <option value="All">Все</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {monthLabel(index)}
                  </option>
                ))}
              </SliceToolbarSelect>
              <SliceToolbarSelect
                label="Тип"
                value={journalTypeFilter}
                onChange={(value) => setJournalTypeFilter(value as EventType | "All")}
              >
                {JOURNAL_EVENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SliceToolbarSelect>
            </>
          ) : null}
        </SliceToolbar>
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
        planningCompact
      />
      ) : null}

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
            userRole={userRole}
            correctionWindow={workspaceMode === "correction" ? correctionWindow : null}
            onOpenPosition={openPositionInDrawer}
          />
        </section>
      ) : null}

      {workspaceTab === "positions" ? (
      <section className="card">
        <h2 className="section-title">Позиции · {tableCounts.total}</h2>
        <div className="table-scroll">
        <table className="simple-table positions-table positions-table--compact">
          <thead>
            <tr>
              <th className="positions-table__sticky-col">Сотрудник / позиция</th>
              <th>Спец. и уровень</th>
              <th>Дек → дек</th>
              <th>ФОТ год</th>
              <th>CR</th>
              <th>Лимит</th>
              {canEditWorkspace ? <th className="positions-table__actions" aria-label="Действия" /> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const cr = avgCR(row, salaryBands);
              const decDelta = row.monthlyBase[11] - row.previousDecemberBase;
              const decPct = decToDec(row.previousDecemberBase, row.monthlyBase[11]);
              const rowExtra = recentlyIndexedIds.includes(row.positionId) ? "row-updated" : undefined;
              const eventCount = row.events.length;
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
                    <PositionIdentityCell
                      record={row}
                      userRole={userRole}
                      metaExtra={
                        <>
                          {eventCount > 0 ? (
                            <span className="position-state-badge position-state-badge--events">{eventCount} соб.</span>
                          ) : null}
                          {active?.positionId === row.positionId && !positions.some((p) => p.positionId === row.positionId) ? (
                            <span className="position-state-badge position-state-badge--draft">черновик</span>
                          ) : null}
                          {isTemporaryReplacementVacancy(row) && <span className="scenario-badge">Временная замена</span>}
                          {needsCarryoverEvent(row) && (
                            <span className="scenario-badge scenario-badge--warn">Нет события переноса</span>
                          )}
                        </>
                      }
                    />
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
                    <span className={`cr-coef cr-coef--${crTone(cr)}`}>{formatCrCoefficient(cr)}</span>
                  </td>
                  <td>
                    <span className={`limit-flag-badge limit-flag-badge--${row.limitFlag}`}>
                      {LIMIT_FLAG_LABELS[row.limitFlag]}
                    </span>
                  </td>
                  {canEditWorkspace ? (
                    <td className="positions-table__actions">
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Удалить ${row.positionId}`}
                        title="Удалить из плана"
                        onClick={(event) => {
                          event.stopPropagation();
                          deletePosition(row.positionId);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
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
            orgSlice={orgSlice}
            query={query}
            monthFilter={journalMonthFilter}
            typeFilter={journalTypeFilter}
          />
        </section>
      ) : null}

      {addSlotOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-slot-title">
          <div className="modal-card modal-card--add-slot">
            <h2 id="add-slot-title" className="section-title">
              Новая позиция в плане
            </h2>
            <p className="muted-line">Штатная единица в плане. Сразу выберите: вакансия или сотрудник на позиции.</p>
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
            <div className="add-slot-employee-fields">
              <label>
                ФИО
                <input
                  type="text"
                  value={addSlotKind === "vacancy" ? "" : addSlotEmployeeName}
                  onChange={(event) => setAddSlotEmployeeName(event.target.value)}
                  placeholder="—"
                  disabled={addSlotKind === "vacancy"}
                />
              </label>
              <label>
                ID сотрудника
                <input
                  type="text"
                  value={addSlotKind === "vacancy" ? "" : addSlotEmployeeId}
                  onChange={(event) => setAddSlotEmployeeId(event.target.value)}
                  placeholder="—"
                  disabled={addSlotKind === "vacancy"}
                />
              </label>
            </div>
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
        onDeletePosition={deletePosition}
        readOnly={!canEditWorkspace}
        planPositions={planPositionsForDrawer}
        employeeOptions={employeeOptions}
        suggestedNewEmployeeId={nextEmployeeId(allPositions)}
        isPersisted={Boolean(active && positions.some((item) => item.positionId === active.positionId))}
        correctionWindow={workspaceMode === "correction" ? correctionWindow : undefined}
        departmentOptions={departmentOptions()}
        unitOptionsForDepartment={unitOptions}
        teamOptionsForUnit={teamOptions}
      />

    </div>
  );
}

