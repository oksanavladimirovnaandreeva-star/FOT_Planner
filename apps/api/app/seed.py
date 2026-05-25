import os
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import (
    DecSnapshot,
    Employee,
    HireStatus,
    LimitFlag,
    MonthlyFactLine,
    OrgUnit,
    PlanVersion,
    PlannedEvent,
    Position,
    PositionAssignment,
    PositionIdSequence,
    SalaryRangeBand,
    SalaryRangeCatalog,
    User,
    UserRole,
)


def _wipe_demo_data(db: Session) -> None:
    db.query(MonthlyFactLine).delete()
    db.query(DecSnapshot).delete()
    db.query(PlannedEvent).delete()
    db.query(PositionAssignment).delete()
    db.query(PlanVersion).delete()
    db.query(Position).delete()
    db.query(Employee).delete()
    db.query(SalaryRangeBand).delete()
    db.query(SalaryRangeCatalog).delete()
    db.query(OrgUnit).delete()
    db.query(PositionIdSequence).delete()
    db.query(User).delete()
    db.commit()


def _ensure_users(db: Session) -> None:
    db.add_all(
        [
            User(username="admin", display_name="Администратор", role=UserRole.ADMIN, scope_org_codes=[]),
            User(username="user_it", display_name="Руководитель IT", role=UserRole.USER, scope_org_codes=["DEPT-IT"]),
            User(username="user_fin", display_name="Руководитель FIN", role=UserRole.USER, scope_org_codes=["DEPT-FIN"]),
        ]
    )
    db.commit()


def _create_org_units(db: Session) -> dict[str, OrgUnit]:
    rows = [
        ("CORP", "Компания", None),
        ("DEPT-IT", "IT департамент", "CORP"),
        ("DEPT-FIN", "Finance департамент", "CORP"),
        ("DEPT-OPS", "Operations департамент", "CORP"),
        ("TEAM-BE", "Backend Team", "DEPT-IT"),
        ("TEAM-FE", "Frontend Team", "DEPT-IT"),
        ("TEAM-QA", "QA Team", "DEPT-IT"),
        ("TEAM-FP", "Financial Planning", "DEPT-FIN"),
        ("TEAM-OPS", "Ops Team", "DEPT-OPS"),
    ]
    by_code: dict[str, OrgUnit] = {}
    for code, name, parent in rows:
        parent_id = by_code[parent].id if parent else None
        ou = OrgUnit(code=code, name=name, parent_id=parent_id)
        db.add(ou)
        db.flush()
        by_code[code] = ou
    db.commit()
    return by_code


def _create_salary_catalog(db: Session) -> None:
    catalog = SalaryRangeCatalog(plan_year=2026, version_label="2026-main", valid_from=date(2026, 1, 1))
    db.add(catalog)
    db.flush()
    bands = [
        ("Backend", "Senior", 220000, 260000, 320000),
        ("Backend", "Middle", 150000, 190000, 230000),
        ("Frontend", "Senior", 210000, 250000, 300000),
        ("Frontend", "Middle", 140000, 180000, 220000),
        ("QA", "Senior", 160000, 200000, 250000),
        ("QA", "Middle", 120000, 150000, 190000),
        ("Finance", "Senior", 180000, 230000, 280000),
        ("Finance", "Middle", 130000, 170000, 210000),
        ("Operations", "Senior", 170000, 210000, 260000),
        ("Operations", "Middle", 120000, 155000, 195000),
    ]
    for spec, lvl, mn, mid, mx in bands:
        db.add(
            SalaryRangeBand(
                catalog_id=catalog.id,
                specialization=spec,
                level=lvl,
                min_salary=Decimal(mn),
                midpoint=Decimal(mid),
                max_salary=Decimal(mx),
            )
        )
    db.commit()


def _create_positions(db: Session, orgs: dict[str, OrgUnit]) -> dict[str, Position]:
    rows = [
        ("П001", "TEAM-BE", "Backend", "Senior", False, "Backend Senior 1"),
        ("П002", "TEAM-BE", "Backend", "Middle", False, "Backend Middle 1"),
        ("П003", "TEAM-FE", "Frontend", "Senior", False, "Frontend Senior 1"),
        ("П004", "TEAM-FE", "Frontend", "Middle", False, "Frontend Middle 1"),
        ("П005", "TEAM-QA", "QA", "Senior", False, "QA Senior 1"),
        ("П006", "TEAM-QA", "QA", "Middle", False, "QA Middle 1"),
        ("П007", "TEAM-FP", "Finance", "Senior", False, "Finance Senior 1"),
        ("П008", "TEAM-FP", "Finance", "Middle", False, "Finance Middle 1"),
        ("П009", "TEAM-OPS", "Operations", "Senior", False, "Operations Senior 1"),
        ("П010", "TEAM-OPS", "Operations", "Middle", False, "Operations Middle 1"),
        ("П011", "TEAM-FP", "Finance", "Senior", True, "Finance Senior Vacancy"),
        ("П012", "TEAM-OPS", "Operations", "Middle", True, "Operations Middle Vacancy"),
        ("П013", "TEAM-BE", "Backend", "Middle", True, "Backend Middle Vacancy"),
        ("П014", "TEAM-QA", "QA", "Middle", True, "QA Middle Vacancy"),
    ]
    by_id: dict[str, Position] = {}
    for ext, org_code, spec, lvl, is_vacancy, title in rows:
        pos = Position(
            external_id=ext,
            org_unit_id=orgs[org_code].id,
            job_title=title,
            specialization=spec,
            level=lvl,
            limit_flag=LimitFlag.IN_LIMIT,
            hire_status=HireStatus.CARRYOVER if is_vacancy else None,
            hire_month=1 if is_vacancy else None,
            is_vacancy=is_vacancy,
        )
        db.add(pos)
        db.flush()
        by_id[ext] = pos
    db.add(PositionIdSequence(id=1, last_value=14))
    db.commit()
    return by_id


def _create_employees(db: Session) -> dict[str, Employee]:
    employees = {
        "E001": "Иванов И.И.",
        "E002": "Петров П.П.",
        "E003": "Смирнова А.А.",
        "E004": "Кузнецов Д.Д.",
        "E005": "Соколова Е.Е.",
        "E006": "Волков Р.Р.",
        "E007": "Орлова Н.Н.",
        "E008": "Лебедев М.М.",
        "E009": "Новикова Т.Т.",
        "E010": "Морозов В.В.",
        "E011": "Зайцева К.К.",
        "E012": "Федоров Л.Л.",
    }
    by_id: dict[str, Employee] = {}
    for ext, name in employees.items():
        emp = Employee(external_id=ext, full_name=name)
        db.add(emp)
        db.flush()
        by_id[ext] = emp
    db.commit()
    return by_id


def _create_assignments(db: Session, positions: dict[str, Position], employees: dict[str, Employee]) -> None:
    rows = [
        ("E001", "П001", "Backend", "Senior", date(2025, 1, 1), None),
        ("E002", "П002", "Backend", "Middle", date(2025, 1, 1), None),
        ("E003", "П003", "Frontend", "Senior", date(2025, 1, 1), date(2026, 5, 31)),
        ("E003", "П011", "Finance", "Senior", date(2026, 6, 1), None),  # переход в другую команду на вакансию
        ("E004", "П004", "Frontend", "Middle", date(2025, 1, 1), None),
        ("E005", "П005", "QA", "Senior", date(2025, 1, 1), None),
        ("E006", "П006", "QA", "Middle", date(2025, 1, 1), None),
        ("E007", "П007", "Finance", "Senior", date(2025, 1, 1), date(2026, 8, 31)),
        ("E007", "П012", "Operations", "Middle", date(2026, 9, 1), None),  # переход в другой департамент
        ("E008", "П008", "Finance", "Middle", date(2025, 1, 1), None),
        ("E009", "П009", "Operations", "Senior", date(2025, 1, 1), None),
        ("E010", "П010", "Operations", "Middle", date(2025, 1, 1), None),
    ]
    for emp_id, pos_id, spec, lvl, vf, vt in rows:
        db.add(
            PositionAssignment(
                employee_id=employees[emp_id].id,
                position_id=positions[pos_id].id,
                specialization=spec,
                level=lvl,
                valid_from=vf,
                valid_to=vt,
            )
        )
    db.commit()


def _create_plan_and_events(db: Session, positions: dict[str, Position], employees: dict[str, Employee]) -> PlanVersion:
    plan = PlanVersion(plan_year=2026, label="baseline")
    db.add(plan)
    db.flush()

    dec_amounts = {
        "E001": ("П001", 250000),
        "E002": ("П002", 185000),
        "E003": ("П003", 240000),
        "E004": ("П004", 175000),
        "E005": ("П005", 195000),
        "E006": ("П006", 150000),
        "E007": ("П007", 220000),
        "E008": ("П008", 165000),
        "E009": ("П009", 205000),
        "E010": ("П010", 160000),
    }
    for emp_id, (pos_id, amount) in dec_amounts.items():
        db.add(
            DecSnapshot(
                plan_version_id=plan.id,
                employee_id=employees[emp_id].id,
                position_id=positions[pos_id].id,
                article="BASE",
                amount=Decimal(amount),
            )
        )

    db.add_all(
        [
            PlannedEvent(
                plan_version_id=plan.id,
                event_type="INDEXATION",
                effective_month=4,
                payload={"index_percent": 10, "index_article": "BASE"},
                created_order=1,
                created_by="system",
            ),
            PlannedEvent(
                plan_version_id=plan.id,
                event_type="CLASSIFICATION",
                effective_month=7,
                payload={
                    "employee_external_id": "E006",
                    "position_external_id": "П006",
                    "specialization": "QA",
                    "level": "Senior",
                },
                created_order=2,
                created_by="system",
            ),
            PlannedEvent(
                plan_version_id=plan.id,
                event_type="MANUAL_OVERRIDE",
                effective_month=8,
                payload={
                    "employee_external_id": "E006",
                    "position_external_id": "П006",
                    "new_amounts": {"BASE": 210000},
                    "propagate_forward": True,
                },
                created_order=3,
                created_by="system",
            ),
            PlannedEvent(
                plan_version_id=plan.id,
                event_type="TERMINATION_TO_VACANCY",
                effective_month=6,
                payload={"employee_external_id": "E003", "position_external_id": "П003"},
                created_order=4,
                created_by="system",
            ),
            PlannedEvent(
                plan_version_id=plan.id,
                event_type="MANUAL_OVERRIDE",
                effective_month=6,
                payload={
                    "employee_external_id": "E003",
                    "position_external_id": "П011",
                    "new_amounts": {"BASE": 250000},
                    "propagate_forward": True,
                },
                created_order=5,
                created_by="system",
            ),
        ]
    )

    for emp_id, amount in [("E001", 252000), ("E003", 245000), ("E009", 210000)]:
        db.add(
            MonthlyFactLine(
                plan_version_id=plan.id,
                employee_external_id=emp_id,
                year=2026,
                month=1,
                article="BASE",
                amount=Decimal(amount),
            )
        )

    db.commit()
    return plan


def seed_database(db: Session) -> None:
    """Создаёт расширенные демо-данные (10+ сотрудников, переходы, вакансии)."""
    force = os.getenv("FOT_RESEED_DEMO", "").strip() == "1"
    has_data = db.query(PlanVersion).count() > 0
    if has_data and not force:
        return
    _wipe_demo_data(db)
    _ensure_users(db)
    orgs = _create_org_units(db)
    _create_salary_catalog(db)
    positions = _create_positions(db, orgs)
    employees = _create_employees(db)
    _create_assignments(db, positions, employees)
    plan = _create_plan_and_events(db, positions, employees)
    from app.services.recalc import recalculate_plan

    recalculate_plan(db, plan)
