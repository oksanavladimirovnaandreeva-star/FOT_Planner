import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MultiSelectMenu, multiSelectSummary, type MultiSelectOption } from "./MultiSelectMenu";

export type ToolbarMultiOption = MultiSelectOption;

type Props = {
  label: string;
  options: ToolbarMultiOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
};

export function ToolbarMultiSelect({ label, options, value, onChange, disabled }: Props) {
  const groupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  return (
    <div
      className={`org-slice-filter org-slice-filter--toolbar${disabled ? " org-slice-filter--disabled" : ""}`}
      ref={rootRef}
    >
      <div className="org-slice-filter__control">
        <button
          type="button"
          className="org-slice-filter__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: ${multiSelectSummary(value, options)}`}
          onClick={() => {
            if (!disabled) setOpen((current) => !current);
          }}
        >
          <span className="org-slice-filter__trigger-prefix">{label}</span>
          <span className="org-slice-filter__value">{multiSelectSummary(value, options)}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="org-slice-filter__chevron" />
        </button>
        {open && !disabled ? (
          <MultiSelectMenu options={options} value={value} onChange={onChange} menuId={groupId} />
        ) : null}
      </div>
    </div>
  );
}
