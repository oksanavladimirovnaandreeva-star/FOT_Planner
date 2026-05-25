import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Planning } from "./pages/Planning";
import { Directories } from "./pages/Directories";
import { PlanVsActual } from "./pages/PlanVsActual";
import { Deviation } from "./pages/Deviation";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "planning", Component: Planning },
      { path: "directories", Component: Directories },
      { path: "plan-vs-actual", Component: PlanVsActual },
      { path: "deviation", Component: Deviation },
    ],
  },
]);
