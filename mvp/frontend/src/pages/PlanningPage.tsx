import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { PlanContextBar } from "../components/planning/PlanContextBar";
import { MassIndexationCompact } from "../components/planning/MassIndexationCompact";
import { PlanIndexationSection } from "../components/planning/PlanIndexationSection";
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
import { ToolbarMultiSelect } from "../components/ToolbarMultiSelect";
import { loadPersistedOrgSlice, savePersistedOrgSlice } from "../data/persistedOrgSlice";
import { roleCanApplyMassIndexation, roleCanEdit, roleOrgFilterDefaults } from "../data/userAccess";
import {
  annualTotal,
  applyEvents,
  collectIndexationBatchesFromPositions,
  applyExistingIndexationBatches,
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
  removeIndexationBatchFromPositions,
  teamOptions,
  unitOptions,
  upsertEvent,
} from "../data/planningData";
import { positionTableRowClass, JOURNAL_EVENT_TYPE_FILTERS, positionGradeYearRange } from "../data/eventJournal";
import {
  findSalaryBand,
  levelOptionsForSpecialization,
  specializationOptions,
} from "../data/salaryRangeData";
import {
  applyPlanTransferFromDrawerEvent,
  applyTerminationToVacancy,
  mapPositionsWithAppliedEvents,
  mergePlanPositionsWithDraft,
  removePlanEvent,
  removePlanPosition,
  withAppliedEvents,
} from "../data/planOperations";
import { useMvpApp } from "../context/MvpAppContext";
import { AnalyticsSummaryStrip } from "../components/AnalyticsSummaryStrip";
import { ExportCsvActions } from "../components/ExportCsvActions";
import { PositionIdentityCell } from "../components/planning/PositionIdentityCell";
import { PositionDrawer } from "../components/PositionDrawer";
import { formatCrCoefficient } from "../data/positionDisplay";
import type { PlannedEvent, PositionRecord, SalaryRangeBand } from "../types";
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
    if (workspaceMode === "correction") {
      return isQuarterWorkingDraft(activePlan, primaryBudget);
    }
    return isAnnualDraft;
  }, [canEditPlan, isTeamSliceReadOnly, workspaceMode, activePlan, primaryBudget, isAnnualDraft]);

  useEffect(() => {
    if (workspaceMode !== "correction" || !workingDraft) return;
    if (planVersionId !== workingDraft.id) {
      openVersion(workingDraft.id);
    }
  }, [workspaceMode, workingDraft, planVersionId, openVersion]);

  const showQuarterlyWorkspace = Boolean(workingDraft);

  const canMassIndexation = roleCanApplyMassIndexation(userRole);
  const canApplyMassIndexation = canMassIndexation && canEditWorkspace;

  const canAddPosition = roleCanEdit(userRole, leadEditFrozen) && canEditWorkspace;

  const blockEdit = () => {
    if (workspaceMode === "correction") {
      window.alert(
        workingDraft
          ? "Правки только в квартальном черновике с допустимым месяцем события."
          : "Создайте квартальный черновик на странице «Версии» (C&B).",
      );
      return;
    }
    window.alert("Годовые правки — в неутверждённой Версии 1. Квартальные — переключитесь на «Квартальное планирование».");
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
  const [journalMonthFilter, setJournalMonthFilter] = useState<string[]>([]);
  const [journalTypeFilter, setJournalTypeFilter] = useState<string[]>([]);
  const [active, setActive] = useState<PositionRecord | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const suppressDrawerOpenUntil = useRef(0);
  const activeRawRef = useRef<PositionRecord | null>(null);
  const closeGuardTimerRef = useRef<number | null>(null);

  const openDrawer = useCallback(
    (row: PositionRecord) => {
      activeRawRef.current = positions.find((position) => position.positionId === row.positionId) ?? null;
      setActive(row);
      setActiveSourceId(row.positionId);
    },
    [positions],
  );

  const closeDrawer = useCallback(() => {
    suppressDrawerOpenUntil.current = Date.now() + 400;
    if (closeGuardTimerRef.current !== null) {
      window.clearTimeout(closeGuardTimerRef.current);
    }
    document.body.classList.add("drawer-close-guard");
    closeGuardTimerRef.current = window.setTimeout(() => {
      document.body.classList.remove("drawer-close-guard");
      closeGuardTimerRef.current = null;
    }, 400);
    activeRawRef.current = null;
    setActive(null);
    setActiveSourceId(null);
  }, []);
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
      if (closeGuardTimerRef.current !== null) {
        window.clearTimeout(closeGuardTimerRef.current);
        document.body.classList.remove("drawer-close-guard");
      }
    },
    [],
  );
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [addSlotKind, setAddSlotKind] = useState<"vacancy" | "occupied">("vacancy");
  const [addSlotEmployeeId, setAddSlotEmployeeId] = useState("");
  const [addSlotEmployeeName, setAddSlotEmployeeName] = useState("");
  const [addSlotSpec, setAddSlotSpec] = useState("");
  const [addSlotLevel, setAddSlotLevel] = useState("");
  const [addSlotBase, setAddSlotBase] = useState<number | "">("");
  const [pendingAddSlot, setPendingAddSlot] = useState(false);

  const catalogSpecOptions = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const catalogLevelOptions = useMemo(
    () => levelOptionsForSpecialization(addSlotSpec || catalogSpecOptions[0] || "", salaryBands),
    [addSlotSpec, catalogSpecOptions, salaryBands],
  );
  const journalMonthOptions = useMemo(
    () => MONTHS.map((_month, index) => ({ value: String(index), label: monthLabel(index) })),
    [],
  );
  const journalTypeOptions = useMemo(
    () => JOURNAL_EVENT_TYPE_FILTERS.map((group) => ({ value: group.id, label: group.label })),
    [],
  );

  useEffect(() => {
    if (!pendingAddSlot || !canEditWorkspace) return;
    setPendingAddSlot(false);
    setAddSlotKind("vacancy");
    setAddSlotEmployeeId(nextEmployeeId(allPositions));
    setAddSlotEmployeeName("");
    const defaultSpec = catalogSpecOptions[0] ?? "";
    setAddSlotSpec(defaultSpec);
    setAddSlotLevel(levelOptionsForSpecialization(defaultSpec, salaryBands)[0] ?? "");
    const defaultBand = findSalaryBand(defaultSpec, levelOptionsForSpecialization(defaultSpec, salaryBands)[0] ?? "", salaryBands);
    setAddSlotBase(defaultBand?.midpoint ?? "");
    setAddSlotOpen(true);
  }, [pendingAddSlot, canEditWorkspace, allPositions, catalogSpecOptions, salaryBands]);

  const indexationBatches = useMemo(
    () => collectIndexationBatchesFromPositions(allPositions),
    [allPositions],
  );
  const indexationTargetPositions = useMemo(
    () => allPositions.filter((position) => applyEvents(position).status !== "Closed"),
    [allPositions],
  );
  const draftForTable = useMemo(() => {
    if (!active) return null;
    if (positions.some((position) => position.positionId === active.positionId)) return null;
    return active;
  }, [active, positions]);

  const appliedPositions = useMemo(
    () => mapPositionsWithAppliedEvents(mergePlanPositionsWithDraft(positions, draftForTable)),
    [positions, draftForTable],
  );
  const planPositionsForDrawer = useMemo(
    () => mergePlanPositionsWithDraft(positions, draftForTable),
    [positions, draftForTable],
  );

  const journalDiffPositionIds = useMemo(() => {
    const raw = searchParams.get("positions");
    if (!raw || searchParams.get("diff") !== "1") return undefined;
    return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
  }, [searchParams]);

  const journalHighlightPositionId = searchParams.get("position");

  const isLeadRole = userRole === "team_lead" || userRole === "unit_lead";
  const leadQuarterlyOnly = isLeadRole && Boolean(workingDraft);

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

  useEffect(() => {
    if (!leadQuarterlyOnly) return;
    if (workspaceMode === "correction") return;
    setWorkspaceMode("correction");
  }, [leadQuarterlyOnly, workspaceMode]);

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

  useEffect(() => {
    if (workspaceMode !== "correction" || showQuarterlyWorkspace) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("mode");
        return next;
      },
      { replace: true },
    );
  }, [workspaceMode, showQuarterlyWorkspace, setSearchParams]);

  const openPositionFromJournal = (positionId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "positions");
    next.set("position", positionId);
    next.delete("positions");
    next.delete("diff");
    setSearchParams(next);
  };

  const openPositionInDrawer = (positionId: string) => {
    if (Date.now() < suppressDrawerOpenUntil.current) return;
    const raw = positions.find((item) => item.positionId === positionId);
    if (!raw) return;
    openDrawer(mapPositionsWithAppliedEvents([raw])[0]);
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
    setActive((current) => {
      if (!current) {
        activeRawRef.current = null;
        return null;
      }
      const refreshedByActive = positions.find((position) => position.positionId === current.positionId) ?? null;
      const refreshedBySource =
        activeSourceId && activeSourceId !== current.positionId
          ? positions.find((position) => position.positionId === activeSourceId) ?? null
          : null;
      const refreshed = refreshedByActive ?? refreshedBySource;
      if (!refreshed) {
        const isDraftRecord = !positions.some((position) => position.positionId === current.positionId);
        if (isDraftRecord) return current;
        activeRawRef.current = null;
        return null;
      }
      activeRawRef.current = refreshed;
      return withAppliedEvents(refreshed);
    });
  }, [positions, activeSourceId]);

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


  const applyIndexationToPlan = () => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    if (!canApplyMassIndexation) {
      window.alert("Массовая индексация доступна только C&B в режиме правки.");
      return;
    }
    if (!isPlanEventMonthAllowed(idxMonth, correctionWindow)) {
      window.alert(planEventMonthBlockedMessage(correctionWindow));
      return;
    }
    const targets = indexationTargetPositions;
    if (targets.length === 0) {
      showBulkFeedback("warning", "Нет активных позиций в плане для индексации.");
      return;
    }
    const confirmed = window.confirm(
      `Применить индексацию +${idxPercent}% с ${monthLabel(idxMonth)} ко всем позициям плана (${targets.length}, включая вакансии)?`,
    );
    if (!confirmed) return;
    const batchId = crypto.randomUUID();
    const targetIds = new Set(targets.map((item) => item.positionId));

    setPositions((prev) =>
      prev.map((position) => {
        if (!targetIds.has(position.positionId)) return position;
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
    const visibleIds = targets
      .filter((item) => matchesOrgSlice(item, orgSlice))
      .map((item) => item.positionId);
    setRecentlyIndexedIds(visibleIds);
    showBulkFeedback(
      "success",
      `Индексация +${idxPercent}% с ${monthLabel(idxMonth)} применена к ${targets.length} позициям плана.`,
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
    if (!canMassIndexation) {
      window.alert("Удаление пакетов индексации доступно только C&B.");
      return;
    }
    if (!canEditWorkspace) {
      window.alert("Откройте черновик бюджета или квартальный черновик для удаления пакета.");
      return;
    }
    const batch = indexationBatches.find((item) => item.id === batchId);
    const confirmed = window.confirm(
      batch
        ? `Удалить индексацию +${batch.percent}% с ${monthLabel(batch.month)} (${batch.affectedCount} поз.) и откатить оклады?`
        : "Удалить пакет индексации и откатить оклады по всем затронутым позициям?",
    );
    if (!confirmed) return;
    setPositions((prev) => removeIndexationBatchFromPositions(prev, batchId));
    showBulkFeedback("success", "Пакет индексации удалён, оклады пересчитаны.");
  };

  const saveDraftPosition = (updated: PositionRecord, sourcePositionId?: string, forceCreate = false) => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    const sourceId = sourcePositionId ?? updated.positionId;
    const recalculated = applyEvents(updated);
    const withIndexation = forceCreate
      ? applyExistingIndexationBatches(recalculated, allPositions)
      : recalculated;
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
    activeRawRef.current = withIndexation;
    if (forceCreate) {
      showBulkFeedback("success", `Позиция ${withIndexation.positionId} сохранена в плане.`);
    }
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
    setActive((current) => {
      if (!current || current.positionId !== positionId) return current;
      const raw =
        activeRawRef.current?.positionId === positionId
          ? activeRawRef.current
          : positions.find((position) => position.positionId === positionId) ?? current;
      const updated = removePlanEvent([raw], positionId, eventId)[0];
      if (!updated) return current;
      activeRawRef.current = updated;
      return withAppliedEvents(updated);
    });
  };
  const deletePosition = (positionId: string) => {
    if (!canEditWorkspace) {
      blockEdit();
      return;
    }
    setBulkFeedback(null);
    if (bulkFeedbackTimer.current !== null) {
      window.clearTimeout(bulkFeedbackTimer.current);
      bulkFeedbackTimer.current = null;
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
        activeRawRef.current = null;
        setActive(null);
        setActiveSourceId(null);
        showBulkFeedback("success", "Черновик позиции удалён.");
        return;
      }
      window.alert(result.error);
      return;
    }
    setPositions(result.positions);
    activeRawRef.current = null;
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
      const defaultSpec = specializationOptions(salaryBands)[0] ?? "";
      setAddSlotSpec(defaultSpec);
      setAddSlotLevel(levelOptionsForSpecialization(defaultSpec, salaryBands)[0] ?? "");
      const defaultLevel = levelOptionsForSpecialization(defaultSpec, salaryBands)[0] ?? "";
      const defaultBand = findSalaryBand(defaultSpec, defaultLevel, salaryBands);
      setAddSlotBase(defaultBand?.midpoint ?? "");
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

    const spec = addSlotSpec.trim() || catalogSpecOptions[0];
    const level = addSlotLevel.trim() || catalogLevelOptions[0];
    if (!spec || !level) {
      window.alert("Выберите специализацию и уровень из справочника диапазонов.");
      return;
    }
    const band = findSalaryBand(spec, level, salaryBands);
    const baseSalary =
      addSlotBase !== "" && Number(addSlotBase) > 0 ? Number(addSlotBase) : (band?.midpoint ?? 150_000);
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
      monthlySpec: Array.from({ length: 12 }, () => spec),
      monthlyLevel: Array.from({ length: 12 }, () => level),
      monthlyBase: Array.from({ length: 12 }, () => baseSalary),
      monthlyBonus: Array.from({ length: 12 }, () => 0),
      seedMonthlySpec: Array.from({ length: 12 }, () => spec),
      seedMonthlyLevel: Array.from({ length: 12 }, () => level),
      seedMonthlyBase: Array.from({ length: 12 }, () => baseSalary),
      seedMonthlyBonus: Array.from({ length: 12 }, () => 0),
      events: [],
    };
    openDrawer(record);
    setAddSlotOpen(false);
    showBulkFeedback("success", `Позиция ${newId}: укажите оклад и нажмите «Сохранить позицию».`);
  };

  return (
    <div className="content-page planning-page">

      <header className="page-header">
        <div>
          <h1>{PLAN_WORKSPACE_LABELS[workspaceMode]} ФОТ</h1>
          {userRole !== "team_lead" && userRole !== "unit_lead" ? (
            <>
              <p>
                {activePlan.label} · {viewMode === "total" ? "итого ФОТ" : "оклад"} · {tableCounts.total} поз. (
                {tableCounts.occupied} занято, {tableCounts.vacancy} вакансии
                {tableCounts.closed > 0 ? `, ${tableCounts.closed} закрыто` : ""})
              </p>
              <p className="muted-line">{roleScopeHint}</p>
            </>
          ) : (
            <p className="muted-line">
              Сдать команду можно на{" "}
              <Link to="/versions?tab=approval">Мой бюджет</Link>
            </p>
          )}
        </div>
        <div className="page-header__actions planning-toolbar">
          {canMassIndexation && workspaceTab === "positions" ? (
            <MassIndexationCompact
              activeCount={indexationTargetPositions.length}
              idxPercent={idxPercent}
              idxMonth={idxMonth}
              correctionWindow={correctionWindow}
              canEditWorkspace={canEditWorkspace}
              indexationBatches={indexationBatches}
              onPercentChange={setIdxPercent}
              onMonthChange={setIdxMonth}
              onApply={applyIndexationToPlan}
              onDeleteBatch={deleteIndexationBatch}
            />
          ) : null}
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
                data-hint={
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

      {isTeamSliceReadOnly ? (
        <section className="workflow-hint" role="status">
          <p className="workflow-hint__text">
            Команда уже сдана на согласование. Правки в плане заблокированы до возврата на доработку.
          </p>
          <Link className="workflow-hint__link" to="/versions?tab=approval">
            Открыть согласование
          </Link>
        </section>
      ) : null}

      <nav className="planning-workspace-tabs planning-mode-tabs" aria-label="Режим планирования">
        {!leadQuarterlyOnly ? (
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceMode === "planning" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceMode("planning")}
        >
          Годовое планирование
        </button>
        ) : null}
        {showQuarterlyWorkspace ? (
          <button
            type="button"
            className={`planning-workspace-tabs__btn${workspaceMode === "correction" ? " planning-workspace-tabs__btn--active" : ""}`}
            onClick={() => setWorkspaceMode("correction")}
          >
            Квартальное планирование
          </button>
        ) : null}
      </nav>

      <nav
        className="planning-workspace-tabs"
        aria-label={workspaceMode === "correction" ? "Разделы квартального планирования" : "Разделы планирования"}
      >
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "positions" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("positions")}
          data-hint="Таблица позиций; клик по строке откроет карточку"
        >
          Позиции
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "matrix" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("matrix")}
          data-hint="План на конец месяца по позициям"
        >
          По месяцам
        </button>
        <button
          type="button"
          className={`planning-workspace-tabs__btn${workspaceTab === "journal" ? " planning-workspace-tabs__btn--active" : ""}`}
          onClick={() => setWorkspaceTab("journal")}
          data-hint="Все события версии; клик откроет позицию"
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
      />

      {workspaceTab === "positions" && !canMassIndexation && indexationBatches.length > 0 ? (
        <PlanIndexationSection
          batches={indexationBatches}
          isIndexationAdmin={false}
          canEditWorkspace={canEditWorkspace}
          activeCount={indexationTargetPositions.length}
          idxPercent={idxPercent}
          idxMonth={idxMonth}
          correctionWindow={correctionWindow}
          onPercentChange={setIdxPercent}
          onMonthChange={setIdxMonth}
          onApply={applyIndexationToPlan}
          onDeleteBatch={deleteIndexationBatch}
        />
      ) : null}

      {workspaceTab === "positions" || workspaceTab === "matrix" || workspaceTab === "journal" ? (
        <SliceToolbar
          sticky
          className={workspaceTab === "journal" ? "slice-toolbar--journal" : undefined}
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
              <ToolbarMultiSelect
                label="Месяц"
                options={journalMonthOptions}
                value={journalMonthFilter}
                onChange={setJournalMonthFilter}
              />
              <ToolbarMultiSelect
                label="Тип"
                options={journalTypeOptions}
                value={journalTypeFilter}
                onChange={setJournalTypeFilter}
              />
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
              const gradeRange = positionGradeYearRange(row);
              const rowExtra = recentlyIndexedIds.includes(row.positionId) ? "row-updated" : undefined;
              const eventCount = row.events.length;
              return (
                <tr
                  key={row.positionId}
                  onPointerDown={(event) => {
                    if (Date.now() < suppressDrawerOpenUntil.current) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }}
                  onClick={() => {
                    if (Date.now() < suppressDrawerOpenUntil.current) return;
                    openDrawer(row);
                  }}
                  className={positionTableRowClass(row, rowExtra)}
                  data-hint="Открыть карточку позиции"
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
                    {gradeRange.changed ? (
                      <div className="positions-table__dec-range">
                        {gradeRange.before} → {gradeRange.after}
                      </div>
                    ) : (
                      <>
                        {row.monthlySpec[11]}
                        <div className="muted-line">{row.monthlyLevel[11]}</div>
                      </>
                    )}
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
                        data-hint="Удалить из плана"
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
        <section className="planning-workspace-panel planning-workspace-panel--journal">
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
                Специализация
                <select
                  value={addSlotSpec}
                  onChange={(event) => {
                    const spec = event.target.value;
                    setAddSlotSpec(spec);
                    const levels = levelOptionsForSpecialization(spec, salaryBands);
                    const level = levels[0] ?? "";
                    setAddSlotLevel(level);
                    const band = findSalaryBand(spec, level, salaryBands);
                    setAddSlotBase(band?.midpoint ?? "");
                  }}
                >
                  {catalogSpecOptions.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Уровень
                <select
                  value={addSlotLevel}
                  onChange={(event) => {
                    const level = event.target.value;
                    setAddSlotLevel(level);
                    const band = findSalaryBand(addSlotSpec, level, salaryBands);
                    if (addSlotBase === "" && band) setAddSlotBase(band.midpoint);
                  }}
                >
                  {catalogLevelOptions.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Оклад, ₽
                <input
                  type="number"
                  min={0}
                  value={addSlotBase}
                  onChange={(event) =>
                    setAddSlotBase(event.target.value === "" ? "" : Number(event.target.value))
                  }
                  placeholder="из справочника"
                />
              </label>
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
        onClose={closeDrawer}
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

