import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.models import (
    DecSnapshot,
    Employee,
    ImportHistory,
    OrgUnit,
    Position,
    PositionAssignment,
    LimitFlag,
    SalaryRangeBand,
    SalaryRangeCatalog,
    MonthlyFactLine,
    PlanVersion,
)
from app.services.recalc import recalculate_plan


def _parse_date(s: str | None):
    if not s or not s.strip():
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date: {s}")


def import_org_units(db: Session, content: str, username: str) -> ImportHistory:
    reader = csv.DictReader(io.StringIO(content))
    errors = []
    ok = 0
    code_to_id: dict[str, int] = {}
    rows = list(reader)
    for row in rows:
        code = row.get("org_unit_code", "").strip()
        if code:
            code_to_id[code] = 0
    for row in rows:
        try:
            code = row["org_unit_code"].strip()
            parent_code = (row.get("parent_code") or "").strip() or None
            unit = db.query(OrgUnit).filter(OrgUnit.code == code).first()
            if not unit:
                unit = OrgUnit(code=code, name=row.get("org_unit_name", code).strip())
                db.add(unit)
                db.flush()
            else:
                unit.name = row.get("org_unit_name", unit.name).strip()
            code_to_id[code] = unit.id
            ok += 1
        except Exception as e:
            errors.append(str(e))
    db.flush()
    for row in rows:
        code = row.get("org_unit_code", "").strip()
        parent_code = (row.get("parent_code") or "").strip() or None
        if code and parent_code and parent_code in code_to_id:
            unit = db.query(OrgUnit).filter(OrgUnit.code == code).first()
            unit.parent_id = code_to_id[parent_code]
    hist = ImportHistory(import_type="org_units", rows_ok=ok, rows_error=len(errors), errors=errors, created_by=username)
    db.add(hist)
    db.commit()
    return hist


def import_positions(db: Session, content: str, username: str) -> ImportHistory:
    reader = csv.DictReader(io.StringIO(content))
    errors = []
    ok = 0
    for row in reader:
        try:
            ext = row["position_id"].strip()
            org = db.query(OrgUnit).filter(OrgUnit.code == row["org_unit_code"].strip()).first()
            if not org:
                raise ValueError(f"Unknown org {row['org_unit_code']}")
            pos = db.query(Position).filter(Position.external_id == ext).first()
            lf = LimitFlag(row.get("limit_flag", "IN_LIMIT").strip())
            vac = row.get("is_vacancy", "false").strip().lower() in ("true", "1", "yes")
            if not pos:
                pos = Position(
                    external_id=ext,
                    org_unit_id=org.id,
                    specialization=row["specialization"].strip(),
                    level=row["level"].strip(),
                    limit_flag=lf,
                    is_vacancy=vac,
                )
                db.add(pos)
            else:
                pos.org_unit_id = org.id
                pos.specialization = row["specialization"].strip()
                pos.level = row["level"].strip()
                pos.limit_flag = lf
                pos.is_vacancy = vac
            ok += 1
        except Exception as e:
            errors.append(str(e))
    hist = ImportHistory(import_type="positions", rows_ok=ok, rows_error=len(errors), errors=errors, created_by=username)
    db.add(hist)
    db.commit()
    return hist


def import_employees(db: Session, plan: PlanVersion, content: str, username: str) -> ImportHistory:
    reader = csv.DictReader(io.StringIO(content))
    errors = []
    ok = 0
    for row in reader:
        try:
            eid = row["employee_id"].strip()
            emp = db.query(Employee).filter(Employee.external_id == eid).first()
            if not emp:
                emp = Employee(external_id=eid, full_name=row.get("full_name"))
                db.add(emp)
                db.flush()
            else:
                emp.full_name = row.get("full_name") or emp.full_name
            pos = db.query(Position).filter(Position.external_id == row["position_id"].strip()).first()
            if not pos:
                raise ValueError(f"Unknown position {row['position_id']}")
            vf = _parse_date(row.get("assignment_valid_from")) or datetime(plan.plan_year - 1, 12, 1).date()
            vt = _parse_date(row.get("assignment_valid_to"))
            asn = PositionAssignment(
                position_id=pos.id,
                employee_id=emp.id,
                specialization=row["specialization"].strip(),
                level=row["level"].strip(),
                valid_from=vf,
                valid_to=vt,
            )
            db.add(asn)
            currency = (row.get("currency") or "RUB").strip()
            base = Decimal(row.get("base_dec") or "0")
            for art, col in [("BASE", "base_dec"), ("BONUS_PLAN", "bonus_dec"), ("RK_SN", "rk_sn_dec")]:
                val = row.get(col)
                if val and str(val).strip():
                    amt = Decimal(str(val).strip())
                elif art == "BASE":
                    amt = base
                else:
                    continue
                db.add(
                    DecSnapshot(
                        plan_version_id=plan.id,
                        employee_id=emp.id,
                        position_id=pos.id,
                        article=art,
                        amount=amt,
                        currency=currency,
                    )
                )
            ok += 1
        except (ValueError, InvalidOperation, KeyError) as e:
            errors.append(str(e))
    hist = ImportHistory(import_type="employees", rows_ok=ok, rows_error=len(errors), errors=errors, created_by=username)
    db.add(hist)
    db.commit()
    recalculate_plan(db, plan)
    return hist


def import_salary_ranges(db: Session, plan_year: int, content: str, username: str, version_label: str) -> ImportHistory:
    reader = csv.DictReader(io.StringIO(content))
    errors = []
    ok = 0
    first_date = None
    rows = list(reader)
    if rows:
        first_date = _parse_date(rows[0].get("effective_from")) or datetime(plan_year, 1, 1).date()
    catalog = SalaryRangeCatalog(plan_year=plan_year, version_label=version_label, valid_from=first_date or datetime.utcnow().date())
    db.add(catalog)
    db.flush()
    for row in rows:
        try:
            mn = Decimal(row["min_salary"])
            mid = Decimal(row["midpoint"])
            mx = Decimal(row["max_salary"])
            if not (mn <= mid <= mx):
                raise ValueError("midpoint must be between min and max")
            db.add(
                SalaryRangeBand(
                    catalog_id=catalog.id,
                    specialization=row["specialization"].strip(),
                    level=row["level"].strip(),
                    min_salary=mn,
                    midpoint=mid,
                    max_salary=mx,
                    currency=(row.get("currency") or "RUB").strip(),
                )
            )
            ok += 1
        except Exception as e:
            errors.append(str(e))
    hist = ImportHistory(import_type="salary_ranges", rows_ok=ok, rows_error=len(errors), errors=errors, created_by=username)
    db.add(hist)
    db.commit()
    return hist


def import_fact(db: Session, plan: PlanVersion, content: str, username: str, year: int, month: int) -> ImportHistory:
    reader = csv.DictReader(io.StringIO(content))
    errors = []
    ok = 0
    db.query(MonthlyFactLine).filter(
        MonthlyFactLine.plan_version_id == plan.id,
        MonthlyFactLine.year == year,
        MonthlyFactLine.month == month,
    ).delete()
    for row in reader:
        try:
            db.add(
                MonthlyFactLine(
                    plan_version_id=plan.id,
                    employee_external_id=row["employee_id"].strip(),
                    year=int(row.get("year", year)),
                    month=int(row.get("month", month)),
                    article=row["article_code"].strip(),
                    amount=Decimal(row["amount"]),
                    currency=(row.get("currency") or "RUB").strip(),
                )
            )
            ok += 1
        except Exception as e:
            errors.append(str(e))
    hist = ImportHistory(import_type="fact", rows_ok=ok, rows_error=len(errors), errors=errors, created_by=username)
    db.add(hist)
    db.commit()
    return hist
