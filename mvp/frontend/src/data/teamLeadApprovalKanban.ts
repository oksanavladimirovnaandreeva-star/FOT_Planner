import { isBudgetLocked, quarterCorrectionLabel, type PlanVersionMeta } from "./planVersions";
import type { TeamSubmissionPhase, TeamSubmissionRecord } from "./teamSubmissionStore";

export type TeamLeadKanbanColumn = "in_progress" | "in_approval" | "returned" | "published";

export const TEAM_LEAD_KANBAN_COLUMNS: {
  id: TeamLeadKanbanColumn;
  title: string;
  hint: string;
}[] = [
  {
    id: "in_progress",
    title: "В работе",
    hint: "Правки в квартальном планировании, затем «Сдать команду».",
  },
  {
    id: "in_approval",
    title: "На согласовании",
    hint: "Правки закрыты до решения юнит-лида, директора и C&B.",
  },
  {
    id: "returned",
    title: "На доработке",
    hint: "Вернул согласующий — исправьте и сдайте снова.",
  },
  {
    id: "published",
    title: "Бюджет опубликован",
    hint: "Квартальная версия утверждена C&B.",
  },
];

export type VersionRibbonStep = {
  id: string;
  label: string;
  state: "done" | "current" | "pending";
};

export function submissionApprovalSubstep(record: TeamSubmissionRecord | null): string | null {
  if (!record) return null;
  switch (record.phase) {
    case "team_submitted":
      return "Ожидает юнит-лида";
    case "unit_approved":
      return "Ожидает директора";
    case "director_approved":
      return "Ожидает C&B";
    case "cb_review":
      return "На проверке C&B";
    default:
      return null;
  }
}

export function resolveTeamLeadKanbanColumn(input: {
  workingDraft: PlanVersionMeta | null;
  latestApproved: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
  submission: TeamSubmissionRecord | null;
}): TeamLeadKanbanColumn {
  const { workingDraft, latestApproved, primaryBudget, submission } = input;
  const quarterlyPublished = Boolean(latestApproved && latestApproved.versionNumber > 1);

  if (!workingDraft && quarterlyPublished && primaryBudget && isBudgetLocked(primaryBudget)) {
    return "published";
  }

  if (!workingDraft) {
    return "in_progress";
  }

  const phase: TeamSubmissionPhase = submission?.phase ?? "editing";
  if (phase === "returned") return "returned";
  if (
    phase === "team_submitted" ||
    phase === "unit_approved" ||
    phase === "director_approved" ||
    phase === "cb_review"
  ) {
    return "in_approval";
  }

  return "in_progress";
}

export function buildTeamLeadVersionRibbon(input: {
  primaryBudget: PlanVersionMeta | null;
  workingDraft: PlanVersionMeta | null;
  latestApproved: PlanVersionMeta | null;
}): VersionRibbonStep[] {
  const { primaryBudget, workingDraft, latestApproved } = input;
  const planYear = primaryBudget?.planYear ?? workingDraft?.planYear ?? latestApproved?.planYear ?? 2026;
  const annualDone = Boolean(primaryBudget && isBudgetLocked(primaryBudget));
  const publishedQuarterly =
    latestApproved && latestApproved.versionNumber > 1 ? latestApproved : null;

  const nextQuarterForDraft = Math.min(4, Math.max(1, latestApproved?.versionNumber ?? 1));

  const draftLabel = workingDraft
    ? workingDraft.label
    : quarterCorrectionLabel(planYear, nextQuarterForDraft);

  let draftState: VersionRibbonStep["state"] = "pending";
  if (workingDraft) {
    draftState = workingDraft.status === "IN_APPROVAL" ? "done" : "current";
  } else if (annualDone && !publishedQuarterly) {
    draftState = "pending";
  } else if (publishedQuarterly) {
    draftState = "done";
  }

  let publishedState: VersionRibbonStep["state"] = "pending";
  if (publishedQuarterly && !workingDraft) {
    publishedState = "done";
  } else if (publishedQuarterly && workingDraft) {
    publishedState = "done";
  }

  const publishedLabel = publishedQuarterly
    ? publishedQuarterly.label
    : quarterCorrectionLabel(planYear, Math.max(1, nextQuarterForDraft));

  return [
    {
      id: "annual",
      label: primaryBudget?.label ?? `Бюджет ${planYear}`,
      state: annualDone ? "done" : primaryBudget ? "current" : "pending",
    },
    {
      id: "draft",
      label: `${draftLabel} · черновик`,
      state: draftState,
    },
    {
      id: "published",
      label: publishedLabel,
      state: publishedState,
    },
  ];
}

/** Подсказка в колонке «Бюджет опубликован» про следующий квартальный цикл. */
export function formatNextQuarterVersionHint(input: {
  planYear: number;
  latestPublishedVersionNumber: number;
}): string {
  const publishedQuarter = Math.max(1, Math.min(4, input.latestPublishedVersionNumber - 1));
  const nextQuarter = Math.min(4, publishedQuarter + 1);
  const nextLabel = quarterCorrectionLabel(input.planYear, nextQuarter);
  const currentLabel = quarterCorrectionLabel(input.planYear, publishedQuarter);

  if (publishedQuarter >= 4) {
    return `Опубликован ${currentLabel}. Следующий цикл — новый годовой бюджет; C&B откроет планирование отдельно.`;
  }

  return (
    `Опубликован ${currentLabel}. Следующие корректировки — в версии «${nextLabel}»: C&B создаст квартальный черновик в начале цикла. ` +
    `До открытия черновика доступен только просмотр; правки прошлых месяцев в утверждённой версии не вносятся.`
  );
}
