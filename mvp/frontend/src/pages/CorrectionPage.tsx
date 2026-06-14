import { Navigate, useSearchParams } from "react-router-dom";

/** Редirect legacy /correction → /planning?mode=correction */
export function CorrectionPage() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set("mode", "correction");
  const query = params.toString();
  return <Navigate to={`/planning?${query}`} replace />;
}
