import type { ReactNode } from "react";
import { formatPositionOrgLine } from "../../data/positionDisplay";
import { POSITION_STATUS_LABELS } from "../../data/planningData";
import type { UserRole } from "../../data/userAccess";
import type { PositionRecord } from "../../types";

type Props = {
  record: PositionRecord;
  userRole: UserRole;
  /** Доп. мета под org-строкой (события, черновик…). */
  metaExtra?: ReactNode;
  compact?: boolean;
};

function vacancyTitle(record: PositionRecord): string {
  const role = record.role?.trim();
  if (!role || role === "Новая вакансия") return "Вакансия";
  return role;
}

function vacancyStatusRedundant(role: string | null | undefined): boolean {
  const trimmed = role?.trim() ?? "";
  return !trimmed || trimmed === "Новая вакансия" || /\(вакансия\)/iu.test(trimmed);
}

export function PositionIdentityCell({ record, userRole, metaExtra, compact = false }: Props) {
  const status = POSITION_STATUS_LABELS[record.status];
  const orgLine = formatPositionOrgLine(record, userRole);
  const employeeName = record.employeeName?.trim();

  return (
    <div className={`position-identity${compact ? " position-identity--compact" : ""}`}>
      <div className="position-identity__primary">
        {record.status === "Occupied" && employeeName ? (
          <>
            <strong className="position-identity__name">{employeeName}</strong>
            <span className="position-identity__sep">·</span>
            <span className="position-identity__status">{status}</span>
          </>
        ) : record.status === "Vacancy" ? (
          <>
            <strong className="position-identity__name">{vacancyTitle(record)}</strong>
            {!vacancyStatusRedundant(record.role) ? (
              <>
                <span className="position-identity__sep">·</span>
                <span className="position-identity__status">{status}</span>
              </>
            ) : null}
          </>
        ) : (
          <strong className="position-identity__name">{status}</strong>
        )}
      </div>
      <div className="muted-line position-identity__org">{orgLine}</div>
      {metaExtra ? <div className="position-identity__meta">{metaExtra}</div> : null}
    </div>
  );
}
