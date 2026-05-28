import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="collapsible">
      <button type="button" className="collapsible__trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ChevronDown size={16} className={`collapsible__chevron${open ? " collapsible__chevron--open" : ""}`} />
        <span className="collapsible__title">{title}</span>
        {summary && <span className="collapsible__summary">{summary}</span>}
        {!open && summary && <span className="collapsible__hint">Нажмите, чтобы раскрыть</span>}
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </section>
  );
}
