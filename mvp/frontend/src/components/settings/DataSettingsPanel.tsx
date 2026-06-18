import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatImportReport, useMvpApp } from "../../context/MvpAppContext";
import { DEFAULT_DEMO_POSITION_COUNT } from "../../data/demoPlanSeed";
import { PLAN_SCENARIO_INCLUDES_FACT } from "../../data/planScenario";
import type { ImportReport } from "../../data/snapshotImport";
import { inspectFactImport, parseFactPayload, type FactImportPreview } from "../../data/factImport";
import { formatIsoDateTime } from "../../data/formatDisplay";
import { monthLabel, hasCarryoverEvent, upsertEvent } from "../../data/planningData";
import {
  clearFactStore,
  factStoreStats,
  hasFactData,
  importEmployeeFacts,
  migrateLegacyFactByPosition,
  seedDemoFactFromPlan,
  type FactImportMode,
} from "../../data/factStore";
import type { PlannedEvent } from "../../types";

export function DataSettingsPanel() {
  const {
    canImportFact,
    canImportPlan,
    canManagePlanVersions,
    positions,
    setPositions,
    exportCurrentSnapshot,
    inspectSnapshot,
    importCurrentSnapshot,
    restoreFromLastExport,
    restoreFromPreImportBackup,
    restoreFromHistoryEntry,
    operationHistory,
    refreshOperationHistory,
    resetDevPlanToDraft,
    reloadDemoSeed,
  } = useMvpApp();

  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [lastImportReport, setLastImportReport] = useState<ImportReport | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewSkipNotes, setPreviewSkipNotes] = useState<string[]>([]);
  const [factLoaded, setFactLoaded] = useState(() => hasFactData());
  const [factStats, setFactStats] = useState(() => factStoreStats());
  const [factImportMode, setFactImportMode] = useState<FactImportMode>("replace");
  const [pendingFactImport, setPendingFactImport] = useState<{
    payload: unknown;
    fileName: string;
    preview: FactImportPreview;
  } | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    payload: unknown;
    fileName: string;
    preview: {
      planVersionId: string;
      salaryBandCount: number;
      positionCount: number;
      validPositionCount: number;
      skippedPositionCount: number;
      eventCount: number;
    };
  } | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const factFileInputRef = useRef<HTMLInputElement | null>(null);

  const carryoverPendingAll = positions.filter(
    (position) =>
      position.status === "Vacancy" && position.slotType === "carryover" && !hasCarryoverEvent(position),
  );

  useEffect(() => {
    refreshOperationHistory();
  }, [refreshOperationHistory]);

  useEffect(() => {
    if (!PLAN_SCENARIO_INCLUDES_FACT) return;
    const migrated = migrateLegacyFactByPosition(positions);
    if (migrated > 0) {
      setFactLoaded(true);
      setFactStats(factStoreStats());
      setDataMessage(`Мигрирован факт для ${migrated} сотрудников (старый формат).`);
    }
  }, [positions]);

  const handleExport = () => {
    const snapshot = exportCurrentSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fot-plan-${snapshot.planVersionId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDataMessage("План выгружен в файл.");
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const trimmed = (await file.text()).trim();
    if (!trimmed) {
      setPendingImport(null);
      setPreviewWarnings([]);
      setPreviewSkipNotes([]);
      setDataMessage("Файл пуст.");
      event.target.value = "";
      return;
    }
    try {
      const payload = JSON.parse(trimmed) as unknown;
      const inspected = inspectSnapshot(payload);
      if (!inspected.ok) {
        setPendingImport(null);
        setPreviewWarnings([]);
        setPreviewSkipNotes([]);
        setDataMessage(`Ошибка валидации: ${inspected.errors.join(" ")}`);
        return;
      }
      setPendingImport({
        payload,
        fileName: file.name,
        preview: inspected.preview,
      });
      setPreviewWarnings(inspected.warnings);
      setPreviewSkipNotes(inspected.positionSkipNotes);
      setDataMessage(null);
      setLastImportReport(null);
    } catch {
      setPendingImport(null);
      setPreviewWarnings([]);
      setPreviewSkipNotes([]);
      setDataMessage("Файл не удалось прочитать.");
    } finally {
      event.target.value = "";
    }
  };

  const handleApplyImport = () => {
    if (!pendingImport) return;
    const result = importCurrentSnapshot(pendingImport.payload, importMode);
    if (result.ok) {
      setLastImportReport(result.report);
      setDataMessage(formatImportReport(result.report));
      setPendingImport(null);
      setPreviewWarnings([]);
      setPreviewSkipNotes([]);
      refreshOperationHistory();
    } else {
      setDataMessage(result.error);
    }
  };

  const handleRestore = () => {
    const result = restoreFromLastExport();
    setDataMessage(result.ok ? `Откат выполнен. Восстановлено позиций: ${result.importedCount}.` : result.error);
    if (result.ok) {
      setPendingImport(null);
      setLastImportReport(null);
      refreshOperationHistory();
    }
  };

  const handleRestorePreImport = () => {
    const result = restoreFromPreImportBackup();
    setDataMessage(
      result.ok ? `Откат до состояния до импорта: ${result.report.nextPositionCount} поз.` : result.error,
    );
    if (result.ok) {
      setPendingImport(null);
      setLastImportReport(null);
      refreshOperationHistory();
    }
  };

  const handleRestoreHistory = (entryId: string) => {
    const result = restoreFromHistoryEntry(entryId);
    setDataMessage(
      result.ok ? `Восстановлено из журнала: ${result.report.nextPositionCount} поз.` : result.error,
    );
    if (result.ok) {
      setPendingImport(null);
      setLastImportReport(null);
      refreshOperationHistory();
    }
  };

  const handleFactImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const trimmed = (await file.text()).trim();
    if (!trimmed) {
      setPendingFactImport(null);
      setDataMessage("Файл факта пуст.");
      event.target.value = "";
      return;
    }
    try {
      const payload = JSON.parse(trimmed) as unknown;
      const inspected = inspectFactImport(payload);
      if (!inspected.ok) {
        setPendingFactImport(null);
        setDataMessage(`Факт: ${inspected.errors.join(" ")}`);
        return;
      }
      setPendingFactImport({
        payload,
        fileName: file.name,
        preview: inspected.preview,
      });
      setDataMessage(null);
    } catch {
      setPendingFactImport(null);
      setDataMessage("Файл факта не удалось прочитать.");
    } finally {
      event.target.value = "";
    }
  };

  const handleApplyFactImport = () => {
    if (!pendingFactImport) return;
    const parsed = parseFactPayload(pendingFactImport.payload);
    if (!parsed.ok) {
      setDataMessage(parsed.errors.join(" "));
      return;
    }
    const result = importEmployeeFacts(parsed.employees, factImportMode, parsed.assignments);
    setFactLoaded(true);
    setFactStats(factStoreStats());
    setPendingFactImport(null);
    setDataMessage(
      `Факт загружен: ${result.importedEmployees} сотрудников` +
        (factImportMode === "merge" && result.mergedEmployees > 0
          ? ` (обновлено ${result.mergedEmployees})`
          : "") +
        (result.assignmentCount > 0 ? ` · посадок: ${result.assignmentCount}` : "") +
        ".",
    );
  };

  const handleSeedDemoFact = () => {
    const result = seedDemoFactFromPlan(positions);
    setFactLoaded(true);
    setFactStats(factStoreStats());
    setDataMessage(
      `Демо-факт: ${result.employeeCount} сотрудников, ${result.assignmentCount} посадок ` +
        `(янв–${monthLabel(result.throughMonth)}), ~95% плана.`,
    );
  };

  const handleClearFact = () => {
    clearFactStore();
    setFactLoaded(false);
    setFactStats(factStoreStats());
    setPendingFactImport(null);
    setDataMessage("Данные факта очищены.");
  };

  const handleCarryoverBatch = () => {
    if (carryoverPendingAll.length === 0) {
      setAdminMessage("Нет вакансий переноса без события переноса бюджета.");
      return;
    }
    const confirmed = window.confirm(
      `Зафиксировать перенос бюджета с января для ${carryoverPendingAll.length} вакансий?`,
    );
    if (!confirmed) return;
    setPositions((prev) =>
      prev.map((position) => {
        if (!carryoverPendingAll.some((item) => item.positionId === position.positionId)) return position;
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
    setAdminMessage(`Перенос зафиксирован для ${carryoverPendingAll.length} вакансий.`);
  };

  const handleDevResetV1 = () => {
    const confirmed = window.confirm(
      "Сбросить версии к одному черновику бюджета? Черновики корректировки и архив будут удалены.",
    );
    if (!confirmed) return;
    const result = resetDevPlanToDraft();
    setDataMessage(result.ok ? "Бюджет сброшен в черновик." : result.error);
  };

  return (
    <div className="settings-data">
      <p className="muted-line">
        Импорт и экспорт плана, демо-набор ~{DEFAULT_DEMO_POSITION_COUNT} поз. Сброс:{" "}
        <code>?reset=demo</code> в URL.
      </p>

      <div className="app-data-panel__block">
        <strong>План</strong>
        <div className="app-data-panel__actions">
          <button type="button" className="app-btn app-btn--ghost" onClick={handleExport}>
            Экспорт плана
          </button>
          {canImportPlan ? (
            <>
              <button type="button" className="app-btn app-btn--primary" onClick={() => fileInputRef.current?.click()}>
                Импорт плана
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={handleRestore}>
                Откат к экспорту
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={handleRestorePreImport}>
                Откат до импорта
              </button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
            </>
          ) : (
            <p className="muted-line">Импорт и откат плана — только C&B.</p>
          )}
        </div>
      </div>

      {PLAN_SCENARIO_INCLUDES_FACT ? (
      <div className="app-data-panel__block">
        <strong>Факт</strong>
        {factLoaded ? (
          <p className="muted-line">
            Загружено: {factStats.employeeCount} сотр. · месяцев с данными: {factStats.monthsWithAnyAmount}
          </p>
        ) : (
          <p className="muted-line">Факт не загружен — на обзоре и в аналитике колонки «—».</p>
        )}
        <div className="app-data-panel__actions">
          {canImportFact ? (
            <>
              <button type="button" className="app-btn app-btn--primary" onClick={() => factFileInputRef.current?.click()}>
                Загрузить факт из файла
              </button>
              {factLoaded ? (
                <button type="button" className="app-btn app-btn--ghost" onClick={handleClearFact}>
                  Очистить факт
                </button>
              ) : null}
              <input
                ref={factFileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={handleFactImportFile}
              />
            </>
          ) : (
            <p className="muted-line">Импорт факта — только C&B.</p>
          )}
        </div>
        <details className="settings-help">
          <summary>Формат файла факта</summary>
          <p className="muted-line">
            JSON с помесячными строками: ID сотрудника, при необходимости ID позиции, месяц, суммы. Или
            кнопка «Заполнить демо-факт» ниже.
          </p>
        </details>
        {pendingFactImport ? (
          <div className="app-data-panel__preview">
            <p>
              Файл: <strong>{pendingFactImport.fileName}</strong> · {pendingFactImport.preview.employeeCount} сотр.
              {pendingFactImport.preview.assignmentCount > 0
                ? ` · ${pendingFactImport.preview.assignmentCount} посадок`
                : ""}
            </p>
            {pendingFactImport.preview.sampleLines.length > 0 ? (
              <table className="fact-import-preview-table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Позиция</th>
                    <th>Месяц</th>
                    <th>Оклад</th>
                    <th>Премия</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFactImport.preview.sampleLines.map((line, index) => (
                    <tr key={`${line.employeeId}-${line.month}-${index}`}>
                      <td>{line.employeeId}</td>
                      <td>{line.positionId ?? "—"}</td>
                      <td>{monthLabel(line.month)}</td>
                      <td>{line.factBase.toLocaleString("ru-RU")}</td>
                      <td>{line.factBonus.toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <div className="app-data-panel__mode">
              <label>
                <input
                  type="radio"
                  name="fact-import-mode"
                  checked={factImportMode === "replace"}
                  onChange={() => setFactImportMode("replace")}
                />{" "}
                Заменить весь факт
              </label>
              <label>
                <input
                  type="radio"
                  name="fact-import-mode"
                  checked={factImportMode === "merge"}
                  onChange={() => setFactImportMode("merge")}
                />{" "}
                Дополнить (merge)
              </label>
            </div>
            <div className="app-data-panel__actions">
              <button type="button" className="app-btn app-btn--primary" onClick={handleApplyFactImport}>
                Подтвердить факт
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setPendingFactImport(null)}>
                Отмена
              </button>
            </div>
          </div>
        ) : null}
        <details className="app-data-panel__demo">
          <summary>Демо-факт с историей посадок</summary>
          <p className="muted-line">После утверждения бюджета: ~95% плана и кто на какой позиции по месяцам.</p>
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={handleSeedDemoFact}>
            Заполнить демо-факт
          </button>
        </details>
      </div>
      ) : null}

      {pendingImport ? (
        <div className="app-data-panel__preview">
          <p>
            Файл: <strong>{pendingImport.fileName}</strong> · к импорту {pendingImport.preview.validPositionCount} поз.
          </p>
          {previewWarnings.length > 0 ? (
            <ul className="app-data-panel__warnings">
              {previewWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {previewSkipNotes.length > 0 ? (
            <ul className="app-data-panel__warnings app-data-panel__warnings--muted">
              {previewSkipNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <div className="app-data-panel__mode">
            <label>
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
              />{" "}
              Перезаписать текущую версию
            </label>
            <label>
              <input
                type="radio"
                name="import-mode"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
              />{" "}
              Дополнить (merge)
            </label>
          </div>
          <div className="app-data-panel__actions">
            <button type="button" className="app-btn app-btn--primary" onClick={handleApplyImport}>
              Подтвердить импорт
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={() => setPendingImport(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {lastImportReport ? (
        <div className="app-data-panel__report" role="status">
          <strong>Отчёт импорта</strong>
          <p>{formatImportReport(lastImportReport)}</p>
        </div>
      ) : null}

      {canImportPlan ? (
        <div className="app-data-panel__block">
          <strong>Демо-план (по умолчанию)</strong>
          <p className="muted-line">
            ~{DEFAULT_DEMO_POSITION_COUNT} позиций, декабрьский перенос, события на части позиций — для повседневной
            работы в MVP без подвисаний.
          </p>
          <div className="app-data-panel__actions">
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={() => {
                const result = reloadDemoSeed();
                setDataMessage(
                  result.ok
                    ? `Демо-план: ${result.count} позиций.`
                    : result.error,
                );
              }}
            >
              Перезагрузить демо-план (~{DEFAULT_DEMO_POSITION_COUNT})
            </button>
          </div>
        </div>
      ) : null}

      {canManagePlanVersions ? (
        <div className="app-data-panel__admin">
          <strong>Администрирование</strong>
          <p className="muted-line">Перенос бюджета вакансий «перенос» — по всему плану.</p>
          {carryoverPendingAll.length > 0 ? (
            <button type="button" className="app-btn app-btn--ghost" onClick={handleCarryoverBatch}>
              Зафиксировать перенос ({carryoverPendingAll.length})
            </button>
          ) : (
            <p className="app-data-panel__admin-ok">Все вакансии переноса обработаны.</p>
          )}
          {adminMessage ? <p className="app-data-panel__message">{adminMessage}</p> : null}
        </div>
      ) : null}

      {canManagePlanVersions ? (
        <details className="app-data-panel__demo">
          <summary>Инструменты разработчика</summary>
          <p className="muted-line">Сброс версий к одному черновику бюджета (данные Версии 1 сохраняются).</p>
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={handleDevResetV1}>
            Сбросить бюджет к черновику
          </button>
        </details>
      ) : null}

      {operationHistory.length > 0 && canImportPlan ? (
        <div className="app-data-panel__history">
          <strong>Журнал операций</strong>
          <ul>
            {operationHistory.map((entry) => (
              <li key={entry.id}>
                <span className="app-data-panel__history-meta">
                  {formatIsoDateTime(entry.at)} · {entry.label}
                </span>
                <span className="app-data-panel__history-summary">{entry.summary}</span>
                <button
                  type="button"
                  className="app-btn app-btn--ghost app-btn--compact"
                  onClick={() => handleRestoreHistory(entry.id)}
                >
                  Откатить
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dataMessage ? <p className="app-data-panel__message">{dataMessage}</p> : null}

      <div className="app-data-panel__block">
        <strong>Справочники</strong>
        <div className="app-data-panel__actions">
          <Link to="/salary-ranges" className="app-btn app-btn--ghost">
            Диапазоны окладов
          </Link>
        </div>
      </div>
    </div>
  );
}
