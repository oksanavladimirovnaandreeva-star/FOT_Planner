import { useMemo, useState } from "react";
import { OrgSliceMultiSelect } from "../OrgSliceMultiSelect";
import { DemoAccessSettingsPanel } from "./DemoAccessSettingsPanel";
import { USER_ROLE_LABELS, useMvpApp } from "../../context/MvpAppContext";
import {
  DEMO_PERSONAS,
  personaNeedsScope,
  type DemoPersonaId,
} from "../../data/demoPersonas";
import {
  defaultPersonaScopesForSettings,
  writePersonaScopeOverrides,
} from "../../data/demoSessionStore";
import { departmentOptions } from "../../data/orgStructure";
import { countOrgNodes, readOrgTree } from "../../data/orgStructureStore";
import {
  countPositionsForScope,
  isSimpleOrgScope,
  orgMatrixRowFromScope,
  scopeFromOrgMatrixRow,
  teamOptionsForMatrix,
  unitOptionsForMatrix,
  type PersonaOrgMatrixRow,
} from "../../data/personaAccessMatrix";
import type { PersonaAccessScope } from "../../data/personaAccessScope";

function emptyOrgRow(): PersonaOrgMatrixRow {
  return { departments: [], units: [], teams: [], excludeSelf: false };
}

export function PersonaAccessMatrixPanel() {
  const { refreshAppConfig, appConfigRevision, allPositions } = useMvpApp();
  const [scopes, setScopes] = useState(() => defaultPersonaScopesForSettings());
  const [message, setMessage] = useState<string | null>(null);

  const tree = useMemo(() => readOrgTree(), [appConfigRevision]);
  const counts = useMemo(() => countOrgNodes(tree), [tree]);

  const rows = useMemo(
    () =>
      DEMO_PERSONAS.map((persona) => {
        const scope = scopes[persona.id];
        const hasPlanningSlice = personaNeedsScope(persona);
        const isCustom =
          hasPlanningSlice && scope
            ? !isSimpleOrgScope(scope, persona.selfEmployeeName)
            : false;
        const orgRow =
          hasPlanningSlice && scope && !isCustom
            ? orgMatrixRowFromScope(scope, persona.selfEmployeeName)
            : hasPlanningSlice && persona.defaultScope
              ? orgMatrixRowFromScope(
                  scope ?? persona.defaultScope,
                  persona.selfEmployeeName,
                )
              : null;
        const previewScope =
          hasPlanningSlice && orgRow && !isCustom
            ? scopeFromOrgMatrixRow(orgRow, persona.selfEmployeeName)
            : scope;
        const positionCount = hasPlanningSlice
          ? countPositionsForScope(allPositions, previewScope ?? null)
          : allPositions.filter((p) => p.status !== "Closed").length;

        return {
          persona,
          hasPlanningSlice,
          isCustom,
          orgRow,
          positionCount,
        };
      }),
    [scopes, allPositions, appConfigRevision],
  );

  const updateOrgRow = (personaId: DemoPersonaId, patch: Partial<PersonaOrgMatrixRow>) => {
    const persona = DEMO_PERSONAS.find((item) => item.id === personaId);
    if (!persona || !personaNeedsScope(persona)) return;
    setScopes((prev) => {
      const current = prev[personaId] ?? persona.defaultScope ?? null;
      const row = current
        ? orgMatrixRowFromScope(current, persona.selfEmployeeName)
        : emptyOrgRow();
      const nextRow = { ...row, ...patch };
      return {
        ...prev,
        [personaId]: scopeFromOrgMatrixRow(nextRow, persona.selfEmployeeName),
      };
    });
  };

  const save = () => {
    const scopePayload: Partial<Record<DemoPersonaId, PersonaAccessScope>> = {};
    for (const persona of DEMO_PERSONAS.filter(personaNeedsScope)) {
      const scope = scopes[persona.id];
      if (scope) scopePayload[persona.id] = scope;
    }
    writePersonaScopeOverrides(scopePayload);
    refreshAppConfig();
    setMessage("Орг-срезы планирования сохранены.");
  };

  const reset = () => {
    const nextScopes = {} as Record<DemoPersonaId, PersonaAccessScope | null>;
    for (const persona of DEMO_PERSONAS) {
      nextScopes[persona.id] = persona.defaultScope ?? null;
    }
    setScopes(nextScopes);
    writePersonaScopeOverrides(
      Object.fromEntries(
        DEMO_PERSONAS.filter((persona) => persona.defaultScope).map((persona) => [
          persona.id,
          persona.defaultScope!,
        ]),
      ) as Partial<Record<DemoPersonaId, PersonaAccessScope>>,
    );
    refreshAppConfig();
    setMessage("Орг-срезы сброшены к демо-пресетам.");
  };

  return (
    <div className="persona-access-matrix">
      <p className="muted-line">
        Кто видит какие команды и позиции в <strong>планировании</strong>. Справочник окладов настраивается
        отдельно ниже — по строкам каталога.
      </p>
      <p className="settings-scope">
        Оргструктура: {counts.departmentCount} деп. · {counts.unitCount} юнитов · {counts.teamCount} команд
      </p>

      <div className="table-scroll">
        <table className="simple-table demo-access-personas-table persona-access-matrix__table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Департамент</th>
              <th>Юнит</th>
              <th>Команда</th>
              <th>Без себя</th>
              <th>Позиций</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ persona, hasPlanningSlice, isCustom, orgRow, positionCount }) => (
              <tr key={persona.id}>
                <td>
                  <div>{persona.displayName}</div>
                  <div className="demo-access-persona-id muted-line">{persona.loginAccount}</div>
                </td>
                <td>{USER_ROLE_LABELS[persona.role]}</td>
                <td colSpan={hasPlanningSlice ? 1 : 4}>
                  {!hasPlanningSlice ? (
                    <span className="muted-line">Весь план</span>
                  ) : isCustom ? (
                    <span
                      className="persona-access-matrix__custom"
                      title="Редактируйте в расширенных правилах"
                    >
                      Нестандартные правила
                    </span>
                  ) : orgRow ? (
                    <OrgSliceMultiSelect
                      label="Деп."
                      layout="toolbar"
                      options={departmentOptions()}
                      value={orgRow.departments}
                      onChange={(departments) => updateOrgRow(persona.id, { departments })}
                    />
                  ) : null}
                </td>
                {hasPlanningSlice ? (
                  <td>
                    {isCustom || !orgRow ? (
                      <span className="muted-line">—</span>
                    ) : (
                      <OrgSliceMultiSelect
                        label="Юнит"
                        layout="toolbar"
                        options={unitOptionsForMatrix(orgRow)}
                        value={orgRow.units}
                        onChange={(units) => updateOrgRow(persona.id, { units })}
                      />
                    )}
                  </td>
                ) : null}
                {hasPlanningSlice ? (
                  <td>
                    {isCustom || !orgRow ? (
                      <span className="muted-line">—</span>
                    ) : (
                      <OrgSliceMultiSelect
                        label="Команда"
                        layout="toolbar"
                        options={teamOptionsForMatrix(orgRow)}
                        value={orgRow.teams}
                        onChange={(teams) => updateOrgRow(persona.id, { teams })}
                      />
                    )}
                  </td>
                ) : null}
                {hasPlanningSlice ? (
                  <td>
                    {isCustom || !orgRow ? (
                      <span className="muted-line">—</span>
                    ) : persona.selfEmployeeName ? (
                      <label className="persona-access-matrix__checkbox">
                        <input
                          type="checkbox"
                          checked={orgRow.excludeSelf}
                          onChange={(event) =>
                            updateOrgRow(persona.id, { excludeSelf: event.target.checked })
                          }
                        />
                        <span className="sr-only">Исключить {persona.selfEmployeeName}</span>
                      </label>
                    ) : (
                      <span className="muted-line">—</span>
                    )}
                  </td>
                ) : null}
                <td>{positionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="persona-access-matrix__advanced">
        <summary>Расширенные правила доступа (ФИО, нестандартные фильтры)</summary>
        <DemoAccessSettingsPanel embedded scopes={scopes} onScopesChange={setScopes} />
      </details>

      <div className="form-actions">
        <button type="button" className="primary-btn" onClick={save}>
          Сохранить
        </button>
        <button type="button" className="secondary-btn" onClick={reset}>
          Сбросить к демо
        </button>
      </div>
      {message ? <p className="app-data-panel__message">{message}</p> : null}
    </div>
  );
}
