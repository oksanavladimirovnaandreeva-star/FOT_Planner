import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { MvpAppProvider } from "./context/MvpAppContext";
import { DashboardPage } from "./pages/DashboardPage";
import { PlanningPage } from "./pages/PlanningPage";
import { SalaryRangesPage } from "./pages/SalaryRangesPage";
import { PlanVsActualPage } from "./pages/PlanVsActualPage";
import { DeviationPage } from "./pages/DeviationPage";
import { VersionsPage } from "./pages/VersionsPage";
import { ForecastPage } from "./pages/ForecastPage";
import { ChangesJournalPage } from "./pages/ChangesJournalPage";

function App() {
  return (
    <MvpAppProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/salary-ranges" element={<SalaryRangesPage />} />
          <Route path="/plan-vs-actual" element={<PlanVsActualPage />} />
          <Route path="/deviation" element={<DeviationPage />} />
          <Route path="/versions" element={<VersionsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/changes" element={<ChangesJournalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </MvpAppProvider>
  );
}

export default App;
