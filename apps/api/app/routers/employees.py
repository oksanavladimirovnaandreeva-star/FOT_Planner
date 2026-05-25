import sys
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Employee, MonthlyPlanLine, SalaryRangeBand, SalaryRangeCatalog

DOMAIN_ROOT = Path(__file__).resolve().parents[4] / "packages" / "domain"
if str(DOMAIN_ROOT) not in sys.path:
    sys.path.insert(0, str(DOMAIN_ROOT))
from fot_domain.engine import PlanCalculator  # noqa: E402

from app.schemas import CrOut

router = APIRouter(prefix="/api/v1/employees", tags=["employees"])


@router.get("")
def list_employees(db: Session = Depends(get_db)):
    return [
        {"external_id": e.external_id, "full_name": e.full_name}
        for e in db.query(Employee).all()
    ]


@router.get("/{external_id}/cr", response_model=CrOut)
def employee_cr(
    external_id: str,
    month: int = 12,
    plan_id: int | None = None,
    plan_year: int = 2026,
    db: Session = Depends(get_db),
):
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    if plan_id:
        line = (
            db.query(MonthlyPlanLine)
            .filter(
                MonthlyPlanLine.plan_version_id == plan_id,
                MonthlyPlanLine.employee_external_id == external_id,
                MonthlyPlanLine.month == month,
                MonthlyPlanLine.article == "BASE",
            )
            .first()
        )
    else:
        line = None
    base = Decimal(str(line.amount)) if line else Decimal("0")
    # get spec/level from latest assignment — simplified from plan line metadata
    from app.models import PositionAssignment, Position

    emp = db.query(Employee).filter(Employee.external_id == external_id).first()
    if not emp:
        raise HTTPException(404)
    asn = (
        db.query(PositionAssignment, Position)
        .join(Position, PositionAssignment.position_id == Position.id)
        .filter(PositionAssignment.employee_id == emp.id)
        .order_by(PositionAssignment.valid_from.desc())
        .first()
    )
    mid = None
    cr = None
    if catalog and asn:
        _, pos = asn
        band = (
            db.query(SalaryRangeBand)
            .filter(
                SalaryRangeBand.catalog_id == catalog.id,
                SalaryRangeBand.specialization == pos.specialization,
                SalaryRangeBand.level == pos.level,
            )
            .first()
        )
        if band:
            mid = Decimal(str(band.midpoint))
            cr = PlanCalculator.compa_ratio(base, mid)
    return CrOut(
        employee_external_id=external_id,
        month=month,
        base_amount=float(base),
        midpoint=float(mid) if mid is not None else None,
        cr=float(cr) if cr is not None else None,
    )
