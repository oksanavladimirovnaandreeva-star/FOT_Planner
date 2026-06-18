import { useMemo, useState } from "react";
import { DEMO_PERSONAS, type DemoPersonaId } from "../../data/demoPersonas";
import {
  defaultPersonaCatalogAccessForSettings,
  readPersonaCatalogAccessOverrides,
  writePersonaCatalogAccessOverrides,
} from "../../data/demoSessionStore";
import { USER_ROLE_LABELS } from "../../context/MvpAppContext";
import type { SalaryCatalogAccess } from "../../types";

type Props = {
  onSaved?: () => void;
};

export function SalaryCatalogAccessPanel({ onSaved }: Props) {
  const [draft, setDraft] = useState(() => defaultPersonaCatalogAccessForSettings());
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      DEMO_PERSONAS.map((persona) => ({
        persona,
        access: draft[persona.id] ?? "read",
      })),
    [draft],
  );

  const setAccess = (personaId: DemoPersonaId, access: SalaryCatalogAccess) => {
    setDraft((prev) => ({ ...prev, [personaId]: access }));
  };

  const save = () => {
    writePersonaCatalogAccessOverrides(draft);
    setMessage("Доступ к диапазонам сохранён.");
    onSaved?.();
  };

  const reset = () => {
    writePersonaCatalogAccessOverrides({});
    setDraft(defaultPersonaCatalogAccessForSettings());
    setMessage("Сброшено к значениям по умолчанию.");
    onSaved?.();
  };

  return (
    <div className="salary-catalog-access-panel">
      <p className="muted-line">
        Кто может редактировать справочник диапазонов (демо, как доступы к плану на экране входа).
      </p>
      <div className="table-scroll">
        <table className="simple-table salary-catalog-access-panel__table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Доступ к диапазонам</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ persona, access }) => (
              <tr key={persona.id}>
                <td>{persona.displayName}</td>
                <td>{USER_ROLE_LABELS[persona.role]}</td>
                <td>
                  <select
                    value={access}
                    onChange={(event) => setAccess(persona.id, event.target.value as SalaryCatalogAccess)}
                  >
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
      {Object.keys(readPersonaCatalogAccessOverrides()).length > 0 ? (
        <p className="muted-line">Есть сохранённые переопределения в браузере.</p>
      ) : null}
    </div>
  );
}
