import { describe, expect, it } from "vitest";
import { classifyMonthVarianceDriver } from "./planFactVarianceDrivers";

describe("planFactVarianceDrivers", () => {
  it("вакансия без факта — VACANCY_UNFILLED (экономия)", () => {
    expect(
      classifyMonthVarianceDriver({
        planVacant: true,
        planAmount: 100_000,
        factAmount: 0,
        factEmployeeCount: 0,
      }),
    ).toBe("VACANCY_UNFILLED");
  });

  it("вакансия с фактом — UNPLANNED_HIRE (перерасход)", () => {
    expect(
      classifyMonthVarianceDriver({
        planVacant: true,
        planAmount: 100_000,
        factAmount: 120_000,
        factEmployeeCount: 1,
      }),
    ).toBe("UNPLANNED_HIRE");
  });

  it("занято, факт дешевле — HIRED_CHEAPER", () => {
    expect(
      classifyMonthVarianceDriver({
        planVacant: false,
        planAmount: 100_000,
        factAmount: 80_000,
        factEmployeeCount: 1,
      }),
    ).toBe("HIRED_CHEAPER");
  });

  it("занято, факт дороже — HIRED_MORE_EXPENSIVE", () => {
    expect(
      classifyMonthVarianceDriver({
        planVacant: false,
        planAmount: 100_000,
        factAmount: 130_000,
        factEmployeeCount: 1,
      }),
    ).toBe("HIRED_MORE_EXPENSIVE");
  });

  it("двое на позиции — MULTI_ON_SEAT", () => {
    expect(
      classifyMonthVarianceDriver({
        planVacant: false,
        planAmount: 100_000,
        factAmount: 200_000,
        factEmployeeCount: 2,
      }),
    ).toBe("MULTI_ON_SEAT");
  });
});
