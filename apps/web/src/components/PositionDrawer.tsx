import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type MonthRow = {
  month: number;
  base: number;
  bonus: number;
  total: number;
  cr: number | null;
  specialization: string;
  level: string;
  midpoint: number | null;
};

type PositionDetail = {
  external_id: string;
  job_title?: string | null;
  org_unit_code: string;
  is_vacancy: boolean;
  limit_flag: string;
  focus_employee_id: string;
  dec_prev_base: number | null;
  midpoint: number | null;
  assignments: {
    employee_id: string;
    full_name: string | null;
    specialization: string;
    level: string;
  }[];
  monthly: MonthRow[];
  events: {
    id: number;
    event_type: string;
    effective_month: number;
    created_order?: number;
    created_at?: string | null;
    payload: Record<string, unknown>;
  }[];
};

type LookupPair = { specialization: string; level: string };
type MonthEdit = { specialization: string; level: string; base: string; bonus: string };
type OrgUnitOption = { code: string; name: string };
type PositionOption = { external_id: string; org_unit_code: string; job_title?: string | null; is_vacancy: boolean };

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString("ru")} ₽`;
}

export function PositionDrawer({
  positionId,
  employeeId,
  planId,
  planYear,
  onClose,
  onSaved,
}: {
  positionId: string;
  employeeId?: string | null;
  planId: number;
  planYear: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<PositionDetail | null>(null);
  const [pairs, setPairs] = useState<LookupPair[]>([]);
  const [orgUnits, setOrgUnits] = useState<string[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState("");
  const [selectedLimitFlag, setSelectedLimitFlag] = useState("IN_LIMIT");
  const [selectedStatus, setSelectedStatus] = useState("Active");
  const [roleTitle, setRoleTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState(1);
  const [targetSalary, setTargetSalary] = useState("");
  const [monthlyEdits, setMonthlyEdits] = useState<Record<number, MonthEdit>>({});
  const [bandMidByPair, setBandMidByPair] = useState<Record<string, number>>({});
  const [termMonth, setTermMonth] = useState(6);
  const [transferMonth, setTransferMonth] = useState(6);
  const [transferTargetPosition, setTransferTargetPosition] = useState("");
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setErr(null);
    const q = new URLSearchParams({ plan_id: String(planId) });
    if (employeeId) q.set("employee_id", employeeId);
    api<PositionDetail>(`/api/v1/positions/${encodeURIComponent(positionId)}?${q}`)
      .then((d) => {
        setDetail(d);
        setSelectedOrgUnit(d.org_unit_code);
        setSelectedLimitFlag(d.limit_flag);
        setSelectedStatus(d.is_vacancy ? "Vacancy" : "Active");
        setRoleTitle(d.job_title || `${d.monthly[0]?.specialization || ""} ${d.monthly[0]?.level || ""}`.trim());
        const edits: Record<number, MonthEdit> = {};
        for (const row of d.monthly) {
          edits[row.month] = {
            specialization: row.specialization,
            level: row.level,
            base: String(row.base),
            bonus: String(row.bonus),
          };
        }
        setMonthlyEdits(edits);
        if (d.monthly.length > 0) setMonth(d.monthly[0].month);

        const uniquePairs = Array.from(new Set(d.monthly.map((r) => `${r.specialization}|${r.level}`)));
        Promise.all(
          uniquePairs.map(async (pair) => {
            const [specialization, level] = pair.split("|");
            const band = await api<{ mid: number | null }>(
              `/api/v1/lookups/salary-band?specialization=${encodeURIComponent(specialization)}&level=${encodeURIComponent(level)}&plan_year=${planYear}`
            );
            return { pair, mid: band.mid ?? 0 };
          })
        ).then((rows) => {
          const mids: Record<string, number> = {};
          for (const r of rows) {
            if (r.mid) mids[r.pair] = r.mid;
          }
          setBandMidByPair(mids);
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Не удалось загрузить позицию"));
  };

  useEffect(() => {
    load();
    api<{ pairs: LookupPair[] }>(`/api/v1/lookups/specializations-levels?plan_year=${planYear}`).then((d) =>
      setPairs(d.pairs)
    );
    api<OrgUnitOption[]>("/api/v1/lookups/org-units")
      .then((rows) => setOrgUnits(rows.map((r) => r.code)))
      .catch(() => setOrgUnits([]));
    api<PositionOption[]>("/api/v1/positions")
      .then((rows) => setPositions(rows))
      .catch(() => setPositions([]));
  }, [positionId, planId, employeeId]);

  useEffect(() => {
    if (!pairs.length) return;
    const uniquePairs = Array.from(new Set(pairs.map((r) => `${r.specialization}|${r.level}`)));
    Promise.all(
      uniquePairs.map(async (pair) => {
        const [specialization, level] = pair.split("|");
        const band = await api<{ mid: number | null }>(
          `/api/v1/lookups/salary-band?specialization=${encodeURIComponent(specialization)}&level=${encodeURIComponent(level)}&plan_year=${planYear}`
        );
        return { pair, mid: band.mid ?? 0 };
      })
    ).then((rows) => {
      const mids: Record<string, number> = {};
      for (const r of rows) {
        if (r.mid) mids[r.pair] = r.mid;
      }
      setBandMidByPair(mids);
    });
  }, [pairs, planYear]);

  const empId = employeeId || detail?.focus_employee_id;
  const isVacancy = detail?.is_vacancy ?? false;

  const levelsForSpec = (specialization: string) =>
    pairs.filter((p) => p.specialization === specialization).map((p) => p.level);
  const setMonthField = (monthNum: number, field: "base" | "bonus", value: string) => {
    setMonthlyEdits((prev) => {
      const row = prev[monthNum];
      if (!row) return prev;
      return { ...prev, [monthNum]: { ...row, [field]: value } };
    });
  };
  const applyRowForward = (fromMonth: number) => {
    setMonthlyEdits((prev) => {
      const src = prev[fromMonth];
      if (!src) return prev;
      const next = { ...prev };
      for (let mm = fromMonth + 1; mm <= 12; mm += 1) {
        if (!next[mm]) continue;
        next[mm] = { ...src };
      }
      return next;
    });
  };

  const savePlan = async () => {
    if (!detail) return;
    setSaving(true);
    setErr(null);
    try {
      const isSameTarget = (payload: Record<string, unknown>) => {
        const payloadPos = payload.position_external_id as string | undefined;
        const payloadEmp = payload.employee_external_id as string | undefined | null;
        const currentEmp = empId?.startsWith("VACANCY-") ? null : empId || null;
        return payloadPos === positionId && (payloadEmp ?? null) === currentEmp;
      };
      const orderedMonths = [...detail.monthly].sort((a, b) => a.month - b.month);
      const pairDiffExists = orderedMonths.some((m) => {
        const row = monthlyEdits[m.month];
        if (!row) return false;
        return row.specialization !== m.specialization || row.level !== m.level;
      });
      if (pairDiffExists) {
        for (let i = 0; i < orderedMonths.length; i += 1) {
          const monthModel = orderedMonths[i];
          const row = monthlyEdits[monthModel.month];
          if (!row) continue;
          const currentPair = `${monthModel.specialization}|${monthModel.level}`;
          const desiredPair = `${row.specialization}|${row.level}`;
          const prevDesiredPair =
            i > 0
              ? (() => {
                  const prevMonth = orderedMonths[i - 1];
                  const prevRow = monthlyEdits[prevMonth.month];
                  const prevSpec = prevRow?.specialization ?? prevMonth.specialization;
                  const prevLevel = prevRow?.level ?? prevMonth.level;
                  return `${prevSpec}|${prevLevel}`;
                })()
              : null;
          const shouldEmit = i === 0 ? desiredPair !== currentPair : desiredPair !== prevDesiredPair;
          if (!shouldEmit) continue;
          await api(`/api/v1/plans/${planId}/classification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              effective_month: monthModel.month,
              position_external_id: positionId,
              employee_external_id: empId?.startsWith("VACANCY-") ? null : empId,
              specialization: row.specialization,
              level: row.level,
            }),
          });
        }
      }
      const amountTimeline = orderedMonths.map((m) => {
        const row = monthlyEdits[m.month];
        const baseNum = Number(row?.base ?? m.base);
        const bonusNum = Number(row?.bonus ?? m.bonus);
        return { month: m.month, base: baseNum, bonus: bonusNum };
      });
      const currentTimeline = orderedMonths.map((m) => ({ month: m.month, base: m.base, bonus: m.bonus }));
      const anyAmountDiff = amountTimeline.some((m, idx) => m.base !== currentTimeline[idx].base || m.bonus !== currentTimeline[idx].bonus);
      if (anyAmountDiff) {
        const oldOverrideEvents = detail.events.filter((ev) => ev.event_type === "MANUAL_OVERRIDE" && isSameTarget(ev.payload));
        for (const ev of oldOverrideEvents) {
          await api(`/api/v1/plans/${planId}/events/${ev.id}`, { method: "DELETE" });
        }
        const desiredSegments = amountTimeline.filter(
          (row, idx) =>
            idx === 0 ||
            row.base !== amountTimeline[idx - 1].base ||
            row.bonus !== amountTimeline[idx - 1].bonus
        );
        for (const seg of desiredSegments) {
          await api(`/api/v1/plans/${planId}/manual-override`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              effective_month: seg.month,
              position_external_id: positionId,
              employee_external_id: empId?.startsWith("VACANCY-") ? null : empId,
              base_amount: seg.base,
              bonus_amount: seg.bonus,
              propagate_forward: true,
            }),
          });
        }
      }
      const shouldUpdatePosition =
        roleTitle !== (detail.job_title || "") ||
        selectedOrgUnit !== detail.org_unit_code ||
        selectedLimitFlag !== detail.limit_flag ||
        (selectedStatus === "Vacancy") !== detail.is_vacancy;
      if (shouldUpdatePosition) {
        await api(`/api/v1/positions/${encodeURIComponent(positionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_title: roleTitle,
            org_unit_code: selectedOrgUnit,
            limit_flag: selectedLimitFlag,
            is_vacancy: selectedStatus === "Vacancy",
          }),
        });
      }
      await onSaved();
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const saveTarget = async () => {
    if (!targetSalary) return;
    setSaving(true);
    try {
      await api(`/api/v1/plans/${planId}/target-salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_month: month || 1,
          position_external_id: positionId,
          employee_external_id: empId?.startsWith("VACANCY-") ? null : empId,
          target_amount: Number(targetSalary),
        }),
      });
      onSaved();
      load();
      setTargetSalary("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const terminateEmployee = async (toVacancy: boolean) => {
    if (!empId || empId.startsWith("VACANCY-")) return;
    if (!confirm(toVacancy ? "Уволить и оставить вакансию?" : "Уволить сотрудника?")) return;
    setSaving(true);
    try {
      await api(`/api/v1/plans/${planId}/termination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_month: termMonth,
          employee_external_id: empId,
          position_external_id: positionId,
          to_vacancy: toVacancy,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const deleteVacancy = async () => {
    if (!confirm("Удалить вакансию из плана?")) return;
    setSaving(true);
    try {
      await api(`/api/v1/positions/${positionId}?plan_id=${planId}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const closePosition = async () => {
    if (!confirm("Закрыть позицию (стул) полностью?")) return;
    setSaving(true);
    try {
      await api(`/api/v1/plans/${planId}/close-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effective_month: termMonth, position_external_id: positionId }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const transferEmployee = async () => {
    if (!empId || empId.startsWith("VACANCY-")) return;
    if (!transferTargetPosition) return;
    if (!confirm("Перевести сотрудника на выбранную позицию?")) return;
    setSaving(true);
    try {
      await api(`/api/v1/plans/${planId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_month: transferMonth,
          employee_external_id: empId,
          from_position_external_id: positionId,
          to_position_external_id: transferTargetPosition,
        }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка перевода");
    } finally {
      setSaving(false);
    }
  };

  const specs = [...new Set(pairs.map((p) => p.specialization))];
  const transferOptions = useMemo(
    () =>
      positions
        .filter((p) => p.external_id !== positionId)
        .sort((a, b) => Number(b.is_vacancy) - Number(a.is_vacancy) || a.external_id.localeCompare(b.external_id, "ru")),
    [positions, positionId]
  );
  const selectedTransferTarget = transferOptions.find((p) => p.external_id === transferTargetPosition) || null;
  useEffect(() => {
    if (!transferOptions.length) {
      if (transferTargetPosition) setTransferTargetPosition("");
      return;
    }
    const stillExists = transferOptions.some((p) => p.external_id === transferTargetPosition);
    if (!stillExists) {
      setTransferTargetPosition(transferOptions[0].external_id);
    }
  }, [transferOptions, transferTargetPosition]);
  const employeeName = detail?.assignments.find((a) => a.employee_id === empId)?.full_name || "—";
  const editedRows = detail?.monthly.map((m) => {
    const row = monthlyEdits[m.month] ?? {
      specialization: m.specialization,
      level: m.level,
      base: String(m.base),
      bonus: String(m.bonus),
    };
    const baseNum = Number(row.base || 0);
    const bonusNum = Number(row.bonus || 0);
    const totalNum = baseNum + bonusNum;
    const pairKey = `${row.specialization}|${row.level}`;
    const mid = bandMidByPair[pairKey] || m.midpoint || 0;
    const crPercent = mid > 0 ? (baseNum / mid) * 100 : m.cr != null ? m.cr * 100 : null;
    return { month: m.month, row, baseNum, bonusNum, totalNum, crPercent };
  }) ?? [];
  const totals = editedRows.reduce(
    (acc, r) => ({ base: acc.base + r.baseNum, bonus: acc.bonus + r.bonusNum, total: acc.total + r.totalNum }),
    { base: 0, bonus: 0, total: 0 }
  );

  const decRow = detail?.monthly.find((m) => m.month === 12);
  const eventLabel = (eventType: string) =>
    ({
      INDEXATION: "Индексация",
      MANUAL_OVERRIDE: "Ручная правка",
      CLASSIFICATION: "Смена грейда",
      TARGET_SALARY: "Целевой оклад",
      TERMINATION: "Увольнение",
      TERMINATION_TO_VACANCY: "Увольнение в вакансию",
      PLANNED_HIRE: "Плановый найм/вакансия",
      POSITION_CARRYOVER: "Перенос позиции",
      TRANSFER: "Перевод сотрудника",
    }[eventType] || eventType);
  const eventDetails = (eventType: string, payload: Record<string, unknown>) => {
    if (eventType === "INDEXATION") {
      if (payload.index_percent != null) {
        return `+${Number(payload.index_percent).toLocaleString("ru")}% ${String(payload.index_article || "BASE")}`;
      }
      if (payload.index_fixed != null) {
        return `${money(payload.index_fixed)} ${String(payload.index_article || "BASE")}`;
      }
    }
    if (eventType === "MANUAL_OVERRIDE") {
      const amounts = payload.new_amounts as Record<string, unknown> | undefined;
      if (amounts) {
        const base = money(amounts.BASE);
        const bonus = money(amounts.BONUS_PLAN);
        const parts = [];
        if (base) parts.push(`BASE: ${base}`);
        if (bonus) parts.push(`BONUS: ${bonus}`);
        return parts.join(", ");
      }
    }
    if (eventType === "PLANNED_HIRE") {
      const amounts = payload.hire_amounts as Record<string, unknown> | undefined;
      if (amounts) {
        const base = money(amounts.BASE);
        const bonus = money(amounts.BONUS_PLAN);
        const parts = [];
        if (base) parts.push(`Оклад вакансии: ${base}`);
        if (bonus) parts.push(`Премия вакансии: ${bonus}`);
        return parts.join(", ");
      }
    }
    if (eventType === "TRANSFER") {
      const fromPos = String(payload.from_position_external_id || "—");
      const toPos = String(payload.to_position_external_id || "—");
      const vacBase = money(payload.vacancy_base_amount);
      return `Из ${fromPos} в ${toPos}${vacBase ? `, оклад вакансии ${vacBase}` : ""}`;
    }
    if (eventType === "TERMINATION_TO_VACANCY") {
      return "Позиция освобождена и остается как вакансия";
    }
    return "";
  };
  const decGrowth = (() => {
    if (!detail || !decRow || detail.dec_prev_base == null) return null;
    const prev = detail.dec_prev_base;
    const curr = decRow.base;
    if (prev === 0) {
      return curr > 0 ? "100.0" : "0.0";
    }
    return (((curr - prev) / prev) * 100).toFixed(1);
  })();

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer drawer-wide drawer-ref" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>Детали планирования</h3>
            <div className="muted">{positionId}{empId && !empId.startsWith("VACANCY-") ? ` · ${empId}` : ""}</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        {detail && detail.monthly.length === 0 && (
          <p className="empty-hint">Нет строк плана — нажмите «Пересчитать план» в сайдбаре.</p>
        )}
        {detail && detail.monthly.length > 0 && (
          <>
            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <label>
                Название роли
                <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              </label>
              <label>
                Сотрудник
                <input value={employeeName} readOnly />
              </label>
              <label>
                Подразделение
                <select value={selectedOrgUnit} onChange={(e) => setSelectedOrgUnit(e.target.value)}>
                  {orgUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  {!orgUnits.includes(selectedOrgUnit) && <option value={selectedOrgUnit}>{selectedOrgUnit}</option>}
                </select>
              </label>
              <label>
                Статус позиции
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="Active">Занята</option>
                  <option value="Vacancy">Вакансия</option>
                </select>
              </label>
            </div>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Классификация и лимиты</h4>
              <div className="form-grid">
                <label>
                  Признак лимита
                  <select value={selectedLimitFlag} onChange={(e) => setSelectedLimitFlag(e.target.value)}>
                    <option value="IN_LIMIT">IN_LIMIT</option>
                    <option value="OVER_LIMIT">OVER_LIMIT</option>
                    <option value="UNLIMITED">UNLIMITED</option>
                  </select>
                </label>
              </div>
            </div>

            <p>
              Дек прошлого года (BASE):{" "}
              <strong>{detail.dec_prev_base != null ? `${detail.dec_prev_base.toLocaleString("ru")} ₽` : "нет данных"}</strong>
            </p>
            <p>
              Дек плана (BASE): <strong>{decRow ? `${decRow.base.toLocaleString("ru")} ₽` : "нет данных"}</strong>
              {decGrowth != null && <span className="muted"> ({decGrowth}%)</span>}
            </p>

            <div className="schedule-header">
              <h4 style={{ margin: 0 }}>Помесячный график выплат</h4>
              <span className="muted">CR пересчитывается автоматически от BASE</span>
            </div>
            <table className="compact-table monthly-schedule">
              <thead>
                <tr>
                  <th>Месяц</th>
                  <th>Спец.</th>
                  <th>Грейд</th>
                  <th>BASE</th>
                  <th>BONUS</th>
                  <th>Итого</th>
                  <th>CR %</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {editedRows.map((item) => {
                  const m = detail.monthly.find((x) => x.month === item.month)!;
                  const row = item.row;
                  const totalNum = item.totalNum;
                  const crPercent = item.crPercent;
                  return (
                    <tr key={m.month} className={m.month === month ? "row-selected" : ""} onClick={() => setMonth(m.month)}>
                      <td>{MONTHS[m.month]}</td>
                      <td>
                        <select
                          value={row.specialization}
                          onChange={(e) =>
                            setMonthlyEdits((prev) => ({
                              ...prev,
                              [m.month]: {
                                ...row,
                                specialization: e.target.value,
                                level: levelsForSpec(e.target.value)[0] || row.level,
                              },
                            }))
                          }
                        >
                          {specs.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.level}
                          onChange={(e) => setMonthlyEdits((prev) => ({ ...prev, [m.month]: { ...row, level: e.target.value } }))}
                        >
                          {levelsForSpec(row.specialization).map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                          {levelsForSpec(row.specialization).length === 0 && (
                            <option value={row.level}>{row.level || "—"}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.base}
                          onChange={(e) => setMonthField(m.month, "base", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.bonus}
                          onChange={(e) => setMonthField(m.month, "bonus", e.target.value)}
                        />
                      </td>
                      <td>{totalNum.toLocaleString("ru")} ₽</td>
                      <td className="cr-cell">{crPercent != null ? `${crPercent.toFixed(1)}%` : "—"}</td>
                      <td className="monthly-actions-cell">
                        <button
                          type="button"
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyRowForward(m.month);
                          }}
                          title="Скопировать строку на следующие месяцы"
                        >
                          ⧉
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="row-total">
                  <td>Итого</td>
                  <td />
                  <td />
                  <td>{totals.base.toLocaleString("ru")} ₽</td>
                  <td>{totals.bonus.toLocaleString("ru")} ₽</td>
                  <td>{totals.total.toLocaleString("ru")} ₽</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>

            <div className="card">
              <h4 style={{ marginTop: 0 }}>Целевой оклад</h4>
              <div className="form-row">
                <input placeholder="Сумма BASE" value={targetSalary} onChange={(e) => setTargetSalary(e.target.value)} type="number" />
                <button type="button" className="secondary" disabled={saving} onClick={saveTarget}>
                  Применить
                </button>
              </div>
            </div>

            {detail.events.length > 0 && (
              <div className="card">
                <h4 style={{ marginTop: 0 }}>Список изменений</h4>
                <ul className="event-list">
                  {detail.events
                    .slice()
                    .sort(
                      (a, b) =>
                        a.effective_month - b.effective_month ||
                        (a.created_order ?? 0) - (b.created_order ?? 0) ||
                        a.id - b.id
                    )
                    .map((ev) => (
                      <li key={ev.id}>
                        <strong>{MONTHS[ev.effective_month]}</strong>: {eventLabel(ev.event_type)}
                        {eventDetails(ev.event_type, ev.payload) && <span className="muted">{eventDetails(ev.event_type, ev.payload)}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {!isVacancy && empId && !empId.startsWith("VACANCY-") && (
              <div className="card">
                <h4 style={{ marginTop: 0 }}>Переход сотрудника</h4>
                <p className="muted" style={{ marginTop: 0 }}>
                  Для перевода в первую очередь выбирайте позиции со статусом «вакансия».
                </p>
                <div className="form-row">
                  <label>
                    С месяца
                    <select value={transferMonth} onChange={(e) => setTransferMonth(Number(e.target.value))}>
                      {MONTHS.slice(1).map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ minWidth: 220 }}>
                    Новая позиция
                    <select value={transferTargetPosition} onChange={(e) => setTransferTargetPosition(e.target.value)}>
                      {!transferOptions.length && <option value="">Нет доступных позиций</option>}
                      {transferOptions.map((p) => (
                        <option key={p.external_id} value={p.external_id}>
                          {p.external_id} · {p.org_unit_code} · {p.is_vacancy ? "вакансия" : "занята"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    disabled={saving || !transferTargetPosition || transferOptions.length === 0}
                    onClick={transferEmployee}
                  >
                    Перевести
                  </button>
                </div>
                {selectedTransferTarget && (
                  <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                    Перевод: <strong>{employeeName}</strong> из <strong>{positionId}</strong> в{" "}
                    <strong>{selectedTransferTarget.external_id}</strong> с {MONTHS[transferMonth]}.
                  </p>
                )}
                {selectedTransferTarget && !selectedTransferTarget.is_vacancy && (
                  <p className="text-danger" style={{ margin: "0.25rem 0 0" }}>
                    Выбрана занятая позиция — перевод может быть отклонен бизнес-правилами.
                  </p>
                )}
              </div>
            )}

            <div className="card danger-zone">
              <h4 style={{ marginTop: 0 }}>Удаление / увольнение</h4>
              <div className="form-row">
                <label>
                  С месяца
                  <select value={termMonth} onChange={(e) => setTermMonth(Number(e.target.value))}>
                    {MONTHS.slice(1).map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {isVacancy ? (
                <button type="button" className="link-danger" disabled={saving} onClick={deleteVacancy}>
                  Удалить вакансию
                </button>
              ) : (
                <>
                  {empId && !empId.startsWith("VACANCY-") && (
                    <>
                      <button type="button" className="secondary" disabled={saving} onClick={() => terminateEmployee(true)}>
                        Уволить → вакансия
                      </button>
                      <button type="button" className="link-danger" disabled={saving} onClick={() => terminateEmployee(false)}>
                        Уволить сотрудника
                      </button>
                    </>
                  )}
                  <button type="button" className="link-danger" disabled={saving} onClick={closePosition}>
                    Закрыть позицию (стул)
                  </button>
                </>
              )}
            </div>
            <div className="page-actions page-actions-sticky" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="button" onClick={savePlan} disabled={saving}>
                Сохранить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
