import React, { createContext, useContext, useState } from "react";

export type ViewMode = "base" | "total";

type Ctx = {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  /** Сумма для отображения: оклад или оклад+премия */
  pickAmount: (base: number, bonus?: number) => number;
};

const ViewModeContext = createContext<Ctx | null>(null);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const v = localStorage.getItem("fot_view_mode");
    return v === "total" ? "total" : "base";
  });

  const setViewMode = (m: ViewMode) => {
    localStorage.setItem("fot_view_mode", m);
    setViewModeState(m);
  };

  const pickAmount = (base: number, bonus = 0) => (viewMode === "total" ? base + bonus : base);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, pickAmount }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const c = useContext(ViewModeContext);
  if (!c) throw new Error("ViewModeProvider required");
  return c;
}
