"""Сброс демо-данных (только dev)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import Base, engine, get_db
from app.seed import seed_database

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.post("/reseed")
def reseed(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    if not cu.is_admin:
        raise HTTPException(403)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database(db)
    from app.models import PlanVersion
    from app.services.recalc import recalculate_plan

    for plan in db.query(PlanVersion).all():
        try:
            recalculate_plan(db, plan)
        except Exception as exc:
            return {"ok": False, "message": str(exc)}
    return {"ok": True, "message": "Демо-данные пересозданы, план пересчитан"}
