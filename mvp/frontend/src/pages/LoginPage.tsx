import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import type { DemoPersonaId } from "../data/demoPersonas";
import { listLoginPersonaOptions, loginAsDemoPersona } from "../data/demoSessionStore";
import { landingRouteForRole } from "../data/roleLanding";
import { useMvpApp } from "../context/MvpAppContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshAppConfig } = useMvpApp();
  const options = useMemo(() => listLoginPersonaOptions(), []);
  const [personaId, setPersonaId] = useState<DemoPersonaId>(options[0]?.id ?? "cb");

  const handleEnter = (event: React.FormEvent) => {
    event.preventDefault();
    if (!personaId) return;
    const persona = loginAsDemoPersona(personaId);
    refreshAppConfig();
    navigate(landingRouteForRole(persona.role), { replace: true });
  };

  return (
    <div className="demo-login-page">
      <form className="demo-login-card" onSubmit={handleEnter}>
        <header className="demo-login-card__head">
          <div className="demo-login-card__logo" aria-hidden>
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <h1>ФОТ-планировщик</h1>
        </header>

        <label className="app-field demo-login-field">
          <span>Пользователь</span>
          <select
            className="demo-login-select"
            value={personaId}
            onChange={(event) => setPersonaId(event.target.value as DemoPersonaId)}
          >
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.optionLabel}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="app-btn app-btn--primary demo-login-submit">
          Войти
        </button>
      </form>
    </div>
  );
}
