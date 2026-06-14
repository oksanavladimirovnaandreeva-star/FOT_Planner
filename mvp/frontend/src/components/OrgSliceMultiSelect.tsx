import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Props = {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** stacked — подпись сверху; toolbar — компактная кнопка в панели срезов */
  layout?: "stacked" | "toolbar";
};

function selectionLabel(value: string[]): string {
  if (value.length === 0) return "Все";
  if (value.length === 1) return value[0];
  return `${value.length} выбрано`;
}

export function OrgSliceMultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  layout = "stacked",
}: Props) {
  const isToolbar = layout === "toolbar";
  const groupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const allSelected = value.length === 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleOption = (option: string) => {
    if (disabled) return;
    if (allSelected) {
      onChange([option]);
      return;
    }
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <label
      className={`org-slice-filter${disabled ? " org-slice-filter--disabled" : ""}${isToolbar ? " org-slice-filter--toolbar" : ""}`}
    >
      {!isToolbar ? <span className="org-slice-filter__label">{label}</span> : null}
      <div className="org-slice-filter__control" ref={rootRef}>
        <button
          type="button"
          className="org-slice-filter__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={isToolbar ? `${label}: ${selectionLabel(value)}` : undefined}
          aria-labelledby={isToolbar ? undefined : groupId}
          onClick={() => {
            if (!disabled) setOpen((current) => !current);
          }}
        >
          {isToolbar ? <span className="org-slice-filter__trigger-prefix">{label}</span> : null}
          <span className="org-slice-filter__value">{selectionLabel(value)}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="org-slice-filter__chevron" />
        </button>
        {open && !disabled ? (
          <div className="org-slice-filter__menu" role="listbox" aria-labelledby={groupId} id={groupId}>
            <button
              type="button"
              role="option"
              aria-selected={allSelected}
              className={`org-slice-filter__item${allSelected ? " org-slice-filter__item--selected" : ""}`}
              onClick={() => onChange([])}
            >
              <span className="org-slice-filter__check" aria-hidden>
                {allSelected ? <Check size={12} strokeWidth={2.5} /> : null}
              </span>
              Все
            </button>
            {options.map((option) => {
              const selected = !allSelected && value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`org-slice-filter__item${selected ? " org-slice-filter__item--selected" : ""}`}
                  onClick={() => toggleOption(option)}
                >
                  <span className="org-slice-filter__check" aria-hidden>
                    {selected ? <Check size={12} strokeWidth={2.5} /> : null}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </label>
  );
}
