from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import (
    AuditLog,
    Employee,
    MonthlyFactLine,
    MonthlyPlanLine,
    PlanVersion,
    PlannedEvent,
    PlanStatus,
    Position,
    PositionAssignment,
    HireStatus,
    OrgUnit,
)
from app.schemas import (
    ClassificationChangeCreate,
    ClosePositionCreate,
    EventCreate,
    EmployeeTransferCreate,
    IndexationCreate,
    ManualOverrideCreate,
    PlanCreate,
    PlanOut,
    ReviewCreate,
    TargetSalaryCreate,
    TerminationCreate,
    VarianceRow,
)
from app.services.variance_report import get_variance_report
from app.services.budget import get_budget_kpis, get_budget_rows
from app.services.import_csv import import_employees, import_fact
from app.services.org_scope import build_org_subtree, filter_org_codes
from app.services.carryover import apply_carryover_events
from app.services.plan_compare import compare_plan_versions
from app.services.plan_correction import create_correction_version
from app.services.plan_guard import require_plan_draft_for_edit
from app.services.recalc import recalculate_plan

router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


@router.get("", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(PlanVersion).order_by(PlanVersion.plan_year.desc(), PlanVersion.id.desc()).all()


@router.get("/compare")
def compare_plans(
    left_plan_id: int,
    right_plan_id: int,
    article: str = "BASE",
    month: int | None = None,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    del cu  # read-only, any authenticated user
    try:
        return compare_plan_versions(db, left_plan_id, right_plan_id, article=article, month=month)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("", response_model=PlanOut)
def create_plan(body: PlanCreate, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    plan = PlanVersion(plan_year=body.plan_year, label=body.label, parent_version_id=body.parent_version_id)
    db.add(plan)
    db.flush()
    apply_carryover_events(db, plan)
    db.add(AuditLog(username=cu.user.username, action="create", entity_type="plan", entity_id=None, details=body.model_dump()))
    db.commit()
    recalculate_plan(db, plan)
    db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    return plan


@router.post("/{plan_id}/approve", response_model=PlanOut)
def approve_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    if not cu.is_admin:
        raise HTTPException(403, "Утверждение доступно только admin")
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    if plan.status != PlanStatus.DRAFT:
        raise HTTPException(400, f"Утвердить можно только DRAFT, сейчас {plan.status.value}")
    plan.status = PlanStatus.APPROVED
    db.add(
        AuditLog(
            username=cu.user.username,
            action="approve",
            entity_type="plan_version",
            entity_id=plan.id,
            details={"plan_year": plan.plan_year, "label": plan.label},
        )
    )
    db.commit()
    db.refresh(plan)
    return plan


@router.post("/{plan_id}/correction", response_model=PlanOut)
def create_plan_correction(
    plan_id: int,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
    label: str | None = None,
):
    if not cu.is_admin:
        raise HTTPException(403, "Корректировка доступна только admin")
    parent = db.get(PlanVersion, plan_id)
    if not parent:
        raise HTTPException(404)
    try:
        child = create_correction_version(db, parent, label=label, username=cu.user.username)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    db.add(
        AuditLog(
            username=cu.user.username,
            action="correction",
            entity_type="plan_version",
            entity_id=child.id,
            details={"parent_version_id": parent.id, "label": child.label},
        )
    )
    db.commit()
    db.refresh(child)
    return child


@router.post("/{plan_id}/recalculate")
def recalc(plan_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    if plan.status == PlanStatus.LOCKED and not cu.is_admin:
        raise HTTPException(403, "Plan is locked")
    count = recalculate_plan(db, plan)
    return {"lines": count}


@router.post("/{plan_id}/events")
def add_event(
    plan_id: int,
    body: EventCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    payload = dict(body.payload)
    if body.employee_external_id:
        payload["employee_external_id"] = body.employee_external_id
    if body.position_external_id:
        payload["position_external_id"] = body.position_external_id
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type=body.event_type,
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.add(AuditLog(username=cu.user.username, action="event", entity_type="planned_event", details=body.model_dump()))
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/indexation")
def indexation(
    plan_id: int,
    body: IndexationCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    if body.index_percent is None and body.index_fixed is None:
        raise HTTPException(400, "Укажите index_percent или index_fixed для индексации")
    payload = {
        "index_percent": body.index_percent,
        "index_fixed": body.index_fixed,
        "index_article": body.index_article,
        "scope_org_unit": body.scope_org_unit,
        "scope_specialization": body.scope_specialization,
    }
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="INDEXATION",
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/reviews")
def salary_review(
    plan_id: int,
    body: ReviewCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    payload = {
        "employee_external_id": body.employee_external_id,
        "specialization": body.specialization,
        "level": body.level,
        "new_amounts": body.new_amounts,
        "percent_change": body.percent_change,
        "target_cr": body.target_cr,
        "band_anchor": body.band_anchor,
    }
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="SALARY_REVIEW",
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/import/employees")
async def import_emp(
    plan_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    if not cu.is_admin:
        raise HTTPException(403, "Admin only")
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    content = (await file.read()).decode("utf-8-sig")
    hist = import_employees(db, plan, content, cu.user.username)
    return {"ok": hist.rows_ok, "errors": hist.errors}


@router.get("/{plan_id}/grid")
def plan_grid(
    plan_id: int,
    org_unit: str | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    q = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id)
    if month:
        q = q.filter(MonthlyPlanLine.month == month)
    lines = q.all()
    subtree = build_org_subtree(db)
    if not cu.is_admin:
        allowed = filter_org_codes([l.org_unit_code for l in lines], cu.user.scope_org_codes, subtree, False)
        lines = [l for l in lines if l.org_unit_code in allowed]
    if org_unit:
        desc = subtree.get(org_unit, {org_unit})
        lines = [l for l in lines if l.org_unit_code in desc]
    return [
        {
            "employee_external_id": l.employee_external_id,
            "position_external_id": l.position_external_id,
            "org_unit_code": l.org_unit_code,
            "month": l.month,
            "article": l.article,
            "amount": float(l.amount),
            "currency": l.currency,
        }
        for l in lines
    ]


@router.get("/{plan_id}/budget")
def plan_budget(plan_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    subtree = build_org_subtree(db)
    allowed: set[str] | None = None
    if not cu.is_admin:
        all_codes = [c for (c,) in db.query(OrgUnit.code).all()]
        allowed = set(filter_org_codes(all_codes, cu.user.scope_org_codes, subtree, False))
    rows = get_budget_rows(db, plan_id, plan.plan_year, allowed)
    kpis = get_budget_kpis(db, plan_id, plan.plan_year, rows)
    return {"rows": rows, "kpis": kpis}


@router.delete("/{plan_id}/events/{event_id}")
def delete_event(
    plan_id: int,
    event_id: int,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    ev = db.get(PlannedEvent, event_id)
    if not ev or ev.plan_version_id != plan_id:
        raise HTTPException(404)
    db.delete(ev)
    db.add(
        AuditLog(
            username=cu.user.username,
            action="delete_event",
            entity_type="planned_event",
            entity_id=event_id,
            details={"event_id": event_id},
        )
    )
    db.commit()
    recalculate_plan(db, plan)
    return {"ok": True}


@router.post("/{plan_id}/target-salary")
def target_salary(
    plan_id: int,
    body: TargetSalaryCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    payload = {
        "position_external_id": body.position_external_id,
        "employee_external_id": body.employee_external_id,
        "new_amounts": {"BASE": body.target_amount},
    }
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="TARGET_SALARY",
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/manual-override")
def manual_override(
    plan_id: int,
    body: ManualOverrideCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    new_amounts: dict[str, float] = {}
    if body.base_amount is not None:
        new_amounts["BASE"] = body.base_amount
    if body.bonus_amount is not None:
        new_amounts["BONUS_PLAN"] = body.bonus_amount
    if not new_amounts:
        raise HTTPException(400, "Укажите base_amount и/или bonus_amount")
    payload = {
        "position_external_id": body.position_external_id,
        "employee_external_id": body.employee_external_id,
        "new_amounts": new_amounts,
        "propagate_forward": body.propagate_forward,
    }
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="MANUAL_OVERRIDE",
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.get("/{plan_id}/events")
def list_events(plan_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(PlannedEvent)
        .filter(PlannedEvent.plan_version_id == plan_id)
        .order_by(PlannedEvent.effective_month, PlannedEvent.created_order)
        .all()
    )
    return [
        {
            "id": r.id,
            "event_type": r.event_type,
            "effective_month": r.effective_month,
            "payload": r.payload,
            "created_by": r.created_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/{plan_id}/summary")
def plan_summary(plan_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    lines = plan_grid(plan_id, db=db, cu=cu)
    positions = db.query(Position).filter(Position.is_active).count()
    employees = db.query(Employee).count()
    vacancies = db.query(Position).filter(Position.is_vacancy, Position.is_active).count()
    year_total = sum(l["amount"] for l in lines if l["article"] == "BASE")
    events_count = db.query(PlannedEvent).filter(PlannedEvent.plan_version_id == plan_id).count()
    return {
        "plan_lines": len(lines),
        "year_total_base": year_total,
        "positions": positions,
        "employees": employees,
        "vacancies": vacancies,
        "events": events_count,
    }


@router.get("/{plan_id}/dashboard")
def dashboard(plan_id: int, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    raw = plan_grid(plan_id, db=db, cu=cu)
    by_month_base: dict[int, float] = defaultdict(float)
    by_month_bonus: dict[int, float] = defaultdict(float)
    for l in raw:
        if l["article"] == "BASE":
            by_month_base[l["month"]] += l["amount"]
        if l["article"] == "BONUS_PLAN":
            by_month_bonus[l["month"]] += l["amount"]
    months = sorted(set(by_month_base) | set(by_month_bonus))
    return {
        "months": [
            {
                "month": m,
                "total_base": by_month_base[m],
                "total_bonus": by_month_bonus[m],
                "total": by_month_base[m] + by_month_bonus[m],
            }
            for m in months
        ]
    }


@router.get("/{plan_id}/variance-report")
def variance_report(
    plan_id: int,
    month: int | None = None,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    return get_variance_report(db, plan_id, month)


@router.post("/{plan_id}/termination")
def terminate_employee(
    plan_id: int,
    body: TerminationCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    emp = db.query(Employee).filter(Employee.external_id == body.employee_external_id).first()
    source_assignment = None
    source_position_external = body.position_external_id
    if emp:
        eff_date = date(plan.plan_year, body.effective_month, 1)
        prev_day = eff_date - timedelta(days=1)
        source_assignment = (
            db.query(PositionAssignment)
            .join(Position, PositionAssignment.position_id == Position.id)
            .filter(
                PositionAssignment.employee_id == emp.id,
                PositionAssignment.valid_from <= eff_date,
                (PositionAssignment.valid_to.is_(None)) | (PositionAssignment.valid_to >= eff_date),
            )
            .order_by(PositionAssignment.valid_from.desc())
            .first()
        )
        if source_assignment:
            source_assignment.valid_to = prev_day
            pos_obj = db.query(Position).filter(Position.id == source_assignment.position_id).first()
            if pos_obj:
                source_position_external = pos_obj.external_id
    ev_type = "TERMINATION_TO_VACANCY" if body.to_vacancy else "TERMINATION"
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type=ev_type,
        effective_month=body.effective_month,
        payload={
            "employee_external_id": body.employee_external_id,
            "position_external_id": source_position_external,
        },
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    if body.to_vacancy:
        pos = (
            db.query(Position)
            .filter(func.lower(Position.external_id) == source_position_external.lower())
            .first()
        )
        if pos:
            pos.is_vacancy = True
            pos.hire_status = pos.hire_status or HireStatus.CARRYOVER
            pos.hire_month = body.effective_month
        month_for_amount = body.effective_month - 1 if body.effective_month > 1 else 1
        base_line = (
            db.query(MonthlyPlanLine)
            .filter(
                MonthlyPlanLine.plan_version_id == plan_id,
                MonthlyPlanLine.employee_external_id == body.employee_external_id,
                MonthlyPlanLine.article == "BASE",
                MonthlyPlanLine.month <= month_for_amount,
            )
            .order_by(MonthlyPlanLine.month.desc(), MonthlyPlanLine.id.desc())
            .first()
        )
        if base_line is None:
            base_line = (
                db.query(MonthlyPlanLine)
                .filter(
                    MonthlyPlanLine.plan_version_id == plan_id,
                    MonthlyPlanLine.position_external_id == source_position_external,
                    MonthlyPlanLine.article == "BASE",
                    MonthlyPlanLine.month <= month_for_amount,
                )
                .order_by(MonthlyPlanLine.month.desc(), MonthlyPlanLine.id.desc())
                .first()
            )
        bonus_line = (
            db.query(MonthlyPlanLine)
            .filter(
                MonthlyPlanLine.plan_version_id == plan_id,
                MonthlyPlanLine.employee_external_id == body.employee_external_id,
                MonthlyPlanLine.article == "BONUS_PLAN",
                MonthlyPlanLine.month <= month_for_amount,
            )
            .order_by(MonthlyPlanLine.month.desc(), MonthlyPlanLine.id.desc())
            .first()
        )
        hire_amounts: dict[str, float] = {"BASE": float(base_line.amount) if base_line is not None else 0.0}
        if bonus_line is not None and float(bonus_line.amount) != 0:
            hire_amounts["BONUS_PLAN"] = float(bonus_line.amount)
        vac_ev = PlannedEvent(
            plan_version_id=plan_id,
            event_type="PLANNED_HIRE",
            effective_month=body.effective_month,
            payload={
                "position_external_id": source_position_external,
                "hire_amounts": hire_amounts,
            },
            created_order=order + 2,
            created_by=cu.user.username,
        )
        db.add(vac_ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/close-position")
def close_position(
    plan_id: int,
    body: ClosePositionCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="TERMINATION_CLOSE_POSITION",
        effective_month=body.effective_month,
        payload={"position_external_id": body.position_external_id},
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    pos = db.query(Position).filter(Position.external_id == body.position_external_id).first()
    if pos:
        pos.is_active = False
    db.commit()
    recalculate_plan(db, plan)
    return {"id": ev.id}


@router.post("/{plan_id}/classification")
def classification_change(
    plan_id: int,
    body: ClassificationChangeCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)
    pos = db.query(Position).filter(Position.external_id == body.position_external_id).first()
    if not pos:
        raise HTTPException(404)
    payload = {
        "position_external_id": body.position_external_id,
        "employee_external_id": body.employee_external_id,
        "specialization": body.specialization,
        "level": body.level,
    }
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev = PlannedEvent(
        plan_version_id=plan_id,
        event_type="CLASSIFICATION",
        effective_month=body.effective_month,
        payload=payload,
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.commit()
    recalculate_plan(db, plan)
    return {"ok": True, "event_id": ev.id}


@router.post("/{plan_id}/transfer")
def transfer_employee(
    plan_id: int,
    body: EmployeeTransferCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    require_plan_draft_for_edit(plan)

    employee = db.query(Employee).filter(Employee.external_id == body.employee_external_id).first()
    if not employee:
        raise HTTPException(404, "Employee not found")

    from_position = db.query(Position).filter(Position.external_id == body.from_position_external_id).first()
    to_position = db.query(Position).filter(Position.external_id == body.to_position_external_id).first()
    if not from_position or not to_position:
        raise HTTPException(404, "Position not found")

    transfer_date = date(plan.plan_year, body.effective_month, 1)
    prev_day = transfer_date - timedelta(days=1)

    from_assignment = (
        db.query(PositionAssignment)
        .filter(
            PositionAssignment.employee_id == employee.id,
            PositionAssignment.position_id == from_position.id,
            PositionAssignment.valid_from <= transfer_date,
        )
        .order_by(PositionAssignment.valid_from.desc())
        .first()
    )
    if not from_assignment or (from_assignment.valid_to and from_assignment.valid_to < transfer_date):
        raise HTTPException(400, "Employee is not active on source position at transfer month")

    from_assignment.valid_to = prev_day

    to_assignment = (
        db.query(PositionAssignment)
        .filter(
            PositionAssignment.employee_id == employee.id,
            PositionAssignment.position_id == to_position.id,
            PositionAssignment.valid_from == transfer_date,
        )
        .first()
    )
    if not to_assignment:
        to_assignment = PositionAssignment(
            employee_id=employee.id,
            position_id=to_position.id,
            specialization=to_position.specialization,
            level=to_position.level,
            valid_from=transfer_date,
            valid_to=None,
        )
        db.add(to_assignment)
    else:
        to_assignment.specialization = to_position.specialization
        to_assignment.level = to_position.level
        to_assignment.valid_to = None

    from_position.is_vacancy = True
    from_position.hire_status = from_position.hire_status or HireStatus.CARRYOVER
    from_position.hire_month = body.effective_month
    to_position.is_vacancy = False

    month_for_amount = body.effective_month - 1 if body.effective_month > 1 else 1
    base_line = (
        db.query(MonthlyPlanLine)
        .filter(
            MonthlyPlanLine.plan_version_id == plan_id,
            MonthlyPlanLine.employee_external_id == body.employee_external_id,
            MonthlyPlanLine.month == month_for_amount,
            MonthlyPlanLine.article == "BASE",
        )
        .order_by(MonthlyPlanLine.id.desc())
        .first()
    )
    bonus_line = (
        db.query(MonthlyPlanLine)
        .filter(
            MonthlyPlanLine.plan_version_id == plan_id,
            MonthlyPlanLine.employee_external_id == body.employee_external_id,
            MonthlyPlanLine.month == month_for_amount,
            MonthlyPlanLine.article == "BONUS_PLAN",
        )
        .order_by(MonthlyPlanLine.id.desc())
        .first()
    )
    base_amount = body.base_amount if body.base_amount is not None else float(base_line.amount) if base_line else 0.0
    bonus_amount = body.bonus_amount if body.bonus_amount is not None else float(bonus_line.amount) if bonus_line else 0.0

    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    ev_termination = PlannedEvent(
        plan_version_id=plan_id,
        event_type="TERMINATION_TO_VACANCY",
        effective_month=body.effective_month,
        payload={
            "employee_external_id": body.employee_external_id,
            "position_external_id": body.from_position_external_id,
        },
        created_order=order + 1,
        created_by=cu.user.username,
    )
    vac_hire_amounts: dict[str, float] = {"BASE": base_amount}
    if bonus_amount != 0:
        vac_hire_amounts["BONUS_PLAN"] = bonus_amount
    ev_vacancy = PlannedEvent(
        plan_version_id=plan_id,
        event_type="PLANNED_HIRE",
        effective_month=body.effective_month,
        payload={
            "position_external_id": body.from_position_external_id,
            "hire_amounts": vac_hire_amounts,
        },
        created_order=order + 2,
        created_by=cu.user.username,
    )
    ev_override = PlannedEvent(
        plan_version_id=plan_id,
        event_type="MANUAL_OVERRIDE",
        effective_month=body.effective_month,
        payload={
            "employee_external_id": body.employee_external_id,
            "position_external_id": body.to_position_external_id,
            "new_amounts": {"BASE": base_amount, "BONUS_PLAN": bonus_amount},
            "propagate_forward": True,
        },
        created_order=order + 3,
        created_by=cu.user.username,
    )
    ev_transfer = PlannedEvent(
        plan_version_id=plan_id,
        event_type="TRANSFER",
        effective_month=body.effective_month,
        payload={
            "employee_external_id": body.employee_external_id,
            "from_position_external_id": body.from_position_external_id,
            "to_position_external_id": body.to_position_external_id,
            "vacancy_base_amount": base_amount,
            "vacancy_bonus_amount": bonus_amount,
        },
        created_order=order + 4,
        created_by=cu.user.username,
    )
    db.add(ev_termination)
    db.add(ev_vacancy)
    db.add(ev_override)
    db.add(ev_transfer)
    db.add(
        AuditLog(
            username=cu.user.username,
            action="transfer",
            entity_type="employee",
            entity_id=body.employee_external_id,
            details=body.model_dump(),
        )
    )
    db.commit()
    recalculate_plan(db, plan)
    return {"ok": True, "termination_event_id": ev_termination.id, "override_event_id": ev_override.id}


@router.get("/{plan_id}/variance", response_model=list[VarianceRow])
def variance(
    plan_id: int,
    month: int | None = None,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    pq = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id)
    fq = db.query(MonthlyFactLine).filter(MonthlyFactLine.plan_version_id == plan_id)
    if month:
        pq = pq.filter(MonthlyPlanLine.month == month)
        fq = fq.filter(MonthlyFactLine.month == month)

    plan_by_pos: dict[tuple, Decimal] = defaultdict(Decimal)
    for l in pq.all():
        key = (l.position_external_id, l.org_unit_code, l.month, l.article)
        plan_by_pos[key] += l.amount

    fact_by_pos: dict[tuple, Decimal] = defaultdict(Decimal)
    fact_emp_count: dict[tuple, set] = defaultdict(set)
    for f in fq.all():
        key = (f.employee_external_id, f.month, f.article)
        pos_key = None
        # aggregate fact by employee then roll to position via last assignment — simplified: by employee
        fact_by_emp_key = (f.employee_external_id, f.month, f.article)
        fact_by_pos_fact = fact_by_emp_key  # employee level for now
        _ = fact_by_pos_fact

    # Position-level: sum plan lines, sum fact by mapping employees to positions
    plan_pos: dict[tuple, Decimal] = defaultdict(Decimal)
    plan_employees: dict[tuple, set] = defaultdict(set)
    for l in pq.all():
        k = (l.position_external_id, l.org_unit_code, l.month, l.article)
        plan_pos[k] += l.amount
        plan_employees[(l.position_external_id, l.month, l.article)].add(l.employee_external_id)

    fact_total: dict[tuple, Decimal] = defaultdict(Decimal)
    fact_emps: dict[tuple, set] = defaultdict(set)
    for f in fq.all():
        k = (f.employee_external_id, f.month, f.article)
        fact_total[k] += f.amount
        # map employee to position from plan lines
        for l in pq.all():
            if l.employee_external_id == f.employee_external_id and l.month == f.month and l.article == f.article:
                pk = (l.position_external_id, l.org_unit_code, l.month, l.article)
                fact_emps[pk].add(f.employee_external_id)

    rows: list[VarianceRow] = []
    for k, p_amt in plan_pos.items():
        pos_id, org, m, art = k
        pe = plan_employees.get((pos_id, m, art), set())
        fe = fact_emps.get(k, set())
        f_amt = Decimal("0")
        for e in fe:
            f_amt += fact_total.get((e, m, art), Decimal("0"))
        var = f_amt - p_amt
        pct = float(var / p_amt * 100) if p_amt else None
        hint = None
        if len(fe) > len(pe):
            hint = "more_employees_than_plan"
        rows.append(
            VarianceRow(
                position_external_id=pos_id,
                org_unit_code=org,
                month=m,
                article=art,
                plan_amount=float(p_amt),
                fact_amount=float(f_amt),
                variance=float(var),
                variance_pct=pct,
                reason_hint=hint,
            )
        )
    return rows


@router.post("/{plan_id}/fact/{year}/{month}/import")
async def import_fact_route(
    plan_id: int,
    year: int,
    month: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    if not cu.is_admin:
        raise HTTPException(403)
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    content = (await file.read()).decode("utf-8-sig")
    hist = import_fact(db, plan, content, cu.user.username, year, month)
    return {"ok": hist.rows_ok, "errors": hist.errors}


@router.get("/{plan_id}/diff/{other_id}")
def plan_diff(plan_id: int, other_id: int, db: Session = Depends(get_db)):
    a = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == plan_id).all()
    b = db.query(MonthlyPlanLine).filter(MonthlyPlanLine.plan_version_id == other_id).all()
    map_a = {(x.employee_external_id, x.position_external_id, x.month, x.article): x.amount for x in a}
    map_b = {(x.employee_external_id, x.position_external_id, x.month, x.article): x.amount for x in b}
    keys = set(map_a) | set(map_b)
    diff = []
    for k in keys:
        va, vb = map_a.get(k, Decimal("0")), map_b.get(k, Decimal("0"))
        if va != vb:
            diff.append({"key": k, "version_a": float(va), "version_b": float(vb), "delta": float(vb - va)})
    return diff
