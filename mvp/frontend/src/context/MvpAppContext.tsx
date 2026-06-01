import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { applyEvents, initialPositions } from "../data/planningData";
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
  type ApprovalStep,
  type PlanVersionMeta,
} from "../data/planVersions";
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
import type { ViewMode } from "../data/dashboardMetrics";
import type { PositionRecord, SalaryCatalogAccess, SalaryRangeBand } from "../types";

export type { MvpPlanSnapshot, SnapshotPreview, ImportReport, ImportMode, PlanVersionMeta };
export { formatImportReport };

/** @deprecated Используйте PlanVersionMeta */
export type PlanVersionMock = PlanVersionMeta;

function seedVersionData(): Record<string, PositionRecord[]> {
  const baseline = initialPositions().map(applyEvents);
  const versions = initialPlanVersions();
  const approvedId = versions[0].id;
  return { [approvedId]: baseline };
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
    const repaired = repairDataByVersion(persistedVersions, persistedData);
    return { versions: persistedVersions, dataByVersion: repaired };
  }
  const versions = initialPlanVersions();
  const dataByVersion = repairDataByVersion(versions, seedVersionData());
  return { versions, dataByVersion };
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
  workingDraft: PlanVersionMeta | null;
  latestApproved: PlanVersionMeta | null;
  versionDiff: VersionDiffBundle;
  createWorkingDraft: (sourceApprovedId?: string) => { ok: true; draftId: string } | { ok: false; error: string };
  publishWorkingDraft: () =>
    | { ok: true; versionId: string; versionLabel: string }
    | { ok: false; error: string };
  approvePrimaryBudget: () => { ok: true } | { ok: false; error: string };
  submitDraftForApproval: () => { ok: true } | { ok: false; error: string };
  approvalRoute: ApprovalStep[];
  primaryBudget: PlanVersionMeta | null;
  openVersion: (id: string) => { ok: true } | { ok: false; error: string };
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
};

const MvpAppContext = createContext<MvpAppContextValue | null>(null);

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
  const [catalogAccess, setCatalogAccessState] = useState<SalaryCatalogAccess>(() => {
    const stored = localStorage.getItem("fot_mvp_catalog_access");
    return stored === "write" ? "write" : "read";
  });

  useEffect(() => {
    persistVersions(planVersions);
  }, [planVersions]);

  useEffect(() => {
    persistDataByVersion(dataByVersion);
  }, [dataByVersion]);

  const refreshOperationHistory = useCallback(() => {
    setOperationHistory(listOperationHistory());
  }, []);

  const setCatalogAccess = (access: SalaryCatalogAccess) => {
    localStorage.setItem("fot_mvp_catalog_access", access);
    setCatalogAccessState(access);
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
      setDataByVersion((prev) => repairDataByVersion(planVersions, prev));
      const repaired = repairDataByVersion(planVersions, dataByVersion);
      const rows = repaired[id];
      if (!rows?.length && version.baselineVersionId) {
        const baselineRows = repaired[version.baselineVersionId];
        if (baselineRows?.length) {
          setDataByVersion((prev) => ({
            ...repairDataByVersion(planVersions, prev),
            [id]: clonePositionList(baselineRows),
          }));
        } else {
          return { ok: false, error: "Нет данных для этой версии. Создайте черновик заново." };
        }
      } else if (!rows?.length && version.kind === "APPROVED") {
        return { ok: false, error: "Версия пуста — импортируйте план или сбросьте данные." };
      }
      setPlanVersionId(id);
      return { ok: true };
    },
    [planVersions, dataByVersion],
  );

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem("fot_mvp_view_mode", mode);
    setViewModeState(mode);
  };

  const positions = dataByVersion[planVersionId] ?? [];
  const setPositions = useCallback<Dispatch<SetStateAction<PositionRecord[]>>>(
    (updater) => {
      setDataByVersion((prev) => {
        const current = prev[planVersionId] ?? [];
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [planVersionId]: next };
      });
    },
    [planVersionId],
  );

  const activePlan = useMemo(
    () => planVersions.find((version) => version.id === planVersionId) ?? planVersions[0],
    [planVersions, planVersionId],
  );

  const canEditPlan = canEditVersion(activePlan);
  const primaryBudget = useMemo(() => primaryBudgetVersion(planVersions) ?? null, [planVersions]);
  const latestApproved = useMemo(() => latestApprovedVersion(planVersions) ?? null, [planVersions]);
  const workingDraft = useMemo(() => {
    if (!latestApproved) return null;
    return findWorkingDraftForBaseline(planVersions, latestApproved.id) ?? null;
  }, [planVersions, latestApproved]);
  const approvalRoute = useMemo(
    () => buildApprovalRoute(planVersions, workingDraft),
    [planVersions, workingDraft],
  );

  useEffect(() => {
    setDataByVersion((prev) => repairDataByVersion(planVersions, prev));
  }, [planVersions]);

  const approvePrimaryBudget = useCallback((): { ok: true } | { ok: false; error: string } => {
    const primary = primaryBudgetVersion(planVersions);
    if (!primary) return { ok: false, error: "Первая версия бюджета не найдена." };
    if (isBudgetLocked(primary)) return { ok: false, error: "Бюджет v1 уже утверждён." };
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

  const submitDraftForApproval = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (!workingDraft) return { ok: false, error: "Нет рабочего черновика." };
    setPlanVersions((prev) =>
      prev.map((version) =>
        version.id === workingDraft.id ? { ...version, status: "IN_APPROVAL" } : version,
      ),
    );
    return { ok: true };
  }, [workingDraft]);

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

  const pickAmount = (base: number, bonus = 0) => (viewMode === "total" ? base + bonus : base);

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

  const runImport = (
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
  };

  const restoreFromLastExport = (): { ok: true; importedCount: number } | { ok: false; error: string } => {
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
  };

  const restoreFromPreImportBackup = (): { ok: true; report: ImportReport } | { ok: false; error: string } => {
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
  };

  const restoreFromHistoryEntry = (entryId: string): { ok: true; report: ImportReport } | { ok: false; error: string } => {
    const entry = listOperationHistory().find((item) => item.id === entryId);
    if (!entry) {
      return { ok: false, error: "Запись журнала не найдена." };
    }
    const restored = runImport(entry.snapshot, "replace");
    if (!restored.ok) return restored;
    refreshOperationHistory();
    return restored;
  };

  const resetDevPlanToDraft = useCallback((): { ok: true } | { ok: false; error: string } => {
    const planYear = primaryBudget?.planYear ?? 2026;
    const freshVersions = initialPlanVersions(planYear);
    const v1Id = freshVersions[0].id;
    const primary = primaryBudgetVersion(planVersions);
    const sourceRows = primary ? dataByVersion[primary.id] : dataByVersion[v1Id];
    const v1Data = sourceRows?.length ? clonePositionList(sourceRows) : seedVersionData()[v1Id];
    setPlanVersions(freshVersions);
    setDataByVersion({ [v1Id]: v1Data });
    setPlanVersionId(v1Id);
    return { ok: true };
  }, [planVersions, dataByVersion, primaryBudget]);

  return (
    <MvpAppContext.Provider
      value={{
        planVersions,
        planVersionId,
        setPlanVersionId,
        activePlan,
        canEditPlan,
        workingDraft,
        latestApproved,
        primaryBudget,
        approvalRoute,
        versionDiff,
        createWorkingDraft,
        publishWorkingDraft,
        approvePrimaryBudget,
        submitDraftForApproval,
        openVersion,
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
        exportCurrentSnapshot: () => {
          const snapshot = buildSnapshot();
          saveSnapshot(LAST_EXPORTED_SNAPSHOT_KEY, snapshot);
          return snapshot;
        },
        inspectSnapshot: (payload) => inspectSnapshot(payload, { currentPlanVersionId: planVersionId }),
        backupBeforeImport: () => {
          const snapshot = buildSnapshot();
          saveSnapshot(PRE_IMPORT_BACKUP_KEY, snapshot);
        },
        importCurrentSnapshot: (payload, mode = "replace", options) => {
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
        restoreFromLastExport,
        restoreFromPreImportBackup,
        restoreFromHistoryEntry,
        operationHistory,
        refreshOperationHistory,
        resetDevPlanToDraft,
      }}
    >
      {children}
    </MvpAppContext.Provider>
  );
}

export function useMvpApp() {
  const ctx = useContext(MvpAppContext);
  if (!ctx) throw new Error("MvpAppProvider required");
  return ctx;
}
