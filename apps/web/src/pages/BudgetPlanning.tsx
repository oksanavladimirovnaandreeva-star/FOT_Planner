import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { usePlanContext } from "../PlanContext";
import { useViewMode } from "../ViewModeContext";
import { PositionDrawer } from "../components/PositionDrawer";
import { VacancyDrawer } from "../components/VacancyDrawer";

type BudgetRow = {
  position_id: string;
  org_unit_code: string;
  employee_id: string | null;
  full_name: string | null;
  hc_status: string;
  specialization: string;
  level: string;
  team: string;
  limit_flag: string;
  is_vacancy: boolean;
  base_dec: number;
  dec_prev_base: number | null;
  cr_dec: number | null;
  dec_dec_pct: number | null;
  year_base: number;
  year_bonus: number;
  year_total: number;
};

type PlanEvent = {
  id: number;
  event_type: string;
  effective_month: number;
  payload: Record<string, unknown>;
  created_by: string | null;
};

type BudgetKpis = {
  year_base: number;
  year_bonus: number;
  year_total: number;
  growth_dec: Record<string, { dec_prev: number; dec_plan: number; net_growth: number; net_growth_pct?: number | null }>;
};
type PositionGroup = {
  positionId: string;
  team: string;
  orgUnitCode: string;
  limitFlag: string;
  specialization: string;
  level: string;
  occupied: BudgetRow[];
  vacancy: BudgetRow | null;
};

const MONTHS = ["", "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const LIMIT_LABELS: Record<string, string> = {
  IN_LIMIT: "В лимите",
  OVER_LIMIT: "Сверх лимита",
  UNLIMITED: "Без лимита",
  UNSPECIFIED: "Не указан",
};

export default function BudgetPlanning() {
  const { planId, plan, recalculate } = usePlanContext();
  const { viewMode, pickAmount } = useViewMode();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [kpis, setKpis] = useState<BudgetKpis | null>(null);
  const [indexEvents, setIndexEvents] = useState<PlanEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ positionId: string; employeeId?: string | null } | null>(null);
  const [vacancyOpen, setVacancyOpen] = useState(false);
  const [idxMonth, setIdxMonth] = useState(4);
  const [idxPct, setIdxPct] = useState("5");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");

  const load = useCallback(() => {
    if (!planId) return;
    setErr(null);
    Promise.all([
      api<{ rows: BudgetRow[]; kpis: BudgetKpis }>(`/api/v1/plans/${planId}/budget`),
      api<PlanEvent[]>(`/api/v1/plans/${planId}/events`),
    ])
      .then(([b, ev]) => {
        setRows(b.rows);
        setKpis(b.kpis);
        setIndexEvents(ev.filter((e) => e.event_type === "INDEXATION"));
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg.includes("Not Found") ? "Перезапустите API: .\\scripts\\start-api.ps1" : msg);
      });
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = async () => {
    await recalculate();
    load();
  };

  const applyIndexation = async () => {
    if (!planId) return;
    const normalizedPct = idxPct.trim().replace(",", ".");
    const parsedPct = Number(normalizedPct);
    if (!Number.isFinite(parsedPct)) {
      setErr("Укажите корректный процент индексации, например 5 или 5.5");
      return;
    }
    await api(`/api/v1/plans/${planId}/indexation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effective_month: idxMonth, index_percent: parsedPct, index_article: "BASE" }),
    });
    await onSaved();
  };

  const deleteIndexation = async (eventId: number) => {
    if (!planId || !confirm("Удалить индексацию?")) return;
    await api(`/api/v1/plans/${planId}/events/${eventId}`, { method: "DELETE" });
    await onSaved();
  };

  const rowFot = (r: BudgetRow) =>
    viewMode === "total" ? r.year_total : r.year_base;

  if (!planId) {
    return (
      <div>
        <h2>Планирование ФОТ</h2>
        <p className="empty-hint">Выберите план baseline 2026 в сайдбаре</p>
      </div>
    );
  }

  const deriveDepartment = (r: BudgetRow) => {
    if (r.org_unit_code?.startsWith("DEPT-")) return r.org_unit_code;
    if (r.org_unit_code?.startsWith("TEAM-B")) return "DEPT-IT";
    if (r.org_unit_code?.startsWith("TEAM-FE")) return "DEPT-IT";
    if (r.org_unit_code?.startsWith("TEAM-QA")) return "DEPT-IT";
    if (r.org_unit_code?.startsWith("TEAM-FP")) return "DEPT-FIN";
    if (r.org_unit_code?.startsWith("TEAM-OPS")) return "DEPT-OPS";
    return "DEPT-OTHER";
  };
  const departments = Array.from(new Set(rows.map((r) => deriveDepartment(r)))).sort();
  const units = Array.from(new Set(rows.map((r) => r.org_unit_code))).sort();
  const teams = Array.from(new Set(rows.map((r) => r.team))).sort();
  const filteredRows = rows.filter((r) => {
    if (departmentFilter !== "ALL" && deriveDepartment(r) !== departmentFilter) return false;
    if (unitFilter !== "ALL" && r.org_unit_code !== unitFilter) return false;
    if (teamFilter !== "ALL" && r.team !== teamFilter) return false;
    return true;
  });
  const occupied = filteredRows.filter((r) => !r.is_vacancy);
  const vacancies = filteredRows.filter((r) => r.is_vacancy);
  const grouped = Array.from(
    filteredRows.reduce<Map<string, PositionGroup>>((acc, row) => {
      const current = acc.get(row.position_id) || {
        positionId: row.position_id,
        team: row.team,
        orgUnitCode: row.org_unit_code,
        limitFlag: row.limit_flag,
        specialization: row.specialization,
        level: row.level,
        occupied: [],
        vacancy: null,
      };
      if (row.is_vacancy) current.vacancy = row;
      else current.occupied.push(row);
      current.limitFlag = row.limit_flag || current.limitFlag;
      acc.set(row.position_id, current);
      return acc;
    }, new Map())
  )
    .map(([, value]) => value)
    .sort((a, b) => a.positionId.localeCompare(b.positionId, "ru"));
  const filteredTotals = filteredRows.reduce(
    (acc, r) => ({ base: acc.base + r.year_base, bonus: acc.bonus + r.year_bonus, total: acc.total + r.year_total }),
    { base: 0, bonus: 0, total: 0 }
  );
  const byLimit = filteredRows.reduce<Record<string, { total: number; decPrev: number; decPlan: number }>>((acc, r) => {
    const key = r.limit_flag || "UNSPECIFIED";
    if (!acc[key]) acc[key] = { total: 0, decPrev: 0, decPlan: 0 };
    acc[key].total += rowFot(r);
    acc[key].decPlan += r.base_dec || 0;
    acc[key].decPrev += r.dec_prev_base || 0;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h2>Планирование ФОТ {plan?.plan_year}</h2>
        <div className="page-actions">
          <a className="btn secondary" href={`/api/v1/plans/${planId}/export.csv`} download>
            Экспорт CSV
          </a>
          <button type="button" onClick={() => setVacancyOpen(true)}>
            + Добавить вакансию
          </button>
        </div>
      </div>
      {err && <div className="alert alert-error">{err}</div>}

      {kpis && (
        <div className="kpi-row">
          <div className="kpi">
            <div className="label">Итого ФОТ год ({viewMode === "total" ? "полный" : "оклад"}, c фильтрами)</div>
            <div className="value">
              {(pickAmount(filteredTotals.base, filteredTotals.total) / 1e6).toFixed(2)} млн
            </div>
          </div>
          <div className="kpi">
            <div className="label">Итого оклад</div>
            <div className="value">{(filteredTotals.base / 1e6).toFixed(2)} млн</div>
          </div>
          <div className="kpi">
            <div className="label">Итого премия</div>
            <div className="value">{(filteredTotals.bonus / 1e6).toFixed(2)} млн</div>
          </div>
          {kpis.growth_dec?.TOTAL && (
            <div className="kpi">
              <div className="label">Дек → дек (итого)</div>
              <div className="value">{kpis.growth_dec.TOTAL.net_growth.toLocaleString("ru")} ₽</div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Фильтры</h3>
        <div className="filters-row">
          <label>
            Департамент
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="ALL">Все</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Юнит
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="ALL">Все</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label>
            Команда
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="ALL">Все</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Разбивка по лимиту и % дек→дек</h3>
        <table>
          <thead>
            <tr>
              <th>Признак лимита</th>
              <th>ФОТ год</th>
              <th>Дек прошл.</th>
              <th>Дек план</th>
              <th>% дек→дек</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byLimit)
              .sort(([a], [b]) => a.localeCompare(b, "ru"))
              .map(([key, val]) => {
              const pct = val.decPrev === 0 ? (val.decPlan > 0 ? 100 : 0) : ((val.decPlan - val.decPrev) / val.decPrev) * 100;
              return (
                <tr key={key}>
                  <td>
                    {LIMIT_LABELS[key] || key} <span className="muted">({key})</span>
                  </td>
                  <td>{val.total.toLocaleString("ru")} ₽</td>
                  <td>{val.decPrev.toLocaleString("ru")} ₽</td>
                  <td>{val.decPlan.toLocaleString("ru")} ₽</td>
                  <td>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Опции планирования</h3>
        <h4>Массовая индексация</h4>
        <p className="muted">Применяется ко всем активным строкам с выбранного месяца</p>
        <div className="form-row">
          <select value={idxMonth} onChange={(e) => setIdxMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <input value={idxPct} onChange={(e) => setIdxPct(e.target.value)} style={{ width: 80 }} /> %
          <button type="button" onClick={applyIndexation}>
            Применить индексацию
          </button>
        </div>
        {indexEvents.length > 0 && (
          <ul className="event-list" style={{ marginTop: "1rem" }}>
            {indexEvents.map((ev) => (
              <li key={ev.id}>
                Индексация с {MONTHS[ev.effective_month]}: {(ev.payload as { index_percent?: number }).index_percent}% BASE
                <button type="button" className="link-danger" onClick={() => deleteIndexation(ev.id)}>
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Годовой обзор по позициям</h3>
        <p className="muted">
          Позиция («стул») — одна строка бюджета; на ней может быть несколько сотрудников. ИД сотрудника нужен для
          привязки факта к плану.
        </p>
        <h4 className="section-sub">Позиции (сотрудник + вакансия в одном стуле)</h4>
        <table className="position-group-table">
          <thead>
            <tr>
              <th>ИД поз.</th>
              <th>Команда</th>
              <th>Спец / уровень</th>
              <th>Лимит</th>
              <th>Занятые</th>
              <th>Вакансия</th>
              <th>Статус стула</th>
              <th>Дек→дек</th>
              <th>ФОТ год</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const occupiedTotal = g.occupied.reduce((acc, r) => acc + rowFot(r), 0);
              const vacancyTotal = g.vacancy ? rowFot(g.vacancy) : 0;
              const total = occupiedTotal + vacancyTotal;
              const refRow = g.vacancy || g.occupied[0] || null;
              const decPct = refRow?.dec_dec_pct ?? null;
              return (
                <tr key={g.positionId}>
                  <td>{g.positionId}</td>
                  <td>{g.team}</td>
                  <td>
                    {g.specialization} / {g.level}
                  </td>
                  <td>
                    <span className={`badge limit-${g.limitFlag}`}>{g.limitFlag}</span>
                  </td>
                  <td>
                    {g.occupied.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="stacked-links">
                        {g.occupied.map((r) => (
                          <button
                            key={`${g.positionId}-${r.employee_id}`}
                            type="button"
                            className="link-inline"
                            onClick={() => setDrawer({ positionId: g.positionId, employeeId: r.employee_id })}
                          >
                            <code>{r.employee_id}</code> {r.full_name || "—"}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {g.vacancy ? (
                      <button type="button" className="link-inline" onClick={() => setDrawer({ positionId: g.positionId })}>
                        {g.vacancy.hc_status} · {g.vacancy.base_dec.toLocaleString("ru")} ₽
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {g.occupied.length > 0 && g.vacancy ? "Частично занята + вакансия" : g.vacancy ? "Вакансия" : "Занята"}
                  </td>
                  <td>{decPct != null ? `${decPct}%` : "—"}</td>
                  <td>{total.toLocaleString("ru")} ₽</td>
                </tr>
              );
            })}
            <tr className="row-total">
              <td colSpan={9}>Итого по стульям</td>
              <td>{grouped.reduce((acc, g) => acc + g.occupied.reduce((x, r) => x + rowFot(r), 0) + (g.vacancy ? rowFot(g.vacancy) : 0), 0).toLocaleString("ru")} ₽</td>
            </tr>
          </tbody>
        </table>

        <h4 className="section-sub">Занятые ({occupied.length})</h4>
        <table>
          <thead>
            <tr>
              <th>ИД поз.</th>
              <th>ИД сотр.</th>
              <th>ФИО</th>
              <th>Команда</th>
              <th>Спец / уровень</th>
              <th>Лимит</th>
              <th>Статус</th>
              <th>Оклад дек</th>
              <th>Дек прош. год</th>
              <th>CR (дек)</th>
              <th>Дек→дек</th>
              <th>ФОТ год</th>
            </tr>
          </thead>
          <tbody>
            {occupied.map((r) => (
              <tr
                key={r.position_id + (r.employee_id || "")}
                className="clickable-row"
                onClick={() => setDrawer({ positionId: r.position_id, employeeId: r.employee_id })}
              >
                <td>{r.position_id}</td>
                <td>
                  <code>{r.employee_id}</code>
                </td>
                <td>{r.full_name || "—"}</td>
                <td>{r.team}</td>
                <td>
                  {r.specialization} / {r.level}
                </td>
                <td>
                  <span className={`badge limit-${r.limit_flag}`}>{r.limit_flag}</span>
                </td>
                <td>{r.is_vacancy ? r.hc_status : "Занято"}</td>
                <td>{r.base_dec.toLocaleString("ru")} ₽</td>
                <td>{r.dec_prev_base != null ? `${r.dec_prev_base.toLocaleString("ru")} ₽` : "—"}</td>
                <td>{r.cr_dec ?? "—"}</td>
                <td>{r.dec_dec_pct != null ? `${r.dec_dec_pct}%` : "—"}</td>
                <td>{rowFot(r).toLocaleString("ru")} ₽</td>
              </tr>
            ))}
            <tr className="row-total">
              <td colSpan={11}>Итого занятые</td>
              <td>{occupied.reduce((acc, r) => acc + rowFot(r), 0).toLocaleString("ru")} ₽</td>
            </tr>
          </tbody>
        </table>

        <h4 className="section-sub">Вакансии ({vacancies.length})</h4>
        <table>
          <thead>
            <tr>
              <th>ИД</th>
              <th>Команда</th>
              <th>Спец / уровень</th>
              <th>Лимит</th>
              <th>Статус</th>
              <th>Оклад дек</th>
              <th>Дек прош. год</th>
              <th>CR (дек)</th>
              <th>Дек→дек</th>
              <th>ФОТ год</th>
            </tr>
          </thead>
          <tbody>
            {vacancies.map((r) => (
              <tr key={r.position_id} className="clickable-row" onClick={() => setDrawer({ positionId: r.position_id })}>
                <td>{r.position_id}</td>
                <td>{r.team}</td>
                <td>
                  {r.specialization} / {r.level}
                </td>
                <td>
                  <span className={`badge limit-${r.limit_flag}`}>{r.limit_flag}</span>
                </td>
                <td>
                  <span className="badge vacancy">{r.hc_status}</span>
                </td>
                <td>{r.base_dec.toLocaleString("ru")} ₽</td>
                <td>{r.dec_prev_base != null ? `${r.dec_prev_base.toLocaleString("ru")} ₽` : "—"}</td>
                <td>{r.cr_dec ?? "—"}</td>
                <td>{r.dec_dec_pct != null ? `${r.dec_dec_pct}%` : "—"}</td>
                <td>{rowFot(r).toLocaleString("ru")} ₽</td>
              </tr>
            ))}
            <tr className="row-total">
              <td colSpan={9}>Итого вакансии</td>
              <td>{vacancies.reduce((acc, r) => acc + rowFot(r), 0).toLocaleString("ru")} ₽</td>
            </tr>
          </tbody>
        </table>
      </div>

      {drawer && plan && (
        <PositionDrawer
          positionId={drawer.positionId}
          employeeId={drawer.employeeId}
          planId={planId}
          planYear={plan.plan_year}
          onClose={() => setDrawer(null)}
          onSaved={onSaved}
        />
      )}
      {vacancyOpen && plan && (
        <VacancyDrawer planId={planId} planYear={plan.plan_year} onClose={() => setVacancyOpen(false)} onCreated={onSaved} />
      )}
    </div>
  );
}
