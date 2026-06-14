/** Оргструктура демо-плана: департамент → юнит → команды. */
export const ORG_STRUCTURE: Record<string, Record<string, string[]>> = {
  Engineering: {
    Platform: ["Backend Core", "Infrastructure", "DevOps"],
    ProductDev: ["Frontend Web", "Mobile", "QA"],
  },
  Product: {
    Core: ["PM Team A", "PM Team B"],
    Analytics: ["Research", "Insights"],
  },
  Marketing: {
    Brand: ["Content", "SMM"],
    Growth: ["Performance", "CRM"],
  },
  Sales: {
    Enterprise: ["Key Accounts", "Partners"],
    Retail: ["Online", "Offline"],
  },
  HR: {
    People: ["Recruiting", "L&D"],
    Ops: ["Payroll", "Admin"],
  },
};

export const departmentOptions = Object.keys(ORG_STRUCTURE);

export function unitOptions(department: string): string[] {
  return Object.keys(ORG_STRUCTURE[department] ?? {});
}

export function teamOptions(department: string, unit: string): string[] {
  return ORG_STRUCTURE[department]?.[unit] ?? [];
}
