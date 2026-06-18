import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { routerBasename } from "./appBase";
import { applyAnnualPlanningScenarioFactPolicy } from "./data/planScenario";
import { applyEmergencyStorageResetFromUrl } from "./data/mvpStorageReset";
import "./index.css";
import "./styles/figma-shell.css";
import App from "./App";

applyEmergencyStorageResetFromUrl();
applyAnnualPlanningScenarioFactPolicy();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
