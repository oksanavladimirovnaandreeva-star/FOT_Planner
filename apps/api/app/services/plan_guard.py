"""Проверки статуса версии плана перед мутациями."""
from fastapi import HTTPException

from app.models import PlanStatus, PlanVersion


def require_plan_draft_for_edit(plan: PlanVersion) -> None:
    if plan.status != PlanStatus.DRAFT:
        raise HTTPException(
            status_code=403,
            detail=(
                f"План в статусе {plan.status.value}. "
                "События и правки доступны только в DRAFT; после утверждения создайте корректировку (parent_version_id)."
            ),
        )
