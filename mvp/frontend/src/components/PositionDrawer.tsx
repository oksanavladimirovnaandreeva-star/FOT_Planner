import { useMemo, useState } from "react";
import { CalendarMinus2, CalendarPlus2, Copy, Trash2, X } from "lucide-react";
import {
  annualTotal,
  applyDirectEdit,
  decToDec,
  getLimitStatus,
  getMonthlyCR,
  levelOptionsForSpecialization,
  limitUsagePercent,
  monthLabel,
  SPECIALIZATION_OPTIONS,
} from "../data/planningData";
import { MONTHS } from "../types";
import type { EventType, PlannedEvent, PositionRecord } from "../types";

interface PositionDrawerProps {
  open: boolean;
  record: PositionRecord | null;
  onClose: () => void;
  onSaveDraft: (record: PositionRecord, sourcePositionId?: string, forceCreate?: boolean) => void;
  onAddEvent: (positionId: string, event: PlannedEvent) => void;
  onDeleteEvent: (positionId: string, eventId: string) => void;
  vacancyPositionOptions: string[];
  isPersisted: boolean;
  departmentOptions: string[];
  unitOptionsForDepartment: (department: string) => string[];
  teamOptionsForUnit: (department: string, unit: string) => string[];
}

const EVENT_OPTIONS: EventType[] = [
  "MANUAL_OVERRIDE",
  "TARGET_SALARY",
  "CLASSIFICATION_CHANGE",
  "TERMINATION",
  "TERMINATION_TO_VACANCY",
  "CLOSE_POSITION",
  "PLANNED_HIRE",
  "CANCEL_VACANCY",
  "TRANSFER",
  "POSITION_CARRYOVER",
];

function emptyPayload() {
  return {
    month: 0,
    percent: 5,
    base: 0,
    bonus: 0,
    specialization: "",
    level: "",
    transferToPositionId: "",
    employeeId: "",
  };
}

function eventPayloadLabel(event: PlannedEvent): string {
  const pairs: string[] = [];
  if (typeof event.payload.percent === "number") pairs.push(`indexation: ${event.payload.percent}%`);
  if (typeof event.payload.base === "number") pairs.push(`BASE: ${event.payload.base.toLocaleString("ru-RU")} ₽`);
  if (typeof event.payload.bonus === "number") pairs.push(`BONUS: ${event.payload.bonus.toLocaleString("ru-RU")} ₽`);
  if (event.payload.specialization) pairs.push(`spec: ${event.payload.specialization}`);
  if (event.payload.level) pairs.push(`level: ${event.payload.level}`);
  if (event.payload.transferToPositionId) pairs.push(`to: ${event.payload.transferToPositionId}`);
  if (event.payload.employeeName) pairs.push(`employee: ${event.payload.employeeName}`);
  if (event.payload.employeeId) pairs.push(`employeeId: ${event.payload.employeeId}`);
  return pairs.length ? pairs.join(", ") : "—";
}

function crTone(value: number): "warn" | "ok" | "danger" {
  if (value < 0.8) return "warn";
  if (value <= 1.2) return "ok";
  return "danger";
}

export function PositionDrawer({
  open,
  record,
  onClose,
  onSaveDraft,
  onAddEvent,
  onDeleteEvent,
  vacancyPositionOptions,
  isPersisted,
  departmentOptions,
  unitOptionsForDepartment,
  teamOptionsForUnit,
}: PositionDrawerProps) {
  const [form, setForm] = useState<{ type: EventType; payload: ReturnType<typeof emptyPayload> }>({
    type: "MANUAL_OVERRIDE",
    payload: emptyPayload(),
  });

  const selected = useMemo(() => record, [record]);
  if (!open || !selected) return null;

  const decemberCurrent = selected.monthlyBase[11];
  const decemberPrevious = selected.previousDecemberBase;
  const growth = decToDec(decemberPrevious, decemberCurrent);
  const limit = getLimitStatus(selected);

  const addVacancyFromDrawer = () => {
    onSaveDraft(selected, selected.positionId, true);
    window.alert("Вакансия добавлена в общий список.");
  };

  const applyCopyForward = (month: number) => {
    const next = {
      ...selected,
      monthlySpec: [...selected.monthlySpec],
      monthlyLevel: [...selected.monthlyLevel],
      monthlyBase: [...selected.monthlyBase],
      monthlyBonus: [...selected.monthlyBonus],
    };

    for (let index = month + 1; index < 12; index += 1) {
      next.monthlySpec[index] = next.monthlySpec[month];
      next.monthlyLevel[index] = next.monthlyLevel[month];
      next.monthlyBase[index] = next.monthlyBase[month];
      next.monthlyBonus[index] = next.monthlyBonus[month];
    }
    onSaveDraft(
      applyDirectEdit(next, (draft) => {
        draft.seedMonthlySpec = [...next.monthlySpec];
        draft.seedMonthlyLevel = [...next.monthlyLevel];
        draft.seedMonthlyBase = [...next.monthlyBase];
        draft.seedMonthlyBonus = [...next.monthlyBonus];
      }),
      selected.positionId,
    );
  };

  const saveEvent = () => {
    const nextEvent: PlannedEvent = {
      id: crypto.randomUUID(),
      type: form.type,
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: form.payload,
    };
    onAddEvent(selected.positionId, nextEvent);
    setForm({ type: "MANUAL_OVERRIDE", payload: emptyPayload() });
  };

  const terminateToVacancy = () => {
    const event: PlannedEvent = {
      id: crypto.randomUUID(),
      type: "TERMINATION_TO_VACANCY",
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: { month: new Date().getMonth() },
    };
    onAddEvent(selected.positionId, event);
  };

  const terminate = () => {
    const event: PlannedEvent = {
      id: crypto.randomUUID(),
      type: "TERMINATION",
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: { month: new Date().getMonth() },
    };
    onAddEvent(selected.positionId, event);
  };

  const closePosition = () => {
    const event: PlannedEvent = {
      id: crypto.randomUUID(),
      type: "CLOSE_POSITION",
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: { month: new Date().getMonth() },
    };
    onAddEvent(selected.positionId, event);
  };

  const transfer = () => {
    if (!form.payload.transferToPositionId) {
      window.alert("Выберите целевую вакансию для перевода.");
      return;
    }
    const event: PlannedEvent = {
      id: crypto.randomUUID(),
      type: "TRANSFER",
      createdAt: new Date().toISOString(),
      createdOrder: selected.events.length + 1,
      payload: {
        month: new Date().getMonth(),
        transferToPositionId: form.payload.transferToPositionId,
      },
    };
    onAddEvent(selected.positionId, {
      ...event,
      payload: {
        ...event.payload,
        employeeName: selected.employeeName ?? undefined,
        employeeId: selected.employeeId ?? undefined,
      },
    });
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <header className="drawer-header">
          <div>
            <h2>{selected.positionId} - {selected.role}</h2>
            <p>{selected.employeeName ?? "Vacancy"} · {selected.employeeId ?? "—"} · {selected.department}</p>
          </div>
          <div className="drawer-header-actions">
            {!isPersisted && selected.status === "Vacancy" && (
              <button className="primary-btn" onClick={addVacancyFromDrawer}>Добавить вакансию</button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
              <X size={18} />
            </button>
          </div>
        </header>

        <section className="kpi-grid">
          <article className="kpi-card">
            <span>Прошлый декабрь BASE</span>
            <strong>{decemberPrevious.toLocaleString("ru-RU")} ₽</strong>
          </article>
          <article className="kpi-card">
            <span>Декабрь BASE</span>
            <strong>{decemberCurrent.toLocaleString("ru-RU")} ₽</strong>
          </article>
          <article className="kpi-card">
            <span>Dec to Dec</span>
            <strong>{growth.toFixed(1)}%</strong>
          </article>
          <article className="kpi-card">
            <span>Annual Limit</span>
            <strong>{selected.annualLimit.toLocaleString("ru-RU")} ₽</strong>
          </article>
          <article className="kpi-card">
            <span>Limit Status</span>
            <strong className={`limit-text limit-text--${limit.tone}`}>
              {limit.label} ({limitUsagePercent(selected).toFixed(1)}%)
            </strong>
          </article>
        </section>

        <section className="limit-settings">
          <label>
            ID позиции
            <input
              type="text"
              value={selected.positionId}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (!value) return;
                const next = applyDirectEdit(selected, (draft) => {
                  draft.positionId = value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Роль
            <input
              type="text"
              value={selected.role}
              onChange={(event) => {
                const next = applyDirectEdit(selected, (draft) => {
                  draft.role = event.target.value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Департамент
            <select
              value={selected.department}
              onChange={(event) => {
                const nextDepartment = event.target.value;
                const units = unitOptionsForDepartment(nextDepartment);
                const nextUnit = units[0] ?? "";
                const teams = teamOptionsForUnit(nextDepartment, nextUnit);
                const nextTeam = teams[0] ?? "";
                const next = applyDirectEdit(selected, (draft) => {
                  draft.department = nextDepartment;
                  draft.unit = nextUnit;
                  draft.team = nextTeam;
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>
          <label>
            Юнит
            <select
              value={selected.unit}
              onChange={(event) => {
                const nextUnit = event.target.value;
                const teams = teamOptionsForUnit(selected.department, nextUnit);
                const nextTeam = teams[0] ?? "";
                const next = applyDirectEdit(selected, (draft) => {
                  draft.unit = nextUnit;
                  draft.team = nextTeam;
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {unitOptionsForDepartment(selected.department).map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <label>
            Команда
            <select
              value={selected.team}
              onChange={(event) => {
                const next = applyDirectEdit(selected, (draft) => {
                  draft.team = event.target.value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {teamOptionsForUnit(selected.department, selected.unit).map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </label>
          <label>
            С какого месяца активна позиция
            <select
              value={selected.activeFromMonth}
              onChange={(event) => {
                const month = Number(event.target.value);
                const next = applyDirectEdit(selected, (draft) => {
                  draft.activeFromMonth = month;
                  if (draft.vacancySinceMonth !== null && draft.vacancySinceMonth < month) {
                    draft.vacancySinceMonth = month;
                    draft.seedVacancySinceMonth = month;
                  }
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            Специализация вакансии
            <select
              value={selected.seedMonthlySpec[selected.activeFromMonth]}
              onChange={(event) => {
                const specialization = event.target.value;
                const levels = levelOptionsForSpecialization(specialization);
                const chosenLevel = levels[0];
                const next = applyDirectEdit(selected, (draft) => {
                  for (let monthIndex = draft.activeFromMonth; monthIndex < 12; monthIndex += 1) {
                    draft.seedMonthlySpec[monthIndex] = specialization;
                    draft.seedMonthlyLevel[monthIndex] = chosenLevel;
                  }
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {SPECIALIZATION_OPTIONS.map((specialization) => (
                <option key={specialization} value={specialization}>{specialization}</option>
              ))}
            </select>
          </label>
          <label>
            Уровень вакансии
            <select
              value={selected.seedMonthlyLevel[selected.activeFromMonth]}
              onChange={(event) => {
                const level = event.target.value;
                const next = applyDirectEdit(selected, (draft) => {
                  for (let monthIndex = draft.activeFromMonth; monthIndex < 12; monthIndex += 1) {
                    draft.seedMonthlyLevel[monthIndex] = level;
                  }
                });
                onSaveDraft(next, selected.positionId);
              }}
            >
              {levelOptionsForSpecialization(selected.seedMonthlySpec[selected.activeFromMonth]).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            ID сотрудника
            <input
              type="text"
              value={selected.employeeId ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim() || null;
                const next = applyDirectEdit(selected, (draft) => {
                  draft.seedEmployeeId = value;
                  draft.employeeId = value;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <label>
            Годовой лимит позиции
            <input
              type="number"
              value={selected.annualLimit}
              onChange={(event) => {
                const value = Number(event.target.value);
                const next = applyDirectEdit(selected, (draft) => {
                  draft.annualLimit = Number.isFinite(value) ? value : 0;
                });
                onSaveDraft(next, selected.positionId);
              }}
            />
          </label>
          <div className="limit-settings__meta">
            План: {annualTotal(selected).toLocaleString("ru-RU")} ₽
          </div>
        </section>

        <section className="drawer-actions">
          <button onClick={terminate} className="secondary-btn">
            <CalendarMinus2 size={14} /> Увольнение
          </button>
          <button onClick={terminateToVacancy} className="secondary-btn">
            <CalendarMinus2 size={14} /> Увольнение в вакансию
          </button>
          <button onClick={transfer} className="secondary-btn">
            <CalendarPlus2 size={14} /> Перевод
          </button>
          <button onClick={closePosition} className="danger-btn">Закрыть позицию</button>
        </section>

        <section className="event-form">
          <h3>Новое событие</h3>
          <p className="event-note">
            Индексация выполняется только массово на странице planning.
          </p>
          <div className="event-grid">
            <label>
              Тип
              <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as EventType }))}>
                {EVENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Месяц
              <select value={form.payload.month} onChange={(event) => setForm((prev) => ({ ...prev, payload: { ...prev.payload, month: Number(event.target.value) } }))}>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
              </select>
            </label>
            <label>
              BASE
              <input type="number" value={form.payload.base} onChange={(event) => setForm((prev) => ({ ...prev, payload: { ...prev.payload, base: Number(event.target.value) } }))} />
            </label>
            <label>
              BONUS
              <input type="number" value={form.payload.bonus} onChange={(event) => setForm((prev) => ({ ...prev, payload: { ...prev.payload, bonus: Number(event.target.value) } }))} />
            </label>
            <label>
              Позиция для TRANSFER
              <select
                value={form.payload.transferToPositionId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    payload: { ...prev.payload, transferToPositionId: event.target.value },
                  }))
                }
              >
                <option value="">Выберите вакансию</option>
                {vacancyPositionOptions
                  .filter((positionId) => positionId !== selected.positionId)
                  .map((positionId) => (
                    <option key={positionId} value={positionId}>
                      {positionId}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Employee ID (planned hire)
              <input
                placeholder="E777"
                value={form.payload.employeeId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    payload: { ...prev.payload, employeeId: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <button onClick={saveEvent} className="primary-btn">Добавить событие</button>
        </section>

        <section className="monthly-table-wrap">
          <h3>Помесячно: spec / level / BASE / BONUS / TOTAL / CR</h3>
          <table className="monthly-table">
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Spec</th>
                <th>Level</th>
                <th>BASE</th>
                <th>BONUS</th>
                <th>TOTAL</th>
                <th>CR</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((month, index) => {
                const total = selected.monthlyBase[index] + selected.monthlyBonus[index];
                const cr = getMonthlyCR(selected.monthlyBase[index], selected.monthlySpec[index], selected.monthlyLevel[index]);
                return (
                  <tr key={month}>
                    <td>{month}</td>
                    <td>
                      <select value={selected.monthlySpec[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          const specialization = event.target.value;
                          const levelOptions = levelOptionsForSpecialization(specialization);
                          const currentLevel = draft.seedMonthlyLevel[index];
                          const nextLevel = levelOptions.includes(currentLevel) ? currentLevel : levelOptions[0];
                          for (let monthIndex = index; monthIndex < 12; monthIndex += 1) {
                            draft.seedMonthlySpec[monthIndex] = specialization;
                            draft.seedMonthlyLevel[monthIndex] = nextLevel;
                          }
                        });
                        onSaveDraft(next, selected.positionId);
                      }}>
                        {SPECIALIZATION_OPTIONS.map((specialization) => (
                          <option key={specialization} value={specialization}>
                            {specialization}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={selected.monthlyLevel[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          for (let monthIndex = index; monthIndex < 12; monthIndex += 1) {
                            draft.seedMonthlyLevel[monthIndex] = event.target.value;
                          }
                        });
                        onSaveDraft(next, selected.positionId);
                      }}>
                        {levelOptionsForSpecialization(selected.monthlySpec[index]).map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" value={selected.monthlyBase[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBase[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td>
                      <input type="number" value={selected.monthlyBonus[index]} onChange={(event) => {
                        const next = applyDirectEdit(selected, (draft) => {
                          draft.seedMonthlyBonus[index] = Number(event.target.value);
                        });
                        onSaveDraft(next, selected.positionId);
                      }} />
                    </td>
                    <td>{total.toLocaleString("ru-RU")} ₽</td>
                    <td>
                      <span className={`cr-value cr-value--${crTone(cr)}`}>{cr.toFixed(2)}</span>
                    </td>
                    <td>
                      <button className="icon-btn" title="Copy forward" onClick={() => applyCopyForward(index)}>
                        <Copy size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="history-wrap">
          <h3>История событий</h3>
          <table className="history-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Месяц</th>
                <th>Payload</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {selected.events.length === 0 && (
                <tr>
                  <td colSpan={4}>Событий пока нет</td>
                </tr>
              )}
              {selected.events.map((event) => (
                <tr key={event.id}>
                  <td>{event.type}</td>
                  <td>{monthLabel(event.payload.month)}</td>
                  <td className="payload">{eventPayloadLabel(event)}</td>
                  <td>
                    <button className="icon-btn danger" onClick={() => onDeleteEvent(selected.positionId, event.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

