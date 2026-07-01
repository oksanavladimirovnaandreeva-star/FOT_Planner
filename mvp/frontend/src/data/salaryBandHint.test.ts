import { describe, expect, it } from "vitest";
import {
  buildSalaryBandHint,
  salaryBandCrTone,
  salaryBandMarkerPct,
} from "./salaryBandHint";
import { initialSalaryBands } from "./salaryRangeData";

const bands = initialSalaryBands();

describe("salaryBandHint", () => {
  it("оклад на мидпоинте — CR ≈ 1 и маркер по центру", () => {
    const band = bands.find((row) => row.specialization === "Engineering" && row.level === "Middle")!;
    const hint = buildSalaryBandHint({
      specialization: "Engineering",
      level: "Middle",
      baseSalary: band.midpoint,
      bands,
      canView: true,
    });
    expect(hint.visible).toBe(true);
    expect(hint.inCatalog).toBe(true);
    expect(hint.cr).toBeCloseTo(1, 2);
    expect(hint.crTone).toBe("ok");
    expect(hint.markerPct).toBeCloseTo(50, 0);
    expect(hint.belowMin).toBe(false);
    expect(hint.aboveMax).toBe(false);
  });

  it("оклад ниже min — belowMin", () => {
    const band = bands.find((row) => row.specialization === "Engineering" && row.level === "Middle")!;
    const hint = buildSalaryBandHint({
      specialization: "Engineering",
      level: "Middle",
      baseSalary: band.minSalary - 1,
      bands,
      canView: true,
    });
    expect(hint.belowMin).toBe(true);
    expect(hint.markerPct).toBe(0);
    expect(salaryBandCrTone(hint.cr!)).toBe("warn");
  });

  it("нет пары в справочнике — подпись и скрытый блок", () => {
    const hint = buildSalaryBandHint({
      specialization: "Marketing",
      level: "Intern",
      baseSalary: 100_000,
      bands,
      canView: true,
    });
    expect(hint.visible).toBe(false);
    expect(hint.inCatalog).toBe(false);
    expect(hint.message).toBe("Нет в справочнике");
  });

  it("canView false — диапазон недоступен", () => {
    const hint = buildSalaryBandHint({
      specialization: "Engineering",
      level: "Middle",
      baseSalary: 150_000,
      bands,
      canView: false,
    });
    expect(hint.visible).toBe(false);
    expect(hint.message).toBe("Диапазон недоступен для вашей роли");
  });

  it("пустой оклад — CR скрыт, маркер на середине шкалы", () => {
    const hint = buildSalaryBandHint({
      specialization: "Engineering",
      level: "Middle",
      baseSalary: "",
      bands,
      canView: true,
    });
    expect(hint.visible).toBe(true);
    expect(hint.cr).toBeNull();
    expect(hint.markerPct).toBe(50);
    expect(hint.belowMin).toBe(false);
  });

  it("salaryBandMarkerPct на границах", () => {
    expect(salaryBandMarkerPct(100, 100, 200).markerPct).toBe(0);
    expect(salaryBandMarkerPct(200, 100, 200).markerPct).toBe(100);
    expect(salaryBandMarkerPct(50, 100, 200).belowMin).toBe(true);
    expect(salaryBandMarkerPct(250, 100, 200).aboveMax).toBe(true);
  });
});
