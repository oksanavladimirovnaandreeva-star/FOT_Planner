import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { useMvpApp } from "../context/MvpAppContext";
import {
  bandKey,
  initialSalaryBands,
  removeSalaryBand,
  specializationOptions,
  upsertSalaryBand,
} from "../data/salaryRangeData";
import type { SalaryRangeBand } from "../types";

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

const EMPTY_FORM: Omit<SalaryRangeBand, "id" | "currency"> = {
  specialization: "",
  level: "",
  minSalary: 0,
  midpoint: 0,
  maxSalary: 0,
};

export function SalaryRangesPage() {
  const { activePlan, salaryBands, setSalaryBands, catalogAccess, setCatalogAccess, canEditSalaryCatalog } = useMvpApp();
  const [specFilter, setSpecFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const specs = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const levels = useMemo(() => [...new Set(salaryBands.map((band) => band.level))].sort((a, b) => a.localeCompare(b, "ru")), [salaryBands]);

  const filtered = useMemo(() => {
    return salaryBands.filter((band) => {
      if (specFilter && band.specialization !== specFilter) return false;
      if (levelFilter && band.level !== levelFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${band.specialization} ${band.level}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [salaryBands, specFilter, levelFilter, search]);

  const [editorOpen, setEditorOpen] = useState(false);

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
        <p className="muted-line">Отображено: {filtered.length} из {salaryBands.length}</p>
      </section>

      <section className="card">
        <div className="table-scroll">
          <table className="simple-table simple-table--numeric salary-ranges-table">
            <thead>
              <tr>
                <th>Специализация</th>
                <th>Уровень</th>
                <th>Мин</th>
                <th>Мид</th>
                <th>Макс</th>
                {canEditSalaryCatalog && <th />}
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
              <input
                value={form.specialization}
                onChange={(event) => setForm((prev) => ({ ...prev, specialization: event.target.value }))}
                disabled={Boolean(editingKey)}
              />
            </label>
            <label>
              Уровень
              <input
                value={form.level}
                onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
                disabled={Boolean(editingKey)}
              />
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

      <CollapsibleSection
        title="Настройки доступа (демо)"
        summary={canEditSalaryCatalog ? "Редактирование включено" : "Только просмотр"}
        defaultOpen={false}
      >
        <label>
          Режим
          <select value={catalogAccess} onChange={(event) => setCatalogAccess(event.target.value as "read" | "write")}>
            <option value="read">Только просмотр</option>
            <option value="write">Редактирование</option>
          </select>
        </label>
        <p className="muted-line">В проде доступ к справочнику задаётся ролью пользователя.</p>
      </CollapsibleSection>
    </div>
  );
}
