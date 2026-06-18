/** Маркер «ничего не выбрано» в мультиселекте (пустой список = «все выбраны»). */
export const MULTI_SELECT_NONE = "__none__";

export function isMultiSelectNone(value: string[]): boolean {
  return value.includes(MULTI_SELECT_NONE);
}

export function isMultiSelectAll(value: string[], optionValues: string[]): boolean {
  if (isMultiSelectNone(value)) return false;
  return value.length === 0 || value.length === optionValues.length;
}

export function multiSelectMatches(value: string[], itemValue: string): boolean {
  if (isMultiSelectNone(value)) return false;
  if (value.length === 0) return true;
  return value.includes(itemValue);
}
