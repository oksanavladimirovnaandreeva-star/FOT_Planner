"""Создание корректировки: новая DRAFT-версия с parent_version_id и копией событий/dec."""
from sqlalchemy.orm import Session

from app.models import DecSnapshot, PlannedEvent, PlanStatus, PlanVersion
from app.services.recalc import recalculate_plan


def create_correction_version(db: Session, parent: PlanVersion, *, label: str | None, username: str) -> PlanVersion:
    if parent.status not in (PlanStatus.APPROVED, PlanStatus.LOCKED):
        raise ValueError(f"Корректировка возможна только от APPROVED/LOCKED, сейчас {parent.status.value}")

    child_label = label or f"{parent.label}-corr"
    child = PlanVersion(
        plan_year=parent.plan_year,
        label=child_label,
        status=PlanStatus.DRAFT,
        base_month=parent.base_month,
        parent_version_id=parent.id,
    )
    db.add(child)
    db.flush()

    for snap in db.query(DecSnapshot).filter(DecSnapshot.plan_version_id == parent.id).all():
        db.add(
            DecSnapshot(
                plan_version_id=child.id,
                employee_id=snap.employee_id,
                position_id=snap.position_id,
                article=snap.article,
                amount=snap.amount,
                currency=snap.currency,
            )
        )

    for ev in (
        db.query(PlannedEvent)
        .filter(PlannedEvent.plan_version_id == parent.id)
        .order_by(PlannedEvent.created_order)
        .all()
    ):
        db.add(
            PlannedEvent(
                plan_version_id=child.id,
                event_type=ev.event_type,
                effective_month=ev.effective_month,
                employee_id=ev.employee_id,
                position_id=ev.position_id,
                payload=dict(ev.payload or {}),
                created_order=ev.created_order,
                created_by=username,
            )
        )

    db.flush()
    recalculate_plan(db, child)
    return child
