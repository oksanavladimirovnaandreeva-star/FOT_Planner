import sys
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Employee, MonthlyPlanLine, SalaryRangeBand, SalaryRangeCatalog

DOMAIN_ROOT = Path(__file__).resolve().parents[4] / "packages" / "domain"
if str(DOMAIN_ROOT) not in sys.path:
    sys.path.insert(0, str(DOMAIN_ROOT))
from fot_domain.engine import PlanCalculator  # noqa: E402

from app.schemas import CrOut, SalaryBandOut
from app.services.import_csv import import_salary_ranges

router = APIRouter(prefix="/api/v1/salary-ranges", tags=["salary-ranges"])


@router.get("")
def list_bands(
    specialization: str | None = None,
    level: str | None = None,
    plan_year: int = 2026,
    db: Session = Depends(get_db),
):
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    if not catalog:
        return []
    q = db.query(SalaryRangeBand).filter(SalaryRangeBand.catalog_id == catalog.id)
    if specialization:
        q = q.filter(SalaryRangeBand.specialization == specialization)
    if level:
        q = q.filter(SalaryRangeBand.level == level)
    return [SalaryBandOut.model_validate(b) for b in q.all()]


@router.post("/import")
async def import_ranges(
    plan_year: int,
    version_label: str = "import",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    if not cu.is_admin:
        raise HTTPException(403)
    content = (await file.read()).decode("utf-8-sig")
    hist = import_salary_ranges(db, plan_year, content, cu.user.username, version_label)
    return {"ok": hist.rows_ok, "errors": hist.errors}


@router.get("/lookup")
def lookup(specialization: str, level: str, plan_year: int = 2026, db: Session = Depends(get_db)):
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    if not catalog:
        raise HTTPException(404, "No catalog")
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
        raise HTTPException(404, "Band not found")
    return SalaryBandOut.model_validate(band)
