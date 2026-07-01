import { useMemo } from "react";
import { buildSalaryBandHint } from "../data/salaryBandHint";
import { formatMoney } from "../data/formatDisplay";
import type { SalaryRangeBand } from "../types";

type Props = {
  specialization: string;
  level: string;
  baseSalary: number | "";
  bands: SalaryRangeBand[];
  canView: boolean;
  compact?: boolean;
};

export function SalaryBandHint({
  specialization,
  level,
  baseSalary,
  bands,
  canView,
  compact = false,
}: Props) {
  const hint = useMemo(
    () =>
      buildSalaryBandHint({
        specialization,
        level,
        baseSalary,
        bands,
        canView,
      }),
    [specialization, level, baseSalary, bands, canView],
  );

  if (!hint.visible) {
    if (!hint.message) return null;
    return (
      <p className={`salary-band-hint salary-band-hint--message muted-line${compact ? " salary-band-hint--compact" : ""}`}>
        {hint.message}
      </p>
    );
  }

  const markerTone = hint.belowMin ? "below" : hint.aboveMax ? "above" : "in";

  return (
    <div
      className={`salary-band-hint${compact ? " salary-band-hint--compact" : ""}`}
      aria-label="Диапазон оклада по справочнику"
    >
      <div className="salary-band-hint__amounts">
        <span>
          Мин <strong>{formatMoney(hint.min!)}</strong>
        </span>
        <span className="salary-band-hint__amounts-mid">
          Мид <strong>{formatMoney(hint.mid!)}</strong>
        </span>
        <span>
          Макс <strong>{formatMoney(hint.max!)}</strong>
        </span>
      </div>
      <div className="salary-band-hint__track-wrap">
        <div className="salary-band-hint__track" aria-hidden>
          <span className="salary-band-hint__mid-tick" />
          <span
            className={`salary-band-hint__marker salary-band-hint__marker--${markerTone}`}
            style={{ left: `${hint.markerPct}%` }}
          />
        </div>
        <div className="salary-band-hint__track-labels" aria-hidden>
          <span>min</span>
          <span>max</span>
        </div>
      </div>
      {hint.crLabel ? (
        <div className="salary-band-hint__cr">
          <span className="salary-band-hint__cr-label">CR</span>
          <span className={`cr-coef cr-coef--${hint.crTone}`}>{hint.crLabel}</span>
          {hint.belowMin ? <span className="salary-band-hint__cr-note">ниже диапазона</span> : null}
          {hint.aboveMax ? <span className="salary-band-hint__cr-note">выше диапазона</span> : null}
        </div>
      ) : null}
    </div>
  );
}
