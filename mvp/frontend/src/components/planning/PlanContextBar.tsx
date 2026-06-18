import { Link } from "react-router-dom";
import {
  allowedPlanMonthIndexes,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import { monthLabel } from "../../data/planningData";
import { planWorkspaceBasePath, planWorkspacePath, type PlanWorkspaceMode } from "../../data/planWorkspaceMode";
import { useMvpApp } from "../../context/MvpAppContext";
import { formatPlanVersionTitle } from "../../data/planVersionDisplay";

type ContextLine = {
  id: string;
  tone: "freeze-blocked" | "freeze" | "quarter" | "workspace" | "readonly";
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
  primaryBudgetTitle?: string;
};

function toneClass(tone: ContextLine["tone"]): string {
  switch (tone) {
    case "freeze-blocked":
      return "plan-policy-banner--freeze plan-policy-banner--freeze-blocked";
    case "freeze":
      return "plan-policy-banner--freeze";
    case "quarter":
      return "plan-policy-banner--quarter";
    default:
      return "plan-policy-banner--workspace";
  }
}

function buildLines(props: Props & { canManagePlanVersions: boolean }): ContextLine[] {
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
    canManagePlanVersions,
  } = props;
  const lines: ContextLine[] = [];

  if (leadEditFrozenForRole) {
    lines.push({
      id: "freeze-blocked",
      tone: "freeze-blocked",
      title: "Правки закрыты директором",
      body: "План доступен только для просмотра.",
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
          ? "Квартальный черновик: правки только с открытого месяца"
          : "Годовое планирование: квартальные правки — в «Квартальном планировании»",
    });
  } else if (!canEditPlan) {
    lines.push({
      id: "readonly-version",
      tone: "readonly",
      title: "Версия только для просмотра",
      body: hasWorkingDraft
        ? "Правки — в квартальном черновике (см. «Работаем в» в сайдбаре)."
        : canManagePlanVersions
          ? "Создайте черновик на «Версии»."
          : "Ожидайте квартальный черновик от C&B.",
      link: canManagePlanVersions ? { to: "/versions", label: "Версии" } : undefined,
    });
  } else if (isAnnualDraft && workspaceMode === "planning" && canManagePlanVersions) {
    const annualTitle = props.primaryBudgetTitle ?? "Бюджет";
    lines.push({
      id: "annual-draft",
      tone: "readonly",
      title: `${annualTitle} ещё не утверждён`,
      body: `После правок — утвердите на «Версии».`,
      link: { to: "/versions", label: "Утвердить" },
    });
  }

  if (workspaceMode === "planning" && hasWorkingDraft && isOnWorkingDraft) {
    lines.push({
      id: "draft-open",
      tone: "workspace",
      title: "Квартальный черновик открыт",
      body: "Правки по квартальной версии — в «Квартальном планировании».",
      link: { to: planWorkspaceBasePath("correction"), label: "Квартальное планирование" },
    });
  } else if (workspaceMode === "planning" && hasWorkingDraft && !isOnWorkingDraft && !isAnnualDraft) {
    lines.push({
      id: "approved-active",
      tone: "workspace",
      title: "Активна утверждённая версия",
      body: `Квартальные события — в «Квартальном планировании»${correctionWindow.startMonth != null && correctionWindow.enforced ? ` с ${correctionWindow.startMonthLabel}` : ""}.`,
      link: { to: planWorkspaceBasePath("correction"), label: "Квартальное планирование" },
    });
  } else if (workspaceMode === "correction" && !hasWorkingDraft) {
    lines.push({
      id: "no-draft",
      tone: "quarter",
      title: "Нет квартального черновика",
      body: canManagePlanVersions
        ? "Создайте черновик на «Версии»."
        : "C&B создаст квартальный черновик — следите за блоком «Работаем в» в сайдбаре.",
      link: canManagePlanVersions ? { to: "/versions", label: "Версии" } : undefined,
    });
  } else if (workspaceMode === "correction" && hasWorkingDraft && !isOnWorkingDraft) {
    lines.push({
      id: "open-draft",
      tone: "quarter",
      title: "Откройте квартальный черновик",
      body: "Перейдите в квартальное планирование — черновик подхватится автоматически.",
      link: { to: planWorkspacePath("correction", { tab: "positions" }), label: "Квартальное планирование" },
    });
  } else if (workspaceMode === "correction" && correctionWindow.enforced) {
    const allowed = allowedPlanMonthIndexes(correctionWindow);
    lines.push({
      id: "correction-window",
      tone: "quarter",
      title: "Квартальное планирование",
      body:
        allowed.length > 0
          ? `${planEventMonthBlockedMessage(correctionWindow)} · ${allowed.map((m) => monthLabel(m)).join(", ")}`
          : planEventMonthBlockedMessage(correctionWindow),
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
  const { primaryBudget, canManagePlanVersions } = useMvpApp();
  const primaryBudgetTitle =
    props.primaryBudgetTitle ??
    (primaryBudget ? formatPlanVersionTitle(primaryBudget) : undefined);
  const lines = buildLines({ ...props, primaryBudgetTitle, canManagePlanVersions });

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
