import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { applyEvents, initialPositions } from "../data/planningData";
import { DEMO_SEED_VERSION, DEMO_SEED_VERSION_KEY } from "../data/demoPlanSeed";
import { buildDemoQuarterlyVersionState, applyDemoQuarterlyScenarioSideEffects } from "../data/demoVersionSeed";
import { diffPlanVersions, type PlanVersionDiffSummary } from "../data/planVersionDiff";
import {
  archiveApprovedVersion,
  buildPublishedVersionMeta,
  buildWorkingDraftMeta,
  buildApprovalRoute,
  canEditVersion,
  clonePositionList,
  findWorkingDraftForBaseline,
  initialPlanVersions,
  isBudgetLocked,
  latestApprovedVersion,
  loadPersistedDataByVersion,
  loadPersistedVersions,
  migrateLegacyStorage,
  persistDataByVersion,
  persistVersions,
  positionsForPublishedVersion,
  primaryBudgetVersion,
  repairDataByVersion,
  repairVersionLabels,
  type ApprovalStep,
  type PlanVersionMeta,
} from "../data/planVersions";
import { mapPositionsWithAppliedEvents } from "../data/planOperations";
import {
  extractImportablePositions,
  formatImportReport,
  inspectSnapshot,
  type ImportMode,
  type ImportReport,
  type MvpPlanSnapshot,
  type SnapshotPreview,
} from "../data/snapshotImport";
import {
  LAST_EXPORTED_SNAPSHOT_KEY,
  loadSnapshot,
  loadSnapshotRaw,
  PRE_IMPORT_BACKUP_KEY,
  saveSnapshot,
  validateSnapshot,
} from "../data/snapshotAdapter";
import {
  listOperationHistory,
  recordPreImportPoint,
  recordRollbackExport,
  recordRollbackPreImport,
  type OperationLogEntry,
} from "../data/operationHistory";
import { initialSalaryBands } from "../data/salaryRangeData";
import {
  APPROVAL_RULE_DEFINITIONS,
  evaluateDraftApprovalRules,
  validateDraftForApproval,
  type DraftApprovalCheck,
} from "../data/planApprovalRules";
import {
  filterPositionsByRole,
  formatDemoRoleScope,
  demoRoleScope,
  loadLeadEditFrozen,
  loadUserRole,
  mergeScopedPositionUpdates,
  roleCanEdit,
  roleCanImportFact,
  roleCanImportPlan,
  roleCanManageVersions,
  roleCanSwitchPlanVersions,
  roleCanToggleLeadFreeze,
  roleScopeDescription,
  saveLeadEditFrozen,
  saveUserRole,
  type UserRole,
} from "../data/userAccess";
import type { ViewMode } from "../data/dashboardMetrics";
import { resolvePlanFactBaseline, type PlanFactBaseline } from "../data/planFactBaseline";
import { deletePlanVersionState } from "../data/planVersionDelete";
import {
  applyPilotBundleSideEffects,
  buildPilotPlanBundle,
  type PilotBundleResult,
} from "../data/pilotTestBundle";
import { applyAnnualPlanningScenarioFactPolicy, PLAN_SCENARIO_INCLUDES_FACT } from "../data/planScenario";
import { hasFactData, seedDemoFactFromPlan } from "../data/factStore";
import { yieldToMain } from "../data/asyncYield";
import { formatPlanVersionTitle } from "../data/planVersionDisplay";
import { canReopenPrimaryBudget, reopenPrimaryBudgetMeta } from "../data/planVersionLifecycle";
import { clearPilotDemoStorage } from "../data/mvpStorageReset";
import { clearSubmissionsForPlan, getTeamSubmission, isTeamEditingLocked } from "../data/teamSubmissionStore";
import { scopePrimaryEq } from "../data/personaAccessScope";
import {
  loadResolvedCatalogAccess,
  loadResolvedDemoPersona,
  readPersonaCatalogAccessOverrides,
  writePersonaCatalogAccessOverrides,
} from "../data/demoSessionStore";
import type { PositionRecord, SalaryCatalogAccess, SalaryRangeBand } from "../types";

export type { UserRole };
export { USER_ROLE_LABELS } from "../data/userAccess";

export type { MvpPlanSnapshot, SnapshotPreview, ImportReport, ImportMode, PlanVersionMeta };
export { formatImportReport };

/** @deprecated Используйте PlanVersionMeta */
export type PlanVersionMock = PlanVersionMeta;

const TEAM_SUBMISSIONS_KEY = "mvp.teamSubmissions";

function applyDemoSeedUpgrade(): {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
} | null {
  try {
    const stored = localStorage.getItem(DEMO_SEED_VERSION_KEY);
    if (stored === String(DEMO_SEED_VERSION)) return null;
  } catch {
    /* ignore */
  }
  localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
  try {
    localStorage.removeItem(TEAM_SUBMISSIONS_KEY);
  } catch {
    /* ignore */
  }
  const state = buildDemoQuarterlyVersionState();
  const draft = state.versions.find((version) => version.kind === "WORKING_DRAFT");
  if (draft) applyDemoQuarterlyScenarioSideEffects(draft.id);
  return state;
}

function hydrateState(): {
  versions: PlanVersionMeta[];
  dataByVersion: Record<string, PositionRecord[]>;
} {
  const persistedVersions = loadPersistedVersions();
  const persistedData = loadPersistedDataByVersion();
  const migrated = migrateLegacyStorage(persistedVersions, persistedData);
  if (migrated) {
    return migrated;
  }
  if (persistedVersions && persistedData) {
    const upgraded = applyDemoSeedUpgrade();
    if (upgraded) return upgraded;
    const repaired = repairDataByVersion(persistedVersions, persistedData);
    return {
      versions: repairVersionLabels(persistedVersions),
      dataByVersion: repaired,
    };
  }
  localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
  const fresh = buildDemoQuarterlyVersionState();
  const draft = fresh.versions.find((version) => version.kind === "WORKING_DRAFT");
  if (draft) applyDemoQuarterlyScenarioSideEffects(draft.id);
  return fresh;
}

type VersionDiffBundle = {
  rows: ReturnType<typeof diffPlanVersions>["rows"];
  summary: PlanVersionDiffSummary;
  baselinePositions: PositionRecord[];
  draftPositions: PositionRecord[];
};

type MvpAppContextValue = {
  planVersions: PlanVersionMeta[];
  planVersionId: string;
  setPlanVersionId: (id: string) => void;
  activePlan: PlanVersionMeta;
  canEditPlan: boolean;
  leadEditFrozen: boolean;
  setLeadEditFrozen: (frozen: boolean) => void;
  canToggleLeadFreeze: boolean;
  leadEditFrozenForRole: boolean;
  canManagePlanVersions: boolean;
  canImportFact: boolean;
  canImportPlan: boolean;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  roleScopeHint: string;
  /** Все позиции текущей версии (без RBAC-фильтра) — для ID новых позиций. */
  allPositions: PositionRecord[];
  positionsTotalCount: number;
  workingDraft: PlanVersionMeta | null;
  latestApproved: PlanVersionMeta | null;
  versionDiff: VersionDiffBundle;
  createWorkingDraft: (sourceApprovedId?: string) => { ok: true; draftId: string } | { ok: false; error: string };
  publishWorkingDraft: () =>
    | { ok: true; versionId: string; versionLabel: string }
    | { ok: false; error: string };
  approvePrimaryBudget: () => { ok: true } | { ok: false; error: string };
  reopenPrimaryBudget: () => { ok: true } | { ok: false; error: string };
  submitDraftForApproval: () => { ok: true } | { ok: false; error: string };
  draftApprovalCheck: DraftApprovalCheck;
  approvalRoute: ApprovalStep[];
  primaryBudget: PlanVersionMeta | null;
  /** База плана для страниц план–факт (последняя утверждённая, не черновик в сайдбаре). */
  planFactBaseline: PlanFactBaseline;
  openVersion: (id: string) => { ok: true } | { ok: false; error: string };
  deletePlanVersion: (versionId: string) => { ok: true; deletedLabel: string } | { ok: false; error: string };
  positions: PositionRecord[];
  setPositions: Dispatch<SetStateAction<PositionRecord[]>>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  pickAmount: (base: number, bonus?: number) => number;
  salaryBands: SalaryRangeBand[];
  setSalaryBands: Dispatch<SetStateAction<SalaryRangeBand[]>>;
  catalogAccess: SalaryCatalogAccess;
  setCatalogAccess: (access: SalaryCatalogAccess) => void;
  canEditSalaryCatalog: boolean;
  exportCurrentSnapshot: () => MvpPlanSnapshot;
  inspectSnapshot: (
    payload: unknown,
  ) =>
    | { ok: true; preview: SnapshotPreview; warnings: string[]; positionSkipNotes: string[] }
    | { ok: false; errors: string[] };
  backupBeforeImport: () => void;
  importCurrentSnapshot: (
    payload: unknown,
    mode?: ImportMode,
    options?: { recordHistory?: boolean },
  ) => { ok: true; report: ImportReport } | { ok: false; error: string };
  restoreFromLastExport: () => { ok: true; importedCount: number } | { ok: false; error: string };
  restoreFromPreImportBackup: () => { ok: true; report: ImportReport } | { ok: false; error: string };
  restoreFromHistoryEntry: (entryId: string) => { ok: true; report: ImportReport } | { ok: false; error: string };
  operationHistory: OperationLogEntry[];
  refreshOperationHistory: () => void;
  resetDevPlanToDraft: () => { ok: true } | { ok: false; error: string };
  reloadDemoSeed: () => { ok: true; count: number } | { ok: false; error: string };
  loadPilotTestBundle: () => Promise<
    { ok: true; summary: string } & PilotBundleResult | { ok: false; error: string }
  >;
  /** Сброс пилота/плана в браузере и перезагрузка страницы. */
  clearPilotTestBundle: () => { ok: true } | { ok: false; error: string };
  demoRoleScopeLabel: string | null;
  /** Имя пользователя на экране входа (Вася, C&B, …). */
  demoPersonaLabel: string | null;
  refreshAppConfig: () => void;
  appConfigRevision: number;
  teamSubmissionRevision: number;
  refreshTeamSubmissions: () => void;
  /** team_lead: правки заблокированы после «Сдал команду». */
  isTeamSliceReadOnly: boolean;
};

const MvpAppContext = createContext<MvpAppContextValue | null>(null);

const DATA_PERSIST_DEBOUNCE_MS = 300;

export function MvpAppProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => hydrateState(), []);
  const [planVersions, setPlanVersions] = useState<PlanVersionMeta[]>(initial.versions);
  const [dataByVersion, setDataByVersion] = useState<Record<string, PositionRecord[]>>(initial.dataByVersion);
  const [planVersionId, setPlanVersionIdState] = useState(() => {
    const stored = localStorage.getItem("fot_mvp_plan_version");
    if (stored && initial.versions.some((version) => version.id === stored)) return stored;
    return latestApprovedVersion(initial.versions)?.id ?? initial.versions[0].id;
  });
  const [operationHistory, setOperationHistory] = useState(() => listOperationHistory());
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem("fot_mvp_view_mode");
    return stored === "total" ? "total" : "base";
  });
  const [salaryBands, setSalaryBands] = useState<SalaryRangeBand[]>(() => initialSalaryBands());
  const [userRole, setUserRoleState] = useState<UserRole>(() => loadUserRole());
  const [leadEditFrozen, setLeadEditFrozenState] = useState(() => loadLeadEditFrozen());
  const [configRevision, setConfigRevision] = useState(0);
  const [teamSubmissionRevision, setTeamSubmissionRevision] = useState(0);
  const bulkHydratingRef = useRef(false);
  const persistDataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistUntilReadyRef = useRef(true);
  const demoFactSeededRef = useRef(false);

  useEffect(() => {
    applyAnnualPlanningScenarioFactPolicy();
  }, []);

  useEffect(() => {
    if (demoFactSeededRef.current || !PLAN_SCENARIO_INCLUDES_FACT || hasFactData()) return;
    const rows = dataByVersion[planVersionId];
    if (!rows?.length) return;
    seedDemoFactFromPlan(rows);
    demoFactSeededRef.current = true;
  }, [dataByVersion, planVersionId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      skipPersistUntilReadyRef.current = false;
    }, 800);
    return () => window.clearTimeout(id);
  }, []);

  const refreshAppConfig = useCallback(() => {
    setUserRoleState(loadUserRole());
    setLeadEditFrozenState(loadLeadEditFrozen());
    setConfigRevision((value) => value + 1);
  }, []);

  const refreshTeamSubmissions = useCallback(() => {
    setTeamSubmissionRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (bulkHydratingRef.current || skipPersistUntilReadyRef.current) return;
    persistVersions(planVersions);
  }, [planVersions]);

  useEffect(() => {
    if (bulkHydratingRef.current || skipPersistUntilReadyRef.current) return;
    if (persistDataTimerRef.current) clearTimeout(persistDataTimerRef.current);
    persistDataTimerRef.current = setTimeout(() => {
      persistDataByVersion(dataByVersion);
    }, DATA_PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistDataTimerRef.current) clearTimeout(persistDataTimerRef.current);
    };
  }, [dataByVersion]);

  const refreshOperationHistory = useCallback(() => {
    setOperationHistory(listOperationHistory());
  }, []);

  const setCatalogAccess = (access: SalaryCatalogAccess) => {
    const persona = loadResolvedDemoPersona();
    if (persona) {
      writePersonaCatalogAccessOverrides({
        ...readPersonaCatalogAccessOverrides(),
        [persona.id]: access,
      });
    } else {
      localStorage.setItem("fot_mvp_catalog_access", access);
    }
    setConfigRevision((value) => value + 1);
  };

  const catalogAccess = useMemo(() => loadResolvedCatalogAccess(), [userRole, configRevision]);

  const setUserRole = (role: UserRole) => {
    saveUserRole(role);
    setUserRoleState(role);
  };

  const setLeadEditFrozen = (frozen: boolean) => {
    saveLeadEditFrozen(frozen);
    setLeadEditFrozenState(frozen);
  };

  const setPlanVersionId = (id: string) => {
    setPlanVersionIdState(id);
    localStorage.setItem("fot_mvp_plan_version", id);
  };

  const openVersion = useCallback(
    (id: string): { ok: true } | { ok: false; error: string } => {
      const version = planVersions.find((item) => item.id === id);
      if (!version) {
        return { ok: false, error: "Версия не найдена." };
      }
      let nextData = repairDataByVersion(planVersions, dataByVersion);
      const rows = nextData[id];
      if (!rows?.length && version.baselineVersionId) {
        const baselineRows = nextData[version.baselineVersionId];
        if (!baselineRows?.length) {
          return { ok: false, error: "Нет данных для этой версии. Создайте черновик заново." };
        }
        nextData = { ...nextData, [id]: clonePositionList(baselineRows) };
      } else if (!rows?.length && version.kind === "APPROVED") {
        return { ok: false, error: "Версия пуста — импортируйте план или сбросьте данные." };
      }
      setDataByVersion(nextData);
      setPlanVersionId(id);
      return { ok: true };
    },
    [planVersions, dataByVersion],
  );

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem("fot_mvp_view_mode", mode);
    setViewModeState(mode);
  };

  const allPositions = dataByVersion[planVersionId] ?? [];
  const positions = useMemo(
    () => filterPositionsByRole(allPositions, userRole),
    [allPositions, userRole, configRevision],
  );
  const positionsTotalCount = allPositions.length;
  const roleScopeHint = useMemo(() => roleScopeDescription(userRole, leadEditFrozen), [userRole, leadEditFrozen, configRevision]);
  const canToggleLeadFreeze = roleCanToggleLeadFreeze(userRole);
  const leadEditFrozenForRole = leadEditFrozen && (userRole === "team_lead" || userRole === "unit_lead");
  const canManagePlanVersions = roleCanManageVersions(userRole);
  const canImportFact = roleCanImportFact(userRole);
  const canImportPlan = roleCanImportPlan(userRole);

  const setPositions = useCallback<Dispatch<SetStateAction<PositionRecord[]>>>(
    (updater) => {
      setDataByVersion((prev) => {
        const current = prev[planVersionId] ?? [];
        const scopedBefore = filterPositionsByRole(current, userRole);
        const scopedNext =
          typeof updater === "function" ? updater(scopedBefore) : updater;
        const next = mergeScopedPositionUpdates(current, scopedBefore, scopedNext);
        return { ...prev, [planVersionId]: next };
      });
    },
    [planVersionId, userRole],
  );

  const activePlan = useMemo(
    () => planVersions.find((version) => version.id === planVersionId) ?? planVersions[0],
    [planVersions, planVersionId],
  );

  const canEditPlan =
    canEditVersion(activePlan) &&
    roleCanEdit(userRole, leadEditFrozen) &&
    !(userRole === "team_lead" && activePlan.kind === "APPROVED" && activePlan.status !== "DRAFT");
  const primaryBudget = useMemo(() => primaryBudgetVersion(planVersions) ?? null, [planVersions]);
  const latestApproved = useMemo(() => latestApprovedVersion(planVersions) ?? null, [planVersions]);
  const planFactBaselineRaw = useMemo(
    () => resolvePlanFactBaseline(planVersions, dataByVersion, planVersionId),
    [planVersions, dataByVersion, planVersionId],
  );
  const planFactBaseline = useMemo(
    () => {
      const positions = filterPositionsByRole(planFactBaselineRaw.positions, userRole);
      return {
        ...planFactBaselineRaw,
        positions,
        appliedPositions: mapPositionsWithAppliedEvents(positions),
      };
    },
    [planFactBaselineRaw, userRole, configRevision],
  );
  const demoRoleScopeLabel = useMemo(() => formatDemoRoleScope(userRole), [userRole, configRevision]);
  const demoPersonaLabel = useMemo(
    () => loadResolvedDemoPersona()?.displayName ?? null,
    [userRole, configRevision],
  );
  const workingDraft = useMemo(() => {
    if (!latestApproved) return null;
    return findWorkingDraftForBaseline(planVersions, latestApproved.id) ?? null;
  }, [planVersions, latestApproved]);

  const isTeamSliceReadOnly = useMemo(() => {
    if (userRole !== "team_lead") return false;
    const scope = demoRoleScope("team_lead");
    const department = scopePrimaryEq(scope, "department");
    const unit = scopePrimaryEq(scope, "unit");
    const team = scopePrimaryEq(scope, "team");
    if (!department || !unit || !team) return false;
    const planVersionId =
      workingDraft?.id ??
      (primaryBudget?.status === "DRAFT" && primaryBudget.versionNumber === 1 ? primaryBudget.id : null);
    if (!planVersionId) return false;
    const submission = getTeamSubmission(planVersionId, department, unit, team);
    return isTeamEditingLocked(submission);
  }, [userRole, workingDraft, primaryBudget, teamSubmissionRevision, configRevision]);
  const approvalRoute = useMemo(
    () => buildApprovalRoute(planVersions, workingDraft),
    [planVersions, workingDraft],
  );

  useEffect(() => {
    setDataByVersion((prev) => repairDataByVersion(planVersions, prev));
  }, [planVersions]);

  useEffect(() => {
    if (roleCanSwitchPlanVersions(userRole)) return;
    if (!workingDraft) return;
    if (planVersionId === workingDraft.id) return;
    openVersion(workingDraft.id);
  }, [userRole, workingDraft, planVersionId, openVersion]);

  const approvePrimaryBudget = useCallback((): { ok: true } | { ok: false; error: string } => {
    const primary = primaryBudgetVersion(planVersions);
    if (!primary) return { ok: false, error: "Первая версия бюджета не найдена." };
    if (isBudgetLocked(primary)) {
      return { ok: false, error: `${formatPlanVersionTitle(primary)} уже утверждён.` };
    }
    const rows = dataByVersion[primary.id];
    if (!rows?.length) return { ok: false, error: "Нет позиций для утверждения." };
    const now = new Date().toISOString();
    setPlanVersions((prev) =>
      prev.map((version) =>
        version.id === primary.id
          ? { ...version, status: "APPROVED", publishedAt: now }
          : version,
      ),
    );
    return { ok: true };
  }, [planVersions, dataByVersion]);

  const reopenPrimaryBudget = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (!canManagePlanVersions) {
      return { ok: false, error: "Откат утверждения доступен только роли C&B." };
    }
    const policy = canReopenPrimaryBudget(planVersions);
    if (!policy.ok) return policy;
    const primary = primaryBudgetVersion(planVersions);
    if (!primary) return { ok: false, error: "Первая версия бюджета не найдена." };
    setPlanVersions((prev) =>
      repairVersionLabels(
        prev.map((version) => (version.id === primary.id ? reopenPrimaryBudgetMeta(version) : version)),
      ),
    );
    setPlanVersionId(primary.id);
    return { ok: true };
  }, [planVersions, canManagePlanVersions]);

  const versionDiff = useMemo((): VersionDiffBundle => {
    const emptySummary: PlanVersionDiffSummary = {
      baselineLabel: "—",
      draftLabel: "—",
      baselineHeadcount: 0,
      draftHeadcount: 0,
      headcountDelta: 0,
      baselineAnnualFot: 0,
      draftAnnualFot: 0,
      annualFotDelta: 0,
      baselineDecPrev: 0,
      draftDecPrev: 0,
      baselineDecPlan: 0,
      draftDecPlan: 0,
      baselineDecPct: 0,
      draftDecPct: 0,
      decPctDelta: 0,
      changedCount: 0,
      addedCount: 0,
      removedCount: 0,
    };
    if (!workingDraft?.baselineVersionId) {
      return { rows: [], summary: emptySummary, baselinePositions: [], draftPositions: [] };
    }
    const baseline = planVersions.find((version) => version.id === workingDraft.baselineVersionId);
    const baselinePositions = dataByVersion[workingDraft.baselineVersionId] ?? [];
    const draftPositions = dataByVersion[workingDraft.id] ?? [];
    const { rows, summary } = diffPlanVersions(baselinePositions, draftPositions, {
      baselineLabel: baseline?.label ?? workingDraft.baselineVersionId,
      draftLabel: workingDraft.label,
    });
    return { rows, summary, baselinePositions, draftPositions };
  }, [workingDraft, planVersions, dataByVersion]);

  const draftApprovalCheck = useMemo((): DraftApprovalCheck => {
    const { baselinePositions, draftPositions } = versionDiff;
    if (!workingDraft || baselinePositions.length === 0) {
      return { triggered: [], clear: [...APPROVAL_RULE_DEFINITIONS] };
    }
    return evaluateDraftApprovalRules(baselinePositions, draftPositions);
  }, [versionDiff, workingDraft]);

  const submitDraftForApproval = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (!workingDraft) return { ok: false, error: "Нет рабочего черновика." };
    const draftPositions = dataByVersion[workingDraft.id] ?? [];
    const structural = validateDraftForApproval(draftPositions);
    if (!structural.ok) return structural;
    setPlanVersions((prev) =>
      prev.map((version) =>
        version.id === workingDraft.id ? { ...version, status: "IN_APPROVAL" } : version,
      ),
    );
    return { ok: true };
  }, [workingDraft, dataByVersion]);

  const createWorkingDraft = useCallback(
    (sourceApprovedId?: string): { ok: true; draftId: string } | { ok: false; error: string } => {
      const source =
        planVersions.find((version) => version.id === (sourceApprovedId ?? latestApproved?.id)) ??
        latestApproved;
      if (!source || source.kind !== "APPROVED") {
        return { ok: false, error: "Нужна версия бюджета как база для черновика." };
      }
      if (!isBudgetLocked(source)) {
        return {
          ok: false,
          error: "Сначала утвердите базовую версию бюджета (кнопка на странице «Версии»).",
        };
      }
      if (findWorkingDraftForBaseline(planVersions, source.id)) {
        return { ok: false, error: "Черновик для этой версии уже существует." };
      }
      const sourcePositions = dataByVersion[source.id];
      if (!sourcePositions?.length) {
        return { ok: false, error: "В базовой версии нет данных позиций." };
      }
      const draftMeta = buildWorkingDraftMeta(source);
      setPlanVersions((prev) => [...prev, draftMeta]);
      setDataByVersion((prev) => ({
        ...prev,
        [draftMeta.id]: clonePositionList(sourcePositions),
      }));
      return { ok: true, draftId: draftMeta.id };
    },
    [planVersions, latestApproved, dataByVersion],
  );

  const publishWorkingDraft = useCallback((): ReturnType<MvpAppContextValue["publishWorkingDraft"]> => {
    if (!workingDraft?.baselineVersionId) {
      return { ok: false, error: "Нет рабочего черновика для публикации." };
    }
    if (workingDraft.status !== "IN_APPROVAL") {
      return { ok: false, error: "Сначала отправьте черновик на согласование." };
    }
    const parent = planVersions.find((version) => version.id === workingDraft.baselineVersionId);
    if (!parent || parent.kind !== "APPROVED") {
      return { ok: false, error: "Базовая утверждённая версия не найдена." };
    }
    const draftPositions = dataByVersion[workingDraft.id];
    const parentPositions = dataByVersion[parent.id];
    if (!draftPositions?.length) {
      return { ok: false, error: "Черновик пуст." };
    }
    const publishedMeta = buildPublishedVersionMeta(workingDraft, parent);
    const nextPositions = positionsForPublishedVersion(draftPositions, parentPositions ?? []);

    setPlanVersions((prev) => {
      const withoutDraft = prev.filter((version) => version.id !== workingDraft.id);
      const archived = withoutDraft.map((version) =>
        version.id === parent.id ? archiveApprovedVersion(version) : version,
      );
      return [...archived, publishedMeta];
    });
    setDataByVersion((prev) => {
      const next = { ...prev };
      delete next[workingDraft.id];
      next[publishedMeta.id] = nextPositions;
      return next;
    });
    return { ok: true, versionId: publishedMeta.id, versionLabel: publishedMeta.label };
  }, [workingDraft, planVersions, dataByVersion]);

  const deletePlanVersion = useCallback(
    (versionId: string): { ok: true; deletedLabel: string } | { ok: false; error: string } => {
      if (!roleCanManageVersions(userRole)) {
        return { ok: false, error: "Удаление версий доступно только C&B." };
      }
      const result = deletePlanVersionState(versionId, planVersions, dataByVersion, planVersionId);
      if (!result.ok) return result;
      setPlanVersions(result.versions);
      setDataByVersion(result.dataByVersion);
      clearSubmissionsForPlan(versionId);
      refreshTeamSubmissions();
      if (planVersionId === versionId) {
        setPlanVersionId(result.fallbackVersionId);
      }
      return { ok: true, deletedLabel: result.deletedLabel };
    },
    [userRole, planVersions, dataByVersion, planVersionId, refreshTeamSubmissions],
  );

  const pickAmount = useCallback(
    (base: number, bonus = 0) => (viewMode === "total" ? base + bonus : base),
    [viewMode],
  );

  const buildSnapshot = useCallback((): MvpPlanSnapshot => {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      planVersionId,
      salaryBands,
      positions,
    };
  }, [planVersionId, salaryBands, positions]);

  const applySnapshot = useCallback(
    (draft: MvpPlanSnapshot, mode: ImportMode, skippedInFile: number): ImportReport => {
      const { positions: rawPositions } = extractImportablePositions(draft);
      const importedPositions = rawPositions.map((item) => applyEvents(item));
      const previousById = new Map(positions.map((item) => [item.positionId, item] as const));
      const mergedById = new Map<string, PositionRecord>(positions.map((item) => [item.positionId, item]));
      importedPositions.forEach((item) => {
        mergedById.set(item.positionId, item);
      });
      const nextPositions = mode === "replace" ? importedPositions : [...mergedById.values()];
      const addedCount = importedPositions.filter((item) => !previousById.has(item.positionId)).length;
      const updatedCount = importedPositions.filter((item) => previousById.has(item.positionId)).length;
      const importedIds = new Set(importedPositions.map((item) => item.positionId));
      const unchangedCount = mode === "merge" ? positions.filter((p) => !importedIds.has(p.positionId)).length : 0;

      if (mode === "replace") {
        setSalaryBands(draft.salaryBands);
      } else {
        const nextBandsById = new Map(salaryBands.map((band) => [band.id, band] as const));
        draft.salaryBands.forEach((band) => {
          nextBandsById.set(band.id, band);
        });
        setSalaryBands([...nextBandsById.values()]);
      }
      setPositions(nextPositions);
      const importedEventCount = importedPositions.reduce((sum, item) => sum + item.events.length, 0);
      return {
        mode,
        importedCount: nextPositions.length,
        addedCount,
        updatedCount,
        skippedCount: skippedInFile,
        unchangedCount,
        importedEventCount,
        previousPositionCount: positions.length,
        nextPositionCount: nextPositions.length,
      };
    },
    [positions, salaryBands, setPositions],
  );

  const runImport = useCallback(
    (
      payload: unknown,
      mode: ImportMode = "replace",
    ): { ok: true; report: ImportReport } | { ok: false; error: string } => {
      const inspected = validateSnapshot(payload, { currentPlanVersionId: planVersionId });
      if (!inspected.ok) {
        return { ok: false, error: inspected.errors.join(" ") };
      }
      const draft = payload as MvpPlanSnapshot;
      const { skippedCount } = extractImportablePositions(payload);
      try {
        const report = applySnapshot(draft, mode, skippedCount);
        return { ok: true, report };
      } catch (error) {
        return {
          ok: false,
          error: `Не удалось импортировать данные: ${error instanceof Error ? error.message : "неизвестная ошибка"}.`,
        };
      }
    },
    [planVersionId, applySnapshot],
  );

  const exportCurrentSnapshot = useCallback((): MvpPlanSnapshot => {
    const snapshot = buildSnapshot();
    saveSnapshot(LAST_EXPORTED_SNAPSHOT_KEY, snapshot);
    return snapshot;
  }, [buildSnapshot]);

  const inspectSnapshotForImport = useCallback(
    (payload: unknown) => inspectSnapshot(payload, { currentPlanVersionId: planVersionId }),
    [planVersionId],
  );

  const backupBeforeImport = useCallback(() => {
    saveSnapshot(PRE_IMPORT_BACKUP_KEY, buildSnapshot());
  }, [buildSnapshot]);

  const importCurrentSnapshot = useCallback(
    (
      payload: unknown,
      mode: ImportMode = "replace",
      options?: { recordHistory?: boolean },
    ): { ok: true; report: ImportReport } | { ok: false; error: string } => {
      if (!canImportPlan) {
        return { ok: false, error: "Импорт плана доступен только роли C&B." };
      }
      if (!canEditPlan) {
        return { ok: false, error: "Импорт доступен только в рабочем черновике." };
      }
      if (options?.recordHistory !== false) {
        recordPreImportPoint(buildSnapshot(), mode);
      }
      const result = runImport(payload, mode);
      if (result.ok) {
        refreshOperationHistory();
      }
      return result;
    },
    [canImportPlan, canEditPlan, buildSnapshot, runImport, refreshOperationHistory],
  );

  const restoreFromLastExport = useCallback((): { ok: true; importedCount: number } | { ok: false; error: string } => {
    const raw = loadSnapshotRaw(LAST_EXPORTED_SNAPSHOT_KEY);
    if (!raw) {
      return { ok: false, error: "Нет сохраненного экспорта для отката." };
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const before = buildSnapshot();
      const restored = runImport(parsed, "replace");
      if (!restored.ok) return restored;
      recordRollbackExport(before);
      refreshOperationHistory();
      return { ok: true, importedCount: restored.report.importedCount };
    } catch {
      return { ok: false, error: "Сохраненный экспорт поврежден, откат недоступен." };
    }
  }, [buildSnapshot, runImport, refreshOperationHistory]);

  const restoreFromPreImportBackup = useCallback((): { ok: true; report: ImportReport } | { ok: false; error: string } => {
    const snapshot = loadSnapshot(PRE_IMPORT_BACKUP_KEY);
    if (!snapshot) {
      return { ok: false, error: "Нет авто-бэкапа до импорта." };
    }
    const before = buildSnapshot();
    const restored = runImport(snapshot, "replace");
    if (!restored.ok) return restored;
    recordRollbackPreImport(before);
    refreshOperationHistory();
    return restored;
  }, [buildSnapshot, runImport, refreshOperationHistory]);

  const restoreFromHistoryEntry = useCallback((entryId: string): { ok: true; report: ImportReport } | { ok: false; error: string } => {
    const entry = listOperationHistory().find((item) => item.id === entryId);
    if (!entry) {
      return { ok: false, error: "Запись журнала не найдена." };
    }
    const restored = runImport(entry.snapshot, "replace");
    if (!restored.ok) return restored;
    refreshOperationHistory();
    return restored;
  }, [runImport, refreshOperationHistory]);

  const reloadDemoSeed = useCallback((): { ok: true; count: number } | { ok: false; error: string } => {
    const fresh = initialPositions().map(applyEvents);
    setDataByVersion((prev) => ({ ...prev, [planVersionId]: fresh }));
    localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
    applyAnnualPlanningScenarioFactPolicy();
    if (PLAN_SCENARIO_INCLUDES_FACT) {
      seedDemoFactFromPlan(fresh);
    }
    return { ok: true, count: fresh.length };
  }, [planVersionId]);

  const loadPilotTestBundle = useCallback(async (): Promise<
    ({ ok: true; summary: string } & PilotBundleResult) | { ok: false; error: string }
  > => {
    if (!roleCanManageVersions(userRole)) {
      return { ok: false, error: "Пилотный набор доступен только роли C&B." };
    }
    try {
      await yieldToMain();
      const plan = buildPilotPlanBundle();
      await yieldToMain();
      applyAnnualPlanningScenarioFactPolicy();
      applyPilotBundleSideEffects();
      const bundle: PilotBundleResult = {
        ...plan,
        fact: { employeeCount: 0, assignmentCount: 0, throughMonth: 0 },
      };
      await yieldToMain();
      bulkHydratingRef.current = true;
      try {
        setPlanVersions(bundle.versions);
        setDataByVersion(bundle.dataByVersion);
        setPlanVersionId(bundle.planVersionId);
        setLeadEditFrozenState(false);
        refreshAppConfig();
        refreshTeamSubmissions();
      } finally {
        persistVersions(bundle.versions);
        persistDataByVersion(bundle.dataByVersion);
        localStorage.setItem("fot_mvp_plan_version", bundle.planVersionId);
        window.setTimeout(() => {
          bulkHydratingRef.current = false;
        }, 0);
      }
      const versionTitle = formatPlanVersionTitle(bundle.versions[0]);
      const summary =
        `Пилот: ${bundle.positionCount} поз. · ${bundle.orgTeamCount} команд · ` +
        `${versionTitle} утверждён. ` +
        `Смените пользователя на экране входа для проверки срезов.`;
      return { ok: true, summary, ...bundle };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось загрузить пилотный набор.",
      };
    }
  }, [userRole, refreshAppConfig, refreshTeamSubmissions]);

  const clearPilotTestBundle = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (!roleCanManageVersions(userRole)) {
      return { ok: false, error: "Сброс пилота доступен только роли C&B." };
    }
    try {
      clearPilotDemoStorage();
      window.location.reload();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось очистить данные пилота.",
      };
    }
  }, [userRole]);

  const resetDevPlanToDraft = useCallback((): { ok: true } | { ok: false; error: string } => {
    const planYear = primaryBudget?.planYear ?? 2026;
    const freshVersions = initialPlanVersions(planYear);
    const v1Id = freshVersions[0].id;
    const primary = primaryBudgetVersion(planVersions);
    const sourceRows = primary ? dataByVersion[primary.id] : dataByVersion[v1Id];
    const v1Data = sourceRows?.length ? clonePositionList(sourceRows) : initialPositions().map(applyEvents);
    setPlanVersions(freshVersions);
    setDataByVersion({ [v1Id]: v1Data });
    setPlanVersionId(v1Id);
    return { ok: true };
  }, [planVersions, dataByVersion, primaryBudget]);

  const contextValue = useMemo(
    (): MvpAppContextValue => ({
      planVersions,
      planVersionId,
      setPlanVersionId,
      activePlan,
      canEditPlan,
      leadEditFrozen,
      setLeadEditFrozen,
      canToggleLeadFreeze,
      leadEditFrozenForRole,
      canManagePlanVersions,
      canImportFact,
      canImportPlan,
      userRole,
      setUserRole,
      roleScopeHint,
      allPositions,
      positionsTotalCount,
      demoRoleScopeLabel,
      demoPersonaLabel,
      workingDraft,
      latestApproved,
      primaryBudget,
      planFactBaseline,
      approvalRoute,
      versionDiff,
      createWorkingDraft,
      publishWorkingDraft,
      approvePrimaryBudget,
      reopenPrimaryBudget,
      submitDraftForApproval,
      draftApprovalCheck,
      openVersion,
      deletePlanVersion,
      positions,
      setPositions,
      viewMode,
      setViewMode,
      pickAmount,
      salaryBands,
      setSalaryBands,
      catalogAccess,
      setCatalogAccess,
      canEditSalaryCatalog: catalogAccess === "write",
      exportCurrentSnapshot,
      inspectSnapshot: inspectSnapshotForImport,
      backupBeforeImport,
      importCurrentSnapshot,
      restoreFromLastExport,
      restoreFromPreImportBackup,
      restoreFromHistoryEntry,
      operationHistory,
      refreshOperationHistory,
      resetDevPlanToDraft,
      reloadDemoSeed,
      loadPilotTestBundle,
      clearPilotTestBundle,
      refreshAppConfig,
      appConfigRevision: configRevision,
      teamSubmissionRevision,
      refreshTeamSubmissions,
      isTeamSliceReadOnly,
    }),
    [
      planVersions,
      planVersionId,
      activePlan,
      canEditPlan,
      leadEditFrozen,
      canToggleLeadFreeze,
      leadEditFrozenForRole,
      canManagePlanVersions,
      canImportFact,
      canImportPlan,
      userRole,
      roleScopeHint,
      allPositions,
      positionsTotalCount,
      demoRoleScopeLabel,
      demoPersonaLabel,
      workingDraft,
      latestApproved,
      primaryBudget,
      planFactBaseline,
      approvalRoute,
      versionDiff,
      createWorkingDraft,
      publishWorkingDraft,
      approvePrimaryBudget,
      reopenPrimaryBudget,
      submitDraftForApproval,
      draftApprovalCheck,
      openVersion,
      deletePlanVersion,
      positions,
      setPositions,
      viewMode,
      pickAmount,
      salaryBands,
      catalogAccess,
      exportCurrentSnapshot,
      inspectSnapshotForImport,
      backupBeforeImport,
      importCurrentSnapshot,
      restoreFromLastExport,
      restoreFromPreImportBackup,
      restoreFromHistoryEntry,
      operationHistory,
      refreshOperationHistory,
      resetDevPlanToDraft,
      reloadDemoSeed,
      loadPilotTestBundle,
      clearPilotTestBundle,
      refreshAppConfig,
      configRevision,
      teamSubmissionRevision,
      refreshTeamSubmissions,
      isTeamSliceReadOnly,
    ],
  );

  return <MvpAppContext.Provider value={contextValue}>{children}</MvpAppContext.Provider>;
}

export function useMvpApp() {
  const ctx = useContext(MvpAppContext);
  if (!ctx) throw new Error("MvpAppProvider required");
  return ctx;
}
