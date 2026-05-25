from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole


class CurrentUser:
    def __init__(self, user: User):
        self.user = user

    @property
    def is_admin(self) -> bool:
        return self.user.role == UserRole.ADMIN

    def can_access_org(self, org_code: str, subtree_codes: set[str]) -> bool:
        if self.is_admin:
            return True
        if org_code in self.user.scope_org_codes:
            return True
        for scope in self.user.scope_org_codes:
            if org_code.startswith(scope) or scope in subtree_codes:
                return True
        return False


def get_current_user(
    x_user_id: str = Header(default="admin"),
    db: Session = Depends(get_db),
) -> CurrentUser:
    user = db.query(User).filter(User.username == x_user_id).first()
    if not user:
        raise HTTPException(401, f"User {x_user_id} not found")
    return CurrentUser(user)
