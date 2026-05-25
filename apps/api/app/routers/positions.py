from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import (
    AuditLog,
    DecSnapshot,
    Employee,
    HireStatus,
    LimitFlag,
    OrgUnit,
    PlanVersion,
    PlannedEvent,
    Position,
    PositionAssignment,
    MonthlyPlanLine,
    SalaryRangeBand,
    SalaryRangeCatalog,
)
from app.schemas import VacancyCreate
from app.services.org_scope import build_org_subtree, filter_org_codes
from app.services.position_id_alloc import allocate_position_id, _sync_sequence_from_positions
from app.services.recalc import recalculate_plan
from sqlalchemy import func

router = APIRouter(prefix="/api/v1/positions", tags=["positions"])


class PositionCreate(BaseModel):
    external_id: str
    org_unit_code: str
    specialization: str
    level: str
    limit_flag: str = "IN_LIMIT"
    is_vacancy: bool = False


class PositionUpdate(BaseModel):
    org_unit_code: str | None = None
    job_title: str | None = None
    limit_flag: str | None = None
    is_vacancy: bool | None = None


@router.get("")
def list_positions(
    vacancy: bool | None = None,
    org_unit: str | None = None,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    q = db.query(Position, OrgUnit).join(OrgUnit, Position.org_unit_id == OrgUnit.id).filter(Position.is_active)
    if vacancy is not None:
        q = q.filter(Position.is_vacancy == vacancy)
    rows = q.all()
    subtree = build_org_subtree(db)
    result = []
    for pos, org in rows:
        allowed = filter_org_codes([org.code], cu.user.scope_org_codes, subtree, cu.is_admin)
        if org.code not in allowed:
            continue
        if org_unit:
            desc = subtree.get(org_unit, {org_unit})
            if org.code not in desc:
                continue
        assigns = (
            db.query(PositionAssignment, Employee)
            .join(Employee, PositionAssignment.employee_id == Employee.id)
            .filter(PositionAssignment.position_id == pos.id)
            .all()
        )
        result.append(
            {
                "external_id": pos.external_id,
                "org_unit_code": org.code,
                "specialization": pos.specialization,
                "level": pos.level,
                "limit_flag": pos.limit_flag.value,
                "is_vacancy": pos.is_vacancy,
                "job_title": pos.job_title,
                "hire_status": pos.hire_status.value if pos.hire_status else None,
                "hire_month": pos.hire_month,
                "assignments": [
                    {"employee_id": e.external_id, "full_name": e.full_name, "specialization": a.specialization, "level": a.level}
                    for a, e in assigns
                ],
            }
        )
    return result


@router.post("")
def create_position(body: PositionCreate, db: Session = Depends(get_db), cu: CurrentUser = Depends(get_current_user)):
    org = db.query(OrgUnit).filter(OrgUnit.code == body.org_unit_code).first()
    if not org:
        raise HTTPException(400, "Unknown org unit")
    pos = Position(
        external_id=body.external_id,
        org_unit_id=org.id,
        specialization=body.specialization,
        level=body.level,
        limit_flag=LimitFlag(body.limit_flag),
        is_vacancy=body.is_vacancy,
    )
    db.add(pos)
    db.commit()
    return {"external_id": pos.external_id}


@router.post("/vacancy")
def create_vacancy(
    body: VacancyCreate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    plan = db.get(PlanVersion, body.plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    org = db.query(OrgUnit).filter(OrgUnit.code == body.org_unit_code).first()
    if not org:
        raise HTTPException(400, "Unknown org unit")
    subtree = build_org_subtree(db)
    allowed = filter_org_codes([org.code], cu.user.scope_org_codes, subtree, cu.is_admin)
    if org.code not in allowed:
        raise HTTPException(403, "Org unit out of scope")

    _sync_sequence_from_positions(db)
    ext_id = allocate_position_id(db)
    try:
        hire_status = HireStatus(body.hire_status)
    except ValueError:
        hire_status = HireStatus.NEW_HIRE

    pos = Position(
        external_id=ext_id,
        org_unit_id=org.id,
        job_title=body.job_title,
        specialization=body.specialization,
        level=body.level,
        limit_flag=LimitFlag(body.limit_flag),
        hire_status=hire_status,
        hire_month=body.hire_month,
        is_vacancy=True,
    )
    db.add(pos)
    db.flush()

    hire_amounts = {"BASE": body.base_salary}
    if body.variable_salary:
        hire_amounts["BONUS_PLAN"] = body.variable_salary

    order = (
        db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == body.plan_id).scalar() or 0
    )
    ev = PlannedEvent(
        plan_version_id=body.plan_id,
        event_type="PLANNED_HIRE",
        effective_month=body.hire_month,
        payload={
            "position_external_id": ext_id,
            "specialization": body.specialization,
            "level": body.level,
            "hire_amounts": hire_amounts,
        },
        created_order=order + 1,
        created_by=cu.user.username,
    )
    db.add(ev)
    db.add(
        AuditLog(
            username=cu.user.username,
            action="vacancy",
            entity_type="position",
            entity_id=pos.id,
            details={"external_id": ext_id},
        )
    )
    db.commit()
    recalculate_plan(db, plan)

    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan.plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    band = None
    if catalog:
        band = (
            db.query(SalaryRangeBand)
            .filter(
                SalaryRangeBand.catalog_id == catalog.id,
                SalaryRangeBand.specialization == body.specialization,
                SalaryRangeBand.level == body.level,
            )
            .first()
        )
    midpoint = float(band.midpoint) if band else None
    cr = round(body.base_salary / midpoint, 2) if midpoint else None

    return {
        "external_id": ext_id,
        "cr": cr,
        "range": {
            "min": float(band.min_salary) if band else None,
            "mid": midpoint,
            "max": float(band.max_salary) if band else None,
        },
    }


@router.delete("/{external_id}")
def delete_vacancy(
    external_id: str,
    plan_id: int,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    pos = db.query(Position).filter(Position.external_id == external_id).first()
    if not pos:
        raise HTTPException(404)
    if not pos.is_vacancy:
        raise HTTPException(400, "Только вакансию можно удалить этим способом")
    plan = db.get(PlanVersion, plan_id)
    if not plan:
        raise HTTPException(404)
    order = db.query(func.max(PlannedEvent.created_order)).filter(PlannedEvent.plan_version_id == plan_id).scalar() or 0
    db.add(
        PlannedEvent(
            plan_version_id=plan_id,
            event_type="CANCEL_VACANCY",
            effective_month=1,
            payload={"position_external_id": external_id},
            created_order=order + 1,
            created_by=cu.user.username,
        )
    )
    pos.is_active = False
    pos.is_vacancy = False
    db.add(
        AuditLog(
            username=cu.user.username,
            action="delete_vacancy",
            entity_type="position",
            entity_id=pos.id,
            details={"external_id": external_id},
        )
    )
    db.commit()
    recalculate_plan(db, plan)
    return {"ok": True}


@router.patch("/{external_id}")
def update_position(
    external_id: str,
    body: PositionUpdate,
    db: Session = Depends(get_db),
    cu: CurrentUser = Depends(get_current_user),
):
    pos = db.query(Position, OrgUnit).join(OrgUnit, Position.org_unit_id == OrgUnit.id).filter(Position.external_id == external_id).first()
    if not pos:
        raise HTTPException(404)
    p, org = pos

    if body.org_unit_code and body.org_unit_code != org.code:
        target = db.query(OrgUnit).filter(OrgUnit.code == body.org_unit_code).first()
        if not target:
            raise HTTPException(400, "Unknown org unit")
        subtree = build_org_subtree(db)
        allowed = filter_org_codes([target.code], cu.user.scope_org_codes, subtree, cu.is_admin)
        if target.code not in allowed:
            raise HTTPException(403, "Org unit out of scope")
        p.org_unit_id = target.id

    if body.job_title is not None:
        p.job_title = body.job_title
    if body.limit_flag:
        p.limit_flag = LimitFlag(body.limit_flag)
    if body.is_vacancy is not None:
        p.is_vacancy = body.is_vacancy

    db.commit()
    return {
        "external_id": p.external_id,
        "org_unit_code": body.org_unit_code or org.code,
        "job_title": p.job_title,
        "limit_flag": p.limit_flag.value if hasattr(p.limit_flag, "value") else str(p.limit_flag),
        "is_vacancy": p.is_vacancy,
    }


@router.get("/{external_id}")
def position_detail(
    external_id: str,
    plan_id: int | None = None,
    employee_id: str | None = None,
    db: Session = Depends(get_db),
):
    pos = db.query(Position, OrgUnit).join(OrgUnit, Position.org_unit_id == OrgUnit.id).filter(
        Position.external_id == external_id
    ).first()
    if not pos:
        raise HTTPException(404)
    p, org = pos
    assigns = (
        db.query(PositionAssignment, Employee)
        .join(Employee, PositionAssignment.employee_id == Employee.id)
        .filter(PositionAssignment.position_id == p.id)
        .all()
    )
    grid = []
    if plan_id:
        grid = [
            {
                "employee_external_id": l.employee_external_id,
                "month": l.month,
                "article": l.article,
                "amount": float(l.amount),
            }
            for l in db.query(MonthlyPlanLine)
            .filter(MonthlyPlanLine.plan_version_id == plan_id, MonthlyPlanLine.position_external_id == external_id)
            .all()
        ]
    events = []
    if plan_id:
        all_ev = (
            db.query(PlannedEvent)
            .filter(PlannedEvent.plan_version_id == plan_id)
            .order_by(PlannedEvent.effective_month, PlannedEvent.created_order)
            .all()
        )
        assignment_employee_ids = {e.external_id for _, e in assigns}
        focus_emp = employee_id
        if not focus_emp and len(assigns) == 1:
            focus_emp = assigns[0][1].external_id
        for ev in all_ev:
            pld = ev.payload or {}
            pos_match = pld.get("position_external_id") == external_id
            transfer_pos_match = (
                pld.get("from_position_external_id") == external_id
                or pld.get("to_position_external_id") == external_id
            )
            indexation_match = ev.event_type == "INDEXATION"
            emp_on_pos = False
            if not pos_match and pld.get("employee_external_id"):
                ev_emp = pld.get("employee_external_id")
                if focus_emp:
                    emp_on_pos = ev_emp == focus_emp
                else:
                    emp_on_pos = ev_emp in assignment_employee_ids
            if pos_match or transfer_pos_match or emp_on_pos or indexation_match:
                events.append(
                    {
                        "id": ev.id,
                        "event_type": ev.event_type,
                        "effective_month": ev.effective_month,
                        "payload": pld,
                        "created_by": ev.created_by,
                        "created_order": ev.created_order,
                        "created_at": ev.created_at.isoformat() if ev.created_at else None,
                    }
                )

    def _monthly_for(emp_filter: str | None) -> list[dict]:
        monthly: dict[int, dict] = {}
        spec = p.specialization
        lvl = p.level
        if emp_filter:
            for a, e in assigns:
                if e.external_id == emp_filter:
                    spec, lvl = a.specialization, a.level
        band_mid = None
        for ln in grid:
            if emp_filter and ln["employee_external_id"] != emp_filter:
                continue
            if not emp_filter and ln["employee_external_id"].startswith("VACANCY-"):
                pass
            elif not emp_filter:
                continue
            m = ln["month"]
            if m not in monthly:
                monthly[m] = {"base": 0, "bonus": 0, "total": 0, "specialization": spec, "level": lvl}
            if ln["article"] == "BASE":
                monthly[m]["base"] += ln["amount"]
            elif ln["article"] == "BONUS_PLAN":
                monthly[m]["bonus"] += ln["amount"]
            monthly[m]["total"] = monthly[m]["base"] + monthly[m]["bonus"]
        return monthly

    plan_year = 2026
    if plan_id:
        pv = db.get(PlanVersion, plan_id)
        if pv:
            plan_year = pv.plan_year
    catalog = (
        db.query(SalaryRangeCatalog)
        .filter(SalaryRangeCatalog.plan_year == plan_year)
        .order_by(SalaryRangeCatalog.valid_from.desc())
        .first()
    )
    bands_map: dict[tuple[str, str], float] = {}
    if catalog:
        for b in db.query(SalaryRangeBand).filter(SalaryRangeBand.catalog_id == catalog.id):
            bands_map[(b.specialization, b.level)] = float(b.midpoint)

    def _enrich_monthly(emp_filter: str | None) -> list[dict]:
        raw = _monthly_for(emp_filter)
        if not emp_filter and p.is_vacancy:
            vac = f"VACANCY-{external_id}"
            monthly_v: dict[int, dict] = {}
            for ln in grid:
                if ln["employee_external_id"] != vac:
                    continue
                m = ln["month"]
                if m not in monthly_v:
                    monthly_v[m] = {"base": 0, "bonus": 0, "total": 0, "specialization": p.specialization, "level": p.level}
                if ln["article"] == "BASE":
                    monthly_v[m]["base"] += ln["amount"]
                elif ln["article"] == "BONUS_PLAN":
                    monthly_v[m]["bonus"] += ln["amount"]
                monthly_v[m]["total"] = monthly_v[m]["base"] + monthly_v[m]["bonus"]
            raw = monthly_v
        class_events = [
            ev
            for ev in events
            if ev["event_type"] == "CLASSIFICATION"
            and (
                (ev["payload"] or {}).get("position_external_id") == external_id
                and (
                    not (ev["payload"] or {}).get("employee_external_id")
                    or (ev["payload"] or {}).get("employee_external_id") == emp_filter
                )
            )
        ]
        class_events.sort(key=lambda e: e["effective_month"])

        out = []
        for m in sorted(raw.keys()):
            row = raw[m]
            eff_spec = row["specialization"]
            eff_level = row["level"]
            for cev in class_events:
                if cev["effective_month"] <= m:
                    payload = cev["payload"] or {}
                    eff_spec = payload.get("specialization") or eff_spec
                    eff_level = payload.get("level") or eff_level
            row["specialization"] = eff_spec
            row["level"] = eff_level
            mid = bands_map.get((row["specialization"], row["level"]))
            cr = round(row["base"] / mid, 2) if mid and row["base"] else None
            out.append({**row, "month": m, "cr": cr, "midpoint": mid})
        return out

    focus_emp = employee_id
    if not focus_emp and len(assigns) == 1:
        focus_emp = assigns[0][1].external_id
    if p.is_vacancy and not focus_emp:
        focus_emp = f"VACANCY-{external_id}"

    monthly = _enrich_monthly(focus_emp)
    midpoint = None
    if monthly and monthly[0].get("midpoint"):
        midpoint = monthly[0]["midpoint"]

    dec_prev: float | None = None
    candidate_plan_ids: list[int] = []
    if plan_id:
        candidate_plan_ids.append(plan_id)
        other_ids = [
            row[0]
            for row in db.query(PlanVersion.id)
            .filter(PlanVersion.plan_year == plan_year, PlanVersion.id != plan_id)
            .order_by(PlanVersion.label.desc(), PlanVersion.id.desc())
            .all()
        ]
        candidate_plan_ids.extend(other_ids)

    if candidate_plan_ids and focus_emp and not focus_emp.startswith("VACANCY-"):
        emp_row = db.query(Employee).filter(Employee.external_id == focus_emp).first()
        if emp_row:
            for pid in candidate_plan_ids:
                snap = (
                    db.query(DecSnapshot)
                    .filter(
                        DecSnapshot.plan_version_id == pid,
                        DecSnapshot.employee_id == emp_row.id,
                        DecSnapshot.position_id == p.id,
                        DecSnapshot.article == "BASE",
                    )
                    .first()
                )
                if snap:
                    dec_prev = float(snap.amount)
                    break

    # Fallback for vacancies and mixed assignment history:
    # use position-level December snapshot sum when employee-level snapshot is absent.
    if candidate_plan_ids and dec_prev is None:
        for pid in candidate_plan_ids:
            dec_prev_sum = (
                db.query(func.sum(DecSnapshot.amount))
                .filter(
                    DecSnapshot.plan_version_id == pid,
                    DecSnapshot.position_id == p.id,
                    DecSnapshot.article == "BASE",
                )
                .scalar()
            )
            if dec_prev_sum is not None:
                dec_prev = float(dec_prev_sum)
                break

    return {
        "external_id": p.external_id,
        "org_unit_code": org.code,
        "job_title": p.job_title,
        "specialization": p.specialization,
        "level": p.level,
        "limit_flag": p.limit_flag.value,
        "is_vacancy": p.is_vacancy,
        "hire_status": p.hire_status.value if p.hire_status else None,
        "hire_month": p.hire_month,
        "midpoint": midpoint,
        "assignments": [
            {
                "employee_id": e.external_id,
                "full_name": e.full_name,
                "specialization": a.specialization,
                "level": a.level,
                "valid_from": str(a.valid_from),
                "valid_to": str(a.valid_to) if a.valid_to else None,
            }
            for a, e in assigns
        ],
        "focus_employee_id": focus_emp,
        "dec_prev_base": dec_prev,
        "plan_grid": grid,
        "monthly": monthly,
        "events": events,
    }
