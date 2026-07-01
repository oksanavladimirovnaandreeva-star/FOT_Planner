import { describe, expect, it } from "vitest";
import { applyEvents, annualTotal } from "./planningData";
import {
  buildTeamApprovalDiff,
  buildUnitApprovalDiff,
  computeLimitGrowthMetrics,
  shareOfAnnualBudget,
  shareOfTotalGrowth,
} from "./teamApprovalDiff";
import type { PositionRecord } from "../types";

function basePosition(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: "P001",
    role: "Dev",
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
    status: "Occupied",
    slotType: "regular",
    limitFlag: "in_limit",
    employeeId: "E001",
    employeeName: "Test",
    events: [],
    monthlyBase: Array(12).fill(100_000),
    monthlyBonus: Array(12).fill(0),
    monthlySpec: Array(12).fill("Engineering"),
    monthlyLevel: Array(12).fill("Middle"),
    seedMonthlyBase: Array(12).fill(100_000),
    seedMonthlyBonus: Array(12).fill(0),
    seedMonthlySpec: Array(12).fill("Engineering"),
    seedMonthlyLevel: Array(12).fill("Middle"),
    seedStatus: "Occupied",
    seedEmployeeId: "E001",
    ...overrides,
  };
}

describe("buildTeamApprovalDiff", () => {
  const baseline = [
    basePosition({
      events: [
        {
          id: "ev-old",
          type: "MANUAL_OVERRIDE",
          payload: { month: 3, base: 100_000 },
          createdAt: "2026-01-01",
          createdOrder: 1,
        },
      ],
    }),
  ];
  const draft = [
    basePosition({
      events: [
        ...baseline[0].events,
        {
          id: "ev-new",
          type: "TARGET_SALARY",
          payload: { month: 5, base: 120_000 },
          createdAt: "2026-06-01",
          createdOrder: 2,
        },
      ],
      monthlyBase: Array(12).fill(120_000),
    }),
  ];
  const scope = {
    department: "Engineering",
    unit: "ProductDev",
    team: "Frontend Web",
  };

  it("годовое: все события команды на год", () => {
    const { rows, summary } = buildTeamApprovalDiff({
      baselinePositions: [],
      draftPositions: draft,
      ...scope,
      mode: "annual",
    });

    expect(rows).toHaveLength(2);
    expect(summary.changeCount).toBe(2);
  });

  it("квартальное: только новые события vs утверждённый год", () => {
    const { rows, summary } = buildTeamApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draft,
      ...scope,
      mode: "quarterly",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].event.id).toBe("ev-new");
    expect(summary.changeCount).toBe(1);
    expect(summary.deltaFot).toBeGreaterThan(0);
    expect(summary.draftDecGrowthByLimit).toBeDefined();
  });

  it("считает ФОТ после applyEvents, не по сырым monthlyBase", () => {
    const monthly = 700_000;
    const staleDraft = basePosition({
      positionId: "P100",
      status: "Occupied",
      slotType: "new",
      limitFlag: "OVER_LIMIT",
      activeFromMonth: 3,
      monthlyBase: Array(12).fill(monthly),
      events: [
        {
          id: "hire",
          type: "PLANNED_HIRE",
          createdAt: "2026-01-01",
          createdOrder: 1,
          payload: {
            month: 3,
            base: monthly,
            bonus: 0,
            specialization: "Engineering",
            level: "Lead",
            employeeName: "Новый",
          },
        },
      ],
    });

    const { summary } = buildTeamApprovalDiff({
      baselinePositions: [],
      draftPositions: [staleDraft],
      ...scope,
      mode: "quarterly",
    });

    const appliedFot = annualTotal(applyEvents(staleDraft));
    expect(annualTotal(staleDraft)).toBe(monthly * 12);
    expect(summary.draftFot).toBe(appliedFot);
    expect(summary.draftFot).toBeLessThan(annualTotal(staleDraft));
  });

  it("исключение позиции тимлида из KPI совпадает с планированием", () => {
    const leadSlot = basePosition({
      positionId: "P-LEAD",
      employeeName: "Василий Андреев",
      employeeId: "PERSONA-vasya",
      monthlyBase: Array(12).fill(200_000),
      limitFlag: "IN_LIMIT",
    });
    const engineer = basePosition({
      positionId: "P-ENG",
      employeeName: "Инженер",
      monthlyBase: Array(12).fill(100_000),
    });
    const scope = {
      department: "Engineering",
      unit: "ProductDev",
      team: "Frontend Web",
    };
    const draft = [leadSlot, engineer];
    const withLead = buildTeamApprovalDiff({
      baselinePositions: draft,
      draftPositions: draft,
      ...scope,
      mode: "quarterly",
    });
    const withoutLead = buildTeamApprovalDiff({
      baselinePositions: [engineer],
      draftPositions: [engineer],
      ...scope,
      mode: "quarterly",
    });
    expect(withLead.summary.draftFot).toBe(annualTotal(applyEvents(leadSlot)) + annualTotal(applyEvents(engineer)));
    expect(withoutLead.summary.draftFot).toBe(annualTotal(applyEvents(engineer)));
    expect(withLead.summary.draftFot - withoutLead.summary.draftFot).toBe(
      annualTotal(applyEvents(leadSlot)),
    );
  });

  it("не включает команды вне среза", () => {
    const { rows } = buildTeamApprovalDiff({
      baselinePositions: [basePosition({ team: "Other" })],
      draftPositions: [
        basePosition({
          team: "Other",
          events: [
            {
              id: "ev-new",
              type: "TARGET_SALARY",
              payload: { month: 5, base: 120_000 },
              createdAt: "2026-06-01",
              createdOrder: 1,
            },
          ],
        }),
      ],
      ...scope,
      mode: "quarterly",
    });

    expect(rows).toHaveLength(0);
  });
});

describe("buildUnitApprovalDiff", () => {
  it("квартальное: дельта по юниту", () => {
    const baseline = [
      basePosition({ team: "Mobile", positionId: "P1" }),
      basePosition({ team: "Frontend Web", positionId: "P2" }),
    ];
    const draft = [
      basePosition({
        team: "Mobile",
        positionId: "P1",
        events: [
          {
            id: "ev-mobile",
            type: "TARGET_SALARY",
            payload: { month: 3, base: 120_000 },
            createdAt: "2026-06-01",
            createdOrder: 1,
          },
        ],
        monthlyBase: Array(12).fill(120_000),
      }),
      basePosition({ team: "Frontend Web", positionId: "P2" }),
    ];

    const { rows, summary } = buildUnitApprovalDiff({
      baselinePositions: baseline,
      draftPositions: draft,
      department: "Engineering",
      unit: "ProductDev",
      mode: "quarterly",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].team).toBe("Mobile");
    expect(summary.changeCount).toBe(1);
  });
});

describe("budget share helpers", () => {
  it("shareOfTotalGrowth — доля прироста в лимите и сверх", () => {
    expect(shareOfTotalGrowth(30, 100)).toBe(30);
    expect(shareOfTotalGrowth(70, 100)).toBe(70);
    expect(shareOfTotalGrowth(0, 0)).toBe(0);
  });

  it("shareOfAnnualBudget — доля годового ФОТ", () => {
    expect(shareOfAnnualBudget(6_680_000, 19_340_000)).toBeCloseTo(34.5, 1);
  });

  it("computeLimitGrowthMetrics — дек→дек 200→300, в лимите +30 из +100", () => {
    const total = computeLimitGrowthMetrics(100, 200, 100, 200);
    expect(total.relativePct).toBe(50);
    expect(total.contributionToTotalRelativePct).toBe(50);

    const inLimit = computeLimitGrowthMetrics(30, 140, 100, 200);
    expect(inLimit.relativePct).toBeCloseTo(21.4, 1);
    expect(inLimit.contributionToTotalRelativePct).toBe(15);

    const overLimit = computeLimitGrowthMetrics(70, 60, 100, 200);
    expect(overLimit.relativePct).toBeCloseTo(116.7, 1);
    expect(overLimit.contributionToTotalRelativePct).toBe(35);

    const newOnly = computeLimitGrowthMetrics(70, 0, 100, 200);
    expect(newOnly.relativePct).toBeNull();
    expect(newOnly.contributionToTotalRelativePct).toBe(35);
  });

  it("вклады по лимитам (п.п.) суммируются в общий % дек→дек", () => {
    const totalBaseline = 74_478_378;
    const totalGrowth = 19_111_135;
    const totalPct = ((totalGrowth / totalBaseline) * 100);
    expect(totalPct).toBeCloseTo(25.7, 0);

    const inLimitGrowth = 6_547_000;
    const overLimitGrowth = totalGrowth - inLimitGrowth;
    const inLimit = computeLimitGrowthMetrics(inLimitGrowth, 20_000_000, totalGrowth, totalBaseline);
    const overLimit = computeLimitGrowthMetrics(
      overLimitGrowth,
      54_478_378,
      totalGrowth,
      totalBaseline,
    );

    expect(inLimit.contributionToTotalRelativePct! + overLimit.contributionToTotalRelativePct!).toBeCloseTo(
      totalPct,
      0,
    );
  });
});

describe("formatLimitDecGrowthLine", () => {
  it("дек→дек: ₽ + % к прошлому дек. · вклад (п.п.)", async () => {
    const { formatLimitDecGrowthLine } = await import("./formatDisplay");
    expect(formatLimitDecGrowthLine(30, 140, 100, 200)).toBe("+30 ₽ (+21.4% · +15.0%)");
    expect(formatLimitDecGrowthLine(70, 60, 100, 200)).toBe("+70 ₽ (+116.7% · +35.0%)");
    expect(formatLimitDecGrowthLine(70, 0, 100, 200)).toBe("+70 ₽ (н/п · +35.0%)");
    expect(formatLimitDecGrowthLine(0, 0, 0, 0)).toBe("—");
  });
});
