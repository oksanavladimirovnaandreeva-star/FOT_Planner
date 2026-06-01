import type { PositionRecord, SalaryRangeBand } from "../types";

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
  validPositionCount: number;
  skippedPositionCount: number;
  eventCount: number;
};

export type ImportMode = "replace" | "merge";

export type ImportReport = {
  mode: ImportMode;
  importedCount: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  unchangedCount: number;
  importedEventCount: number;
  previousPositionCount: number;
  nextPositionCount: number;
};

const MONTH_FIELDS: Array<keyof PositionRecord> = [
  "monthlySpec",
  "monthlyLevel",
  "monthlyBase",
  "monthlyBonus",
  "seedMonthlySpec",
  "seedMonthlyLevel",
  "seedMonthlyBase",
  "seedMonthlyBonus",
];

function validatePositionAt(index: number, raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    errors.push(`positions[${index}] должен быть объектом.`);
    return errors;
  }
  const record = raw as Partial<PositionRecord>;
  if (typeof record.positionId !== "string" || !record.positionId.trim()) {
    errors.push(`positions[${index}].positionId обязателен.`);
  }
  if (!Array.isArray(record.events)) {
    errors.push(`positions[${index}].events должен быть массивом.`);
  }
  MONTH_FIELDS.forEach((field) => {
    const value = record[field];
    if (!Array.isArray(value) || value.length !== 12) {
      errors.push(`positions[${index}].${field} должен быть массивом из 12 значений.`);
    }
  });
  return errors;
}

function collectFileLevelWarnings(draft: Partial<MvpPlanSnapshot>, currentPlanVersionId?: string): string[] {
  const warnings: string[] = [];
  if (!draft.exportedAt) {
    warnings.push("В файле нет поля exportedAt — дата экспорта неизвестна.");
  }
  if (Array.isArray(draft.positions) && draft.positions.length === 0) {
    warnings.push("Файл не содержит позиций — импорт очистит или оставит только локальные записи (merge).");
  }
  if (
    currentPlanVersionId &&
    typeof draft.planVersionId === "string" &&
    draft.planVersionId.trim() &&
    draft.planVersionId !== currentPlanVersionId
  ) {
    warnings.push(
      `planVersionId в файле (${draft.planVersionId}) отличается от текущей версии (${currentPlanVersionId}).`,
    );
  }
  if (Array.isArray(draft.positions)) {
    const unlimitedCount = draft.positions.filter(
      (item) => item && typeof item === "object" && (item as PositionRecord).limitFlag === "UNLIMITED",
    ).length;
    if (unlimitedCount > 0) {
      warnings.push(`В файле ${unlimitedCount} поз. с UNLIMITED — в UI показываются только IN_LIMIT / OVER_LIMIT.`);
    }
  }
  return warnings;
}

export function inspectSnapshot(
  payload: unknown,
  options?: { currentPlanVersionId?: string },
): { ok: true; preview: SnapshotPreview; warnings: string[]; positionSkipNotes: string[] } | { ok: false; errors: string[] } {
  if (payload === null || payload === undefined) {
    return { ok: false, errors: ["Файл пуст или не содержит JSON-объект."] };
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
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

  const positionSkipNotes: string[] = [];
  let validPositionCount = 0;
  if (Array.isArray(draft.positions)) {
    const seenPositionIds = new Set<string>();
    draft.positions.forEach((position, index) => {
      const positionErrors = validatePositionAt(index, position);
      if (positionErrors.length > 0) {
        positionSkipNotes.push(...positionErrors.slice(0, 2));
        return;
      }
      const record = position as PositionRecord;
      const normalizedId = record.positionId.trim();
      if (seenPositionIds.has(normalizedId)) {
        errors.push(`Дублирующийся positionId: ${normalizedId}.`);
        return;
      }
      seenPositionIds.add(normalizedId);
      validPositionCount += 1;
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, 12) };
  }

  const positions = (draft.positions ?? []) as PositionRecord[];
  const warnings = collectFileLevelWarnings(draft, options?.currentPlanVersionId);
  if (positionSkipNotes.length > 0) {
    warnings.push(
      `Пропущено при импорте: ${draft.positions!.length - validPositionCount} из ${draft.positions!.length} позиций (ошибки валидации).`,
    );
  }

  return {
    ok: true,
    preview: {
      planVersionId: draft.planVersionId as string,
      salaryBandCount: (draft.salaryBands as SalaryRangeBand[]).length,
      positionCount: positions.length,
      validPositionCount,
      skippedPositionCount: positions.length - validPositionCount,
      eventCount: positions.reduce((sum, position) => sum + (Array.isArray(position.events) ? position.events.length : 0), 0),
    },
    warnings,
    positionSkipNotes: positionSkipNotes.slice(0, 8),
  };
}

export function extractImportablePositions(payload: unknown): {
  positions: PositionRecord[];
  skippedCount: number;
  skipNotes: string[];
} {
  const inspected = inspectSnapshot(payload);
  if (!inspected.ok) {
    return { positions: [], skippedCount: 0, skipNotes: inspected.errors };
  }
  const draft = payload as MvpPlanSnapshot;
  const positions: PositionRecord[] = [];
  const skipNotes: string[] = [];
  const seen = new Set<string>();
  draft.positions.forEach((raw, index) => {
    const positionErrors = validatePositionAt(index, raw);
    if (positionErrors.length > 0) {
      skipNotes.push(...positionErrors.slice(0, 1));
      return;
    }
    const record = raw as PositionRecord;
    const id = record.positionId.trim();
    if (seen.has(id)) return;
    seen.add(id);
    positions.push({ ...record, positionId: id });
  });
  return {
    positions,
    skippedCount: draft.positions.length - positions.length,
    skipNotes: skipNotes.slice(0, 12),
  };
}

export function formatImportReport(report: ImportReport): string {
  const modeLabel = report.mode === "replace" ? "перезапись" : "добавление";
  const parts = [
    `Импорт (${modeLabel}): в плане ${report.nextPositionCount} поз. (было ${report.previousPositionCount}).`,
    `Из файла: +${report.addedCount} новых, обновлено ${report.updatedCount}.`,
  ];
  if (report.skippedCount > 0) {
    parts.push(`Пропущено в файле: ${report.skippedCount}.`);
  }
  if (report.mode === "merge" && report.unchangedCount > 0) {
    parts.push(`Без изменений (только в плане): ${report.unchangedCount}.`);
  }
  parts.push(`Событий в импорте: ${report.importedEventCount}.`);
  return parts.join(" ");
}
