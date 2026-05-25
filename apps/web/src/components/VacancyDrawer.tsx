import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type LookupPair = { specialization: string; level: string };
type BandPreview = { min: number | null; mid: number | null; max: number | null; cr: number | null };

const HIRE_STATUS_OPTIONS = [
  { value: "NEW_HIRE", label: "Новый найм" },
  { value: "PLANNED_HIRE", label: "Плановый найм" },
  { value: "CARRYOVER", label: "Перенос с прошлого года" },
];

export function VacancyDrawer({
  planId,
  planYear,
  onClose,
  onCreated,
}: {
  planId: number;
  planYear: number;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [pairs, setPairs] = useState<LookupPair[]>([]);
  const [orgs, setOrgs] = useState<{ code: string; name: string }[]>([]);
  const [orgUnit, setOrgUnit] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [level, setLevel] = useState("");
  const [base, setBase] = useState("");
  const [variable, setVariable] = useState("");
  const [hireMonth, setHireMonth] = useState(1);
  const [limitFlag, setLimitFlag] = useState("IN_LIMIT");
  const [hireStatus, setHireStatus] = useState("NEW_HIRE");
  const [preview, setPreview] = useState<BandPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ external_id: string; cr: number | null; range: BandPreview } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ pairs: LookupPair[] }>(`/api/v1/lookups/specializations-levels?plan_year=${planYear}`),
      api<{ code: string; name?: string }[]>("/api/v1/lookups/org-units"),
    ])
      .then(([pairsResp, orgsResp]) => {
        setPairs(pairsResp.pairs);
        if (pairsResp.pairs.length) {
          setSpecialization(pairsResp.pairs[0].specialization);
          setLevel(pairsResp.pairs[0].level);
        }
        const list = orgsResp.map((row) => ({ code: row.code, name: row.name || row.code }));
        setOrgs(list);
        if (list.length) setOrgUnit(list[0].code);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Не удалось загрузить справочники"));
  }, [planYear]);

  const specs = useMemo(() => [...new Set(pairs.map((p) => p.specialization))], [pairs]);
  const levels = useMemo(
    () => pairs.filter((p) => p.specialization === specialization).map((p) => p.level),
    [pairs, specialization]
  );
  useEffect(() => {
    if (!levels.length) {
      setLevel("");
      return;
    }
    if (!levels.includes(level)) {
      setLevel(levels[0]);
    }
  }, [levels, level]);

  useEffect(() => {
    if (!specialization || !level) return;
    const q = new URLSearchParams({
      specialization,
      level,
      plan_year: String(planYear),
    });
    if (base) q.set("base_salary", base);
    api<BandPreview>(`/api/v1/lookups/salary-band?${q}`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [specialization, level, base, planYear]);

  const submit = async () => {
    const baseAmount = Number(base);
    const variableAmount = Number(variable || 0);
    if (!orgUnit || !specialization || !level || !Number.isFinite(baseAmount) || baseAmount <= 0) {
      setErr("Заполните обязательные поля: юнит, специализацию, уровень и оклад > 0.");
      return;
    }
    if (!Number.isFinite(variableAmount) || variableAmount < 0) {
      setErr("Премия должна быть числом не меньше 0.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await api<{ external_id: string; cr: number | null; range: BandPreview }>("/api/v1/positions/vacancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          org_unit_code: orgUnit,
          job_title: jobTitle.trim() || null,
          specialization,
          level,
          base_salary: baseAmount,
          variable_salary: variableAmount,
          hire_month: hireMonth,
          limit_flag: limitFlag,
          hire_status: hireStatus,
        }),
      });
      setResult(res);
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer drawer-wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>Добавить вакансию</h3>
          <button type="button" className="secondary" onClick={onClose}>
            ✕
          </button>
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        {result ? (
          <div className="card">
            <p>
              Создана позиция <strong>{result.external_id}</strong>
              {result.cr != null && <> · CR {result.cr}</>}
            </p>
            {result.range?.mid != null && (
              <p className="muted">
                Диапазон: {result.range.min?.toLocaleString("ru")} — {result.range.mid?.toLocaleString("ru")} —{" "}
                {result.range.max?.toLocaleString("ru")} ₽
              </p>
            )}
            <button type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <label>
                Команда / юнит
                <select value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Должность
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Backend-разработчик" />
              </label>
              <label>
                Специализация
                <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                  {specs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Уровень
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                База (оклад)
                <input type="number" value={base} onChange={(e) => setBase(e.target.value)} />
              </label>
              <label>
                Переменная / премия
                <input type="number" value={variable} onChange={(e) => setVariable(e.target.value)} />
              </label>
              <label>
                Месяц выхода
                <select value={hireMonth} onChange={(e) => setHireMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Статус найма
                <select value={hireStatus} onChange={(e) => setHireStatus(e.target.value)}>
                  {HIRE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Лимит
                <select value={limitFlag} onChange={(e) => setLimitFlag(e.target.value)}>
                  <option value="IN_LIMIT">IN_LIMIT</option>
                  <option value="OVER_LIMIT">OVER_LIMIT</option>
                  <option value="UNLIMITED">UNLIMITED</option>
                </select>
              </label>
            </div>
            {preview?.mid != null && (
              <div className="card preview-band">
                <strong>Диапазон и CR (предпросмотр)</strong>
                <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                  {preview.min?.toLocaleString("ru")} — {preview.mid?.toLocaleString("ru")} — {preview.max?.toLocaleString("ru")} ₽
                  {preview.cr != null && <> · CR <strong>{preview.cr}</strong></>}
                </p>
              </div>
            )}
            <p className="muted">ИД позиции: автоматически П001, П002, … (глобальная нумерация)</p>
            <button type="button" disabled={saving || !base || !orgUnit || !specialization || !level} onClick={submit}>
              Создать вакансию
            </button>
          </>
        )}
      </div>
    </div>
  );
}
