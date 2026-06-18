import { Link } from "react-router-dom";
import { useMvpApp } from "../context/MvpAppContext";
import { loadResolvedDemoPersona } from "../data/demoSessionStore";
import { formatPersonaOrgBinding } from "../data/personaAccessScope";
import { USER_ROLE_LABELS } from "../data/userAccess";

export function DemoUserCard() {
  const { demoPersonaLabel, userRole, appConfigRevision } = useMvpApp();
  const persona = loadResolvedDemoPersona();
  void appConfigRevision;
  const orgLabel = persona?.scope ? formatPersonaOrgBinding(persona.scope) : null;

  return (
    <div className="demo-user-card">
      <span className="demo-user-card__label">Вы вошли как</span>
      <strong className="demo-user-card__name">{demoPersonaLabel ?? USER_ROLE_LABELS[userRole]}</strong>
      {orgLabel ? <span className="demo-user-card__scope muted-line">{orgLabel}</span> : null}
      <Link to="/login" className="demo-user-card__switch app-btn app-btn--ghost app-btn--sm">
        Сменить пользователя
      </Link>
    </div>
  );
}
