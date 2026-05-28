import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarRange,
  LayoutDashboard,
  Scale,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useMvpApp } from "../context/MvpAppContext";

const NAV = [
  { to: "/", label: "Обзор и итого", icon: LayoutDashboard, end: true },
  { to: "/planning", label: "Планирование", icon: CalendarRange },
  { to: "/salary-ranges", label: "Диапазоны", icon: Scale },
  { to: "/plan-vs-actual", label: "План и факт", icon: TrendingUp },
  { to: "/deviation", label: "Отклонения", icon: BarChart3 },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    planVersions,
    planVersionId,
    setPlanVersionId,
    activePlan,
    viewMode,
    setViewMode,
    exportCurrentSnapshot,
    inspectSnapshot,
    backupBeforeImport,
    importCurrentSnapshot,
    restoreFromLastExport,
    restoreFromPreImportBackup,
  } = useMvpApp();
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    payload: unknown;
    fileName: string;
    preview: { planVersionId: string; salaryBandCount: number; positionCount: number; eventCount: number };
  } | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const inspected = inspectSnapshot(payload);
      if (!inspected.ok) {
        setPendingImport(null);
        setDataMessage(`Ошибка валидации: ${inspected.errors.join(" ")}`);
        return;
      }
      setPendingImport({
        payload,
        fileName: file.name,
        preview: inspected.preview,
      });
      setDataMessage(null);
    } catch {
      setPendingImport(null);
      setDataMessage("Файл не удалось прочитать как корректный JSON.");
    } finally {
      event.target.value = "";
    }
  };

  const handleApplyImport = () => {
    if (!pendingImport) return;
    backupBeforeImport();
    const result = importCurrentSnapshot(pendingImport.payload, importMode);
    setDataMessage(
      result.ok
        ? `Импорт (${importMode === "replace" ? "перезапись" : "добавление"}) завершен: ${result.report.nextPositionCount} позиций в плане (из файла: новых ${result.report.addedCount}, обновлено ${result.report.updatedCount}), событий ${result.report.importedEventCount}.`
        : result.error,
    );
    if (result.ok) setPendingImport(null);
  };

  const handleRestore = () => {
    const result = restoreFromLastExport();
    setDataMessage(result.ok ? `Откат выполнен. Восстановлено позиций: ${result.importedCount}.` : result.error);
    if (result.ok) setPendingImport(null);
  };

  const handleRestorePreImport = () => {
    const result = restoreFromPreImportBackup();
    setDataMessage(
      result.ok
        ? `Откат до состояния до импорта выполнен: ${result.report.importedCount} позиций восстановлено.`
        : result.error,
    );
    if (result.ok) setPendingImport(null);
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
                  {version.label} · {version.status}
                </option>
              ))}
            </select>
          </label>
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
          {NAV.map((item) => (
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

        <p className="app-sidebar__foot">
          Лимит: IN_LIMIT / OVER_LIMIT из поля позиции, не из % годового ФОТ.
        </p>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-search">
            <Search className="app-search__icon" size={16} aria-hidden />
            <input
              type="search"
              className="app-search__input"
              placeholder="Поиск по позициям, подразделениям, сотрудникам…"
              disabled
              aria-label="Поиск"
            />
          </div>
          <div className="app-topbar__actions">
            <button type="button" className="app-icon-btn" aria-label="Уведомления">
              <Bell size={20} />
            </button>
            <button
              type="button"
              className={`app-icon-btn${isDataDialogOpen ? " app-icon-btn--active" : ""}`}
              aria-label="Данные"
              onClick={() => {
                setDataMessage(null);
                setIsDataDialogOpen((value) => !value);
              }}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {isDataDialogOpen ? (
          <section className="app-data-panel" aria-label="Импорт и экспорт данных">
            <div>
              <h3>Данные (MVP)</h3>
              <p>Импорт заменяет данные текущей версии плана в памяти браузера.</p>
            </div>
            <div className="app-data-panel__actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={handleExport}>
                Экспорт JSON
              </button>
              <button type="button" className="app-btn app-btn--primary" onClick={handleImportClick}>
                Импорт JSON
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={handleRestore}>
                Откат к последнему экспорту
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={handleRestorePreImport}>
                Откат до импорта
              </button>
              <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
            </div>
            {pendingImport ? (
              <div className="app-data-panel__preview">
                <p>
                  Файл: <strong>{pendingImport.fileName}</strong>
                </p>
                <p>
                  Версия: {pendingImport.preview.planVersionId} · позиций: {pendingImport.preview.positionCount} · событий:{" "}
                  {pendingImport.preview.eventCount} · диапазонов: {pendingImport.preview.salaryBandCount}
                </p>
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
            {dataMessage ? <p className="app-data-panel__message">{dataMessage}</p> : null}
          </section>
        ) : null}

        <div className="app-page-scroll">{children}</div>
      </div>
    </div>
  );
}
