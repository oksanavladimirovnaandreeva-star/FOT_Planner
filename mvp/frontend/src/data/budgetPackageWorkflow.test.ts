import { describe, expect, it } from "vitest";
import {
  canSubmitBudgetPackage,
  packageStatusHint,
  packageSubmitConfirmMessage,
  packageTeamsProgressLine,
} from "./budgetPackageWorkflow";

describe("budgetPackageWorkflow", () => {
  it("не даёт отправить пакет повторно", () => {
    expect(canSubmitBudgetPackage("collecting")).toBe(true);
    expect(canSubmitBudgetPackage("returned")).toBe(true);
    expect(canSubmitBudgetPackage("submitted")).toBe(false);
    expect(canSubmitBudgetPackage("approved")).toBe(false);
  });

  it("разные тексты для годового и квартального сценария", () => {
    expect(packageSubmitConfirmMessage({
      label: "Отправить",
      submissionMode: "annual",
      teamsSubmitted: 0,
      teamsTotal: 13,
    })).toContain("Годовой бюджет");

    expect(packageSubmitConfirmMessage({
      label: "Отправить",
      submissionMode: "quarterly",
      teamsSubmitted: 2,
      teamsTotal: 13,
    })).toContain("Сдано команд: 2 из 13");

    expect(packageTeamsProgressLine({
      submissionMode: "annual",
      teamsSubmitted: 0,
      teamsTotal: 13,
      teamsAwaitingUnit: 0,
    })).toContain("Команд в сводке: 13");

    expect(packageStatusHint("annual")).toContain("Годовой бюджет");
  });
});
