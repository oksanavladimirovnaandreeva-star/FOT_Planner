import { emptySlice, type EmployeeFactSlice, type FactPositionAssignment } from "./factStore";

export type FactImportSnapshot = {
  schemaVersion: 1;
  planYear?: number;
  importedAt?: string;
  employees: Record<string, EmployeeFactSlice>;
};

type FactLine = {
  employeeId: string;
  month: number;
  article: "BASE" | "BONUS_PLAN";
  amount: number;
  positionId?: string;
};

function normalizeEmployeeId(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function monthIndexFromPayload(value: unknown): number | null {
  const month = Number(value);
  if (!Number.isFinite(month)) return null;
  if (month >= 1 && month <= 12) return month - 1;
  if (month >= 0 && month <= 11) return month;
  return null;
}

function accumulateLine(
  store: Record<string, EmployeeFactSlice>,
  line: FactLine,
  assignments: FactPositionAssignment[],
): void {
  const slice = store[line.employeeId] ?? emptySlice();
  if (line.article === "BASE") {
    slice.monthlyFactBase[line.month] = line.amount;
  } else {
    slice.monthlyFactBonus[line.month] = line.amount;
  }
  store[line.employeeId] = slice;
  if (line.positionId) {
    assignments.push({
      positionId: line.positionId,
      employeeId: line.employeeId,
      month: line.month,
    });
  }
}

function normalizePositionId(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function parseLinesArray(lines: unknown[]): {
  employees: Record<string, EmployeeFactSlice>;
  assignments: FactPositionAssignment[];
  errors: string[];
} {
  const employees: Record<string, EmployeeFactSlice> = {};
  const assignments: FactPositionAssignment[] = [];
  const errors: string[] = [];
  lines.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Строка ${index + 1}: не объект.`);
      return;
    }
    const record = row as Record<string, unknown>;
    const employeeId =
      normalizeEmployeeId(record.employeeId) ??
      normalizeEmployeeId(record.employee_id) ??
      normalizeEmployeeId(record.employeeExternalId);
    if (!employeeId) {
      errors.push(`Строка ${index + 1}: нет employeeId / employee_id.`);
      return;
    }
    const month = monthIndexFromPayload(record.month);
    if (month === null) {
      errors.push(`Строка ${index + 1}: month должен быть 1–12 или 0–11.`);
      return;
    }
    const articleRaw = String(record.article ?? record.article_code ?? "BASE").toUpperCase();
    const article = articleRaw === "BONUS_PLAN" || articleRaw === "BONUS" ? "BONUS_PLAN" : "BASE";
    const amount = Number(record.amount);
    if (!Number.isFinite(amount)) {
      errors.push(`Строка ${index + 1}: amount не число.`);
      return;
    }
    const positionId =
      normalizePositionId(record.positionId) ??
      normalizePositionId(record.position_id) ??
      undefined;
    accumulateLine(employees, { employeeId, month, article, amount, positionId }, assignments);
  });
  return { employees, assignments, errors };
}

function parseEmployeesMap(map: unknown): { employees: Record<string, EmployeeFactSlice>; errors: string[] } {
  const errors: string[] = [];
  if (!map || typeof map !== "object") {
    return { employees: {}, errors: ["Поле employees должно быть объектом."] };
  }
  const employees: Record<string, EmployeeFactSlice> = {};
  for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      errors.push(`Сотрудник ${key}: некорректная запись.`);
      continue;
    }
    const record = value as Record<string, unknown>;
    const base = Array.isArray(record.monthlyFactBase) ? record.monthlyFactBase.map(Number) : null;
    const bonus = Array.isArray(record.monthlyFactBonus) ? record.monthlyFactBonus.map(Number) : null;
    if (!base || base.length !== 12 || base.some((item) => !Number.isFinite(item))) {
      errors.push(`Сотрудник ${key}: monthlyFactBase — 12 чисел.`);
      continue;
    }
    if (!bonus || bonus.length !== 12 || bonus.some((item) => !Number.isFinite(item))) {
      errors.push(`Сотрудник ${key}: monthlyFactBonus — 12 чисел.`);
      continue;
    }
    employees[key] = { monthlyFactBase: base, monthlyFactBonus: bonus };
  }
  return { employees, errors };
}

export function inspectFactImport(
  payload: unknown,
): { ok: true; preview: { employeeCount: number; lineCount?: number } } | { ok: false; errors: string[] } {
  const parsed = parseFactPayload(payload);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    preview: {
      employeeCount: Object.keys(parsed.employees).length,
      lineCount: parsed.lineCount,
    },
  };
}

export function parseFactPayload(
  payload: unknown,
):
  | { ok: true; employees: Record<string, EmployeeFactSlice>; assignments: FactPositionAssignment[]; lineCount?: number }
  | { ok: false; errors: string[] } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Корневой JSON должен быть объектом."] };
  }
  const draft = payload as Record<string, unknown>;
  if (Array.isArray(draft.lines)) {
    const { employees, assignments, errors } = parseLinesArray(draft.lines);
    if (errors.length > 0) return { ok: false, errors };
    if (Object.keys(employees).length === 0) {
      return { ok: false, errors: ["Нет валидных строк факта."] };
    }
    return { ok: true, employees, assignments, lineCount: draft.lines.length };
  }
  if (draft.employees && typeof draft.employees === "object") {
    const { employees, errors } = parseEmployeesMap(draft.employees);
    if (errors.length > 0) return { ok: false, errors };
    if (Object.keys(employees).length === 0) {
      return { ok: false, errors: ["employees пуст."] };
    }
    return { ok: true, employees, assignments: [] };
  }
  return {
    ok: false,
    errors: [
      "Ожидается employees { E001: { monthlyFactBase[], monthlyFactBonus[] } } или массив lines (опционально position_id / positionId).",
    ],
  };
}
