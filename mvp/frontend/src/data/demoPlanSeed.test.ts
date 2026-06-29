import { describe, expect, it } from "vitest";
import {
  buildDecemberRosterSnapshot,
  buildDemoPositions,
  DEFAULT_DEMO_POSITION_COUNT,
  DEMO_MASS_INDEXATION_BATCH_ID,
  DEMO_SEED_VERSION,
  PILOT_POSITION_TARGET,
} from "./demoPlanSeed";
import { ORG_STRUCTURE } from "./orgStructure";
import { applyEvents } from "./planningData";

describe("demoPlanSeed", () => {
  it("генерирует компактный демо-план по умолчанию", () => {
    const positions = buildDemoPositions();
    expect(positions.length).toBeGreaterThanOrEqual(DEFAULT_DEMO_POSITION_COUNT);
    expect(positions.length).toBeLessThan(PILOT_POSITION_TARGET);
    expect(DEMO_SEED_VERSION).toBe(13);

    const carryover = positions.filter((position) => position.slotType === "carryover");
    expect(carryover.every((position) => position.events.some((event) => event.type === "POSITION_CARRYOVER"))).toBe(
      true,
    );
    const active = positions.filter((position) => position.status !== "Closed");
    expect(
      active.every((position) =>
        position.events.some(
          (event) =>
            event.type === "INDEXATION" &&
            event.payload.indexationBatchId === DEMO_MASS_INDEXATION_BATCH_ID,
        ),
      ),
    ).toBe(true);
  });

  it("генерирует пилотный объём по всей оргструктуре", () => {
    const positions = buildDemoPositions(PILOT_POSITION_TARGET);
    expect(positions.length).toBeGreaterThanOrEqual(PILOT_POSITION_TARGET);

    for (const [department, units] of Object.entries(ORG_STRUCTURE)) {
      for (const [unit, teams] of Object.entries(units)) {
        for (const team of teams) {
          const inTeam = positions.filter(
            (position) => position.department === department && position.unit === unit && position.team === team,
          );
          expect(inTeam.length).toBeGreaterThanOrEqual(3);
        }
      }
    }

    const carryover = positions.filter((position) => position.slotType === "carryover");
    expect(carryover.every((position) => position.events.some((event) => event.type === "POSITION_CARRYOVER"))).toBe(
      true,
    );
    expect(positions.some((position) => position.events.some((event) => event.type === "INDEXATION"))).toBe(true);
  });

  it("массовая индексация +5% с февраля на активные позиции", () => {
    const applied = buildDemoPositions(40).map(applyEvents);
    const stable = applied.find(
      (position) =>
        position.status === "Occupied" &&
        position.activeFromMonth === 0 &&
        !position.events.some((event) => ["CLOSE_POSITION", "MANUAL_OVERRIDE"].includes(event.type)),
    );
    expect(stable).toBeTruthy();
    expect(stable!.monthlyBase[0]).toBe(stable!.seedMonthlyBase[0]);
    expect(stable!.monthlyBase[1]).toBe(Math.round(stable!.seedMonthlyBase[1] * 1.05));
    expect(stable!.monthlyBase[11]).toBe(Math.round(stable!.seedMonthlyBase[11] * 1.05));
  });

  it("декабрьский срез отражает seed-состояние до событий года", () => {
    const positions = buildDemoPositions(40);
    const roster = buildDecemberRosterSnapshot(positions);
    expect(roster).toHaveLength(40);
    const occupied = roster.filter((row) => row.status === "Occupied");
    expect(occupied.every((row) => row.employeeId && row.decemberBase > 0)).toBe(true);
    const stable = positions.find(
      (position) =>
        position.seedStatus === "Occupied" &&
        !position.events.some((event) => event.type === "CLOSE_POSITION"),
    );
    expect(stable).toBeTruthy();
    const applied = applyEvents(stable!);
    expect(applied.status).toBe(stable!.seedStatus);
  });
});
