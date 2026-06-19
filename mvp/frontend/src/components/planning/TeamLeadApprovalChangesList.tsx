import { Link, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import {
  formatGradeChangeRange,
  formatSalaryChangeRange,
  gradeChanged,
  salaryChanged,
  tableRowStatusClass,
} from "../../data/eventJournal";
import { formatIsoDateTime } from "../../data/formatDisplay";
import type { TeamApprovalDiffRow, TeamApprovalSubmissionMode } from "../../data/teamApprovalDiff";
import { useMvpApp } from "../../context/MvpAppContext";
import { PositionIdentityCell } from "./PositionIdentityCell";
import type { PositionRecord } from "../../types";

type Props = {
  rows: TeamApprovalDiffRow[];
  canEdit: boolean;
  positionsById: Map<string, PositionRecord>;
  versionLabel?: string;
  submissionMode: TeamApprovalSubmissionMode;
  planningLink: string;
};

export function TeamLeadApprovalChangesList({
  rows,
  canEdit,
  positionsById,
  versionLabel,
  submissionMode,
  planningLink,
}: Props) {
  const { userRole } = useMvpApp();
  const navigate = useNavigate();
  const isAnnual = submissionMode === "annual";
  const sectionTitle = isAnnual ? "Изменения на год" : "Изменения квартальной версии";

  const openPosition = (positionId: string) => {
    const separator = planningLink.includes("?") ? "&" : "?";
    navigate(`${planningLink}${separator}position=${encodeURIComponent(positionId)}`);
  };

  if (rows.length === 0) {
    return (
      <section className="card team-lead-approval__changes">
        <h2 className="section-title">{sectionTitle}</h2>
        <p className="muted-line">
          {isAnnual
            ? "Пока нет плановых событий по команде — можно сдавать как есть или добавить правки в годовом планировании."
            : "В этой квартальной версии правок нет — можно сдавать без изменений или добавить события в квартальном планировании."}
        </p>
        {canEdit ? (
          <Link className="secondary-btn" to={planningLink}>
            {isAnnual ? "Годовое планирование" : "Квартальное планирование"}
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card team-lead-approval__changes">
      <div className="team-lead-approval__changes-head">
        <h2 className="section-title">{sectionTitle}</h2>
        <span className="team-lead-approval__changes-count">{rows.length}</span>
      </div>
      <p className="muted-line team-lead-approval__changes-note">
        {isAnnual
          ? `Все плановые изменения команды на год${versionLabel ? ` · ${versionLabel}` : ""}. Клик по строке — карточка позиции.`
          : `Только новые правки в ${versionLabel ?? "квартальной версии"} относительно утверждённого года. Клик по строке — карточка позиции.`}
      </p>
      <div className="table-scroll">
        <table className="simple-table plan-journal-table team-lead-approval__changes-table">
          <thead>
            <tr>
              <th>Когда</th>
              <th>Позиция</th>
              <th>Было → стало</th>
              <th>Событие</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const position = positionsById.get(row.positionId);
              const statusAfter = position?.status ?? "Occupied";
              return (
                <tr
                  key={`${row.positionId}-${row.event.id}`}
                  className={`${tableRowStatusClass(statusAfter)} plan-journal-table__row--clickable`}
                  onClick={() => openPosition(row.positionId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPosition(row.positionId);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Открыть позицию ${row.positionId}`}
                >
                  <td>{formatIsoDateTime(row.createdAt)}</td>
                  <td>
                    {position ? (
                      <PositionIdentityCell record={position} userRole={userRole} compact />
                    ) : (
                      <>
                        <strong>{row.positionId}</strong>
                        <div className="muted-line">{row.role}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <div className="plan-journal-change">
                      <div className="muted-line">с {row.change.monthLabel}</div>
                      {row.isNewPosition ? (
                        <div className="positions-table__dec-range">
                          Новая позиция · ФОТ {Math.round(row.fotDeltaAnnual).toLocaleString("ru-RU")} ₽/год
                        </div>
                      ) : null}
                      {!row.isNewPosition && row.change.statusBefore !== row.change.statusAfter ? (
                        <div className="positions-table__dec-range">
                          {row.change.statusBefore} → {row.change.statusAfter}
                        </div>
                      ) : null}
                      {!row.isNewPosition && salaryChanged(row.change) ? (
                        <div className="positions-table__dec-range">{formatSalaryChangeRange(row.change)}</div>
                      ) : null}
                      {!row.isNewPosition && gradeChanged(row.change) ? (
                        <div className="positions-table__dec-range">{formatGradeChangeRange(row.change)}</div>
                      ) : null}
                      {!row.isNewPosition &&
                      !salaryChanged(row.change) &&
                      !gradeChanged(row.change) &&
                      row.change.statusBefore === row.change.statusAfter ? (
                        <div className="muted-line">без изменения ФОТ и грейда</div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className="event-type-pill event-type-pill--lg">{row.typeLabel}</span>
                  </td>
                  <td>
                    {row.comment ? (
                      <span className="plan-journal-table__comment">
                        <MessageSquare size={14} aria-hidden />
                        {row.comment}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
