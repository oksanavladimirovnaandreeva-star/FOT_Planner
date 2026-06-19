import { useMemo, useState } from "react";
import { DEMO_PERSONAS, type DemoPersonaId } from "../../data/demoPersonas";
import { formatVisibilityField, parseCsvOrStar } from "../../data/catalogVisibility";
import {
  defaultPersonaCatalogVisibilityForSettings,
  readPersonaCatalogVisibilityOverrides,
  writePersonaCatalogAccessOverrides,
  writePersonaCatalogVisibilityOverrides,
} from "../../data/demoSessionStore";
import { USER_ROLE_LABELS } from "../../context/MvpAppContext";
import type { CatalogVisibilityRule, SalaryCatalogAccess } from "../../types";

type Props = {
  onSaved?: () => void;
};

export function SalaryCatalogAccessPanel({ onSaved }: Props) {
  const [draft, setDraft] = useState(() => defaultPersonaCatalogVisibilityForSettings());
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      DEMO_PERSONAS.map((persona) => ({
        persona,
        rule: draft[persona.id],
      })),
    [draft],
  );

  const updateRule = (personaId: DemoPersonaId, patch: Partial<CatalogVisibilityRule>) => {
    setDraft((prev) => ({
      ...prev,
      [personaId]: { ...prev[personaId], ...patch },
    }));
  };

  const save = () => {
    writePersonaCatalogVisibilityOverrides(draft);
    const legacyAccess: Partial<Record<DemoPersonaId, SalaryCatalogAccess>> = {};
    for (const persona of DEMO_PERSONAS) {
      const access = draft[persona.id]?.access;
      if (access && access !== "none") legacyAccess[persona.id] = access;
    }
    writePersonaCatalogAccessOverrides(legacyAccess);
    setMessage("Доступ к диапазонам сохранён.");
    onSaved?.();
  };

  const reset = () => {
    writePersonaCatalogVisibilityOverrides({});
    writePersonaCatalogAccessOverrides({});
    setDraft(defaultPersonaCatalogVisibilityForSettings());
    setMessage("Сброшено к значениям по умолчанию.");
    onSaved?.();
  };

  return (
    <div className="salary-catalog-access-panel">
      <p className="muted-line">
        Видимость справочника: специализации и уровни (через запятую или *). Редактирование — только при
        access «write».
      </p>
      <div className="table-scroll">
        <table className="simple-table salary-catalog-access-panel__table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Специализации</th>
              <th>Уровни</th>
              <th>Доступ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ persona, rule }) => (
              <tr key={persona.id}>
                <td>{persona.displayName}</td>
                <td>{USER_ROLE_LABELS[persona.role]}</td>
                <td>
                  <input
                    className="salary-catalog-access-panel__field"
                    value={formatVisibilityField(rule.specs)}
                    onChange={(event) =>
                      updateRule(persona.id, { specs: parseCsvOrStar(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    className="salary-catalog-access-panel__field"
                    value={formatVisibilityField(rule.levels)}
                    onChange={(event) =>
                      updateRule(persona.id, { levels: parseCsvOrStar(event.target.value) })
                    }
                  />
                </td>
                <td>
                  <select
                    value={rule.access}
                    onChange={(event) =>
                      updateRule(persona.id, {
                        access: event.target.value as CatalogVisibilityRule["access"],
                      })
                    }
                  >
                    <option value="none">Нет доступа</option>
                    <option value="read">Только просмотр</option>
                    <option value="write">Редактирование</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <button type="button" className="primary-btn" onClick={save}>
          Сохранить
        </button>
        <button type="button" className="secondary-btn" onClick={reset}>
          Сбросить
        </button>
      </div>
      {message ? <p className="app-data-panel__message">{message}</p> : null}
      {Object.keys(readPersonaCatalogVisibilityOverrides()).length > 0 ? (
        <p className="muted-line">Есть сохранённые переопределения в браузере.</p>
      ) : null}
    </div>
  );
}
