import { Navigate, Route, Routes } from "react-router-dom";
import { PlanProvider } from "./PlanContext";
import { ViewModeProvider } from "./ViewModeContext";
import { LayoutChrome } from "./components/LayoutChrome";
import { useAuth } from "./auth";
import Dashboard from "./pages/Dashboard";
import BudgetPlanning from "./pages/BudgetPlanning";
import SalaryRanges from "./pages/SalaryRanges";
import Imports from "./pages/Imports";
import Variance from "./pages/Variance";
import Audit from "./pages/Audit";
import Plans from "./pages/Plans";

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/planning" element={<BudgetPlanning />} />
          <Route path="/plan-grid" element={<Navigate to="/planning" replace />} />
          <Route path="/indexation" element={<Navigate to="/planning" replace />} />
          <Route path="/reviews" element={<Navigate to="/planning" replace />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/positions" element={<Navigate to="/planning" replace />} />
          <Route path="/positions/:id" element={<Navigate to="/planning" replace />} />
          <Route path="/employees" element={<Navigate to="/imports" replace />} />
          <Route path="/salary-ranges" element={<SalaryRanges />} />
          <Route path="/variance" element={<Variance />} />
          {isAdmin && <Route path="/imports" element={<Imports />} />}
          <Route path="/audit" element={<Audit />} />
        </Routes>
  );
}

export default function App() {
  return (
    <ViewModeProvider>
      <PlanProvider>
        <LayoutChrome>
          <AppRoutes />
        </LayoutChrome>
      </PlanProvider>
    </ViewModeProvider>
  );
}
