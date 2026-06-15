type Props = {
  filled: number;
  total: number;
  approved: number;
  labelFilled?: string;
  labelApproved?: string;
};

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function ConsolidationProgressDonut({
  filled,
  total,
  approved,
  labelFilled = "Заполнено",
  labelApproved = "Согласовано",
}: Props) {
  const filledPct = pct(filled, total);
  const approvedPct = pct(approved, total);

  return (
    <div className="consolidation-progress-donut-wrap">
      <div
        className="consolidation-progress-donut"
        role="img"
        aria-label={`${labelFilled}: ${filled} из ${total} (${filledPct}%). ${labelApproved}: ${approved} из ${total} (${approvedPct}%).`}
      >
        <div
          className="consolidation-progress-donut__ring consolidation-progress-donut__ring--filled"
          style={{ background: `conic-gradient(#4f46e5 0 ${filledPct}%, #e2e8f0 ${filledPct}% 100%)` }}
        />
        <div
          className="consolidation-progress-donut__ring consolidation-progress-donut__ring--approved"
          style={{ background: `conic-gradient(#059669 0 ${approvedPct}%, transparent ${approvedPct}% 100%)` }}
        />
        <div className="consolidation-progress-donut__center">
          <span className="consolidation-progress-donut__value">{filledPct}%</span>
        </div>
      </div>
      <div className="consolidation-progress-donut__legend">
        <p>
          <strong>{labelFilled}</strong>
          <span className="muted-line">
            {filled}/{total}
          </span>
        </p>
        <p>
          <strong>{labelApproved}</strong>
          <span className="muted-line">
            {approved}/{total}
          </span>
        </p>
      </div>
    </div>
  );
}
