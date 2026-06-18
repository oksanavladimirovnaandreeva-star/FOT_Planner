import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireDemoSession } from "./components/RequireDemoSession";
import { MvpAppProvider } from "./context/MvpAppContext";
import { DashboardPage } from "./pages/DashboardPage";
import { CorrectionPage } from "./pages/CorrectionPage";
import { PlanningPage } from "./pages/PlanningPage";
import { SalaryRangesPage } from "./pages/SalaryRangesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { VersionsPage } from "./pages/VersionsPage";
import { PlanAuditPage } from "./pages/PlanAuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { PLAN_SCENARIO_INCLUDES_FACT } from "./data/planScenario";

function LegacyRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

function AnalyticsLegacyRedirect({ tab }: { tab: string }) {
  return <Navigate to={`/analytics?tab=${tab}`} replace />;
}

function App() {
  return (
    <MvpAppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <RequireDemoSession>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/planning" element={<PlanningPage />} />
                  <Route
                    path="/analytics"
                    element={PLAN_SCENARIO_INCLUDES_FACT ? <AnalyticsPage /> : <Navigate to="/planning" replace />}
                  />
                  <Route path="/versions" element={<VersionsPage />} />
                  <Route path="/salary-ranges" element={<SalaryRangesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/audit" element={<PlanAuditPage />} />
                  <Route path="/correction" element={<CorrectionPage />} />
                  <Route path="/plan-vs-actual" element={<LegacyRedirect to="/analytics" />} />
                  <Route path="/deviation" element={<AnalyticsLegacyRedirect tab="deviation" />} />
                  <Route path="/forecast" element={<AnalyticsLegacyRedirect tab="forecast" />} />
                  <Route path="/consolidation" element={<LegacyRedirect to="/versions?tab=consolidation" />} />
                  <Route path="/changes" element={<Navigate to="/audit" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            </RequireDemoSession>
          }
        />
      </Routes>
    </MvpAppProvider>
  );
}

export default App;
