"""Перенос вакансий в новый плановый год: IN_LIMIT + audit-события."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import HireStatus, LimitFlag, PlannedEvent, PlanVersion, Position


def apply_carryover_events(db: Session, plan: PlanVersion) -> int:
    """Для вакансий CARRYOVER: IN_LIMIT и события POSITION_CARRYOVER + PLANNED_HIRE при отсутствии."""
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan.id).scalar() or 0
    added = 0
    vacancies = db.query(Position).filter(Position.is_active, Position.is_vacancy).all()
    for pos in vacancies:
        hs = pos.hire_status.value if pos.hire_status else None
        if hs != HireStatus.CARRYOVER.value and hs != "CARRYOVER":
            continue
        pos.limit_flag = LimitFlag.IN_LIMIT
        has_carry = (
            db.query(PlannedEvent)
            .filter(
                PlannedEvent.plan_version_id == plan.id,
                PlannedEvent.event_type == "POSITION_CARRYOVER",
            )
            .all()
        )
        has_for_pos = any((e.payload or {}).get("position_external_id") == pos.external_id for e in has_carry)
        if not has_for_pos:
            order += 1
            db.add(
                PlannedEvent(
                    plan_version_id=plan.id,
                    event_type="POSITION_CARRYOVER",
                    effective_month=1,
                    payload={
                        "position_external_id": pos.external_id,
                        "limit_flag": "IN_LIMIT",
                        "hire_status": "CARRYOVER",
                    },
                    created_order=order,
                    created_by="system",
                )
            )
            added += 1
        has_hire = (
            db.query(PlannedEvent)
            .filter(
                PlannedEvent.plan_version_id == plan.id,
                PlannedEvent.event_type == "PLANNED_HIRE",
            )
            .all()
        )
        has_hire_pos = any((e.payload or {}).get("position_external_id") == pos.external_id for e in has_hire)
        if not has_hire_pos:
            from app.models import SalaryRangeBand, SalaryRangeCatalog

            base = 150000
            catalog = (
                db.query(SalaryRangeCatalog)
                .filter(SalaryRangeCatalog.plan_year == plan.plan_year)
                .order_by(SalaryRangeCatalog.valid_from.desc())
                .first()
            )
            if catalog:
                band = (
                    db.query(SalaryRangeBand)
                    .filter(
                        SalaryRangeBand.catalog_id == catalog.id,
                        SalaryRangeBand.specialization == pos.specialization,
                        SalaryRangeBand.level == pos.level,
                    )
                    .first()
                )
                if band:
                    base = float(band.midpoint)
            order += 1
            hire_m = pos.hire_month or 1
            db.add(
                PlannedEvent(
                    plan_version_id=plan.id,
                    event_type="PLANNED_HIRE",
                    effective_month=hire_m,
                    payload={
                        "position_external_id": pos.external_id,
                        "specialization": pos.specialization,
                        "level": pos.level,
                        "hire_amounts": {"BASE": base},
                    },
                    created_order=order,
                    created_by="system",
                )
            )
            added += 1
        if pos.hire_month is None:
            pos.hire_month = 1
    db.flush()
    return added
