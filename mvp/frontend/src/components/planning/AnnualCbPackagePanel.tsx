import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMvpApp } from "../../context/MvpAppContext";
import { isAnnualPlanningDraft } from "../../data/planCorrectionWindow";
import { formatIsoDateTime } from "../../data/formatDisplay";
import { formatPlanVersionTitle } from "../../data/planVersionDisplay";
import type { PlanVersionMeta } from "../../data/planVersions";
import { departmentOptions } from "../../data/orgStructure";
import {
  applyPackageSubmissionAction,
  getPackageSubmission,
  PACKAGE_PHASE_LABELS,
  type PackagePhase,
} from "../../data/packageSubmissionStore";
import {
  canApproveBudgetPackage,
  canReturnBudgetPackage,
} from "../../data/budgetPackageWorkflow";
import {
  canRolePerformSubmissionAction,
  submissionActionLabel,
} from "../../data/submissionWorkflowPolicy";
import type { UserRole } from "../../data/userAccess";

type Props = {
  primaryBudget: PlanVersionMeta;
  userRole: UserRole;
};

type DepartmentPackageRow = {
  department: string;
  phase: PackagePhase;
  submittedAt?: string;
  approvedAt?: string;
  returnedNote?: string;
};

export function AnnualCbPackagePanel({ primaryBudget, userRole }: Props) {
  const { refreshTeamSubmissions, teamSubmissionRevision } = useMvpApp();

  const rows = useMemo((): DepartmentPackageRow[] => {
    void teamSubmissionRevision;
    if (!isAnnualPlanningDraft(primaryBudget)) return [];
    return departmentOptions().map((department) => {
      const record =
        getPackageSubmission({
          planVersionId: primaryBudget.id,
          level: "department",
          department,
          unit: null,
        }) ?? null;
      return {
        department,
        phase: record?.phase ?? "collecting",
        submittedAt: record?.submittedAt,
        approvedAt: record?.approvedAt,
        returnedNote: record?.returnedNote,
      };
    });
  }, [primaryBudget, teamSubmissionRevision]);

  const pendingCount = rows.filter((row) => row.phase === "submitted" || row.phase === "approved").length;

  const runPackageAction = (
    department: string,
    action: "package_approve_department" | "package_cb_review" | "package_return",
  ) => {
    if (action === "package_return") {
      const note = window.prompt("Комментарий к возврату пакета (опционально):") ?? undefined;
      const result = applyPackageSubmissionAction({
        planVersionId: primaryBudget.id,
        level: "department",
        department,
        unit: null,
        action,
        actorRole: userRole,
        note,
      });
      if (!result.ok) window.alert(result.error);
      else refreshTeamSubmissions();
      return;
    }
    const result = applyPackageSubmissionAction({
      planVersionId: primaryBudget.id,
      level: "department",
      department,
      unit: null,
      action,
      actorRole: userRole,
    });
    if (!result.ok) window.alert(result.error);
    else refreshTeamSubmissions();
  };

  return (
    <section className="card annual-cb-package" aria-label="Годовые пакеты департаментов">
      <h2 className="section-title">Годовой бюджет · приём пакетов</h2>
      <p className="muted-line">
        {formatPlanVersionTitle(primaryBudget)} · квартальный черновик не открыт — согласование идёт по годовому
        циклу.
      </p>
      {pendingCount === 0 ? (
        <p className="workflow-hint__text" role="status">
          Пакетов на проверке пока нет. Директор отправляет департамент после сдачи команд и юнитов.
        </p>
      ) : null}
      <div className="table-scroll">
        <table className="simple-table annual-cb-package__table">
          <thead>
            <tr>
              <th>Департамент</th>
              <th>Статус пакета</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canApprove =
                canApproveBudgetPackage(row.phase) &&
                canRolePerformSubmissionAction("package_approve_department", {
                  actorRole: userRole,
                  targetDepartment: row.department,
                  targetUnit: "",
                  targetTeam: "",
                });
              const canCbReview =
                row.phase === "approved" &&
                canRolePerformSubmissionAction("package_cb_review", {
                  actorRole: userRole,
                  targetDepartment: row.department,
                  targetUnit: "",
                  targetTeam: "",
                });
              const canReturn =
                canReturnBudgetPackage(row.phase) &&
                canRolePerformSubmissionAction("package_return", {
                  actorRole: userRole,
                  targetDepartment: row.department,
                  targetUnit: "",
                  targetTeam: "",
                });
              return (
                <tr key={row.department}>
                  <td>
                    <strong>{row.department}</strong>
                    {row.submittedAt && row.phase !== "collecting" ? (
                      <div className="muted-line">Отправлен {formatIsoDateTime(row.submittedAt)}</div>
                    ) : null}
                    {row.returnedNote ? (
                      <div className="muted-line">Возврат: {row.returnedNote}</div>
                    ) : null}
                  </td>
                  <td>{PACKAGE_PHASE_LABELS[row.phase]}</td>
                  <td className="annual-cb-package__actions">
                    {canApprove ? (
                      <button
                        type="button"
                        className="primary-btn app-btn--sm"
                        onClick={() => runPackageAction(row.department, "package_approve_department")}
                      >
                        {submissionActionLabel("package_approve_department")}
                      </button>
                    ) : null}
                    {canCbReview ? (
                      <button
                        type="button"
                        className="primary-btn app-btn--sm"
                        onClick={() => runPackageAction(row.department, "package_cb_review")}
                      >
                        {submissionActionLabel("package_cb_review")}
                      </button>
                    ) : null}
                    {canReturn ? (
                      <button
                        type="button"
                        className="secondary-btn app-btn--sm"
                        onClick={() => runPackageAction(row.department, "package_return")}
                      >
                        {submissionActionLabel("package_return")}
                      </button>
                    ) : null}
                    {!canApprove && !canCbReview && !canReturn && row.phase === "collecting" ? (
                      <span className="muted-line">Ожидает директора</span>
                    ) : null}
                    {row.phase === "cb_review" ? (
                      <span className="position-state-badge position-state-badge--events">Принят C&B</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted-line annual-cb-package__footer">
        После приёма всех пакетов —{" "}
        <Link to="/versions">утвердите годовой бюджет на «Версиях»</Link>.
      </p>
    </section>
  );
}
