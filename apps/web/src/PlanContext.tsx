import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { Plan } from "./usePlan";

type Summary = {
  plan_lines: number;
  year_total_base: number;
  positions: number;
  employees: number;
  vacancies: number;
  events: number;
};

type Ctx = {
  plans: Plan[];
  planId: number | null;
  plan: Plan | null;
  summary: Summary | null;
  loading: boolean;
  error: string | null;
  setPlanId: (id: number) => void;
  refresh: () => void;
  recalculate: () => Promise<void>;
};

const PlanContext = createContext<Ctx | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanIdState] = useState<number | null>(() => {
    const v = localStorage.getItem("fot_plan_id");
    return v ? Number(v) : null;
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setPlanId = (id: number) => {
    localStorage.setItem("fot_plan_id", String(id));
    setPlanIdState(id);
  };

  const loadSummary = async (id: number) => {
    try {
      const s = await api<Summary>(`/api/v1/plans/${id}/summary`);
      setSummary(s);
    } catch {
      setSummary(null);
    }
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api<Plan[]>("/api/v1/plans");
      setPlans(list);
      let id = planId;
      if (id && !list.some((p) => p.id === id)) {
        localStorage.removeItem("fot_plan_id");
        id = null;
        setPlanIdState(null);
      }
      if (!id && list.length > 0) {
        id = list[0].id;
        setPlanId(id);
      }
      if (id) {
        await loadSummary(id);
      } else if (list.length === 0) {
        setError("Нет планов. Запустите API (порт 8000) и нажмите «Пересоздать демо» в Импорте.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("fetch") || msg.includes("Failed")
          ? "API недоступен. Запустите в терминале: cd apps/api → uvicorn app.main:app --reload --port 8000"
          : msg
      );
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlans();
  }, [planId]);

  const recalculate = async () => {
    if (!planId) return;
    setError(null);
    try {
      await api(`/api/v1/plans/${planId}/recalculate`, { method: "POST" });
      await loadSummary(planId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка пересчёта");
    }
  };

  const plan = plans.find((p) => p.id === planId) ?? null;

  return (
    <PlanContext.Provider
      value={{
        plans,
        planId,
        plan,
        summary,
        loading,
        error,
        setPlanId,
        refresh: loadPlans,
        recalculate,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlanContext() {
  const c = useContext(PlanContext);
  if (!c) throw new Error("PlanProvider required");
  return c;
}
