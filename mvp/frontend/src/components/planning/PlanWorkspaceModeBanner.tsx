import { Link } from "react-router-dom";
import {
  allowedPlanMonthIndexes,
  planEventMonthBlockedMessage,
  type CorrectionWindowInfo,
} from "../../data/planCorrectionWindow";
import { monthLabel } from "../../data/planningData";
import { planWorkspaceBasePath, planWorkspacePath, type PlanWorkspaceMode } from "../../data/planWorkspaceMode";

type Props = {
  mode: PlanWorkspaceMode;
  correctionWindow: CorrectionWindowInfo;
  hasWorkingDraft: boolean;
  isOnWorkingDraft: boolean;
  isAnnualDraft: boolean;
};

export function PlanWorkspaceModeBanner({
  mode,
  correctionWindow,
  hasWorkingDraft,
  isOnWorkingDraft,
  isAnnualDraft,
}: Props) {
  if (mode === "planning" && hasWorkingDraft && isOnWorkingDraft) {
    return (
      <div className="plan-policy-banner plan-policy-banner--workspace" role="status">
        <strong>Квартальный черновик открыт</strong>
        <span>
          Правки по квартальной версии — в разделе{" "}
          <Link to={planWorkspaceBasePath("correction")}>Квартальное планирование</Link>. Здесь — просмотр и годовой контекст.
        </span>
      </div>
    );
  }

  if (mode === "planning" && hasWorkingDraft && !isOnWorkingDraft && !isAnnualDraft) {
    return (
      <div className="plan-policy-banner plan-policy-banner--workspace" role="status">
        <strong>Активна утверждённая версия</strong>
        <span>
          Квартальные события — в{" "}
          <Link to={planWorkspaceBasePath("correction")}>квартальном планировании</Link>
          {correctionWindow.startMonth != null && correctionWindow.enforced
            ? ` (с ${correctionWindow.startMonthLabel})`
            : ""}
          .
        </span>
      </div>
    );
  }

  if (mode === "correction" && !hasWorkingDraft) {
    return (
      <div className="plan-policy-banner plan-policy-banner--workspace plan-policy-banner--warn" role="status">
        <strong>Нет квартального черновика</strong>
        <span>
          Создайте черновик на <Link to="/versions">Версии</Link> (C&B), затем вернитесь сюда.{" "}
          {planEventMonthBlockedMessage(correctionWindow)}
        </span>
      </div>
    );
  }

  if (mode === "correction" && hasWorkingDraft && !isOnWorkingDraft) {
    return (
      <div className="plan-policy-banner plan-policy-banner--workspace" role="status">
        <strong>Откройте квартальный черновик</strong>
        <span>
          Переключите версию в сайдбаре или{" "}
          <Link to={planWorkspacePath("correction", { tab: "positions" })}>обновите страницу</Link> — черновик
          подставится автоматически.
        </span>
      </div>
    );
  }

  if (mode === "correction" && correctionWindow.enforced) {
    const allowed = allowedPlanMonthIndexes(correctionWindow);
    return (
      <div className="plan-policy-banner plan-policy-banner--quarter" role="status">
        <strong>Квартальное планирование</strong>
        <span>{planEventMonthBlockedMessage(correctionWindow)}</span>
        {allowed.length > 0 ? (
          <span className="muted-line">Месяцы для событий: {allowed.map((m) => monthLabel(m)).join(", ")}</span>
        ) : null}
      </div>
    );
  }

  return null;
}
