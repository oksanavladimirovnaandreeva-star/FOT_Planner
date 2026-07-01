import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";
import type { DemoPersonaId } from "../data/demoPersonas";
import {
  buildLoginOrgTree,
  loginPathForPersona,
  type LoginPersonaLeaf,
} from "../data/loginOrgTree";
import { readOrgTree } from "../data/orgStructureStore";
import { loadDemoPersonaId, loginAsDemoPersona } from "../data/demoSessionStore";
import { landingRouteForRole } from "../data/roleLanding";
import { useMvpApp } from "../context/MvpAppContext";

function PersonaButton({
  persona,
  selected,
  onSelect,
  onEnter,
  hideRoleLabel = false,
}: {
  persona: LoginPersonaLeaf;
  selected: boolean;
  onSelect: (id: DemoPersonaId) => void;
  onEnter: (id: DemoPersonaId) => void;
  hideRoleLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className={`login-org-person${selected ? " login-org-person--selected" : ""}`}
      onClick={() => onSelect(persona.id)}
      onDoubleClick={() => onEnter(persona.id)}
    >
      <strong>{persona.displayName}</strong>
      {!hideRoleLabel ? <span className="login-org-person__role">{persona.roleLabel}</span> : null}
    </button>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshAppConfig } = useMvpApp();
  const tree = useMemo(() => buildLoginOrgTree(readOrgTree()), []);

  const initialPersonaId = loadDemoPersonaId() ?? tree.cbPersonas[0]?.id ?? "cb";
  const [personaId, setPersonaId] = useState<DemoPersonaId>(initialPersonaId);
  const [openPath, setOpenPath] = useState(() => loginPathForPersona(tree, initialPersonaId));

  const enterAs = useCallback(
    (id: DemoPersonaId) => {
      const persona = loginAsDemoPersona(id);
      refreshAppConfig();
      navigate(landingRouteForRole(persona.role), { replace: true });
    },
    [navigate, refreshAppConfig],
  );

  const selectPersona = (id: DemoPersonaId) => {
    setPersonaId(id);
    setOpenPath(loginPathForPersona(tree, id));
  };

  const handleEnter = (event: React.FormEvent) => {
    event.preventDefault();
    if (!personaId) return;
    enterAs(personaId);
  };

  const selectedPersona =
    tree.cbPersonas.find((persona) => persona.id === personaId) ??
    tree.departments
      .flatMap((department) => [
        ...department.directors,
        ...department.units.flatMap((unit) => [...unit.unitLeads, ...unit.teams.flatMap((team) => team.personas)]),
      ])
      .find((persona) => persona.id === personaId) ??
    null;

  return (
    <div className="demo-login-page">
      <form className="demo-login-card demo-login-card--tree" onSubmit={handleEnter}>
        <header className="demo-login-card__head">
          <div className="demo-login-card__logo" aria-hidden>
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <h1>ФОТ-планировщик</h1>
          <p className="muted-line demo-login-card__hint">Выберите себя в оргструктуре · двойной клик — сразу войти</p>
        </header>

        <div className="login-org-tree" role="tree" aria-label="Оргструктура для входа">
          {tree.cbPersonas.length > 0 ? (
            <section className="login-org-branch login-org-branch--cb">
              <h2 className="login-org-branch__title">C&amp;B</h2>
              <div className="login-org-people">
                {tree.cbPersonas.map((persona) => (
                  <PersonaButton
                    key={persona.id}
                    persona={persona}
                    selected={personaId === persona.id}
                    onSelect={selectPersona}
                    onEnter={enterAs}
                    hideRoleLabel
                  />
                ))}
              </div>
            </section>
          ) : null}

          {tree.departments.map((department) => (
            <details
              key={department.id}
              className="login-org-branch"
              open={openPath.departmentId === department.id}
            >
              <summary className="login-org-branch__summary">
                <ChevronRight size={16} aria-hidden className="login-org-branch__chevron" />
                {department.department}
              </summary>
              <div className="login-org-branch__body">
                {department.directors.length > 0 ? (
                  <div className="login-org-people login-org-people--inline">
                    {department.directors.map((persona) => (
                      <PersonaButton
                        key={persona.id}
                        persona={persona}
                        selected={personaId === persona.id}
                        onSelect={selectPersona}
                        onEnter={enterAs}
                      />
                    ))}
                  </div>
                ) : null}

                {department.units.map((unit) => (
                  <details
                    key={unit.id}
                    className="login-org-branch login-org-branch--nested"
                    open={openPath.unitId === unit.id}
                  >
                    <summary className="login-org-branch__summary">
                      <ChevronRight size={16} aria-hidden className="login-org-branch__chevron" />
                      {unit.unit}
                    </summary>
                    <div className="login-org-branch__body">
                      {unit.unitLeads.length > 0 ? (
                        <div className="login-org-people login-org-people--inline">
                          {unit.unitLeads.map((persona) => (
                            <PersonaButton
                              key={persona.id}
                              persona={persona}
                              selected={personaId === persona.id}
                              onSelect={selectPersona}
                              onEnter={enterAs}
                            />
                          ))}
                        </div>
                      ) : null}

                      {unit.teams.map((team) => (
                        <details
                          key={team.id}
                          className="login-org-branch login-org-branch--nested login-org-branch--team"
                          open={openPath.teamId === team.id}
                        >
                          <summary className="login-org-branch__summary">
                            <ChevronRight size={16} aria-hidden className="login-org-branch__chevron" />
                            {team.team}
                          </summary>
                          <div className="login-org-branch__body">
                            <div className="login-org-people">
                              {team.personas.map((persona) => (
                                <PersonaButton
                                  key={persona.id}
                                  persona={persona}
                                  selected={personaId === persona.id}
                                  onSelect={selectPersona}
                                  onEnter={enterAs}
                                />
                              ))}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>

        {selectedPersona ? (
          <p className="login-org-selection muted-line">
            Выбрано: <strong>{selectedPersona.displayName}</strong> · {selectedPersona.roleLabel}
          </p>
        ) : null}

        <button type="submit" className="app-btn app-btn--primary demo-login-submit" disabled={!personaId}>
          Войти
        </button>
      </form>
    </div>
  );
}
