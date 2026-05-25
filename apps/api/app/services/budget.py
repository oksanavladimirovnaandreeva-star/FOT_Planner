from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    DecSnapshot,
    Employee,
    LimitFlag,
    MonthlyPlanLine,
    OrgUnit,
    Position,
    PositionAssignment,
    PlanVersion,
    SalaryRangeBand,
    SalaryRangeCatalog,
)
from app.services.org_scope import build_org_subtree, filter_org_codes


def _enum_val(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def get_budget_rows(db: Session, plan_id: int, plan_year: int, allowed_org: set[str] | None) -> list[dict]:
    year_end = date(plan_year, 12, 31)
    positions = (
        db.query(Position, OrgUnit)
        .join(OrgUnit, Position.org_unit_id == OrgUnit.id)
        .filter(Position.is_active)
        .all()
    )
    lines = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id).all()
    line_by_key: dict[tuple, list[MonthlyPlanLine]] = defaultdict(list)
    for ln in lines:
        line_by_key[(ln.position_external_id, ln.employee_external_id)].append(ln)

    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    bands: dict[tuple[str, str], SalaryRangeBand] = {}
    if catalog:
        for b in db.query(SalaryRangeBand).filter(SalaryRangeBand.catalog_id == catalog.id):
            bands[(b.specialization, b.level)] = b

    candidate_plan_ids = [plan_id] + [
        pid
        for (pid,) in db.query(PlanVersion.id)
        .filter(PlanVersion.plan_year == plan_year, PlanVersion.id != plan_id)
        .order_by(PlanVersion.id.desc())
        .all()
    ]
    dec_map: dict[tuple[str, str], float] = {}
    dec_pos_map: dict[str, float] = defaultdict(float)
    for pid in candidate_plan_ids:
        dec_prev = (
            db.query(DecSnapshot, Employee, Position)
            .join(Employee, DecSnapshot.employee_id == Employee.id)
            .join(Position, DecSnapshot.position_id == Position.id)
            .filter(DecSnapshot.plan_version_id == pid, DecSnapshot.article == "BASE")
            .all()
        )
        for d, e, p in dec_prev:
            key = (e.external_id, p.external_id)
            if key not in dec_map:
                dec_map[key] = float(d.amount)
            dec_pos_map[p.external_id] += float(d.amount)

    rows: list[dict] = []
    seen_positions: set[str] = set()

    for pos, org in positions:
        if allowed_org is not None and org.code not in allowed_org:
            continue
        seen_positions.add(pos.external_id)
        assigns = (
            db.query(PositionAssignment, Employee)
            .join(Employee, PositionAssignment.employee_id == Employee.id)
            .filter(
                PositionAssignment.position_id == pos.id,
                PositionAssignment.valid_from <= year_end,
            )
            .filter((PositionAssignment.valid_to.is_(None)) | (PositionAssignment.valid_to >= year_end))
            .all()
        )
        if pos.is_vacancy and not assigns:
            rows.append(_row_vacancy(pos, org, line_by_key, bands, dec_map, dec_pos_map))
            continue
        for asn, emp in assigns:
            rows.append(_row_employee(pos, org, emp, asn, line_by_key, bands, dec_map, dec_pos_map))
        if not assigns and not pos.is_vacancy:
            rows.append(_row_vacancy(pos, org, line_by_key, bands, dec_map, dec_pos_map))

    rows.sort(key=lambda r: (r["is_vacancy"], r["position_id"]))
    return rows


def _row_vacancy(pos, org, line_by_key, bands, dec_map, dec_pos_map) -> dict:
    key = (pos.external_id, f"VACANCY-{pos.external_id}")
    plines = line_by_key.get((pos.external_id, f"VACANCY-{pos.external_id}"), [])
    if not plines:
        for k, v in line_by_key.items():
            if k[0] == pos.external_id:
                plines = v
                break
    return _build_row(pos, org, None, plines, bands, dec_map, dec_pos_map, is_vacancy=True)


def _row_employee(pos, org, emp, asn, line_by_key, bands, dec_map, dec_pos_map) -> dict:
    plines = line_by_key.get((pos.external_id, emp.external_id), [])
    row = _build_row(pos, org, emp, plines, bands, dec_map, dec_pos_map, is_vacancy=False)
    row["is_vacancy"] = False
    row["hc_status"] = "Занято"
    row["specialization"] = asn.specialization
    row["level"] = asn.level
    band = bands.get((asn.specialization, asn.level))
    if band and row["base_dec"]:
        row["cr_dec"] = round(row["base_dec"] / float(band.midpoint), 2)
    return row


def _build_row(pos, org, emp, plines, bands, dec_map, dec_pos_map, is_vacancy: bool) -> dict:
    base_by_month = {ln.month: float(ln.amount) for ln in plines if ln.article == "BASE"}
    bonus_by_month = {ln.month: float(ln.amount) for ln in plines if ln.article == "BONUS_PLAN"}
    dec_base = base_by_month.get(12, 0) or (list(base_by_month.values())[-1] if base_by_month else 0)
    prev_dec = None
    if emp:
        prev_dec = dec_map.get((emp.external_id, pos.external_id))
    if prev_dec is None:
        prev_dec = dec_pos_map.get(pos.external_id)
    year_base = sum(base_by_month.get(m, 0) for m in range(1, 13))
    year_bonus = sum(bonus_by_month.get(m, 0) for m in range(1, 13))
    band = bands.get((pos.specialization, pos.level))
    midpoint = float(band.midpoint) if band else None
    cr = round(dec_base / midpoint, 2) if midpoint and dec_base else None
    dec_dec_pct = None
    if prev_dec is not None:
        if prev_dec == 0:
            dec_dec_pct = 100.0 if dec_base > 0 else 0.0
        else:
            dec_dec_pct = round((dec_base - prev_dec) / prev_dec * 100, 1)

    hire_status = _enum_val(pos.hire_status) if pos.hire_status else None
    if is_vacancy or pos.is_vacancy:
        hs = hire_status or "CARRYOVER"
        status_label = {
            "CARRYOVER": "Перенос",
            "NEW_HIRE": "Новый найм",
            "PLANNED_HIRE": "Найм",
        }.get(hs, "Вакансия")
    else:
        status_label = "Занято"

    return {
        "position_id": pos.external_id,
        "employee_id": emp.external_id if emp else None,
        "full_name": emp.full_name if emp else None,
        "hc_status": status_label,
        "hire_status": hire_status if not (is_vacancy or pos.is_vacancy) else (hire_status or hs),
        "specialization": pos.specialization,
        "level": pos.level,
        "team": org.name,
        "org_unit_code": org.code,
        "limit_flag": _enum_val(pos.limit_flag),
        "is_vacancy": is_vacancy or pos.is_vacancy,
        "base_dec": dec_base,
        "dec_prev_base": prev_dec,
        "dec_dec_pct": dec_dec_pct,
        "year_base": year_base,
        "year_bonus": year_bonus,
        "year_total": year_base + year_bonus,
        "cr_dec": cr,
        "position_internal_id": pos.id,
    }


def get_budget_kpis(db: Session, plan_id: int, plan_year: int, rows: list[dict]) -> dict:
    dec_lines = (
        db.query(MonthlyPlanLine)
        .filter(MonthlyPlanLine.plan_version_id == plan_id, MonthlyPlanLine.month == 12, MonthlyPlanLine.article == "BASE")
        .all()
    )
    prev_year_lines = defaultdict(float)
    for d, e, p in (
        db.query(DecSnapshot, Employee, Position)
        .join(Employee, DecSnapshot.employee_id == Employee.id)
        .join(Position, DecSnapshot.position_id == Position.id)
        .filter(DecSnapshot.plan_version_id == plan_id, DecSnapshot.article == "BASE")
        .all()
    ):
        lf = _enum_val(p.limit_flag)
        prev_year_lines[lf] += float(d.amount)

    by_limit = defaultdict(lambda: {"year_base": 0.0, "year_bonus": 0.0, "year_total": 0.0, "dec_plan": 0.0, "dec_prev": 0.0})
    for r in rows:
        lf = r["limit_flag"]
        by_limit[lf]["year_base"] += r["year_base"]
        by_limit[lf]["year_bonus"] += r["year_bonus"]
        by_limit[lf]["year_total"] += r["year_total"]
    for ln in dec_lines:
        pos = db.query(Position).filter(Position.external_id == ln.position_external_id).first()
        lf = _enum_val(pos.limit_flag) if pos else "IN_LIMIT"
        by_limit[lf]["dec_plan"] += float(ln.amount)

    growth = {}
    total_prev = sum(prev_year_lines.values())
    total_plan = sum(v["dec_plan"] for v in by_limit.values())
    for lf, vals in by_limit.items():
        prev = prev_year_lines.get(lf, 0)
        growth[lf] = {
            "dec_prev": prev,
            "dec_plan": vals["dec_plan"],
            "net_growth": vals["dec_plan"] - prev,
            "net_growth_pct": round((vals["dec_plan"] - prev) / prev * 100, 1) if prev else None,
        }
    growth["TOTAL"] = {
        "dec_prev": total_prev,
        "dec_plan": total_plan,
        "net_growth": total_plan - total_prev,
        "net_growth_pct": round((total_plan - total_prev) / total_prev * 100, 1) if total_prev else None,
    }

    by_limit_out = {
        lf: {"year_base": v["year_base"], "year_bonus": v["year_bonus"], "year_total": v["year_total"]}
        for lf, v in by_limit.items()
    }
    by_limit_out["TOTAL"] = {
        "year_base": sum(r["year_base"] for r in rows),
        "year_bonus": sum(r["year_bonus"] for r in rows),
        "year_total": sum(r["year_total"] for r in rows),
    }

    return {
        "positions": len({r["position_id"] for r in rows}),
        "vacancies": sum(1 for r in rows if r["is_vacancy"]),
        "fte_year": sum(0 if r["is_vacancy"] else 1 for r in rows),
        "year_base": sum(r["year_base"] for r in rows),
        "year_bonus": sum(r["year_bonus"] for r in rows),
        "year_total": sum(r["year_total"] for r in rows),
        "by_limit": by_limit_out,
        "growth_dec": growth,
    }
