import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy.orm import Session

DOMAIN_ROOT = Path(__file__).resolve().parents[4] / "packages" / "domain"
if str(DOMAIN_ROOT) not in sys.path:
    sys.path.insert(0, str(DOMAIN_ROOT))

from fot_domain.engine import (  # noqa: E402
    AssignmentInput,
    DecAmount,
    PlanCalculator,
    PlannedEventInput,
    SalaryBand,
)

from app.models import (
    DecSnapshot,
    Employee,
    MonthlyPlanLine,
    OrgUnit,
    PlanVersion,
    PlannedEvent,
    Position,
    PositionAssignment,
    SalaryRangeBand,
    SalaryRangeCatalog,
)


def _month_from_date(d: date, year: int) -> int:
    if d.year < year:
        return 1
    if d.year > year:
        return 13
    return d.month


def recalculate_plan(db: Session, plan: PlanVersion) -> int:
    year = plan.plan_year
    assignments_db = (
        db.query(PositionAssignment, Employee, Position, OrgUnit)
        .join(Employee, PositionAssignment.employee_id == Employee.id)
        .join(Position, PositionAssignment.position_id == Position.id)
        .join(OrgUnit, Position.org_unit_id == OrgUnit.id)
        .all()
    )

    assignment_inputs: list[AssignmentInput] = []
    for asn, emp, pos, org in assignments_db:
        vf = _month_from_date(asn.valid_from, year)
        vt = _month_from_date(asn.valid_to, year) if asn.valid_to else None
        if vt == 13:
            vt = None
        assignment_inputs.append(
            AssignmentInput(
                emp.external_id,
                pos.external_id,
                org.code,
                asn.specialization,
                asn.level,
                vf,
                vt,
            )
        )

    events_db_early = (
        db.query(PlannedEvent)
        .filter(PlannedEvent.plan_version_id == plan.id)
        .order_by(PlannedEvent.effective_month, PlannedEvent.created_order)
        .all()
    )
    hire_month_by_pos: dict[str, int] = {}
    for ev in events_db_early:
        if ev.event_type == "PLANNED_HIRE":
            p = ev.payload or {}
            pid = p.get("position_external_id")
            if pid:
                hire_month_by_pos[pid] = ev.effective_month

    vacancies_db = (
        db.query(Position, OrgUnit)
        .join(OrgUnit, Position.org_unit_id == OrgUnit.id)
        .filter(Position.is_active, Position.is_vacancy)
        .all()
    )
    for pos, org in vacancies_db:
        vac_emp = f"VACANCY-{pos.external_id}"
        if any(
            a.position_external_id == pos.external_id and a.employee_external_id.startswith("VACANCY-")
            for a in assignment_inputs
        ):
            continue
        vf = pos.hire_month or hire_month_by_pos.get(pos.external_id) or 1
        assignment_inputs.append(
            AssignmentInput(
                vac_emp,
                pos.external_id,
                org.code,
                pos.specialization,
                pos.level,
                vf,
                None,
            )
        )

    dec_rows = (
        db.query(DecSnapshot, Employee, Position)
        .join(Employee, DecSnapshot.employee_id == Employee.id)
        .join(Position, DecSnapshot.position_id == Position.id)
        .filter(DecSnapshot.plan_version_id == plan.id)
        .all()
    )

    dec_amounts = [
        DecAmount(emp.external_id, pos.external_id, row.article, Decimal(str(row.amount)), row.currency)
        for row, emp, pos in dec_rows
    ]

    events_db = events_db_early
    event_inputs: list[PlannedEventInput] = []
    for ev in events_db:
        p = ev.payload or {}
        event_inputs.append(
            PlannedEventInput(
                event_type=ev.event_type,
                effective_month=ev.effective_month,
                employee_external_id=p.get("employee_external_id"),
                position_external_id=p.get("position_external_id"),
                org_unit_code=p.get("org_unit_code"),
                specialization=p.get("specialization"),
                level=p.get("level"),
                index_percent=Decimal(str(p["index_percent"])) if p.get("index_percent") is not None else None,
                index_fixed=Decimal(str(p["index_fixed"])) if p.get("index_fixed") is not None else None,
                index_article=p.get("index_article"),
                scope_org_unit=p.get("scope_org_unit"),
                scope_specialization=p.get("scope_specialization"),
                new_amounts={k: Decimal(str(v)) for k, v in (p.get("new_amounts") or {}).items()},
                percent_change=Decimal(str(p["percent_change"])) if p.get("percent_change") is not None else None,
                target_cr=Decimal(str(p["target_cr"])) if p.get("target_cr") is not None else None,
                band_anchor=p.get("band_anchor"),
                hire_amounts={k: Decimal(str(v)) for k, v in (p.get("hire_amounts") or {}).items()},
                propagate_forward=bool(p.get("propagate_forward", True)),
                created_order=ev.created_order,
            )
        )

    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    bands: list[SalaryBand] = []
    if catalog:
        for b in db.query(SalaryRangeBand).filter(SalaryRangeBand.catalog_id == catalog.id):
            bands.append(
                SalaryBand(
                    b.specialization,
                    b.level,
                    Decimal(str(b.min_salary)),
                    Decimal(str(b.midpoint)),
                    Decimal(str(b.max_salary)),
                    b.currency,
                )
            )

    calc = PlanCalculator(year, assignment_inputs, dec_amounts, event_inputs, bands)
    lines = calc.calculate()

    db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan.id).delete()
    for ln in lines:
        db.add(
            MonthlyPlanLine(
                plan_version_id=plan.id,
                employee_external_id=ln.employee_external_id,
                position_external_id=ln.position_external_id,
                org_unit_code=ln.org_unit_code,
                month=ln.month,
                article=ln.article,
                amount=ln.amount,
                currency=ln.currency,
            )
        )
    db.commit()
    return len(lines)
