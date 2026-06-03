import {
  applyEvents,
  isVacantForTransferAtMonth,
  removeEvent,
  upsertEvent,
} from "./planningData";
import type { PlannedEvent, PositionRecord } from "../types";

export type PlanTransferParams = {
  sourcePositionId: string;
  month: number;
  transferKind: "INTRA_UNIT" | "INTER_DEPARTMENT";
  transferToPositionId?: string;
  targetDepartment?: string;
  targetUnit?: string;
  targetTeam?: string;
  employeeId: string;
  employeeName: string;
  base: number;
  bonus: number;
  specialization: string;
  level: string;
};

export type PlanTransferOptions = {
  nextPositionId: (positions: PositionRecord[]) => string;
  applyIndexationBatches: (record: PositionRecord, allPositions: PositionRecord[]) => PositionRecord;
};

function isOccupiedAtMonth(record: PositionRecord, month: number): boolean {
  return !isVacantForTransferAtMonth(record, month);
}

function findEventById(positions: PositionRecord[], positionId: string, eventId: string): PlannedEvent | null {
  const position = positions.find((item) => item.positionId === positionId);
  return position?.events.find((event) => event.id === eventId) ?? null;
}

function collectPairEventIds(positions: PositionRecord[], pairId: string): { positionId: string; eventId: string }[] {
  const hits: { positionId: string; eventId: string }[] = [];
  for (const position of positions) {
    for (const event of position.events) {
      if (event.payload.transferPairId === pairId) {
        hits.push({ positionId: position.positionId, eventId: event.id });
      }
    }
  }
  return hits;
}

/** Позиция с пересчитанными помесячными полями и статусом (как в UI после событий). */
export function withAppliedEvents(record: PositionRecord): PositionRecord {
  return applyEvents(record);
}

export function mapPositionsWithAppliedEvents(positions: PositionRecord[]): PositionRecord[] {
  return positions.map(withAppliedEvents);
}

/** Черновик вакансии (ещё не в planPositions) доступен для intra-перевода до «Сохранить в план». */
export function mergePlanPositionsWithDraft(
  positions: PositionRecord[],
  draft: PositionRecord | null,
): PositionRecord[] {
  if (!draft) return positions;
  if (positions.some((position) => position.positionId === draft.positionId)) return positions;
  return [...positions, withAppliedEvents(draft)];
}

export function applyTerminationToVacancy(
  positions: PositionRecord[],
  positionId: string,
  month: number,
): { ok: true; positions: PositionRecord[] } | { ok: false; error: string } {
  const source = positions.find((item) => item.positionId === positionId);
  if (!source) return { ok: false, error: "Позиция не найдена." };
  if (!isOccupiedAtMonth(source, month)) {
    return { ok: false, error: "На выбранный месяц позиция уже не занята." };
  }

  const event: PlannedEvent = {
    id: crypto.randomUUID(),
    type: "TERMINATION_TO_VACANCY",
    createdAt: new Date().toISOString(),
    createdOrder: source.events.length + 1,
    payload: { month },
  };

  const next = positions.map((position) =>
    position.positionId === positionId ? upsertEvent(position, event) : position,
  );
  const updated = next.find((item) => item.positionId === positionId);
  if (!updated) return { ok: false, error: "Не удалось применить увольнение." };
  if (updated.status !== "Vacancy") {
    return { ok: false, error: "После увольнения статус должен быть «Вакансия»." };
  }
  const annualBase = updated.monthlyBase.reduce((sum, value, index) => sum + value + updated.monthlyBonus[index], 0);
  if (annualBase <= 0) {
    return { ok: false, error: "Бюджет позиции обнулился — проверьте события и оклады." };
  }
  return { ok: true, positions: next };
}

function buildIntraUnitTarget(
  positions: PositionRecord[],
  source: PositionRecord,
  params: PlanTransferParams,
  options: PlanTransferOptions,
): PositionRecord {
  const transferMonth = params.month;
  const seedBase = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : params.base));
  const seedBonus = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : params.bonus));
  const seedSpec = Array.from({ length: 12 }, (_, idx) =>
    idx < transferMonth ? source.seedMonthlySpec[idx] : params.specialization,
  );
  const seedLevel = Array.from({ length: 12 }, (_, idx) =>
    idx < transferMonth ? source.seedMonthlyLevel[idx] : params.level,
  );

  const targetPosition: PositionRecord = {
    positionId: options.nextPositionId(positions),
    role: "Вакансия под перевод",
    department: source.department,
    unit: source.unit,
    team: source.team,
    slotType: "new",
    activeFromMonth: transferMonth,
    vacancySinceMonth: transferMonth,
    limitFlag: "IN_LIMIT",
    previousDecemberBase: 0,
    employeeName: null,
    employeeId: null,
    status: "Vacancy",
    seedEmployeeName: null,
    seedEmployeeId: null,
    seedStatus: "Vacancy",
    seedVacancySinceMonth: transferMonth,
    monthlySpec: [...seedSpec],
    monthlyLevel: [...seedLevel],
    monthlyBase: [...seedBase],
    monthlyBonus: [...seedBonus],
    seedMonthlySpec: seedSpec,
    seedMonthlyLevel: seedLevel,
    seedMonthlyBase: seedBase,
    seedMonthlyBonus: seedBonus,
    events: [],
  };
  return options.applyIndexationBatches(targetPosition, positions);
}

function buildInterDepartmentTarget(
  positions: PositionRecord[],
  source: PositionRecord,
  params: PlanTransferParams,
  options: PlanTransferOptions,
): PositionRecord {
  const transferMonth = params.month;
  const seedBase = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : params.base));
  const seedBonus = Array.from({ length: 12 }, (_, idx) => (idx < transferMonth ? 0 : params.bonus));
  const seedSpec = Array.from({ length: 12 }, (_, idx) =>
    idx < transferMonth ? source.seedMonthlySpec[idx] : params.specialization,
  );
  const seedLevel = Array.from({ length: 12 }, (_, idx) =>
    idx < transferMonth ? source.seedMonthlyLevel[idx] : params.level,
  );

  const targetPosition: PositionRecord = {
    positionId: options.nextPositionId(positions),
    role: source.role,
    department: params.targetDepartment ?? source.department,
    unit: params.targetUnit ?? "",
    team: params.targetTeam ?? "",
    slotType: "new",
    activeFromMonth: transferMonth,
    vacancySinceMonth: transferMonth,
    limitFlag: "IN_LIMIT",
    previousDecemberBase: 0,
    employeeName: null,
    employeeId: null,
    status: "Vacancy",
    seedEmployeeName: null,
    seedEmployeeId: null,
    seedStatus: "Vacancy",
    seedVacancySinceMonth: transferMonth,
    monthlySpec: [...seedSpec],
    monthlyLevel: [...seedLevel],
    monthlyBase: [...seedBase],
    monthlyBonus: [...seedBonus],
    seedMonthlySpec: seedSpec,
    seedMonthlyLevel: seedLevel,
    seedMonthlyBase: seedBase,
    seedMonthlyBonus: seedBonus,
    events: [],
  };
  return options.applyIndexationBatches(targetPosition, positions);
}

export function applyPlanTransfer(
  positions: PositionRecord[],
  params: PlanTransferParams,
  options: PlanTransferOptions,
): { ok: true; positions: PositionRecord[] } | { ok: false; error: string } {
  const month = Math.max(0, Math.min(11, params.month));
  const source = positions.find((item) => item.positionId === params.sourcePositionId);
  if (!source) return { ok: false, error: "Исходная позиция не найдена." };
  if (!source.employeeId || !source.employeeName) {
    return { ok: false, error: "У исходной позиции нет сотрудника." };
  }
  if (!isOccupiedAtMonth(source, month)) {
    return { ok: false, error: "На выбранный месяц исходная позиция уже не занята." };
  }

  let targetPositionId = params.transferToPositionId;
  let working = [...positions];

  if (params.transferKind === "INTRA_UNIT") {
    if (!targetPositionId) {
      const created = buildIntraUnitTarget(working, source, params, options);
      working = [...working, created];
      targetPositionId = created.positionId;
    } else {
      const target = working.find((item) => item.positionId === targetPositionId);
      if (!target) return { ok: false, error: "Целевая вакансия не найдена." };
      if (target.department.trim() !== source.department.trim() || target.unit.trim() !== source.unit.trim()) {
        return { ok: false, error: "Целевая вакансия должна быть в том же департаменте и юните." };
      }
      if (!isVacantForTransferAtMonth(target, month)) {
        return { ok: false, error: "Целевой слот недоступен в выбранный месяц." };
      }
    }
  } else {
    if (!params.targetDepartment) return { ok: false, error: "Выберите целевой департамент." };
    if (!targetPositionId) {
      const created = buildInterDepartmentTarget(working, source, params, options);
      working = [...working, created];
      targetPositionId = created.positionId;
    } else {
      const target = working.find((item) => item.positionId === targetPositionId);
      if (!target) return { ok: false, error: "Целевая вакансия не найдена." };
      if (!isVacantForTransferAtMonth(target, month)) {
        return { ok: false, error: "Целевой слот недоступен в выбранный месяц." };
      }
    }
  }

  const pairId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const transferOrder = source.events.length + 1;

  const transferEvent: PlannedEvent = {
    id: crypto.randomUUID(),
    type: "TRANSFER",
    createdAt,
    createdOrder: transferOrder,
    payload: {
      month,
      transferToPositionId: targetPositionId,
      transferKind: params.transferKind,
      targetDepartment: params.targetDepartment,
      targetUnit: params.targetUnit,
      targetTeam: params.targetTeam,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      base: params.base,
      bonus: params.bonus,
      specialization: params.specialization,
      level: params.level,
      transferPairId: pairId,
    },
  };

  working = working.map((position) =>
    position.positionId === params.sourcePositionId ? upsertEvent(position, transferEvent) : position,
  );

  const target = working.find((item) => item.positionId === targetPositionId);
  if (!target) return { ok: false, error: "Целевая позиция потеряна при переводе." };

  const hireEvent: PlannedEvent = {
    id: crypto.randomUUID(),
    type: "PLANNED_HIRE",
    createdAt,
    createdOrder: target.events.length + 1,
    payload: {
      month,
      employeeName: params.employeeName,
      employeeId: params.employeeId,
      transferFromPositionId: params.sourcePositionId,
      base: params.base,
      bonus: params.bonus,
      specialization: params.specialization,
      level: params.level,
      transferPairId: pairId,
    },
  };

  working = working.map((position) =>
    position.positionId === targetPositionId ? upsertEvent(position, hireEvent) : position,
  );

  const sourceAfter = working.find((item) => item.positionId === params.sourcePositionId);
  const targetAfter = working.find((item) => item.positionId === targetPositionId);
  if (!sourceAfter || sourceAfter.status !== "Vacancy") {
    return { ok: false, error: "Исходная позиция не освободилась после перевода." };
  }
  if (!targetAfter || targetAfter.status !== "Occupied") {
    return { ok: false, error: "Целевая позиция не занята после перевода." };
  }

  return { ok: true, positions: working };
}

/** Удаление события с каскадом для связанных переводов. */
export function removePlanEvent(
  positions: PositionRecord[],
  positionId: string,
  eventId: string,
): PositionRecord[] {
  const event = findEventById(positions, positionId, eventId);
  if (!event) return positions;

  const pairId = event.payload.transferPairId;
  if (!pairId) {
    return positions.map((position) =>
      position.positionId === positionId ? removeEvent(position, eventId) : position,
    );
  }

  const linked = collectPairEventIds(positions, pairId);
  let next = positions;
  for (const hit of linked) {
    next = next.map((position) =>
      position.positionId === hit.positionId ? removeEvent(position, hit.eventId) : position,
    );
  }
  return next;
}

export function applyPlanTransferFromDrawerEvent(
  positions: PositionRecord[],
  sourcePositionId: string,
  event: PlannedEvent,
  options: PlanTransferOptions,
): { ok: true; positions: PositionRecord[] } | { ok: false; error: string } {
  if (event.type !== "TRANSFER") {
    return { ok: false, error: "Ожидалось событие TRANSFER." };
  }
  const payload = event.payload;
  return applyPlanTransfer(
    positions,
    {
      sourcePositionId,
      month: payload.month,
      transferKind: payload.transferKind ?? "INTRA_UNIT",
      transferToPositionId: payload.transferToPositionId,
      targetDepartment: payload.targetDepartment,
      targetUnit: payload.targetUnit,
      targetTeam: payload.targetTeam,
      employeeId: payload.employeeId ?? "",
      employeeName: payload.employeeName ?? "",
      base: payload.base ?? 0,
      bonus: payload.bonus ?? 0,
      specialization: payload.specialization ?? "",
      level: payload.level ?? "",
    },
    options,
  );
}
