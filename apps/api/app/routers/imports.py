from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.services.import_csv import import_org_units, import_positions

router = APIRouter(prefix="/api/v1/import", tags=["import"])


@router.post("/org-units")
async def imp_org(file: UploadFile = File(...), db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    if not cu.is_admin:
        raise HTTPException(403)
    content = (await file.read()).decode("utf-8-sig")
    return import_org_units(db, content, cu.user.username)


@router.post("/positions")
async def imp_pos(file: UploadFile = File(...), db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    if not cu.is_admin:
        raise HTTPException(403)
    content = (await file.read()).decode("utf-8-sig")
    return import_positions(db, content, cu.user.username)
