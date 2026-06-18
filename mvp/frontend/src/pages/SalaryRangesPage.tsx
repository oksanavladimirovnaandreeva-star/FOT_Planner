import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { SalaryCatalogAccessPanel } from "../components/settings/SalaryCatalogAccessPanel";
import { useMvpApp } from "../context/MvpAppContext";
import {
  bandKey,
  initialSalaryBands,
  removeSalaryBand,
  specializationOptions,
  upsertSalaryBand,
} from "../data/salaryRangeData";
import { formatMoney } from "../data/formatDisplay";
import type { SalaryRangeBand } from "../types";

type SortKey = "specialization" | "level" | "minSalary" | "midpoint" | "maxSalary";
type SortDirection = "asc" | "desc";

function compareBands(a: SalaryRangeBand, b: SalaryRangeBand, key: SortKey, dir: SortDirection): number {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "specialization" || key === "level") {
    return mul * a[key].localeCompare(b[key], "ru");
  }
  return mul * (a[key] - b[key]);
}

function nextSortState(
  currentKey: SortKey,
  currentDir: SortDirection,
  key: SortKey,
): { sortKey: SortKey; sortDir: SortDirection } {
  if (currentKey !== key) return { sortKey: key, sortDir: "asc" };
  return { sortKey: key, sortDir: currentDir === "asc" ? "desc" : "asc" };
}

const EMPTY_FORM: Omit<SalaryRangeBand, "id" | "currency"> = {
  specialization: "",
  level: "",
  minSalary: 0,
  midpoint: 0,
  maxSalary: 0,
};

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "specialization", label: "Специализация" },
  { key: "level", label: "Уровень" },
  { key: "minSalary", label: "Мин" },
  { key: "midpoint", label: "Мид" },
  { key: "maxSalary", label: "Макс" },
];

export function SalaryRangesPage() {
  const { activePlan, salaryBands, setSalaryBands, canEditSalaryCatalog, userRole, refreshAppConfig } =
    useMvpApp();
  const showCatalogAccessSettings = userRole === "cb_admin";
  const [specFilter, setSpecFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("specialization");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const specs = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const levels = useMemo(() => [...new Set(salaryBands.map((band) => band.level))].sort((a, b) => a.localeCompare(b, "ru")), [salaryBands]);

  const filtered = useMemo(() => {
    const rows = salaryBands.filter((band) => {
      if (specFilter && band.specialization !== specFilter) return false;
      if (levelFilter && band.level !== levelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${band.specialization} ${band.level}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => compareBands(a, b, sortKey, sortDir));
  }, [salaryBands, specFilter, levelFilter, search, sortKey, sortDir]);

  const [editorOpen, setEditorOpen] = useState(false);

  const toggleSort = (key: SortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.sortKey);
    setSortDir(next.sortDir);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return " ⇅";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const startCreate = () => {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  };

  const startEdit = (band: SalaryRangeBand) => {
    setEditorOpen(true);
    setEditingKey(bandKey(band.specialization, band.level));
    setForm({
      specialization: band.specialization,
      level: band.level,
      minSalary: band.minSalary,
      midpoint: band.midpoint,
      maxSalary: band.maxSalary,
    });
    setFormError(null);
  };

  const saveForm = () => {
    const specialization = form.specialization.trim();
    const level = form.level.trim();
    if (!specialization || !level) {
      setFormError("Укажите специализацию и уровень.");
      return;
    }
    if (form.minSalary <= 0 || form.midpoint <= 0 || form.maxSalary <= 0) {
      setFormError("Мин, мид и макс должны быть больше нуля.");
      return;
    }
    if (form.minSalary > form.midpoint || form.midpoint > form.maxSalary) {
      setFormError("Ожидается: мин ≤ мид ≤ макс.");
      return;
    }
    const key = bandKey(specialization, level);
    if (!editingKey && salaryBands.some((band) => bandKey(band.specialization, band.level) === key)) {
      setFormError("Такая пара специализация + уровень уже есть.");
      return;
    }
    setSalaryBands((prev) =>
      upsertSalaryBand(prev, {
        id: key,
        specialization,
        level,
        minSalary: form.minSalary,
        midpoint: form.midpoint,
        maxSalary: form.maxSalary,
        currency: "RUB",
      }),
    );
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(false);
  };

  const removeRow = (band: SalaryRangeBand) => {
    if (!window.confirm(`Удалить диапазон ${band.specialization} / ${band.level}?`)) return;
    setSalaryBands((prev) => removeSalaryBand(prev, band.specialization, band.level));
    if (editingKey === bandKey(band.specialization, band.level)) {
      setEditingKey(null);
      setForm(EMPTY_FORM);
    }
  };

  const resetCatalog = () => {
    if (!window.confirm("Сбросить справочник к начальным значениям MVP?")) return;
    setSalaryBands(initialSalaryBands());
    setEditingKey(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="content-page salary-ranges-page">
      <header className="page-header">
        <div>
          <h1>Диапазоны</h1>
          <p>
            Справочник окладов по специализации и уровню ({activePlan.planYear}) · {salaryBands.length} строк · для расчёта
            CR в планировании
          </p>
        </div>
      </header>

      <section className="card filters-card">
        <h2 className="section-title">Справочник</h2>
        <div className="filters-grid filters-grid--toolbar">
          <label className="search-field">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Специализация или уровень…" />
          </label>
          <label>
            Специализация
            <select value={specFilter} onChange={(event) => setSpecFilter(event.target.value)}>
              <option value="">Все</option>
              {specs.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </label>
          <label>
            Уровень
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
              <option value="">Все</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          {canEditSalaryCatalog && (
            <div className="filters-grid__actions">
              <button type="button" className="primary-btn" onClick={startCreate}>
                <Plus size={14} /> Добавить
              </button>
              <button type="button" className="secondary-btn" onClick={resetCatalog}>
                Сбросить
              </button>
            </div>
          )}
        </div>
        <p className="muted-line">Отображено: {filtered.length} из {salaryBands.length} · клик по заголовку столбца — сортировка</p>
      </section>

      <section className="card">
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric salary-ranges-table">
            <thead>
              <tr>
                {SORT_COLUMNS.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className="salary-ranges-table__sort"
                      aria-sort={sortKey === column.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.label}
                      {sortIndicator(column.key)}
                    </button>
                  </th>
                ))}
                {canEditSalaryCatalog && <th aria-label="Действия" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((band) => (
                <tr key={band.id}>
                  <td>{band.specialization}</td>
                  <td>{band.level}</td>
                  <td>{formatMoney(band.minSalary)}</td>
                  <td>
                    <strong>{formatMoney(band.midpoint)}</strong>
                  </td>
                  <td>{formatMoney(band.maxSalary)}</td>
                  {canEditSalaryCatalog && (
                    <td className="salary-ranges-table__actions">
                      <button type="button" className="secondary-btn" onClick={() => startEdit(band)}>
                        Изменить
                      </button>
                      <button type="button" className="danger-btn" onClick={() => removeRow(band)}>
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="muted-line">Нет строк по фильтру.</p>}
      </section>

      {canEditSalaryCatalog && editorOpen && (
        <section className="card salary-ranges-editor">
          <h2 className="section-title">{editingKey ? "Редактирование диапазона" : "Новый диапазон"}</h2>
          <div className="filters-grid">
            <label>
              Специализация
              <select
                value={form.specialization}
                disabled={Boolean(editingKey)}
                onChange={(event) => setForm((prev) => ({ ...prev, specialization: event.target.value }))}
              >
                <option value="">—</option>
                {specs.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Уровень
              <input
                value={form.level}
                onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
                disabled={Boolean(editingKey)}
                list="salary-range-levels"
              />
              <datalist id="salary-range-levels">
                {levels.map((level) => (
                  <option key={level} value={level} />
                ))}
              </datalist>
            </label>
            <label>
              Мин
              <input
                type="number"
                value={form.minSalary || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, minSalary: Number(event.target.value) || 0 }))}
              />
            </label>
            <label>
              Мид
              <input
                type="number"
                value={form.midpoint || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, midpoint: Number(event.target.value) || 0 }))}
              />
            </label>
            <label>
              Макс
              <input
                type="number"
                value={form.maxSalary || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, maxSalary: Number(event.target.value) || 0 }))}
              />
            </label>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-actions">
            <button type="button" className="primary-btn" onClick={saveForm}>
              Сохранить
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setEditingKey(null);
                setForm(EMPTY_FORM);
                setFormError(null);
                setEditorOpen(false);
              }}
            >
              Отмена
            </button>
          </div>
        </section>
      )}

      {showCatalogAccessSettings ? (
        <CollapsibleSection
          title="Доступ к диапазонам (демо C&B)"
          summary="По пользователям, как срезы на экране входа"
          defaultOpen={false}
        >
          <SalaryCatalogAccessPanel onSaved={refreshAppConfig} />
        </CollapsibleSection>
      ) : (
        <p className="muted-line">Справочник диапазонов: {canEditSalaryCatalog ? "редактирование" : "только просмотр"}.</p>
      )}
    </div>
  );
}
