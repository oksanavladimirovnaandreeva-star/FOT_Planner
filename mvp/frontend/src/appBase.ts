/** Vite `base` → React Router `basename` (без завершающего слэша). */
export function routerBasename(): string {
  const base = import.meta.env.BASE_URL;
  if (!base || base === "/") return "";
  return base.replace(/\/$/, "");
}
