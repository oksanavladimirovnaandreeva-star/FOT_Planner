import { describe, expect, it } from "vitest";
import { inspectFactImport, parseFactPayload } from "./factImport";

describe("monthly_fact_lines schema", () => {
  const payload = {
    schemaVersion: 1,
    monthly_fact_lines: [
      {
        employee_id: "E001",
        position_id: "P001",
        month: 3,
        fact_base: 100_000,
        fact_bonus: 10_000,
        tariff_salary: 95_000,
      },
      {
        employee_id: "E002",
        position_id: "P002",
        month: 4,
        fact_base: 80_000,
        fact_bonus: 0,
        tariff_salary: 78_000,
      },
    ],
  };

  it("parseFactPayload собирает сотрудников и посадки", () => {
    const parsed = parseFactPayload(payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lineCount).toBe(2);
    expect(parsed.employees.E001.monthlyFactBase[2]).toBe(100_000);
    expect(parsed.employees.E001.monthlyFactBonus[2]).toBe(10_000);
    expect(parsed.employees.E001.monthlyTariffSalary?.[2]).toBe(95_000);
    expect(parsed.assignments).toHaveLength(2);
  });

  it("inspectFactImport отдаёт превью tariff_salary", () => {
    const inspected = inspectFactImport(payload);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.preview.schema).toBe("monthly_fact_lines");
    expect(inspected.preview.tariffSalaryLines).toBe(2);
    expect(inspected.preview.sampleLines[0]?.tariffSalary).toBe(95_000);
  });
});
