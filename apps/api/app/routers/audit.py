from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import AuditLog

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("")
def audit_log(limit: int = 100, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "username": r.username,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
