/** Форматирование сумм и дат для UI (без React). */

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
