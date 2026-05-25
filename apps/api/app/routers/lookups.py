from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import OrgUnit, Position, PositionAssignment, SalaryRangeBand, SalaryRangeCatalog
from app.services.org_scope import build_org_subtree, filter_org_codes

router = APIRouter(prefix="/api/v1/lookups", tags=["lookups"])


@router.get("/org-units")
def org_units(
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    subtree = build_org_subtree(db)
    rows = db.query(OrgUnit).all()
    result = []
    for ou in rows:
        allowed = filter_org_codes([ou.code], cu.user.scope_org_codes, subtree, cu.is_admin)
        if ou.code in allowed:
            result.append({"code": ou.code, "name": ou.name})
    result.sort(key=lambda x: x["name"])
    return result


@router.get("/specializations-levels")
def specializations_levels(
    plan_year: int = 2026,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    pairs: set[tuple[str, str]] = set()
    if catalog:
        for b in db.query(SalaryRangeBand).filter(SalaryRangeBand.catalog_id == catalog.id):
            pairs.add((b.specialization, b.level))

    subtree = build_org_subtree(db)
    positions = db.query(Position).filter(Position.is_active).all()
    for pos in positions:
        org = pos.org_unit
        allowed = filter_org_codes([org.code], cu.user.scope_org_codes, subtree, cu.is_admin)
        if org.code in allowed:
            pairs.add((pos.specialization, pos.level))

    for asn, pos in (
        db.query(PositionAssignment, Position).join(Position, PositionAssignment.position_id == Position.id).all()
    ):
        org = pos.org_unit
        allowed = filter_org_codes([org.code], cu.user.scope_org_codes, subtree, cu.is_admin)
        if org.code in allowed:
            pairs.add((asn.specialization, asn.level))

    specs = sorted({s for s, _ in pairs})
    levels = sorted({l for _, l in pairs})
    return {
        "pairs": [{"specialization": s, "level": l} for s, l in sorted(pairs)],
        "specializations": specs,
        "levels": levels,
    }


@router.get("/salary-band")
def salary_band(
    specialization: str,
    level: str,
    plan_year: int = 2026,
    base_salary: float | None = None,
    db: Session = Depends(get_db),
):
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    if not catalog:
        return {"min": None, "mid": None, "max": None, "cr": None}
    band = (
        db.query(SalaryRangeBand)
        .filter(
            SalaryRangeBand.catalog_id == catalog.id,
            SalaryRangeBand.specialization == specialization,
            SalaryRangeBand.level == level,
        )
        .first()
    )
    if not band:
        return {"min": None, "mid": None, "max": None, "cr": None}
    mid = float(band.midpoint)
    cr = round(base_salary / mid, 2) if base_salary and mid else None
    return {
        "min": float(band.min_salary),
        "mid": mid,
        "max": float(band.max_salary),
        "cr": cr,
    }
