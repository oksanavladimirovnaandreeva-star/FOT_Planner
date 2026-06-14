import { HelpCircle } from "lucide-react";

type MetricHelpProps = {
  title?: string;
  children: React.ReactNode;
};

export function MetricHelp({ title, children }: MetricHelpProps) {
  return (
    <span className="metric-help">
      <button type="button" className="metric-help__btn" aria-label={title ?? "Подсказка"} tabIndex={0}>
        <HelpCircle size={13} strokeWidth={2} aria-hidden />
      </button>
      <span className="metric-help__popover" role="tooltip">
        {title ? <strong>{title}</strong> : null}
        {children}
      </span>
    </span>
  );
}
