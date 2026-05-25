import { useEffect, useMemo, useState } from "react";
import { api, uploadFile } from "../api";
import { useAuth } from "../auth";
import { usePlanContext } from "../PlanContext";

type Band = {
  specialization: string;
  level: string;
  min_salary: number;
  midpoint: number;
  max_salary: number;
  currency: string;
};

export default function SalaryRanges() {
  const { user } = useAuth();
  const { plan } = usePlanContext();
  const year = plan?.plan_year ?? 2026;
  const [bands, setBands] = useState<Band[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [specFilter, setSpecFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [search, setSearch] = useState("");
  const isAdmin = user?.role === "admin";

  const load = () => {
    setErr(null);
    api<Band[]>(`/api/v1/salary-ranges?plan_year=${year}`)
      .then(setBands)
      .catch((e) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, [year]);

  const specs = useMemo(() => [...new Set(bands.map((b) => b.specialization))].sort(), [bands]);
  const levels = useMemo(() => [...new Set(bands.map((b) => b.level))].sort(), [bands]);

  const filtered = bands.filter((b) => {
    if (specFilter && b.specialization !== specFilter) return false;
    if (levelFilter && b.level !== levelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${b.specialization} ${b.level}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(`/api/v1/salary-ranges/import?plan_year=${year}&version_label=import`, f);
    load();
  };

  return (
    <div>
      <h2>Диапазоны</h2>
      <p className="muted">Справочник окладов по специализации и уровню ({year})</p>
      {err && <div className="alert alert-error">{err}</div>}
      {isAdmin && (
        <div className="card">
          <input type="file" accept=".csv" onChange={onUpload} /> — загрузить salary_ranges.csv
        </div>
      )}
      <div className="card">
        <div className="filters-row">
          <label>
            Специализация
            <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value)}>
              <option value="">Все</option>
              {specs.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Уровень
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="">Все</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Поиск
            <input placeholder="Спец или уровень…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Специализация</th>
              <th>Уровень</th>
              <th>Мин</th>
              <th>Мид</th>
              <th>Макс</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={`${b.specialization}-${b.level}`}>
                <td>{b.specialization}</td>
                <td>{b.level}</td>
                <td>{Number(b.min_salary).toLocaleString("ru")} ₽</td>
                <td>
                  <strong>{Number(b.midpoint).toLocaleString("ru")} ₽</strong>
                </td>
                <td>{Number(b.max_salary).toLocaleString("ru")} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !err && <p className="empty-hint">Нет диапазонов — импортируйте CSV или перезапустите API</p>}
      </div>
    </div>
  );
}
