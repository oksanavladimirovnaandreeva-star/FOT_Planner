import type { ReactNode } from "react";
import { Search } from "lucide-react";

type Props = {
  children: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  sticky?: boolean;
  footer?: ReactNode;
  className?: string;
};

export function SliceToolbar({
  children,
  search,
  onSearchChange,
  searchPlaceholder = "Поиск…",
  sticky = false,
  footer,
  className = "",
}: Props) {
  const showSearch = onSearchChange != null;

  return (
    <section
      className={`slice-toolbar${sticky ? " slice-toolbar--sticky" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Срезы и фильтры"
    >
      <div className="slice-toolbar__row">
        <div className="slice-toolbar__filters">{children}</div>
        {showSearch ? (
          <label className="slice-toolbar__search search-field">
            <Search size={14} aria-hidden />
            <input
              value={search ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        ) : null}
      </div>
      {footer ? <div className="slice-toolbar__footer">{footer}</div> : null}
    </section>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

export function SliceToolbarSelect({ label, value, onChange, children }: SelectProps) {
  return (
    <label className="slice-toolbar__select">
      <span className="slice-toolbar__select-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {children}
      </select>
    </label>
  );
}
