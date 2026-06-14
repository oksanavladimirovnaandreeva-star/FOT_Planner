import { Link } from "react-router-dom";
import {
  allowedPlanMonthIndexes,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import { monthLabel } from "../../data/planningData";
import type { IndexationBatchLog } from "../../data/planningData";
import { planWorkspaceBasePath, planWorkspacePath, type PlanWorkspaceMode } from "../../data/planWorkspaceMode";

type ContextLine = {
  id: string;
  tone: "freeze-blocked" | "freeze" | "quarter" | "workspace" | "readonly" | "indexation";
  title: string;
  body?: string;
  link?: { to: string; label: string };
};

type Props = {
  workspaceMode: PlanWorkspaceMode;
  correctionWindow: CorrectionWindowInfo;
  hasWorkingDraft: boolean;
  isOnWorkingDraft: boolean;
  isAnnualDraft: boolean;
  canEditWorkspace: boolean;
  canEditPlan: boolean;
  leadEditFrozenForRole: boolean;
  leadEditFrozen: boolean;
  canToggleLeadFreeze: boolean;
  indexationBatches: IndexationBatchLog[];
};

function toneClass(tone: ContextLine["tone"]): string {
  switch (tone) {
    case "freeze-blocked":
      return "plan-policy-banner--freeze plan-policy-banner--freeze-blocked";
    case "freeze":
      return "plan-policy-banner--freeze";
    case "quarter":
      return "plan-policy-banner--quarter";
    case "indexation":
      return "plan-policy-banner--indexation";
    default:
      return "plan-policy-banner--workspace";
  }
}

function buildLines(props: Props): ContextLine[] {
  const {
    workspaceMode,
    correctionWindow,
    hasWorkingDraft,
    isOnWorkingDraft,
    isAnnualDraft,
    canEditWorkspace,
    canEditPlan,
    leadEditFrozenForRole,
    leadEditFrozen,
    canToggleLeadFreeze,
    indexationBatches,
  } = props;
  const lines: ContextLine[] = [];

  if (leadEditFrozenForRole) {
    lines.push({
      id: "freeze-blocked",
      tone: "freeze-blocked",
      title: "Правки закрыты директором",
      body: "План и факт доступны только для просмотра.",
    });
  } else if (leadEditFrozen && canToggleLeadFreeze) {
    lines.push({
      id: "freeze-managing",
      tone: "freeze",
      title: "Правки лидов заморожены",
      body: "Тимлиды и юнит-лиды не могут менять черновик.",
    });
  }

  if (!canEditWorkspace && canEditPlan) {
    lines.push({
      id: "readonly-workspace",
      tone: "readonly",
      title:
        workspaceMode === "correction"
          ? "Квартальный черновик: правки с открытого месяца"
          : "Годовое планирование: квартальные правки — в режиме «Корректировка»",
    });
  } else if (!canEditPlan) {
    lines.push({
      id: "readonly-version",
      tone: "readonly",
      title: "Версия только для просмотра",
      body: hasWorkingDraft ? "Правки — в квартальном черновике." : "Создайте черновик на «Версии».",
      link: { to: "/versions", label: "Версии" },
    });
  } else if (isAnnualDraft && workspaceMode === "planning") {
    lines.push({
      id: "annual-draft",
      tone: "readonly",
      title: "Бюджет v1 ещё не утверждён",
      body: "После правок — утвердите на «Версии».",
      link: { to: "/versions?tab=approval", label: "Утвердить" },
    });
  }

  if (workspaceMode === "planning" && hasWorkingDraft && isOnWorkingDraft) {
    lines.push({
      id: "draft-open",
      tone: "workspace",
      title: "Квартальный черновик открыт",
      body: "Правки с ограничением по месяцам — в «Корректировке».",
      link: { to: planWorkspaceBasePath("correction"), label: "Корректировка" },
    });
  } else if (workspaceMode === "planning" && hasWorkingDraft && !isOnWorkingDraft && !isAnnualDraft) {
    lines.push({
      id: "approved-active",
      tone: "workspace",
      title: "Активна утверждённая версия",
      body: `Квартальные события — в «Корректировке»${correctionWindow.startMonth != null ? ` с ${correctionWindow.startMonthLabel}` : ""}.`,
      link: { to: planWorkspaceBasePath("correction"), label: "Корректировка" },
    });
  } else if (workspaceMode === "correction" && !hasWorkingDraft) {
    lines.push({
      id: "no-draft",
      tone: "quarter",
      title: "Нет квартального черновика",
      body: "Создайте черновик на «Версии» (C&B).",
      link: { to: "/versions", label: "Версии" },
    });
  } else if (workspaceMode === "correction" && hasWorkingDraft && !isOnWorkingDraft) {
    lines.push({
      id: "open-draft",
      tone: "quarter",
      title: "Откройте квартальный черновик",
      body: "Переключите версию в сайдбаре.",
      link: { to: planWorkspacePath("correction", { tab: "positions" }), label: "Открыть" },
    });
  } else if (workspaceMode === "correction" && correctionWindow.enforced) {
    const allowed = allowedPlanMonthIndexes(correctionWindow);
    lines.push({
      id: "correction-window",
      tone: "quarter",
      title: "Квартальная корректировка",
      body:
        allowed.length > 0
          ? `${planEventMonthBlockedMessage(correctionWindow)} · ${allowed.map((m) => monthLabel(m)).join(", ")}`
          : planEventMonthBlockedMessage(correctionWindow),
    });
  }

  if (indexationBatches.length > 0) {
    const latest = [...indexationBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    lines.push({
      id: "indexation",
      tone: "indexation",
      title: `Индексация +${latest.percent}% с ${monthLabel(latest.month)}`,
      body: `${latest.affectedCount} поз.${indexationBatches.length > 1 ? ` · пакетов: ${indexationBatches.length}` : ""}`,
    });
  }

  return lines;
}

function ContextLineContent({ line }: { line: ContextLine }) {
  return (
    <div className="plan-context-bar__line">
      <strong>{line.title}</strong>
      {line.body ? <span>{line.body}</span> : null}
      {line.link ? (
        <Link to={line.link.to} className="plan-context-bar__link">
          {line.link.label}
        </Link>
      ) : null}
    </div>
  );
}

export function PlanContextBar(props: Props) {
  const lines = buildLines(props);

  if (lines.length === 0) return null;

  return (
    <div className="plan-context-bar">
      {lines.map((line) => (
        <div key={line.id} className={`plan-policy-banner ${toneClass(line.tone)}`} role="status">
          <ContextLineContent line={line} />
        </div>
      ))}
    </div>
  );
}
