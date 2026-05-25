import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MonthlyPlanLine, PlanVersion

router = APIRouter(prefix="/api/v1/plans", tags=["plans-export"])


@router.get("/{plan_id}/export.csv")
def export_plan_csv(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    lines = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["employee_id", "position_id", "org_unit_code", "month", "article", "amount", "currency"])
    for l in lines:
        w.writerow(
            [
                l.employee_external_id,
                l.position_external_id,
                l.org_unit_code,
                l.month,
                l.article,
                float(l.amount),
                l.currency,
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=plan_{plan_id}.csv"},
    )
