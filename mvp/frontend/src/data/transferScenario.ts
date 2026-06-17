import { isVacantForTransferAtMonth } from "./planningData";
import type { PositionRecord } from "../types";

const norm = (value: string) => value.trim();

export type TransferTargetScope = {
  department: string;
  unit?: string;
  team?: string;
};

export type MaternityReplacementCandidate = {
  employeeId: string;
  employeeName: string;
  positionId: string;
  department: string;
  unit: string;
  team: string;
  role: string;
};

export type TransferVacancyPick = {
  options: PositionRecord[];
  /** Список расширен до всего юнита, если в команде пусто. */
  relaxedFromTeam: boolean;
};

/** Свободные вакансии (на месяц перевода) в целевом орг-срезе. */
export function listTransferVacancyTargets(
  planPositions: PositionRecord[],
  sourcePositionId: string,
  transferMonth: number,
  scope: TransferTargetScope,
): PositionRecord[] {
  return planPositions
    .filter((position) => position.positionId !== sourcePositionId)
    .filter((position) => norm(position.department) === norm(scope.department))
    .filter((position) => !scope.unit || norm(position.unit) === norm(scope.unit))
    .filter((position) => !scope.team || norm(position.team) === norm(scope.team))
    .filter((position) => isVacantForTransferAtMonth(position, transferMonth))
    .sort((a, b) => {
      const unitCmp = a.unit.localeCompare(b.unit, "ru");
      if (unitCmp !== 0) return unitCmp;
      const teamCmp = (a.team ?? "").localeCompare(b.team ?? "", "ru");
      if (teamCmp !== 0) return teamCmp;
      return a.positionId.localeCompare(b.positionId, "ru");
    });
}

/** Подбор вакансий: при пустой команде — показать все свободные в юните. */
export function pickTransferVacancyTargets(
  planPositions: PositionRecord[],
  sourcePositionId: string,
  transferMonth: number,
  scope: TransferTargetScope,
): TransferVacancyPick {
  const strict = listTransferVacancyTargets(planPositions, sourcePositionId, transferMonth, scope);
  if (strict.length > 0 || !scope.team) {
    return { options: strict, relaxedFromTeam: false };
  }
  const relaxed = listTransferVacancyTargets(planPositions, sourcePositionId, transferMonth, {
    department: scope.department,
    unit: scope.unit,
  });
  return { options: relaxed, relaxedFromTeam: relaxed.length > 0 };
}

export function formatTransferVacancyLabel(position: PositionRecord): string {
  const org = [position.unit, position.team].filter(Boolean).join(" / ");
  const role = position.role?.trim() || "Позиция";
  return `${position.positionId} · ${org} · ${role}`;
}

export function formatMaternityReplacementLabel(candidate: MaternityReplacementCandidate): string {
  const org = [candidate.unit, candidate.team].filter(Boolean).join(" / ");
  return `${candidate.employeeName} · ${org} · ${candidate.role}`;
}

/** Сотрудники для замещения в декрете: тот же департамент, не основной сотрудник. */
export function listMaternityReplacementCandidates(
  planPositions: PositionRecord[],
  employeeOptions: { employeeId: string; employeeName: string; positionId: string }[],
  primary: { employeeId?: string; department: string },
): MaternityReplacementCandidate[] {
  const byPositionId = new Map(planPositions.map((position) => [position.positionId, position]));

  return employeeOptions
    .filter((option) => option.employeeId !== primary.employeeId)
    .map((option) => {
      const position = byPositionId.get(option.positionId);
      if (!position || position.status !== "Occupied") return null;
      if (norm(position.department) !== norm(primary.department)) return null;
      return {
        employeeId: option.employeeId,
        employeeName: option.employeeName,
        positionId: option.positionId,
        department: position.department,
        unit: position.unit,
        team: position.team ?? "",
        role: position.role?.trim() || option.positionId,
      };
    })
    .filter((item): item is MaternityReplacementCandidate => item !== null)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ru"));
}

export function transferVacancyEmptyHint(scope: TransferTargetScope, hasDepartment: boolean): string {
  if (!hasDepartment) return "Выберите целевой департамент.";
  const parts = [scope.department, scope.unit, scope.team].filter(Boolean);
  return `Нет свободных вакансий в ${parts.join(" / ")} на выбранный месяц. Оставьте поле пустым — будет создана новая позиция.`;
}
