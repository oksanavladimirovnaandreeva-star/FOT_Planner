import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarRange,
  LayoutDashboard,
  GitBranch,
  Scale,
  Settings,
  LineChart,
  Network,
  TrendingUp,
} from "lucide-react";
import { formatImportReport, USER_ROLE_LABELS, useMvpApp } from "../context/MvpAppContext";
import type { UserRole } from "../context/MvpAppContext";
import type { ImportReport } from "../data/snapshotImport";
import { inspectFactImport, parseFactPayload } from "../data/factImport";
import {
  clearFactStore,
  factStoreStats,
  hasFactData,
  importEmployeeFacts,
  migrateLegacyFactByPosition,
  seedDemoFactFromPlan,
  type FactImportMode,
} from "../data/factStore";
import { hasCarryoverEvent, upsertEvent } from "../data/planningData";
import type { PlannedEvent } from "../types";

const NAV = [
  { to: "/", label: "Обзор и итого", icon: LayoutDashboard, end: true },
  { to: "/planning", label: "Планирование", icon: CalendarRange },
  { to: "/consolidation", label: "Консолидация", icon: Network, roles: ["admin", "unit_lead", "team_lead"] as UserRole[] },
  { to: "/versions", label: "Версии", icon: GitBranch },
  { to: "/salary-ranges", label: "Диапазоны", icon: Scale },
  { to: "/plan-vs-actual", label: "План и факт", icon: TrendingUp },
  { to: "/deviation", label: "Отклонения", icon: BarChart3 },
  { to: "/forecast", label: "Прогноз", icon: LineChart },
] as const;

function formatHistoryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    planVersions,
    planVersionId,
    setPlanVersionId,
    activePlan,
    canEditPlan,
    workingDraft,
    openVersion,
    primaryBudget,
    viewMode,
    setViewMode,
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
    userRole,
    setUserRole,
    roleScopeHint,
    positionsTotalCount,
  } = useMvpApp();
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
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
    employeeCount: number;
  } | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const carryoverPendingAll = positions.filter(
    (position) =>
      position.status === "Vacancy" && position.slotType === "carryover" && !hasCarryoverEvent(position),
  );
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

  useEffect(() => {
    const migrated = migrateLegacyFactByPosition(positions);
    if (migrated > 0) {
      setFactLoaded(true);
      setFactStats(factStoreStats());
      setDataMessage(`Мигрирован факт для ${migrated} сотрудников (старый формат по positionId).`);
    }
  }, [positions]);

  const handleExport = () => {
    const snapshot = exportCurrentSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fot-mvp-${snapshot.planVersionId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDataMessage("JSON выгружен.");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
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
      setDataMessage("Файл не удалось прочитать как корректный JSON.");
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
      result.ok
        ? `Откат до состояния до импорта: ${result.report.nextPositionCount} поз.`
        : result.error,
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

  const handleFactImportClick = () => {
    factFileInputRef.current?.click();
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
        employeeCount: inspected.preview.employeeCount,
      });
      setDataMessage(null);
    } catch {
      setPendingFactImport(null);
      setDataMessage("Файл факта не удалось прочитать как JSON.");
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
        (result.assignmentCount > 0 ? ` · посадок на слоты: ${result.assignmentCount}` : "") +
        ". Ключ — employee_id; в lines можно передать position_id.",
    );
  };

  const handleSeedDemoFact = () => {
    const count = seedDemoFactFromPlan(positions);
    setFactLoaded(true);
    setFactStats(factStoreStats());
    setDataMessage(`Демо-факт (только UI): ${count} сотрудников, 95% плана.`);
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
      setAdminMessage("Нет вакансий переноса без события POSITION_CARRYOVER.");
      return;
    }
    const ids = carryoverPendingAll.map((item) => item.positionId).join(", ");
    const confirmed = window.confirm(
      `Зафиксировать перенос бюджета с января для ${carryoverPendingAll.length} вакансий (${ids})?`,
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
      "Сбросить версии к v1 (DRAFT)? Будут удалены черновики и архивные версии. Данные v1 сохранятся.",
    );
    if (!confirmed) return;
    const result = resetDevPlanToDraft();
    if (!result.ok) {
      setDataMessage(result.error);
      return;
    }
    setDataMessage("v1 сброшен в DRAFT. Черновики и архив удалены.");
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo" aria-hidden>
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <span className="app-sidebar__title">ФОТ-планировщик</span>
        </div>

        <div className="app-sidebar__section">
          <p className="app-sidebar__section-label">Срез данных</p>
          <label className="app-field">
            <span>Версия плана</span>
            <select value={planVersionId} onChange={(e) => setPlanVersionId(e.target.value)}>
              {planVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.label}
                  {version.kind === "WORKING_DRAFT" ? " · черновик" : version.status === "ARCHIVED" ? " · архив" : ""}
                </option>
              ))}
            </select>
          </label>
          {workingDraft && planVersionId !== workingDraft.id ? (
            <button
              type="button"
              className="app-btn app-btn--ghost app-btn--sm app-sidebar__draft-link"
              onClick={() => {
                const result = openVersion(workingDraft.id);
                if (!result.ok) window.alert(result.error);
              }}
            >
              Открыть черновик
            </button>
          ) : null}
          {workingDraft && planVersionId !== workingDraft.id && primaryBudget?.status === "APPROVED" ? (
            <p className="app-sidebar__hint app-sidebar__hint--warn">Утверждённый бюджет — правки в черновике</p>
          ) : null}
          {activePlan.status === "ARCHIVED" ? (
            <p className="app-sidebar__hint app-sidebar__hint--warn">Архивная версия — только просмотр</p>
          ) : null}
          {activePlan.status === "IN_APPROVAL" ? (
            <p className="app-sidebar__hint app-sidebar__hint--warn">На согласовании — правки недоступны</p>
          ) : null}
          {primaryBudget && primaryBudget.status === "DRAFT" ? (
            <p className="app-sidebar__hint app-sidebar__hint--ok">v1 не утверждён — можно править</p>
          ) : null}
          {!canEditPlan && activePlan.status !== "ARCHIVED" && activePlan.status !== "IN_APPROVAL" ? (
            <p className="app-sidebar__hint app-sidebar__hint--warn">Только просмотр · правки в черновике</p>
          ) : null}
          <label className="app-field">
            <span>Роль (MVP)</span>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value as UserRole)}>
              {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <p className="app-sidebar__hint">{roleScopeHint}</p>
          {positions.length !== positionsTotalCount ? (
            <p className="app-sidebar__hint app-sidebar__hint--warn">
              В срезе {positions.length} из {positionsTotalCount} поз.
            </p>
          ) : null}
          <label className="app-field">
            <span>Режим просмотра</span>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "base" | "total")}>
              <option value="base">Оклад (BASE)</option>
              <option value="total">Итого ФОТ</option>
            </select>
          </label>
          <p className="app-sidebar__hint">Год {activePlan.planYear} · данные локально</p>
        </div>

        <nav className="app-sidebar__nav" aria-label="Основное меню">
          <p className="app-sidebar__section-label">Основное меню</p>
          {NAV.filter((item) => !("roles" in item) || item.roles.includes(userRole)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
            >
              <item.icon className="app-nav__icon" size={20} strokeWidth={2} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__actions">
          <button type="button" className="app-sidebar__action-btn" aria-label="Уведомления">
            <Bell size={18} />
          </button>
          <button
            type="button"
            className={`app-sidebar__action-btn${isDataDialogOpen ? " app-sidebar__action-btn--active" : ""}`}
            aria-label="Данные и настройки"
            onClick={() => {
              setIsDataDialogOpen((value) => !value);
              refreshOperationHistory();
            }}
          >
            <Settings size={18} />
          </button>
        </div>

        <p className="app-sidebar__foot">
          Лимит: IN_LIMIT / OVER_LIMIT из поля позиции, не из % годового ФОТ.
        </p>
      </aside>

      <div className="app-main">
        {isDataDialogOpen ? (
          <section className="app-data-panel" aria-label="Импорт и экспорт данных">
            <div>
              <h3>Данные (MVP)</h3>
              <p>План — JSON текущей версии. Факт — JSON по <strong>employee_id</strong> (как staging 1С).</p>
            </div>

            <div className="app-data-panel__block">
              <strong>План</strong>
              <div className="app-data-panel__actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={handleExport}>
                  Экспорт плана
                </button>
                <button type="button" className="app-btn app-btn--primary" onClick={handleImportClick}>
                  Импорт плана
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={handleRestore}>
                  Откат к экспорту
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={handleRestorePreImport}>
                  Откат до импорта
                </button>
                <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
              </div>
            </div>

            <div className="app-data-panel__block">
              <strong>Факт</strong>
              {factLoaded ? (
                <p className="muted-line">
                  Загружено: {factStats.employeeCount} сотр. · месяцев с данными: {factStats.monthsWithAnyAmount}
                </p>
              ) : (
                <p className="muted-line">Факт не загружен — на обзоре и план-факте колонки «—».</p>
              )}
              <div className="app-data-panel__actions">
                <button type="button" className="app-btn app-btn--primary" onClick={handleFactImportClick}>
                  Импорт факта JSON
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
              </div>
              {pendingFactImport ? (
                <div className="app-data-panel__preview">
                  <p>
                    Факт: <strong>{pendingFactImport.fileName}</strong> · {pendingFactImport.employeeCount} сотрудников
                  </p>
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
                      Дополнить / обновить (merge)
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
                <summary>Демо-факт 95% (только проверка UI)</summary>
                <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={handleSeedDemoFact}>
                  Заполнить демо
                </button>
              </details>
            </div>

            {pendingImport ? (
              <div className="app-data-panel__preview">
                <p>
                  Файл: <strong>{pendingImport.fileName}</strong>
                </p>
                <p>
                  Версия: {pendingImport.preview.planVersionId} · в файле {pendingImport.preview.positionCount} поз. (
                  к импорту {pendingImport.preview.validPositionCount}
                  {pendingImport.preview.skippedPositionCount > 0
                    ? `, пропуск ${pendingImport.preview.skippedPositionCount}`
                    : ""}
                  ) · событий {pendingImport.preview.eventCount} · диапазонов {pendingImport.preview.salaryBandCount}
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
                    Перезаписать текущие данные версии
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="import-mode"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                    />{" "}
                    Добавить/обновить из файла (merge)
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

            <div className="app-data-panel__admin">
              <strong>Администрирование</strong>
              <p className="muted-line">
                Перенос бюджета вакансий carryover — разовая операция по всему плану (не по фильтру таблицы).
              </p>
              {carryoverPendingAll.length > 0 ? (
                <button type="button" className="app-btn app-btn--ghost" onClick={handleCarryoverBatch}>
                  Зафиксировать перенос ({carryoverPendingAll.length})
                </button>
              ) : (
                <p className="app-data-panel__admin-ok">Все вакансии переноса уже обработаны.</p>
              )}
              {adminMessage ? <p className="app-data-panel__message">{adminMessage}</p> : null}
            </div>

            <details className="app-data-panel__demo">
              <summary>Dev / отладка</summary>
              <p className="muted-line">Сброс localStorage-версий к одному v1 в статусе DRAFT (данные v1 сохраняются).</p>
              <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={handleDevResetV1}>
                Сбросить v1 к черновику
              </button>
            </details>

            {operationHistory.length > 0 ? (
              <div className="app-data-panel__history">
                <strong>Журнал операций</strong>
                <ul>
                  {operationHistory.map((entry) => (
                    <li key={entry.id}>
                      <span className="app-data-panel__history-meta">
                        {formatHistoryDate(entry.at)} · {entry.label}
                      </span>
                      <span className="app-data-panel__history-summary">{entry.summary}</span>
                      <button
                        type="button"
                        className="app-btn app-btn--ghost app-btn--compact"
                        onClick={() => handleRestoreHistory(entry.id)}
                      >
                        Откатить к этой точке
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {dataMessage ? <p className="app-data-panel__message">{dataMessage}</p> : null}
          </section>
        ) : null}

        <div className="app-page-scroll">{children}</div>
      </div>
    </div>
  );
}
