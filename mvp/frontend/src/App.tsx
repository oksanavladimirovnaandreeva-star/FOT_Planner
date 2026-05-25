import { Navigate, Route, Routes } from "react-router-dom";
import { PlanningPage } from "./pages/PlanningPage";

function App() {
  return (
    <Routes>
      <Route path="/planning" element={<PlanningPage />} />
      <Route path="*" element={<Navigate to="/planning" replace />} />
    </Routes>
  );
}

export default App;
