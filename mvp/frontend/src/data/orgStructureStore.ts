/** Демо-хранилище оргструктуры: localStorage + журнал изменений. */

export type OrgTree = Record<string, Record<string, string[]>>;

export type OrgHistoryEntry = {
  id: string;
  at: string;
  action: "import_replace" | "import_merge" | "reset_seed";
  fileName?: string;
  summary: string;
  departmentCount: number;
  unitCount: number;
  teamCount: number;
};

export const DEFAULT_ORG_TREE: OrgTree = {
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

const TREE_KEY = "fot_mvp_org_tree";
const HISTORY_KEY = "fot_mvp_org_history";
const MAX_HISTORY = 40;

function cloneTree(tree: OrgTree): OrgTree {
  const next: OrgTree = {};
  for (const [department, units] of Object.entries(tree)) {
    next[department] = {};
    for (const [unit, teams] of Object.entries(units)) {
      next[department][unit] = [...teams];
    }
  }
  return next;
}

export function countOrgNodes(tree: OrgTree): { departmentCount: number; unitCount: number; teamCount: number } {
  let unitCount = 0;
  let teamCount = 0;
  for (const units of Object.values(tree)) {
    unitCount += Object.keys(units).length;
    for (const teams of Object.values(units)) {
      teamCount += teams.length;
    }
  }
  return { departmentCount: Object.keys(tree).length, unitCount, teamCount };
}

export function readOrgTree(): OrgTree {
  try {
    const raw = localStorage.getItem(TREE_KEY);
    if (!raw) return cloneTree(DEFAULT_ORG_TREE);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return cloneTree(DEFAULT_ORG_TREE);
    return normalizeOrgTree(parsed as OrgTree);
  } catch {
    return cloneTree(DEFAULT_ORG_TREE);
  }
}

export function writeOrgTree(tree: OrgTree): void {
  localStorage.setItem(TREE_KEY, JSON.stringify(normalizeOrgTree(tree)));
}

export function listOrgHistory(): OrgHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OrgHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function appendHistory(partial: Omit<OrgHistoryEntry, "id" | "at">): OrgHistoryEntry {
  const entry: OrgHistoryEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...partial,
  };
  const next = [entry, ...listOrgHistory()].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return entry;
}

function normalizeOrgTree(tree: OrgTree): OrgTree {
  const next: OrgTree = {};
  for (const [department, units] of Object.entries(tree)) {
    const dept = String(department).trim();
    if (!dept || !units || typeof units !== "object") continue;
    next[dept] = next[dept] ?? {};
    for (const [unit, teams] of Object.entries(units)) {
      const unitName = String(unit).trim();
      if (!unitName || !Array.isArray(teams)) continue;
      const uniqueTeams = [...new Set(teams.map((team) => String(team).trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      );
      if (uniqueTeams.length === 0) continue;
      next[dept][unitName] = uniqueTeams;
    }
    if (Object.keys(next[dept]).length === 0) delete next[dept];
  }
  return next;
}

export function mergeOrgTrees(base: OrgTree, incoming: OrgTree): OrgTree {
  const merged = cloneTree(base);
  for (const [department, units] of Object.entries(incoming)) {
    merged[department] = merged[department] ?? {};
    for (const [unit, teams] of Object.entries(units)) {
      const existing = new Set(merged[department][unit] ?? []);
      for (const team of teams) existing.add(team);
      merged[department][unit] = [...existing].sort((a, b) => a.localeCompare(b, "ru"));
    }
  }
  return merged;
}

function detectDelimiter(headerLine: string): "," | ";" {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

const HEADER_ALIASES: Record<string, "department" | "unit" | "team"> = {
  department: "department",
  dept: "department",
  департамент: "department",
  unit: "unit",
  юнит: "unit",
  team: "team",
  команда: "team",
};

export function parseOrgCsv(text: string): { tree: OrgTree; rowCount: number; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length === 0) {
    return { tree: {}, rowCount: 0, errors: ["Файл пуст."] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = lines[0].split(delimiter).map((cell) => normalizeHeader(cell));
  const columnIndex: Partial<Record<"department" | "unit" | "team", number>> = {};
  headerCells.forEach((cell, index) => {
    const mapped = HEADER_ALIASES[cell];
    if (mapped) columnIndex[mapped] = index;
  });

  const hasHeader = columnIndex.department != null && columnIndex.unit != null && columnIndex.team != null;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (!hasHeader) {
    if (lines[0].split(delimiter).length < 3) {
      return { tree: {}, rowCount: 0, errors: ["Ожидаются колонки: department, unit, team."] };
    }
    columnIndex.department = 0;
    columnIndex.unit = 1;
    columnIndex.team = 2;
  }

  const tree: OrgTree = {};
  let rowCount = 0;

  for (let lineIndex = 0; lineIndex < dataLines.length; lineIndex += 1) {
    const cells = dataLines[lineIndex].split(delimiter).map((cell) => cell.trim());
    const department = cells[columnIndex.department ?? 0] ?? "";
    const unit = cells[columnIndex.unit ?? 1] ?? "";
    const team = cells[columnIndex.team ?? 2] ?? "";
    if (!department || !unit || !team) {
      errors.push(`Строка ${hasHeader ? lineIndex + 2 : lineIndex + 1}: не заполнены department / unit / team.`);
      continue;
    }
    tree[department] = tree[department] ?? {};
    tree[department][unit] = tree[department][unit] ?? [];
    if (!tree[department][unit].includes(team)) {
      tree[department][unit].push(team);
    }
    rowCount += 1;
  }

  return { tree: normalizeOrgTree(tree), rowCount, errors };
}

export function importOrgTree(
  incoming: OrgTree,
  mode: "replace" | "merge",
  fileName?: string,
): { entry: OrgHistoryEntry; tree: OrgTree } {
  const before = readOrgTree();
  const after = mode === "replace" ? normalizeOrgTree(incoming) : mergeOrgTrees(before, incoming);
  writeOrgTree(after);
  const counts = countOrgNodes(after);
  const beforeCounts = countOrgNodes(before);
  const summary =
    mode === "replace"
      ? `Замена дерева: ${counts.departmentCount} деп. · ${counts.teamCount} команд`
      : `Дополнение: было ${beforeCounts.teamCount} команд → стало ${counts.teamCount}`;
  const entry = appendHistory({
    action: mode === "replace" ? "import_replace" : "import_merge",
    fileName,
    summary,
    ...counts,
  });
  return { entry, tree: after };
}

export function resetOrgTreeToSeed(): OrgHistoryEntry {
  const tree = cloneTree(DEFAULT_ORG_TREE);
  writeOrgTree(tree);
  const counts = countOrgNodes(tree);
  return appendHistory({
    action: "reset_seed",
    summary: "Сброс к демо-дереву по умолчанию",
    ...counts,
  });
}
