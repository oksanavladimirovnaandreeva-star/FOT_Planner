from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import DecSnapshot, Employee, LimitFlag, MonthlyFactLine, MonthlyPlanLine, Position
from app.services.budget import _enum_val


def get_variance_report(db: Session, plan_id: int, month: int | None = None) -> dict:
    pq = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id)
    fq = db.query(MonthlyFactLine).filter(MonthlyFactLine.plan_version_id == plan_id)
    if month:
        pq = pq.filter(MonthlyPlanLine.month == month)
        fq = fq.filter(MonthlyFactLine.month == month)

    pos_limit: dict[str, str] = {}
    for p in db.query(Position).all():
        pos_limit[p.external_id] = _enum_val(p.limit_flag)

    plan_by_emp: dict[tuple, Decimal] = defaultdict(Decimal)
    for l in pq.all():
        plan_by_emp[(l.employee_external_id, l.month, l.article)] += l.amount

    fact_by_emp: dict[tuple, Decimal] = defaultdict(Decimal)
    for f in fq.all():
        fact_by_emp[(f.employee_external_id, f.month, f.article)] += f.amount

    emp_to_pos: dict[str, str] = {}
    for l in db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id).all():
        if not l.employee_external_id.startswith("VACANCY-"):
            emp_to_pos[l.employee_external_id] = l.position_external_id

    rows = []
    keys = set(plan_by_emp) | set(fact_by_emp)
    for emp_id, m, art in sorted(keys):
        if month and m != month:
            continue
        p_amt = plan_by_emp.get((emp_id, m, art), Decimal("0"))
        f_amt = fact_by_emp.get((emp_id, m, art), Decimal("0"))
        var = f_amt - p_amt
        pct = float(var / p_amt * 100) if p_amt else None
        pos_id = emp_to_pos.get(emp_id, emp_id.replace("VACANCY-", ""))
        rows.append(
            {
                "employee_external_id": emp_id,
                "position_external_id": pos_id,
                "month": m,
                "article": art,
                "limit_flag": pos_limit.get(pos_id, "IN_LIMIT"),
                "plan_amount": float(p_amt),
                "fact_amount": float(f_amt),
                "variance": float(var),
                "variance_pct": round(pct, 1) if pct is not None else None,
            }
        )

    def _sum_article(art: str, source: str) -> dict[str, float]:
        by_limit: dict[str, float] = defaultdict(float)
        for r in rows:
            if r["article"] != art:
                continue
            by_limit[r["limit_flag"]] += r["plan_amount"] if source == "plan" else r["fact_amount"]
        total = sum(by_limit.values())
        by_limit["TOTAL"] = total
        return dict(by_limit)

    def _sum_all_articles(source: str) -> dict[str, float]:
        by_limit: dict[str, float] = defaultdict(float)
        for r in rows:
            by_limit[r["limit_flag"]] += r["plan_amount"] if source == "plan" else r["fact_amount"]
        total = sum(by_limit.values())
        by_limit["TOTAL"] = total
        return dict(by_limit)

    plan_base = sum(r["plan_amount"] for r in rows if r["article"] == "BASE")
    fact_base = sum(r["fact_amount"] for r in rows if r["article"] == "BASE")
    var_total = fact_base - plan_base
    plan_total = sum(r["plan_amount"] for r in rows)
    fact_total = sum(r["fact_amount"] for r in rows)
    var_total_all = fact_total - plan_total

    dec_plan = (
        db.query(MonthlyPlanLine)
        .filter(MonthlyPlanLine.plan_version_id == plan_id, MonthlyPlanLine.month == 12, MonthlyPlanLine.article == "BASE")
        .all()
    )
    dec_prev_rows = (
        db.query(DecSnapshot, Employee, Position)
        .join(Employee, DecSnapshot.employee_id == Employee.id)
        .join(Position, DecSnapshot.position_id == Position.id)
        .filter(DecSnapshot.plan_version_id == plan_id, DecSnapshot.article == "BASE")
        .all()
    )
    dec_growth: dict[str, dict] = {}
    by_lim_plan: dict[str, float] = defaultdict(float)
    by_lim_prev: dict[str, float] = defaultdict(float)
    for l in dec_plan:
        lf = pos_limit.get(l.position_external_id, "IN_LIMIT")
        by_lim_plan[lf] += float(l.amount)
    for d, e, p in dec_prev_rows:
        lf = _enum_val(p.limit_flag)
        by_lim_prev[lf] += float(d.amount)
    for lf in set(by_lim_plan) | set(by_lim_prev):
        prev = by_lim_prev.get(lf, 0)
        plan = by_lim_plan.get(lf, 0)
        dec_growth[lf] = {
            "dec_prev": prev,
            "dec_plan": plan,
            "net_growth": plan - prev,
            "net_growth_pct": round((plan - prev) / prev * 100, 1) if prev else None,
        }
    dec_growth["TOTAL"] = {
        "dec_prev": sum(by_lim_prev.values()),
        "dec_plan": sum(by_lim_plan.values()),
        "net_growth": sum(by_lim_plan.values()) - sum(by_lim_prev.values()),
        "net_growth_pct": None,
    }
    tp, tpp = dec_growth["TOTAL"]["dec_prev"], dec_growth["TOTAL"]["dec_plan"]
    if tp:
        dec_growth["TOTAL"]["net_growth_pct"] = round((tpp - tp) / tp * 100, 1)

    return {
        "rows": rows,
        "totals": {
            "plan": plan_base,
            "fact": fact_base,
            "variance": var_total,
            "variance_pct": round(var_total / plan_base * 100, 1) if plan_base else None,
        },
        "totals_total": {
            "plan": plan_total,
            "fact": fact_total,
            "variance": var_total_all,
            "variance_pct": round(var_total_all / plan_total * 100, 1) if plan_total else None,
        },
        "by_limit_plan": _sum_article("BASE", "plan"),
        "by_limit_fact": _sum_article("BASE", "fact"),
        "by_limit_plan_total": _sum_all_articles("plan"),
        "by_limit_fact_total": _sum_all_articles("fact"),
        "growth_dec": dec_growth,
    }
