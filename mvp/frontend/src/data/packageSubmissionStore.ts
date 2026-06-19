import type { PlanVersionMeta } from "./planVersions";
import type { UserRole } from "./userAccess";
import { canRolePerformSubmissionAction, type SubmissionWorkflowAction } from "./submissionWorkflowPolicy";

export type PackageLevel = "unit" | "department";

export type PackagePhase =
  | "collecting"
  | "submitted"
  | "returned"
  | "approved"
  | "cb_review"
  | "published";

export type PackageSubmissionRecord = {
  phase: PackagePhase;
  submittedAt?: string;
  approvedAt?: string;
  cbReviewAt?: string;
  returnedAt?: string;
  returnedNote?: string;
};

export type BudgetPipelineStep =
  | "in_progress"
  | "teams_submitting"
  | "awaiting_unit"
  | "at_director"
  | "at_cb"
  | "published";

const STORAGE_KEY = "mvp.packageSubmissions";

type StoredPackages = Record<string, PackageSubmissionRecord>;

const ALLOWED: Record<PackagePhase, PackagePhase[]> = {
  collecting: ["submitted"],
  submitted: ["approved", "returned"],
  returned: ["collecting", "submitted"],
  approved: ["cb_review", "returned"],
  cb_review: ["published", "returned"],
  published: [],
};

function packageKey(
  planVersionId: string,
  level: PackageLevel,
  department: string,
  unit: string | null,
): string {
  return `${planVersionId}\0${level}\0${department}\0${unit ?? ""}`;
}

function readAll(): StoredPackages {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredPackages;
  } catch {
    return {};
  }
}

function writeAll(data: StoredPackages): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export const PACKAGE_PHASE_LABELS: Record<PackagePhase, string> = {
  collecting: "В работе",
  submitted: "Отправлено на согласование",
  returned: "Возврат на доработку",
  approved: "Согласовано",
  cb_review: "На проверке C&B",
  published: "Опубликовано",
};

export const BUDGET_PIPELINE_LABELS: Record<BudgetPipelineStep, string> = {
  in_progress: "В работе",
  teams_submitting: "Команды сдают бюджет",
  awaiting_unit: "Ожидает согласования юнит-лида",
  at_director: "У директора",
  at_cb: "У C&B",
  published: "Бюджет опубликован",
};

export function getPackageSubmission(input: {
  planVersionId: string;
  level: PackageLevel;
  department: string;
  unit: string | null;
}): PackageSubmissionRecord | null {
  const all = readAll();
  return all[packageKey(input.planVersionId, input.level, input.department, input.unit)] ?? null;
}

export function resolveBudgetPipelineStep(input: {
  level: PackageLevel;
  packageSubmission: PackageSubmissionRecord | null;
  teamsSubmitted: number;
  teamsTotal: number;
  teamsAwaitingUnit: number;
  workingDraft: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
}): BudgetPipelineStep {
  const { packageSubmission, teamsSubmitted, teamsTotal, teamsAwaitingUnit, workingDraft, primaryBudget } =
    input;

  if (workingDraft?.status === "APPROVED" || primaryBudget?.status === "APPROVED") {
    const published = latestApprovedIsActive(workingDraft, primaryBudget);
    if (published && !workingDraft) return "published";
  }

  const phase = packageSubmission?.phase ?? "collecting";
  if (phase === "published") return "published";
  if (phase === "cb_review") return "at_cb";
  if (phase === "approved") return "at_cb";
  if (phase === "submitted") {
    return input.level === "unit" ? "at_director" : "at_cb";
  }
  if (phase === "returned") return "in_progress";

  if (teamsAwaitingUnit > 0) return "awaiting_unit";
  if (teamsSubmitted > 0 && teamsSubmitted < teamsTotal) return "teams_submitting";
  if (teamsSubmitted === teamsTotal && teamsTotal > 0) return "awaiting_unit";
  return "in_progress";
}

function latestApprovedIsActive(
  workingDraft: PlanVersionMeta | null,
  primaryBudget: PlanVersionMeta | null,
): boolean {
  void workingDraft;
  return Boolean(primaryBudget && primaryBudget.status === "APPROVED" && primaryBudget.versionNumber > 1);
}

function actionForSubmit(level: PackageLevel): SubmissionWorkflowAction {
  return level === "unit" ? "package_submit_unit" : "package_submit_department";
}

function actionForApprove(level: PackageLevel): SubmissionWorkflowAction {
  return level === "unit" ? "package_approve_unit" : "package_approve_department";
}

export function applyPackageSubmissionAction(input: {
  planVersionId: string;
  level: PackageLevel;
  department: string;
  unit: string | null;
  action: SubmissionWorkflowAction;
  actorRole: UserRole;
  note?: string;
}): { ok: true } | { ok: false; error: string } {
  const { planVersionId, level, department, unit, action, actorRole, note } = input;
  const key = packageKey(planVersionId, level, department, unit);
  const all = readAll();
  const existing = all[key];
  const current = existing?.phase ?? "collecting";
  const now = new Date().toISOString();

  if (action === "package_submit_unit" || action === "package_submit_department") {
    if (
      !canRolePerformSubmissionAction(action, {
        actorRole,
        targetDepartment: department,
        targetUnit: unit ?? "",
        targetTeam: "",
      })
    ) {
      return { ok: false, error: "Недостаточно прав." };
    }
    if (!ALLOWED[current]?.includes("submitted")) {
      return { ok: false, error: "Пакет уже отправлен или закрыт." };
    }
    all[key] = { ...existing, phase: "submitted", submittedAt: now };
    writeAll(all);
    return { ok: true };
  }

  if (action === "package_approve_unit" || action === "package_approve_department") {
    if (
      !canRolePerformSubmissionAction(action, {
        actorRole,
        targetDepartment: department,
        targetUnit: unit ?? "",
        targetTeam: "",
      })
    ) {
      return { ok: false, error: "Недостаточно прав." };
    }
    if (!ALLOWED[current]?.includes("approved")) {
      return { ok: false, error: "Нет пакета на согласовании." };
    }
    all[key] = { ...existing, phase: "approved", approvedAt: now };
    writeAll(all);
    return { ok: true };
  }

  if (action === "package_return") {
    if (
      !canRolePerformSubmissionAction(action, {
        actorRole,
        targetDepartment: department,
        targetUnit: unit ?? "",
        targetTeam: "",
      })
    ) {
      return { ok: false, error: "Недостаточно прав." };
    }
    if (current !== "submitted" && current !== "approved") {
      return { ok: false, error: "Нечего возвращать." };
    }
    all[key] = {
      ...existing,
      phase: "returned",
      returnedAt: now,
      returnedNote: note?.trim() || undefined,
    };
    writeAll(all);
    return { ok: true };
  }

  if (action === "package_cb_review") {
    if (
      !canRolePerformSubmissionAction(action, {
        actorRole,
        targetDepartment: department,
        targetUnit: unit ?? "",
        targetTeam: "",
      })
    ) {
      return { ok: false, error: "Недостаточно прав." };
    }
    if (!ALLOWED[current]?.includes("cb_review")) {
      return { ok: false, error: "Пакет не готов к приёму C&B." };
    }
    all[key] = { ...existing, phase: "cb_review", cbReviewAt: now };
    writeAll(all);
    return { ok: true };
  }

  void actionForSubmit;
  void actionForApprove;
  return { ok: false, error: "Неизвестное действие." };
}

export function clearPackageSubmissionsForPlan(planVersionId: string): void {
  const all = readAll();
  const next: StoredPackages = {};
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(`${planVersionId}\0`)) next[key] = value;
  }
  writeAll(next);
}
