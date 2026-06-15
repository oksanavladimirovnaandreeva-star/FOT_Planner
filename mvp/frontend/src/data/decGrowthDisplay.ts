import { decToDec } from "./planningData";
import type { PositionRecord } from "../types";

export type DecGrowthDisplay = {
  prevYear: number;
  planYear: number;
  prevBase: number;
  planDecBase: number;
  delta: number;
  pct: number | null;
  label: "growth" | "new_position" | "no_plan_dec" | "unchanged";
};

export function resolveDecGrowthDisplay(position: PositionRecord, planYear: number): DecGrowthDisplay {
  const prevBase = position.previousDecemberBase;
  const planDecBase = position.monthlyBase[11] ?? 0;
  const delta = planDecBase - prevBase;
  const prevYear = planYear - 1;

  if (position.slotType === "new" && prevBase === 0 && planDecBase > 0) {
    return {
      prevYear,
      planYear,
      prevBase,
      planDecBase,
      delta,
      pct: null,
      label: "new_position",
    };
  }
  if (prevBase === 0 && planDecBase === 0) {
    return { prevYear, planYear, prevBase, planDecBase, delta: 0, pct: 0, label: "no_plan_dec" };
  }
  if (prevBase > 0 && prevBase === planDecBase) {
    return { prevYear, planYear, prevBase, planDecBase, delta: 0, pct: 0, label: "unchanged" };
  }
  return {
    prevYear,
    planYear,
    prevBase,
    planDecBase,
    delta,
    pct: prevBase > 0 ? decToDec(prevBase, planDecBase) : null,
    label: "growth",
  };
}

export function formatDecGrowthPctLine(display: DecGrowthDisplay): string {
  if (display.label === "new_position") return "н/п · новая позиция";
  if (display.pct === null) return "—";
  if (display.pct > 0) return `+${display.pct.toFixed(1)}%`;
  return `${display.pct.toFixed(1)}%`;
}
