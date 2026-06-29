import { Check, CircleCheck } from "lucide-react";
import { isBudgetLocked, type PlanVersionMeta } from "../../data/planVersions";
import type { VersionRibbonStep } from "../../data/teamLeadApprovalKanban";

type Props = {
  steps: VersionRibbonStep[];
  workingDraft: PlanVersionMeta | null;
  primaryBudget: PlanVersionMeta | null;
};

export function ApprovalVersionRibbon({ steps, workingDraft, primaryBudget }: Props) {
  return (
    <section className="card team-lead-approval__ribbon" aria-label="Лента версий бюджета">
      <ol className="team-lead-approval__ribbon-track">
        {steps.map((step, index) => {
          const isAnnualApproved = step.id === "annual" && step.state === "done";
          return (
            <li
              key={step.id}
              className={`team-lead-approval__ribbon-step team-lead-approval__ribbon-step--${step.state}${isAnnualApproved ? " team-lead-approval__ribbon-step--approved" : ""}`}
            >
              <span
                className={`team-lead-approval__ribbon-dot${step.state === "done" ? " team-lead-approval__ribbon-dot--done" : ""}${step.state === "current" ? " team-lead-approval__ribbon-dot--current" : ""}${isAnnualApproved ? " team-lead-approval__ribbon-dot--approved" : ""}`}
                aria-hidden
              >
                {isAnnualApproved ? (
                  <CircleCheck size={18} strokeWidth={2.25} />
                ) : step.state === "done" ? (
                  <Check size={12} strokeWidth={3} />
                ) : null}
              </span>
              <div>
                <strong>
                  {step.label}
                  {isAnnualApproved ? (
                    <span className="team-lead-approval__ribbon-approved-tag">утверждён</span>
                  ) : null}
                </strong>
                <span className="team-lead-approval__ribbon-state">
                  {isAnnualApproved
                    ? "закрыт для правок"
                    : step.state === "done"
                      ? "готово"
                      : step.state === "current"
                        ? "сейчас"
                        : "далее"}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <span className="team-lead-approval__ribbon-connector" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
      {!workingDraft && primaryBudget && isBudgetLocked(primaryBudget) ? (
        <p className="muted-line team-lead-approval__ribbon-wait">
          C&B ещё не открыл квартальный черновик — дождитесь уведомления или уточните у C&B.
        </p>
      ) : null}
    </section>
  );
}
