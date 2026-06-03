import { emptySlice, type EmployeeFactSlice, type FactPositionAssignment } from "./factStore";

export type FactImportSnapshot = {
  schemaVersion: 1;
  planYear?: number;
  importedAt?: string;
  employees: Record<string, EmployeeFactSlice>;
  monthly_fact_lines?: FactImportLine[];
};

export type FactImportLine = {
  employeeId: string;
  month: number;
  factBase: number;
  factBonus: number;
  tariffSalary?: number;
  positionId?: string;
};

export type FactImportPreview = {
  schema: "employees" | "lines" | "monthly_fact_lines";
  employeeCount: number;
  lineCount: number;
  assignmentCount: number;
  tariffSalaryLines: number;
  sampleLines: FactImportLine[];
};

type FactLine = {
  employeeId: string;
  month: number;
  article: "BASE" | "BONUS_PLAN";
  amount: number;
  positionId?: string;
  tariffSalary?: number;
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

function normalizePositionId(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function normalizeAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function ensureEmployeeSlice(store: Record<string, EmployeeFactSlice>, employeeId: string): EmployeeFactSlice {
  const slice = store[employeeId] ?? emptySlice();
  if (!slice.monthlyTariffSalary) {
    slice.monthlyTariffSalary = Array.from({ length: 12 }, () => 0);
  }
  store[employeeId] = slice;
  return slice;
}

function accumulateLine(
  store: Record<string, EmployeeFactSlice>,
  line: FactLine,
  assignments: FactPositionAssignment[],
): void {
  const slice = ensureEmployeeSlice(store, line.employeeId);
  if (line.article === "BASE") {
    slice.monthlyFactBase[line.month] = line.amount;
  } else {
    slice.monthlyFactBonus[line.month] = line.amount;
  }
  if (typeof line.tariffSalary === "number" && slice.monthlyTariffSalary) {
    slice.monthlyTariffSalary[line.month] = line.tariffSalary;
  }
  if (line.positionId) {
    assignments.push({
      positionId: line.positionId,
      employeeId: line.employeeId,
      month: line.month,
    });
  }
}

function parseFactLineRow(
  record: Record<string, unknown>,
  index: number,
  errors: string[],
): FactLine[] | null {
  const employeeId =
    normalizeEmployeeId(record.employeeId) ??
    normalizeEmployeeId(record.employee_id) ??
    normalizeEmployeeId(record.employeeExternalId);
  if (!employeeId) {
    errors.push(`Строка ${index + 1}: нет employeeId / employee_id.`);
    return null;
  }
  const month = monthIndexFromPayload(record.month);
  if (month === null) {
    errors.push(`Строка ${index + 1}: month должен быть 1–12 или 0–11.`);
    return null;
  }

  const positionId =
    normalizePositionId(record.positionId) ?? normalizePositionId(record.position_id) ?? undefined;

  const tariffRaw =
    record.tariffSalary ?? record.tariff_salary ?? record.tariffSalaryAmount;
  const tariffSalary = tariffRaw === undefined ? undefined : normalizeAmount(tariffRaw);
  if (tariffRaw !== undefined && tariffSalary === null) {
    errors.push(`Строка ${index + 1}: tariff_salary не число.`);
    return null;
  }

  const factBase = normalizeAmount(record.factBase ?? record.fact_base);
  const factBonus = normalizeAmount(record.factBonus ?? record.fact_bonus);
  const hasProductLine = factBase !== null || factBonus !== null;

  if (hasProductLine) {
    const lines: FactLine[] = [];
    if (factBase !== null) {
      lines.push({ employeeId, month, article: "BASE", amount: factBase, positionId, tariffSalary: tariffSalary ?? undefined });
    }
    if (factBonus !== null) {
      lines.push({
        employeeId,
        month,
        article: "BONUS_PLAN",
        amount: factBonus,
        positionId,
        tariffSalary: factBase === null ? tariffSalary ?? undefined : undefined,
      });
    }
    if (tariffSalary !== null && factBase === null && factBonus === null) {
      lines.push({ employeeId, month, article: "BASE", amount: 0, positionId, tariffSalary });
    }
    return lines;
  }

  const articleRaw = String(record.article ?? record.article_code ?? "BASE").toUpperCase();
  const article = articleRaw === "BONUS_PLAN" || articleRaw === "BONUS" ? "BONUS_PLAN" : "BASE";
  const amount = normalizeAmount(record.amount);
  if (amount === null) {
    errors.push(`Строка ${index + 1}: укажите fact_base/fact_bonus или amount.`);
    return null;
  }
  return [{ employeeId, month, article, amount, positionId, tariffSalary: tariffSalary ?? undefined }];
}

function parseLinesArray(lines: unknown[]): {
  employees: Record<string, EmployeeFactSlice>;
  assignments: FactPositionAssignment[];
  errors: string[];
  previewLines: FactImportLine[];
} {
  const employees: Record<string, EmployeeFactSlice> = {};
  const assignments: FactPositionAssignment[] = [];
  const errors: string[] = [];
  const previewLines: FactImportLine[] = [];

  lines.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Строка ${index + 1}: не объект.`);
      return;
    }
    const parsed = parseFactLineRow(row as Record<string, unknown>, index, errors);
    if (!parsed) return;
    for (const line of parsed) {
      accumulateLine(employees, line, assignments);
      if (previewLines.length < 8) {
        const slice = employees[line.employeeId];
        previewLines.push({
          employeeId: line.employeeId,
          month: line.month,
          positionId: line.positionId,
          factBase: slice.monthlyFactBase[line.month] ?? 0,
          factBonus: slice.monthlyFactBonus[line.month] ?? 0,
          tariffSalary: slice.monthlyTariffSalary?.[line.month] || undefined,
        });
      }
    }
  });

  return { employees, assignments: dedupeAssignments(assignments), errors, previewLines };
}

function dedupeAssignments(assignments: FactPositionAssignment[]): FactPositionAssignment[] {
  const seen = new Set<string>();
  const unique: FactPositionAssignment[] = [];
  for (const item of assignments) {
    const key = `${item.positionId}|${item.employeeId}|${item.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
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
    const tariff = Array.isArray(record.monthlyTariffSalary)
      ? record.monthlyTariffSalary.map(Number)
      : Array.isArray(record.monthly_tariff_salary)
        ? record.monthly_tariff_salary.map(Number)
        : null;
    if (!base || base.length !== 12 || base.some((item) => !Number.isFinite(item))) {
      errors.push(`Сотрудник ${key}: monthlyFactBase — 12 чисел.`);
      continue;
    }
    if (!bonus || bonus.length !== 12 || bonus.some((item) => !Number.isFinite(item))) {
      errors.push(`Сотрудник ${key}: monthlyFactBonus — 12 чисел.`);
      continue;
    }
    employees[key] = {
      monthlyFactBase: base,
      monthlyFactBonus: bonus,
      monthlyTariffSalary:
        tariff && tariff.length === 12 && !tariff.some((item) => !Number.isFinite(item))
          ? tariff
          : undefined,
    };
  }
  return { employees, errors };
}

function buildPreview(
  schema: FactImportPreview["schema"],
  employees: Record<string, EmployeeFactSlice>,
  lineCount: number,
  assignments: FactPositionAssignment[],
  sampleLines: FactImportLine[],
): FactImportPreview {
  let tariffSalaryLines = 0;
  for (const slice of Object.values(employees)) {
    if (!slice.monthlyTariffSalary) continue;
    tariffSalaryLines += slice.monthlyTariffSalary.filter((value) => value > 0).length;
  }
  return {
    schema,
    employeeCount: Object.keys(employees).length,
    lineCount,
    assignmentCount: assignments.length,
    tariffSalaryLines,
    sampleLines,
  };
}

export function inspectFactImport(
  payload: unknown,
): { ok: true; preview: FactImportPreview } | { ok: false; errors: string[] } {
  const parsed = parseFactPayload(payload);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    preview: parsed.preview,
  };
}

export function parseFactPayload(
  payload: unknown,
):
  | {
      ok: true;
      employees: Record<string, EmployeeFactSlice>;
      assignments: FactPositionAssignment[];
      lineCount: number;
      preview: FactImportPreview;
    }
  | { ok: false; errors: string[] } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Корневой JSON должен быть объектом."] };
  }
  const draft = payload as Record<string, unknown>;

  const linesSource = Array.isArray(draft.monthly_fact_lines)
    ? draft.monthly_fact_lines
    : Array.isArray(draft.lines)
      ? draft.lines
      : null;

  if (linesSource) {
    const schema: FactImportPreview["schema"] = Array.isArray(draft.monthly_fact_lines)
      ? "monthly_fact_lines"
      : "lines";
    const { employees, assignments, errors, previewLines } = parseLinesArray(linesSource);
    if (errors.length > 0) return { ok: false, errors };
    if (Object.keys(employees).length === 0) {
      return { ok: false, errors: ["Нет валидных строк факта."] };
    }
    const preview = buildPreview(schema, employees, linesSource.length, assignments, previewLines);
    return { ok: true, employees, assignments, lineCount: linesSource.length, preview };
  }

  if (draft.employees && typeof draft.employees === "object") {
    const { employees, errors } = parseEmployeesMap(draft.employees);
    if (errors.length > 0) return { ok: false, errors };
    if (Object.keys(employees).length === 0) {
      return { ok: false, errors: ["employees пуст."] };
    }
    const preview = buildPreview("employees", employees, 0, [], []);
    return { ok: true, employees, assignments: [], lineCount: 0, preview };
  }

  return {
    ok: false,
    errors: [
      "Ожидается employees, monthly_fact_lines или lines с полями employee_id, position_id, month, fact_base, fact_bonus, tariff_salary.",
    ],
  };
}
