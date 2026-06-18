import { Check } from "lucide-react";
import {
  isMultiSelectAll,
  isMultiSelectNone,
  MULTI_SELECT_NONE,
} from "../data/multiSelectFilter";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  menuId: string;
  selectAllLabel?: string;
};

function allValues(options: MultiSelectOption[]): string[] {
  return options.map((option) => option.value);
}

function isOptionChecked(optionValue: string, value: string[]): boolean {
  if (isMultiSelectNone(value)) return false;
  if (value.length === 0) return true;
  return value.includes(optionValue);
}

function withoutNone(value: string[]): string[] {
  return value.filter((item) => item !== MULTI_SELECT_NONE);
}

export function MultiSelectMenu({
  options,
  value,
  onChange,
  menuId,
  selectAllLabel = "Выбрать все",
}: Props) {
  const optionValues = allValues(options);
  const allChecked = isMultiSelectAll(value, optionValues);

  const selectAll = () => {
    if (allChecked) {
      onChange([MULTI_SELECT_NONE]);
      return;
    }
    onChange([]);
  };

  const toggleOption = (optionValue: string) => {
    const current = withoutNone(value);
    if (current.length === 0) {
      onChange(optionValues.filter((item) => item !== optionValue));
      return;
    }
    if (current.includes(optionValue)) {
      const next = current.filter((item) => item !== optionValue);
      onChange(next.length === 0 ? [MULTI_SELECT_NONE] : next);
      return;
    }
    const next = [...current, optionValue];
    if (next.length === options.length) {
      onChange([]);
      return;
    }
    onChange(next);
  };

  return (
    <div className="org-slice-filter__menu" role="listbox" aria-labelledby={menuId} id={menuId}>
      <button
        type="button"
        role="option"
        aria-selected={allChecked}
        className={`org-slice-filter__item org-slice-filter__item--select-all${allChecked ? " org-slice-filter__item--selected" : ""}`}
        onClick={selectAll}
      >
        <span
          className={`org-slice-filter__box${allChecked ? " org-slice-filter__box--checked" : ""}`}
          aria-hidden
        >
          {allChecked ? <Check size={10} strokeWidth={3} /> : null}
        </span>
        {selectAllLabel}
      </button>
      <div className="org-slice-filter__menu-divider" aria-hidden />
      {options.map((option) => {
        const checked = isOptionChecked(option.value, value);
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={checked}
            className={`org-slice-filter__item${checked ? " org-slice-filter__item--selected" : ""}`}
            onClick={() => toggleOption(option.value)}
          >
            <span
              className={`org-slice-filter__box${checked ? " org-slice-filter__box--checked" : ""}`}
              aria-hidden
            >
              {checked ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function multiSelectSummary(value: string[], options: MultiSelectOption[]): string {
  if (isMultiSelectNone(value)) return "Ничего";
  const optionValues = options.map((option) => option.value);
  if (isMultiSelectAll(value, optionValues)) return "Все";
  const selected = withoutNone(value);
  if (selected.length === 1) {
    return options.find((option) => option.value === selected[0])?.label ?? selected[0];
  }
  return `${selected.length} выбрано`;
}
