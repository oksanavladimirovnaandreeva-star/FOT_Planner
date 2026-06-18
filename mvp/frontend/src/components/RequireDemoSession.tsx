import { Navigate, useLocation } from "react-router-dom";
import { hasDemoSession } from "../data/demoSessionStore";

export function RequireDemoSession({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!hasDemoSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
