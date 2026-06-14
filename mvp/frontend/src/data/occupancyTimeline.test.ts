import { describe, expect, it } from "vitest";
import { applyEvents, initialPositions } from "./planningData";
import { formatSlotOccupancyAtMonth } from "./occupancyTimeline";
import type { PositionRecord } from "../types";

describe("formatSlotOccupancyAtMonth", () => {
  it("показывает вакансию замещения при декрете", () => {
    const base = initialPositions().map(applyEvents);
    const occupied = base.find((position) => position.status === "Occupied" && position.employeeId);
    expect(occupied).toBeTruthy();

    const withMaternity: PositionRecord = {
      ...occupied!,
      events: [
        ...occupied!.events,
        {
          id: "mat-1",
          type: "MANUAL_OVERRIDE",
          createdAt: "2026-04-01T00:00:00.000Z",
          createdOrder: occupied!.events.length + 1,
          payload: {
            month: 3,
            base: 180_000,
            bonus: 0,
            maternityMode: "SHARED_POSITION",
            maternityPrimaryEmployeeId: occupied!.employeeId!,
            maternityPrimaryEmployeeName: occupied!.employeeName!,
            maternityReplacementKind: "VACANCY",
            employeeName: "Вакансия (замещение)",
          },
        },
      ],
    };

    const label = formatSlotOccupancyAtMonth(withMaternity, 5);
    expect(label).toContain("[декрет]");
    expect(label).toContain("Вакансия");
  });
});
