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
  defaultPersonaCatalogVisibilityForSettings,
  defaultPersonaScopesForSettings,
  writePersonaCatalogAccessOverrides,
  writePersonaCatalogVisibilityOverrides,
  writePersonaScopeOverrides,
} from "../../data/demoSessionStore";
import { departmentOptions } from "../../data/orgStructure";
import { countOrgNodes, readOrgTree } from "../../data/orgStructureStore";
import {
  catalogAccessForRole,
  catalogFieldToMultiSelect,
  catalogSliceFromPositions,
  countCatalogBands,
  defaultCatalogVisibilityForPersona,
  levelCatalogOptions,
  multiSelectToCatalogField,
} from "../../data/personaCatalogDefaults";
import {
  countPositionsForScope,
  isSimpleOrgScope,
  orgMatrixRowFromScope,
  scopeFromOrgMatrixRow,
  teamOptionsForMatrix,
  unitOptionsForMatrix,
  type PersonaOrgMatrixRow,
} from "../../data/personaAccessMatrix";
import { specializationOptions } from "../../data/salaryRangeData";
import type { CatalogVisibilityRule, SalaryCatalogAccess } from "../../types";
import type { PersonaAccessScope } from "../../data/personaAccessScope";

function emptyOrgRow(): PersonaOrgMatrixRow {
  return { departments: [], units: [], teams: [], excludeSelf: false };
}

export function PersonaAccessMatrixPanel() {
  const { refreshAppConfig, appConfigRevision, allPositions, salaryBands } = useMvpApp();
  const [scopes, setScopes] = useState(() => defaultPersonaScopesForSettings());
  const [catalog, setCatalog] = useState(() => defaultPersonaCatalogVisibilityForSettings(allPositions));
  const [message, setMessage] = useState<string | null>(null);

  const tree = useMemo(() => readOrgTree(), [appConfigRevision]);
  const counts = useMemo(() => countOrgNodes(tree), [tree]);
  const specOptions = useMemo(() => specializationOptions(salaryBands), [salaryBands]);
  const levelOptions = useMemo(() => levelCatalogOptions(salaryBands), [salaryBands]);

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
        const catalogRule = catalog[persona.id];
        const catalogBandCount = countCatalogBands(salaryBands, catalogRule);

        return {
          persona,
          hasPlanningSlice,
          isCustom,
          orgRow,
          positionCount,
          catalogRule,
          catalogBandCount,
        };
      }),
    [scopes, catalog, allPositions, salaryBands, appConfigRevision],
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

  const updateCatalog = (personaId: DemoPersonaId, patch: Partial<CatalogVisibilityRule>) => {
    setCatalog((prev) => ({
      ...prev,
      [personaId]: { ...prev[personaId], ...patch },
    }));
  };

  const fillCatalogFromPositions = (personaId: DemoPersonaId) => {
    const persona = DEMO_PERSONAS.find((item) => item.id === personaId);
    if (!persona) return;
    const scope = scopes[personaId] ?? persona.defaultScope ?? null;
    const slice = catalogSliceFromPositions(allPositions, scope);
    updateCatalog(personaId, {
      specs: slice.specs,
      levels: slice.levels,
      access: catalogAccessForRole(persona.role),
    });
  };

  const save = () => {
    const scopePayload: Partial<Record<DemoPersonaId, PersonaAccessScope>> = {};
    for (const persona of DEMO_PERSONAS.filter(personaNeedsScope)) {
      const scope = scopes[persona.id];
      if (scope) scopePayload[persona.id] = scope;
    }
    writePersonaScopeOverrides(scopePayload);

    const catalogPayload = {} as Record<DemoPersonaId, CatalogVisibilityRule>;
    for (const persona of DEMO_PERSONAS) {
      catalogPayload[persona.id] = {
        ...catalog[persona.id],
        access: catalogAccessForRole(persona.role),
      };
    }
    writePersonaCatalogVisibilityOverrides(catalogPayload);

    const legacyAccess: Partial<Record<DemoPersonaId, SalaryCatalogAccess>> = {};
    for (const persona of DEMO_PERSONAS) {
      const access = catalogPayload[persona.id]?.access;
      if (access === "read" || access === "write") legacyAccess[persona.id] = access;
    }
    writePersonaCatalogAccessOverrides(legacyAccess);
    refreshAppConfig();
    setMessage("Доступы сохранены.");
  };

  const reset = () => {
    const nextScopes = {} as Record<DemoPersonaId, PersonaAccessScope | null>;
    const nextCatalog = {} as Record<DemoPersonaId, CatalogVisibilityRule>;
    for (const persona of DEMO_PERSONAS) {
      nextScopes[persona.id] = persona.defaultScope ?? null;
      nextCatalog[persona.id] = defaultCatalogVisibilityForPersona(persona, allPositions);
    }
    setScopes(nextScopes);
    setCatalog(nextCatalog);
    writePersonaScopeOverrides(
      Object.fromEntries(
        DEMO_PERSONAS.filter((persona) => persona.defaultScope).map((persona) => [
          persona.id,
          persona.defaultScope!,
        ]),
      ) as Partial<Record<DemoPersonaId, PersonaAccessScope>>,
    );
    writePersonaCatalogVisibilityOverrides({});
    writePersonaCatalogAccessOverrides({});
    refreshAppConfig();
    setMessage("Сброшено к демо-пресетам.");
  };

  return (
    <div className="persona-access-matrix">
      <p className="muted-line">
        Срез планирования — по оргструктуре. Справочник окладов — по <strong>специализациям и уровням</strong>:
        тимлид видит только строки диапазонов своей команды, не весь каталог. Редактирует справочник только C&B.
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
              <th>Специализации</th>
              <th>Уровни</th>
              <th>Строк справочника</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                persona,
                hasPlanningSlice,
                isCustom,
                orgRow,
                positionCount,
                catalogRule,
                catalogBandCount,
              }) => {
                const canEditCatalog = persona.role === "cb_admin";
                const specValue = catalogFieldToMultiSelect(catalogRule.specs, specOptions);
                const levelValue = catalogFieldToMultiSelect(catalogRule.levels, levelOptions);

                return (
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
                    <td>
                      <OrgSliceMultiSelect
                        label="Спец."
                        layout="toolbar"
                        options={specOptions}
                        value={specValue}
                        onChange={(selected) =>
                          updateCatalog(persona.id, {
                            specs: multiSelectToCatalogField(selected, specOptions),
                          })
                        }
                      />
                    </td>
                    <td>
                      <OrgSliceMultiSelect
                        label="Уровни"
                        layout="toolbar"
                        options={levelOptions}
                        value={levelValue}
                        onChange={(selected) =>
                          updateCatalog(persona.id, {
                            levels: multiSelectToCatalogField(selected, levelOptions),
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="persona-access-matrix__catalog-count">{catalogBandCount}</div>
                      {hasPlanningSlice ? (
                        <button
                          type="button"
                          className="app-btn app-btn--ghost app-btn--sm persona-access-matrix__fill"
                          onClick={() => fillCatalogFromPositions(persona.id)}
                        >
                          Из позиций
                        </button>
                      ) : canEditCatalog ? (
                        <span className="muted-line persona-access-matrix__fill">редакт. справочника</span>
                      ) : null}
                    </td>
                  </tr>
                );
              },
            )}
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
