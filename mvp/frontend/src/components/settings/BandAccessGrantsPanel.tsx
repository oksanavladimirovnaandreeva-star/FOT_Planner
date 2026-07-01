import { useMemo, useState } from "react";
import { USER_ROLE_LABELS, useMvpApp } from "../../context/MvpAppContext";
import {
  DEMO_PERSONAS,
  listLoginPersonaGroups,
  type DemoPersonaId,
} from "../../data/demoPersonas";
import {
  buildDefaultBandAccessGrants,
  clearBandAccessGrants,
  readBandAccessGrants,
  resolveBandAccessGrants,
  toggleBandViewer,
  viewersForBandFromPositions,
  writeBandAccessGrants,
  type BandAccessGrants,
} from "../../data/bandAccessGrants";
import { defaultPersonaScopesForSettings } from "../../data/demoSessionStore";
import { formatMoney } from "../../data/formatDisplay";
import { bandKey } from "../../data/salaryRangeData";
import type { SalaryRangeBand } from "../../types";

type Props = {
  onSaved?: () => void;
};

export function BandAccessGrantsPanel({ onSaved }: Props) {
  const { refreshAppConfig, appConfigRevision, allPositions, salaryBands } = useMvpApp();
  const [grants, setGrants] = useState<BandAccessGrants>(() =>
    resolveBandAccessGrants(salaryBands, allPositions, (id) => defaultPersonaScopesForSettings()[id]),
  );
  const [message, setMessage] = useState<string | null>(null);

  const scopeForPersona = useMemo(
    () => (id: DemoPersonaId) => defaultPersonaScopesForSettings()[id],
    [appConfigRevision],
  );

  const personaGroups = useMemo(() => listLoginPersonaGroups(), []);

  const viewerColumns = useMemo(() => {
    const columns: { groupLabel: string; personaId: DemoPersonaId }[] = [];
    for (const group of personaGroups) {
      for (const option of group.options) {
        if (option.id === "cb") continue;
        columns.push({ groupLabel: group.label, personaId: option.id });
      }
    }
    return columns;
  }, [personaGroups]);

  const rows = useMemo(
    () =>
      [...salaryBands].sort(
        (a, b) =>
          a.specialization.localeCompare(b.specialization, "ru") ||
          a.level.localeCompare(b.level, "ru"),
      ),
    [salaryBands],
  );

  const save = () => {
    writeBandAccessGrants(grants);
    refreshAppConfig();
    setMessage("Доступ к строкам справочника сохранён.");
    onSaved?.();
  };

  const reset = () => {
    clearBandAccessGrants();
    const next = buildDefaultBandAccessGrants(salaryBands, allPositions, scopeForPersona);
    setGrants(next);
    refreshAppConfig();
    setMessage("Сброшено к демо-пресету (позиции + акценты).");
    onSaved?.();
  };

  const fillRowFromPositions = (band: SalaryRangeBand) => {
    const viewers = viewersForBandFromPositions(band, allPositions, scopeForPersona);
    const key = bandKey(band.specialization, band.level);
    setGrants((prev) => ({ ...prev, [key]: viewers }));
  };

  const toggleViewer = (band: SalaryRangeBand, personaId: DemoPersonaId, enabled: boolean) => {
    setGrants((prev) => toggleBandViewer(prev, band, personaId, enabled));
  };

  const hasOverrides = Object.keys(readBandAccessGrants() ?? {}).length > 0;

  return (
    <div className="band-access-grants-panel">
      <p className="muted-line">
        Каждая строка справочника (специализация × уровень) — свой список зрителей. Пример: тимлид Платформы
        не видит <strong>Lead · Engineering</strong>, но видит <strong>Lead · Marketing</strong>.
      </p>

      <div className="table-scroll band-access-grants-panel__scroll">
        <table className="simple-table band-access-grants-panel__table">
          <thead>
            <tr>
              <th rowSpan={2}>Специализация</th>
              <th rowSpan={2}>Уровень</th>
              <th rowSpan={2} className="simple-table--numeric">
                Мин
              </th>
              <th rowSpan={2} className="simple-table--numeric">
                Мид
              </th>
              <th rowSpan={2} className="simple-table--numeric">
                Макс
              </th>
              <th rowSpan={2}>Зрителей</th>
              {personaGroups
                .filter((group) => group.options.some((option) => option.id !== "cb"))
                .map((group) => {
                  const count = group.options.filter((option) => option.id !== "cb").length;
                  if (count === 0) return null;
                  return (
                    <th key={group.label} colSpan={count} className="band-access-grants-panel__group-head">
                      {group.label}
                    </th>
                  );
                })}
              <th rowSpan={2} aria-label="Действия" />
            </tr>
            <tr>
              {viewerColumns.map(({ personaId }) => {
                const persona = DEMO_PERSONAS.find((item) => item.id === personaId)!;
                return (
                  <th
                    key={personaId}
                    className="band-access-grants-panel__persona-head"
                    title={`${persona.displayName} · ${USER_ROLE_LABELS[persona.role]}`}
                  >
                    <span className="band-access-grants-panel__persona-short">
                      {persona.loginAccount.split(".")[0]}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((band) => {
              const key = bandKey(band.specialization, band.level);
              const viewers = new Set(grants[key] ?? []);
              return (
                <tr key={key}>
                  <td>{band.specialization}</td>
                  <td>{band.level}</td>
                  <td className="simple-table--numeric">{formatMoney(band.minSalary)}</td>
                  <td className="simple-table--numeric">
                    <strong>{formatMoney(band.midpoint)}</strong>
                  </td>
                  <td className="simple-table--numeric">{formatMoney(band.maxSalary)}</td>
                  <td className="band-access-grants-panel__count">{viewers.size}</td>
                  {viewerColumns.map(({ personaId }) => (
                    <td key={personaId} className="band-access-grants-panel__cell">
                      <label className="band-access-grants-panel__checkbox">
                        <input
                          type="checkbox"
                          checked={viewers.has(personaId)}
                          onChange={(event) => toggleViewer(band, personaId, event.target.checked)}
                        />
                        <span className="sr-only">
                          {DEMO_PERSONA_BY_ID_SHORT[personaId]} · {band.specialization} {band.level}
                        </span>
                      </label>
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="app-btn app-btn--ghost app-btn--sm"
                      onClick={() => fillRowFromPositions(band)}
                    >
                      Из позиций
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="form-actions">
        <button type="button" className="primary-btn" onClick={save}>
          Сохранить
        </button>
        <button type="button" className="secondary-btn" onClick={reset}>
          Сбросить к демо
        </button>
      </div>
      {message ? <p className="app-data-panel__message">{message}</p> : null}
      {hasOverrides ? <p className="muted-line">Есть сохранённые grants в браузере.</p> : null}
    </div>
  );
}

const DEMO_PERSONA_BY_ID_SHORT = Object.fromEntries(
  DEMO_PERSONAS.map((persona) => [persona.id, persona.displayName]),
) as Record<DemoPersonaId, string>;
