import { useState } from "react";
import { Link } from "react-router-dom";

type WorkflowHintProps = {
  hintId: string;
  children: React.ReactNode;
  linkTo?: string;
  linkLabel?: string;
};

export function WorkflowHint({ hintId, children, linkTo, linkLabel }: WorkflowHintProps) {
  const storageKey = `mvp.hint.${hintId}`;
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "1";
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  return (
    <aside className="workflow-hint" role="note">
      <p className="workflow-hint__text">{children}</p>
      <div className="workflow-hint__actions">
        {linkTo && linkLabel ? (
          <Link to={linkTo} className="workflow-hint__link">
            {linkLabel}
          </Link>
        ) : null}
        <button
          type="button"
          className="app-btn app-btn--ghost app-btn--sm"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Понятно
        </button>
      </div>
    </aside>
  );
}
