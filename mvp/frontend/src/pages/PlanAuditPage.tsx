import { Navigate, useSearchParams } from "react-router-dom";

/** Редирект: журнал встроен в планирование. */
export function PlanAuditPage() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set("tab", "journal");
  const position = searchParams.get("position");
  if (position) next.set("position", position);
  const positions = searchParams.get("positions");
  if (positions) next.set("positions", positions);
  if (searchParams.get("diff") === "1") next.set("diff", "1");
  return <Navigate to={`/planning?${next.toString()}`} replace />;
}

export const ChangesJournalPage = PlanAuditPage;
