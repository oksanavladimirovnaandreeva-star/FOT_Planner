import type { CatalogVisibilityRule, SalaryRangeBand } from "../types";
import type { UserRole } from "./userAccess";

export function defaultCatalogVisibilityForRole(role: UserRole): CatalogVisibilityRule {
  if (role === "cb_admin") {
    return { specs: "*", levels: "*", access: "write" };
  }
  if (role === "viewer") {
    return { specs: "*", levels: "*", access: "none" };
  }
  return { specs: "*", levels: "*", access: "read" };
}

export function bandMatchesCatalogVisibility(
  band: SalaryRangeBand,
  rule: CatalogVisibilityRule,
): boolean {
  if (rule.access === "none") return false;
  if (rule.specs !== "*" && rule.specs.length === 0) return false;
  if (rule.levels !== "*" && rule.levels.length === 0) return false;
  if (rule.specs !== "*" && !rule.specs.includes(band.specialization)) return false;
  if (rule.levels !== "*" && !rule.levels.includes(band.level)) return false;
  return true;
}

export function parseCsvOrStar(value: string): string[] | "*" {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "*") return "*";
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatVisibilityField(value: string[] | "*"): string {
  return value === "*" ? "*" : value.join(", ");
}
