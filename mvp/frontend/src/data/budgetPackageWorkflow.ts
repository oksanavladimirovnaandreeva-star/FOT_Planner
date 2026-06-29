import type { BudgetTeamRow } from "./buildBudgetPackage";
import type { PackagePhase } from "./packageSubmissionStore";
import type { TeamApprovalSubmissionMode } from "./teamApprovalDiff";

const SUBMITTED_TEAM_STATUSES = new Set([
  "team_submitted",
  "unit_approved",
  "director_approved",
  "cb_review",
  "cb_submitted",
]);

export function canSubmitBudgetPackage(phase: PackagePhase | undefined): boolean {
  const current = phase ?? "collecting";
  return current === "collecting" || current === "returned";
}

export function canApproveBudgetPackage(phase: PackagePhase | undefined): boolean {
  return phase === "submitted";
}

export function canReturnBudgetPackage(phase: PackagePhase | undefined): boolean {
  return phase === "submitted" || phase === "approved";
}

export function countQuarterlyTeamsSubmitted(teams: BudgetTeamRow[]): number {
  return teams.filter((team) => SUBMITTED_TEAM_STATUSES.has(team.displayStatus)).length;
}

export function packageSubmitConfirmMessage(input: {
  label: string;
  submissionMode: TeamApprovalSubmissionMode;
  teamsSubmitted: number;
  teamsTotal: number;
}): string {
  const { label, submissionMode, teamsSubmitted, teamsTotal } = input;
  if (submissionMode === "annual") {
    return `${label}?\n\nГодовой бюджет будет отправлен в C&B для проверки.`;
  }
  return `${label}?\n\nСдано команд: ${teamsSubmitted} из ${teamsTotal}. Можно отправить частично.`;
}

export function packageTeamsProgressLine(input: {
  submissionMode: TeamApprovalSubmissionMode;
  teamsSubmitted: number;
  teamsTotal: number;
  teamsAwaitingUnit: number;
}): string {
  const { submissionMode, teamsSubmitted, teamsTotal, teamsAwaitingUnit } = input;

  if (submissionMode === "annual") {
    let line = `Команд в сводке: ${teamsTotal}`;
    if (teamsAwaitingUnit > 0) {
      line += ` · ждут согласования юнит-лида: ${teamsAwaitingUnit}`;
    }
    return line;
  }

  let line = `Команды сданы: ${teamsSubmitted} из ${teamsTotal}`;
  if (teamsAwaitingUnit > 0) {
    line += ` · ждут согласования юнит-лида: ${teamsAwaitingUnit}`;
  }
  return line;
}

export function packageStatusHint(submissionMode: TeamApprovalSubmissionMode): string {
  if (submissionMode === "annual") {
    return "Годовой бюджет: отправьте пакет в C&B, когда сводка готова.";
  }
  return "Квартальный цикл: команды сдают план, затем отправляется пакет.";
}
