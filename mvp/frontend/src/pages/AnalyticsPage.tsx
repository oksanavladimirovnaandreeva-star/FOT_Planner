import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PlanFactBaselineBanner } from "../components/PlanFactBaselineBanner";
import { useMvpApp } from "../context/MvpAppContext";
import { DeviationPage } from "./DeviationPage";
import { ForecastPage } from "./ForecastPage";
import { PlanVsActualPage } from "./PlanVsActualPage";

type AnalyticsTab = "plan-fact" | "deviation" | "forecast";

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "plan-fact", label: "План и факт" },
  { id: "deviation", label: "Отклонения" },
  { id: "forecast", label: "Прогноз" },
];

function parseTab(value: string | null): AnalyticsTab {
  if (value === "deviation" || value === "forecast") return value;
  return "plan-fact";
}

function DeferredAnalyticsPanel({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!ready) {
    return <p className="muted-line analytics-page__loading">Считаем аналитику…</p>;
  }
  return children;
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const { planFactBaseline } = useMvpApp();

  const setTab = (next: AnalyticsTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "plan-fact") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div className="content-page analytics-page">
      <header className="page-header page-header--compact">
        <h1>Аналитика</h1>
      </header>

      <PlanFactBaselineBanner baseline={planFactBaseline} />

      <div className="plan-fact-readonly-note" role="note">
        Всегда <strong>план − факт</strong>: плюс — экономия, минус — перерасход. Факт не меняет план.
      </div>

      <nav className="planning-workspace-tabs" aria-label="Разделы аналитики">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`planning-workspace-tabs__btn${tab === item.id ? " planning-workspace-tabs__btn--active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <DeferredAnalyticsPanel>
        {tab === "plan-fact" ? <PlanVsActualPage embedded /> : null}
        {tab === "deviation" ? <DeviationPage embedded /> : null}
        {tab === "forecast" ? <ForecastPage embedded /> : null}
      </DeferredAnalyticsPanel>
    </div>
  );
}
