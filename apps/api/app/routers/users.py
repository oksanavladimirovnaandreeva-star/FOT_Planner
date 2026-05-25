from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(cu: CurrentUser = Depends(get_current_user)):
    u = cu.user
    role = u.role.value if hasattr(u.role, "value") else str(u.role)
    return UserOut(
        username=u.username,
        display_name=u.display_name,
        role=role,
        scope_org_codes=u.scope_org_codes or [],
    )


@router.get("")
def list_users(db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    if not cu.is_admin:
        raise HTTPException(403)
    return [
        UserOut(username=u.username, display_name=u.display_name, role=u.role.value, scope_org_codes=u.scope_org_codes)
        for u in db.query(User).all()
    ]


class UserUpdateScope(BaseModel):
    scope_org_codes: list[str]


@router.patch("/{username}/scope")
def update_scope(
    username: str,
    body: UserUpdateScope,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    if not cu.is_admin:
        raise HTTPException(403)
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(404)
    user.scope_org_codes = body.scope_org_codes
    db.commit()
    return {"ok": True}
