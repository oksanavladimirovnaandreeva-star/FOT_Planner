import { useMemo, useState } from "react";
import { OrgSliceMultiSelect } from "../OrgSliceMultiSelect";
import { useMvpApp } from "../../context/MvpAppContext";
import { USER_ROLE_LABELS } from "../../context/MvpAppContext";
import {
  DEMO_PERSONAS,
  personaNeedsScope,
  type DemoPersonaId,
} from "../../data/demoPersonas";
import {
  defaultPersonaScopesForSettings,
  writePersonaScopeOverrides,
} from "../../data/demoSessionStore";
import {
  ACCESS_FILTER_FIELD_LABELS,
  ACCESS_FILTER_OPERATOR_LABELS,
  nextAccessRuleId,
  normalizeAccessScope,
  type AccessFilterField,
  type AccessFilterOperator,
  type AccessFilterRule,
  type PersonaAccessScope,
} from "../../data/personaAccessScope";
import { departmentOptions, teamOptions, unitOptions } from "../../data/orgStructure";

const ORG_FIELDS: AccessFilterField[] = ["department", "unit", "team"];

function orgOptionsForField(
  field: AccessFilterField,
  rules: AccessFilterRule[],
  appConfigRevision: number,
): string[] {
  void appConfigRevision;
  const departments = rules
    .filter((rule) => rule.field === "department" && rule.operator === "eq")
    .flatMap((rule) => rule.values);
  const units = rules
    .filter((rule) => rule.field === "unit" && rule.operator === "eq")
    .flatMap((rule) => rule.values);

  switch (field) {
    case "department":
      return departmentOptions();
    case "unit": {
      const depts = departments.length > 0 ? departments : departmentOptions();
      const result = new Set<string>();
      for (const dept of depts) {
        for (const unit of unitOptions(dept)) result.add(unit);
      }
      return [...result].sort((a, b) => a.localeCompare(b, "ru"));
    }
    case "team": {
      const depts = departments.length > 0 ? departments : departmentOptions();
      const result = new Set<string>();
      if (units.length > 0) {
        for (const dept of depts) {
          for (const unit of units) {
            for (const team of teamOptions(dept, unit)) result.add(team);
          }
        }
      } else {
        for (const dept of depts) {
          for (const unit of unitOptions(dept)) {
            for (const team of teamOptions(dept, unit)) result.add(team);
          }
        }
      }
      return [...result].sort((a, b) => a.localeCompare(b, "ru"));
    }
    default:
      return [];
  }
}

function PersonaAccessRuleEditor({
  rule,
  allRules,
  employeeNameOptions,
  onChange,
  onRemove,
  appConfigRevision,
}: {
  rule: AccessFilterRule;
  allRules: AccessFilterRule[];
  employeeNameOptions: string[];
  onChange: (next: AccessFilterRule) => void;
  onRemove: () => void;
  appConfigRevision: number;
}) {
  const isOrgField = ORG_FIELDS.includes(rule.field);

  return (
    <div className="demo-access-rule">
      <select
        className="demo-access-inline-select"
        value={rule.field}
        onChange={(event) => {
          const field = event.target.value as AccessFilterField;
          onChange({ ...rule, field, values: [] });
        }}
      >
        {(Object.keys(ACCESS_FILTER_FIELD_LABELS) as AccessFilterField[]).map((field) => (
          <option key={field} value={field}>
            {ACCESS_FILTER_FIELD_LABELS[field]}
          </option>
        ))}
      </select>
      <select
        className="demo-access-inline-select"
        value={rule.operator}
        onChange={(event) => onChange({ ...rule, operator: event.target.value as AccessFilterOperator })}
      >
        {(Object.keys(ACCESS_FILTER_OPERATOR_LABELS) as AccessFilterOperator[]).map((operator) => (
          <option key={operator} value={operator}>
            {ACCESS_FILTER_OPERATOR_LABELS[operator]}
          </option>
        ))}
      </select>
      {isOrgField ? (
        <OrgSliceMultiSelect
          label={ACCESS_FILTER_FIELD_LABELS[rule.field]}
          options={orgOptionsForField(rule.field, allRules, appConfigRevision)}
          value={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
        />
      ) : (
        <OrgSliceMultiSelect
          label="ФИО"
          options={employeeNameOptions}
          value={rule.values}
          onChange={(values) => onChange({ ...rule, values })}
        />
      )}
      <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={onRemove}>
        Удалить
      </button>
    </div>
  );
}

function PersonaAccessCard({
  personaId,
  label,
  loginAccount,
  roleLabel,
  scope,
  selfEmployeeName,
  employeeNameOptions,
  onChange,
  appConfigRevision,
}: {
  personaId: DemoPersonaId;
  label: string;
  loginAccount: string;
  roleLabel: string;
  scope: PersonaAccessScope;
  selfEmployeeName?: string;
  employeeNameOptions: string[];
  onChange: (next: PersonaAccessScope) => void;
  appConfigRevision: number;
}) {
  const addRule = (field: AccessFilterField = "department") => {
    onChange(
      normalizeAccessScope({
        rules: [
          ...scope.rules,
          { id: nextAccessRuleId(), field, operator: "eq", values: [] },
        ],
      }),
    );
  };

  const excludeSelf = () => {
    if (!selfEmployeeName) return;
    const withoutSelf = scope.rules.filter(
      (rule) =>
        !(
          rule.field === "employeeName" &&
          rule.operator === "neq" &&
          rule.values.includes(selfEmployeeName)
        ),
    );
    onChange(
      normalizeAccessScope({
        rules: [
          ...withoutSelf,
          {
            id: nextAccessRuleId(),
            field: "employeeName",
            operator: "neq",
            values: [selfEmployeeName],
          },
        ],
      }),
    );
  };

  return (
    <article className="demo-access-persona-card">
      <header className="demo-access-persona-card__head">
        <div>
          <strong>{label}</strong>
          <div className="muted-line">
            {roleLabel} · {personaId}
            {loginAccount ? ` · ${loginAccount}` : ""}
          </div>
        </div>
        {selfEmployeeName ? (
          <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={excludeSelf}>
            Исключить себя ({selfEmployeeName})
          </button>
        ) : null}
      </header>
      <div className="demo-access-rules">
        {scope.rules.length === 0 ? (
          <p className="muted-line">Нет правил — видна вся оргструктура (кроме глобальных ограничений роли).</p>
        ) : (
          scope.rules.map((rule) => (
            <PersonaAccessRuleEditor
              key={rule.id}
              rule={rule}
              allRules={scope.rules}
              employeeNameOptions={employeeNameOptions}
              onChange={(next) =>
                onChange(
                  normalizeAccessScope({
                    rules: scope.rules.map((item) => (item.id === rule.id ? next : item)),
                  }),
                )
              }
              onRemove={() =>
                onChange(normalizeAccessScope({ rules: scope.rules.filter((item) => item.id !== rule.id) }))
              }
              appConfigRevision={appConfigRevision}
            />
          ))
        )}
      </div>
      <div className="demo-access-persona-card__actions">
        <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => addRule("department")}>
          + Правило
        </button>
        <button type="button" className="app-btn app-btn--ghost app-btn--sm" onClick={() => addRule("employeeName")}>
          + ФИО
        </button>
      </div>
    </article>
  );
}

export function DemoAccessSettingsPanel() {
  const { refreshAppConfig, appConfigRevision, allPositions } = useMvpApp();
  const [scopes, setScopes] = useState(() => defaultPersonaScopesForSettings());
  const [saved, setSaved] = useState(false);

  const scopedPersonas = DEMO_PERSONAS.filter(personaNeedsScope);

  const employeeNameOptions = useMemo(() => {
    const names = new Set<string>();
    for (const position of allPositions) {
      const name = position.employeeName?.trim() || position.seedEmployeeName?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ru"));
  }, [allPositions, appConfigRevision]);

  const save = () => {
    const payload: Partial<Record<DemoPersonaId, PersonaAccessScope>> = {};
    for (const persona of scopedPersonas) {
      const scope = scopes[persona.id];
      if (scope) payload[persona.id] = scope;
    }
    writePersonaScopeOverrides(payload);
    refreshAppConfig();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    const next = {} as Record<DemoPersonaId, PersonaAccessScope | null>;
    for (const persona of scopedPersonas) {
      next[persona.id] = persona.defaultScope ? normalizeAccessScope(persona.defaultScope) : null;
    }
    setScopes(next);
    writePersonaScopeOverrides(
      Object.fromEntries(
        scopedPersonas
          .filter((persona) => persona.defaultScope)
          .map((persona) => [persona.id, persona.defaultScope!]),
      ) as Partial<Record<DemoPersonaId, PersonaAccessScope>>,
    );
    refreshAppConfig();
  };

  return (
    <div className="demo-access-settings">
      <p className="muted-line">
        Правила доступа для именованных пользователей: <strong>равно / не равно</strong>, несколько значений в
        правиле, фильтр по оргструктуре и <strong>ФИО</strong> (чтобы исключить самого лида из среза). Все правила
        соединяются через <strong>И</strong>.
      </p>
      <div className="demo-access-personas">
        {scopedPersonas.map((persona) => {
          const scope = scopes[persona.id];
          if (!scope) return null;
          return (
            <PersonaAccessCard
              key={persona.id}
              personaId={persona.id}
              label={persona.displayName}
              loginAccount={persona.loginAccount}
              roleLabel={USER_ROLE_LABELS[persona.role]}
              scope={scope}
              selfEmployeeName={persona.selfEmployeeName}
              employeeNameOptions={employeeNameOptions}
              onChange={(next) => setScopes((prev) => ({ ...prev, [persona.id]: next }))}
              appConfigRevision={appConfigRevision}
            />
          );
        })}
      </div>
      <p className="muted-line">
        <strong>C&B</strong> — без среза. Пример: команда <em>равно</em> Frontend Web <strong>И</strong> ФИО{" "}
        <em>не равно</em> Василий Андреев.
      </p>
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
