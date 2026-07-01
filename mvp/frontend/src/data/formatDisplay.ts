/** Форматирование сумм и дат для UI (без React). */

import { computeLimitGrowthMetrics } from "./teamApprovalDiff";
import { formatGrowthPct } from "./planningData";

function formatRelativePct(pct: number | null): string {
  if (pct === null) return "н/п";
  return formatGrowthPct(pct);
}

function formatTwoPctLine(
  amount: string,
  relativePct: number | null,
  contributionPct: number | null,
): string {
  const contribution = contributionPct !== null ? formatGrowthPct(contributionPct) : null;
  if (relativePct === null) {
    if (contribution) return `${amount} (н/п · ${contribution})`;
    return `${amount} (н/п)`;
  }
  const rel = formatRelativePct(relativePct);
  if (!contribution || Math.abs(relativePct - contributionPct!) < 0.05) {
    return `${amount} (${rel})`;
  }
  return `${amount} (${rel} · ${contribution})`;
}

/** Дек→дек по лимиту: ₽ + % к прошлому декабрю блока · вклад в общий % дек→дек. */
export function formatLimitDecGrowthLine(
  growth: number,
  prevDec: number,
  totalDecGrowth: number,
  totalPrevDec: number,
  compact = false,
): string {
  if (growth === 0 && prevDec === 0 && totalDecGrowth === 0) return "—";
  const metrics = computeLimitGrowthMetrics(growth, prevDec, totalDecGrowth, totalPrevDec);
  return formatTwoPctLine(
    formatSignedMoneyDelta(growth, compact),
    metrics.relativePct,
    metrics.contributionToTotalRelativePct,
  );
}

/** Δ годового ФОТ по лимиту: ₽ + % к утверждённому году блока · вклад в общий % Δ. */
export function formatLimitDeltaLine(
  delta: number,
  baseline: number,
  totalDelta: number,
  totalBaseline: number,
  compact = false,
): string {
  if (delta === 0 && baseline === 0 && totalDelta === 0) return "—";
  const metrics = computeLimitGrowthMetrics(delta, baseline, totalDelta, totalBaseline);
  return formatTwoPctLine(
    formatSignedMoneyDelta(delta, compact),
    metrics.relativePct,
    metrics.contributionToTotalRelativePct,
  );
}

export function formatMoney(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} млн ₽`;
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

/** Сумма с разделителями тысяч, без символа валюты (таблицы с подписью в заголовке). */
export function formatMoneyPlain(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

/** Компактные суммы для матрицы месяцев. */
export function formatMoneyShort(value: number): string {
  if (value === 0) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function formatSignedMoneyDelta(value: number, compact = false): string {
  if (value === 0) return formatMoney(0, compact);
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), compact)}`;
}

export function formatIsoDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
