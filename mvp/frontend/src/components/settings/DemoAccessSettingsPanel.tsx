import { useMemo, useState } from "react";
import { useMvpApp } from "../../context/MvpAppContext";
import { USER_ROLE_LABELS } from "../../context/MvpAppContext";
import {
  DEFAULT_ROLE_SCOPES,
  readRoleScopes,
  writeRoleScopes,
  type RoleScopeRecord,
  type ScopedRole,
} from "../../data/demoRoleScopeStore";
import { departmentOptions, teamOptions, unitOptions } from "../../data/orgStructure";

const SCOPED_ROLES: ScopedRole[] = ["director", "unit_lead", "team_lead"];

function ScopeFields({
  role,
  scope,
  onChange,
  appConfigRevision,
}: {
  role: ScopedRole;
  scope: RoleScopeRecord;
  onChange: (next: RoleScopeRecord) => void;
  appConfigRevision: number;
}) {
  const departments = useMemo(() => departmentOptions(), [appConfigRevision]);
  const units = useMemo(() => unitOptions(scope.department), [scope.department]);
  const teams = useMemo(() => teamOptions(scope.department, scope.unit ?? units[0] ?? ""), [scope.department, scope.unit, units]);

  return (
    <div className="demo-access-role">
      <h3 className="demo-access-role__title">{USER_ROLE_LABELS[role]}</h3>
      <div className="demo-access-role__grid">
        <label className="settings-field">
          <span>Департамент</span>
          <select
            value={scope.department}
            onChange={(event) => {
              const department = event.target.value;
              const nextUnits = unitOptions(department);
              const nextUnit = nextUnits[0] ?? "";
              const nextTeams = teamOptions(department, nextUnit);
              onChange({ department, unit: role === "director" ? undefined : nextUnit, team: role === "team_lead" ? nextTeams[0] : undefined });
            }}
          >
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {role !== "director" ? (
          <label className="settings-field">
            <span>Юнит</span>
            <select
              value={scope.unit ?? ""}
              onChange={(event) => {
                const unit = event.target.value;
                const nextTeams = teamOptions(scope.department, unit);
                onChange({ ...scope, unit, team: role === "team_lead" ? nextTeams[0] : undefined });
              }}
            >
              {units.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {role === "team_lead" ? (
          <label className="settings-field">
            <span>Команда</span>
            <select value={scope.team ?? ""} onChange={(event) => onChange({ ...scope, team: event.target.value })}>
              {teams.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function DemoAccessSettingsPanel() {
  const { refreshAppConfig, appConfigRevision } = useMvpApp();
  const [scopes, setScopes] = useState(() => readRoleScopes());
  const [saved, setSaved] = useState(false);

  const save = () => {
    writeRoleScopes(scopes);
    refreshAppConfig();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    setScopes({ ...DEFAULT_ROLE_SCOPES });
    writeRoleScopes(DEFAULT_ROLE_SCOPES);
    refreshAppConfig();
  };

  return (
    <div className="demo-access-settings">
      <p className="muted-line">
        Демо-привязка роли к узлу оргструктуры. В проде — SSO + API (см. SECURITY-REQUIREMENTS).
      </p>
      {SCOPED_ROLES.map((role) => (
        <ScopeFields
          key={role}
          role={role}
          scope={scopes[role]}
          onChange={(next) => setScopes((prev) => ({ ...prev, [role]: next }))}
          appConfigRevision={appConfigRevision}
        />
      ))}
      <div className="app-data-panel__actions">
        <button type="button" className="app-btn app-btn--primary" onClick={save}>
          Сохранить доступы
        </button>
        <button type="button" className="app-btn app-btn--ghost" onClick={reset}>
          Сбросить пресеты
        </button>
        {saved ? <span className="muted-line">Сохранено</span> : null}
      </div>
    </div>
  );
}
