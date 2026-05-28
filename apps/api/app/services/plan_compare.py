"""Read-only сравнение двух версий плана по monthly_plan_lines."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import MonthlyPlanLine, PlanVersion


def compare_plan_versions(
    db: Session,
    left_plan_id: int,
    right_plan_id: int,
    *,
    article: str = "BASE",
    month: int | None = None,
) -> dict:
    left = db.get(PlanVersion, left_plan_id)
    right = db.get(PlanVersion, right_plan_id)
    if not left or not right:
        raise ValueError("Plan version not found")
    if left.plan_year != right.plan_year:
        raise ValueError("Plans must be the same plan_year")

    def totals(plan_id: int) -> dict[tuple[str, str, int], float]:
        q = db.query(MonthlyPlanLine).filter(
            MonthlyPlanLine.plan_version_id == plan_id,
            MonthlyPlanLine.article == article,
        )
        if month is not None:
            q = q.filter(MonthlyPlanLine.month == month)
        acc: dict[tuple[str, str, int], float] = {}
        for ln in q.all():
            key = (ln.position_external_id, ln.employee_external_id, ln.month)
            acc[key] = acc.get(key, 0.0) + float(ln.amount)
        return acc

    left_map = totals(left_plan_id)
    right_map = totals(right_plan_id)
    keys = sorted(set(left_map) | set(right_map))

    rows: list[dict] = []
    for position_id, employee_id, m in keys:
        lv = left_map.get((position_id, employee_id, m), 0.0)
        rv = right_map.get((position_id, employee_id, m), 0.0)
        if abs(lv - rv) < 0.01:
            continue
        rows.append(
            {
                "position_external_id": position_id,
                "employee_external_id": employee_id,
                "month": m,
                "left_amount": lv,
                "right_amount": rv,
                "delta": rv - lv,
                "delta_pct": round((rv - lv) / lv * 100, 1) if lv else (100.0 if rv else 0.0),
            }
        )

    left_sum = sum(left_map.values())
    right_sum = sum(right_map.values())
    return {
        "plan_year": left.plan_year,
        "left_plan_id": left_plan_id,
        "left_label": left.label,
        "right_plan_id": right_plan_id,
        "right_label": right.label,
        "article": article,
        "month": month,
        "rows": rows,
        "totals": {
            "left": left_sum,
            "right": right_sum,
            "delta": right_sum - left_sum,
            "delta_pct": round((right_sum - left_sum) / left_sum * 100, 1) if left_sum else (100.0 if right_sum else 0.0),
        },
        "changed_rows": len(rows),
    }
