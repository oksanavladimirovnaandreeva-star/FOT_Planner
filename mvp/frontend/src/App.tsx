import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { MvpAppProvider } from "./context/MvpAppContext";
import { DashboardPage } from "./pages/DashboardPage";
import { CorrectionPage } from "./pages/CorrectionPage";
import { PlanningPage } from "./pages/PlanningPage";
import { SalaryRangesPage } from "./pages/SalaryRangesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { VersionsPage } from "./pages/VersionsPage";
import { PlanAuditPage } from "./pages/PlanAuditPage";
import { SettingsPage } from "./pages/SettingsPage";

function LegacyRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

function AnalyticsLegacyRedirect({ tab }: { tab: string }) {
  return <Navigate to={`/analytics?tab=${tab}`} replace />;
}

function App() {
  return (
    <MvpAppProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
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
    </MvpAppProvider>
  );
}

export default App;
