import { describe, expect, it } from "vitest";
import { buildTeamApprovalDiff, buildUnitApprovalDiff } from "./teamApprovalDiff";
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
