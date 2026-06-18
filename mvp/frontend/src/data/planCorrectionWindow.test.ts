import { describe, expect, it } from "vitest";
import {
  correctionWindowStartMonth,
  isCorrectionMonthLocked,
  isPlanEventMonthAllowed,
  resolveCorrectionWindow,
} from "./planCorrectionWindow";
import type { PlanVersionMeta } from "./planVersions";

function meta(partial: Partial<PlanVersionMeta>): PlanVersionMeta {
  return {
    id: "v1",
    label: "v1",
    kind: "APPROVED",
    status: "DRAFT",
    versionNumber: 1,
    createdAt: "",
    ...partial,
  };
}

describe("correctionWindowStartMonth", () => {
  it("Q1 (февраль) → с января (0)", () => {
    expect(correctionWindowStartMonth(new Date(2026, 1, 1))).toBe(0);
  });

  it("Q2 (июнь) → с апреля (3)", () => {
    expect(correctionWindowStartMonth(new Date(2026, 5, 15))).toBe(3);
  });

  it("Q3 (август) → с июля (6)", () => {
    expect(correctionWindowStartMonth(new Date(2026, 7, 1))).toBe(6);
  });

  it("Q4 (ноябрь) → с октября (9)", () => {
    expect(correctionWindowStartMonth(new Date(2026, 10, 1))).toBe(9);
  });
});

describe("resolveCorrectionWindow", () => {
  it("v1 DRAFT на маршруте planning — без ограничения", () => {
    const w = resolveCorrectionWindow(meta({ status: "DRAFT" }), meta({ status: "DRAFT" }), {
      workspaceMode: "planning",
      refDate: new Date(2026, 5, 1),
    });
    expect(w.enforced).toBe(false);
    expect(isPlanEventMonthAllowed(0, w)).toBe(true);
  });

  it("квартальный черновик на planning — без ограничения (окно только в correction)", () => {
    const w = resolveCorrectionWindow(
      meta({ id: "draft", kind: "WORKING_DRAFT", status: "DRAFT", versionNumber: 2 }),
      meta({ status: "APPROVED" }),
      { workspaceMode: "planning", refDate: new Date(2026, 5, 1) },
    );
    expect(w.enforced).toBe(false);
    expect(isPlanEventMonthAllowed(5, w)).toBe(true);
  });

  it("квартальный черновик на correction в Q2 — с апреля, июнь открыт", () => {
    const w = resolveCorrectionWindow(
      meta({ id: "draft", kind: "WORKING_DRAFT", status: "DRAFT", versionNumber: 2 }),
      meta({ status: "APPROVED" }),
      { workspaceMode: "correction", refDate: new Date(2026, 5, 1) },
    );
    expect(w.enforced).toBe(true);
    expect(w.startMonth).toBe(3);
    expect(isPlanEventMonthAllowed(2, w)).toBe(false);
    expect(isPlanEventMonthAllowed(3, w)).toBe(true);
    expect(isPlanEventMonthAllowed(5, w)).toBe(true);
    expect(isCorrectionMonthLocked(2, w)).toBe(true);
    expect(isCorrectionMonthLocked(5, w)).toBe(false);
  });

  it("correction без черновика в Q2 — с апреля", () => {
    const w = resolveCorrectionWindow(
      meta({ id: "v1", kind: "APPROVED", status: "APPROVED", versionNumber: 1 }),
      meta({ status: "APPROVED" }),
      { workspaceMode: "correction", refDate: new Date(2026, 5, 1) },
    );
    expect(w.enforced).toBe(true);
    expect(w.startMonth).toBe(3);
    expect(isPlanEventMonthAllowed(2, w)).toBe(false);
    expect(isPlanEventMonthAllowed(5, w)).toBe(true);
  });
});
