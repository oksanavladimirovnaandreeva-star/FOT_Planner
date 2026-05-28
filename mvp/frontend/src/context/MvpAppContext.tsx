import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { applyEvents, initialPositions } from "../data/planningData";
import { initialSalaryBands } from "../data/salaryRangeData";
import type { ViewMode } from "../data/dashboardMetrics";
import type { PositionRecord, SalaryCatalogAccess, SalaryRangeBand } from "../types";

export type PlanVersionMock = {
  id: string;
  label: string;
  planYear: number;
  status: "DRAFT" | "APPROVED";
};

export const MOCK_PLAN_VERSIONS: PlanVersionMock[] = [
  { id: "baseline-2026", label: "baseline 2026", planYear: 2026, status: "DRAFT" },
  { id: "corr-2026", label: "корректировка 2026", planYear: 2026, status: "DRAFT" },
];

export type MvpPlanSnapshot = {
  schemaVersion: 1;
  exportedAt: string;
  planVersionId: string;
  salaryBands: SalaryRangeBand[];
  positions: PositionRecord[];
};

export type SnapshotPreview = {
  planVersionId: string;
  salaryBandCount: number;
  positionCount: number;
  eventCount: number;
};

const LAST_EXPORTED_SNAPSHOT_KEY = "fot_mvp_last_export_snapshot";
const PRE_IMPORT_BACKUP_KEY = "fot_mvp_pre_import_backup";

type ImportReport = {
  importedCount: number;
  addedCount: number;
  updatedCount: number;
  importedEventCount: number;
  previousPositionCount: number;
  nextPositionCount: number;
};

export type ImportMode = "replace" | "merge";

function inspectSnapshot(payload: unknown): { ok: true; preview: SnapshotPreview } | { ok: false; errors: string[] } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Ожидался JSON-объект."] };
  }
  const draft = payload as Partial<MvpPlanSnapshot>;
  const errors: string[] = [];
  if (draft.schemaVersion !== 1) {
    errors.push("Неподдерживаемая версия схемы. Ожидается schemaVersion = 1.");
  }
  if (!Array.isArray(draft.salaryBands)) {
    errors.push("Поле salaryBands должно быть массивом.");
  }
  if (!Array.isArray(draft.positions)) {
    errors.push("Поле positions должно быть массивом.");
  }
  if (typeof draft.planVersionId !== "string" || !draft.planVersionId.trim()) {
    errors.push("Поле planVersionId должно быть непустой строкой.");
  }
  if (Array.isArray(draft.positions)) {
    const seenPositionIds = new Set<string>();
    draft.positions.forEach((position, index) => {
      if (!position || typeof position !== "object") {
        errors.push(`positions[${index}] должен быть объектом.`);
        return;
      }
      const record = position as Partial<PositionRecord>;
      if (typeof record.positionId !== "string" || !record.positionId.trim()) {
        errors.push(`positions[${index}].positionId обязателен.`);
      } else {
        const normalizedId = record.positionId.trim();
        if (seenPositionIds.has(normalizedId)) {
          errors.push(`Дублирующийся positionId: ${normalizedId}.`);
        } else {
          seenPositionIds.add(normalizedId);
        }
      }
      const monthFields: Array<keyof PositionRecord> = [
        "monthlySpec",
        "monthlyLevel",
        "monthlyBase",
        "monthlyBonus",
        "seedMonthlySpec",
        "seedMonthlyLevel",
        "seedMonthlyBase",
        "seedMonthlyBonus",
      ];
      monthFields.forEach((field) => {
        const value = record[field];
        if (!Array.isArray(value) || value.length !== 12) {
          errors.push(`positions[${index}].${field} должен быть массивом из 12 значений.`);
        }
      });
    });
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 12) };
  const positions = draft.positions as PositionRecord[];
  return {
    ok: true,
    preview: {
      planVersionId: draft.planVersionId as string,
      salaryBandCount: (draft.salaryBands as SalaryRangeBand[]).length,
      positionCount: positions.length,
      eventCount: positions.reduce((sum, position) => sum + position.events.length, 0),
    },
  };
}

function seedVersionData(): Record<string, PositionRecord[]> {
  const baseline = initialPositions().map(applyEvents);
  return {
    "baseline-2026": baseline,
    "corr-2026": baseline.map((position) => ({
      ...position,
      events: position.events.map((event) => ({ ...event, payload: { ...event.payload } })),
      monthlyBase: [...position.monthlyBase],
      monthlyBonus: [...position.monthlyBonus],
      monthlySpec: [...position.monthlySpec],
      monthlyLevel: [...position.monthlyLevel],
      seedMonthlyBase: [...position.seedMonthlyBase],
      seedMonthlyBonus: [...position.seedMonthlyBonus],
      seedMonthlySpec: [...position.seedMonthlySpec],
      seedMonthlyLevel: [...position.seedMonthlyLevel],
    })),
  };
}

type MvpAppContextValue = {
  planVersions: PlanVersionMock[];
  planVersionId: string;
  setPlanVersionId: (id: string) => void;
  activePlan: PlanVersionMock;
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
  inspectSnapshot: (payload: unknown) => { ok: true; preview: SnapshotPreview } | { ok: false; errors: string[] };
  backupBeforeImport: () => void;
  importCurrentSnapshot: (payload: unknown, mode?: ImportMode) => { ok: true; report: ImportReport } | { ok: false; error: string };
  restoreFromLastExport: () => { ok: true; importedCount: number } | { ok: false; error: string };
  restoreFromPreImportBackup: () => { ok: true; report: ImportReport } | { ok: false; error: string };
};

const MvpAppContext = createContext<MvpAppContextValue | null>(null);

export function MvpAppProvider({ children }: { children: React.ReactNode }) {
  const [dataByVersion, setDataByVersion] = useState<Record<string, PositionRecord[]>>(seedVersionData);
  const [planVersionId, setPlanVersionIdState] = useState(() => MOCK_PLAN_VERSIONS[0].id);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem("fot_mvp_view_mode");
    return stored === "total" ? "total" : "base";
  });
  const [salaryBands, setSalaryBands] = useState<SalaryRangeBand[]>(() => initialSalaryBands());
  const [catalogAccess, setCatalogAccessState] = useState<SalaryCatalogAccess>(() => {
    const stored = localStorage.getItem("fot_mvp_catalog_access");
    return stored === "write" ? "write" : "read";
  });

  const setCatalogAccess = (access: SalaryCatalogAccess) => {
    localStorage.setItem("fot_mvp_catalog_access", access);
    setCatalogAccessState(access);
  };

  const setPlanVersionId = (id: string) => {
    setPlanVersionIdState(id);
    localStorage.setItem("fot_mvp_plan_version", id);
  };

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
    () => MOCK_PLAN_VERSIONS.find((version) => version.id === planVersionId) ?? MOCK_PLAN_VERSIONS[0],
    [planVersionId],
  );

  const pickAmount = (base: number, bonus = 0) => (viewMode === "total" ? base + bonus : base);

  const exportCurrentSnapshot = (): MvpPlanSnapshot => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    planVersionId,
    salaryBands,
    positions,
  });

  const importCurrentSnapshot = (payload: unknown, mode: ImportMode = "replace"): { ok: true; report: ImportReport } | { ok: false; error: string } => {
    const inspected = inspectSnapshot(payload);
    if (!inspected.ok) {
      return { ok: false, error: inspected.errors.join(" ") };
    }
    const draft = payload as MvpPlanSnapshot;
    try {
      const importedPositions = draft.positions.map((item) => applyEvents(item));
      const previousById = new Map(positions.map((item) => [item.positionId, item] as const));
      const mergedById = new Map<string, PositionRecord>(positions.map((item) => [item.positionId, item]));
      importedPositions.forEach((item) => {
        mergedById.set(item.positionId, item);
      });
      const nextPositions = mode === "replace" ? importedPositions : [...mergedById.values()];
      const addedCount = importedPositions.filter((item) => !previousById.has(item.positionId)).length;
      const updatedCount = importedPositions.length - addedCount;
      const importedEventCount = importedPositions.reduce((sum, item) => sum + item.events.length, 0);

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
      return {
        ok: true,
        report: {
          importedCount: nextPositions.length,
          addedCount,
          updatedCount,
          importedEventCount,
          previousPositionCount: positions.length,
          nextPositionCount: nextPositions.length,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: `Не удалось импортировать данные: ${error instanceof Error ? error.message : "неизвестная ошибка"}.`,
      };
    }
  };

  const restoreFromLastExport = (): { ok: true; importedCount: number } | { ok: false; error: string } => {
    const raw = localStorage.getItem(LAST_EXPORTED_SNAPSHOT_KEY);
    if (!raw) {
      return { ok: false, error: "Нет сохраненного экспорта для отката." };
    }
    try {
      const restored = importCurrentSnapshot(JSON.parse(raw) as unknown);
      if (!restored.ok) return restored;
      return { ok: true, importedCount: restored.report.importedCount };
    } catch {
      return { ok: false, error: "Сохраненный экспорт поврежден, откат недоступен." };
    }
  };

  const restoreFromPreImportBackup = (): { ok: true; report: ImportReport } | { ok: false; error: string } => {
    const raw = localStorage.getItem(PRE_IMPORT_BACKUP_KEY);
    if (!raw) {
      return { ok: false, error: "Нет авто-бэкапа до импорта." };
    }
    try {
      return importCurrentSnapshot(JSON.parse(raw) as unknown);
    } catch {
      return { ok: false, error: "Авто-бэкап поврежден, откат недоступен." };
    }
  };

  return (
    <MvpAppContext.Provider
      value={{
        planVersions: MOCK_PLAN_VERSIONS,
        planVersionId,
        setPlanVersionId,
        activePlan,
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
          const snapshot = exportCurrentSnapshot();
          localStorage.setItem(LAST_EXPORTED_SNAPSHOT_KEY, JSON.stringify(snapshot));
          return snapshot;
        },
        inspectSnapshot,
        backupBeforeImport: () => {
          localStorage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(exportCurrentSnapshot()));
        },
        importCurrentSnapshot,
        restoreFromLastExport,
        restoreFromPreImportBackup,
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
