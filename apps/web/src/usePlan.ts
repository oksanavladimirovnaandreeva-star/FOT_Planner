import { useEffect, useState } from "react";
import { api } from "./api";

export type Plan = {
  id: number;
  plan_year: number;
  label: string;
  status: string;
  parent_version_id?: number | null;
};

export function usePlanId(): [number | null, (id: number) => void] {
  const key = "fot_plan_id";
  const [id, setId] = useState<number | null>(() => {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  });
  const set = (n: number) => {
    localStorage.setItem(key, String(n));
    setId(n);
  };
  return [id, set];
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => {
    api<Plan[]>("/api/v1/plans").then(setPlans);
  }, []);
  return plans;
}
