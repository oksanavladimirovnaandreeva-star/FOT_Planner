import { HelpCircle } from "lucide-react";

type MetricHelpProps = {
  title?: string;
  children: React.ReactNode;
};

function hintText(title: string | undefined, children: React.ReactNode): string {
  const body = typeof children === "string" ? children : "";
  if (title && body) return `${title}. ${body}`;
  return title ?? body;
}

/** Иконка «?» с подсказкой через общий HintTooltipLayer (data-hint). */
export function MetricHelp({ title, children }: MetricHelpProps) {
  const text = hintText(title, children);
  if (!text) return null;

  return (
    <span className="metric-help">
      <button
        type="button"
        className="metric-help__btn"
        aria-label={title ?? "Подсказка"}
        data-hint={text}
      >
        <HelpCircle size={13} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}
