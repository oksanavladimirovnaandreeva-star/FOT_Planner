import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class PlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    LOCKED = "LOCKED"


class LimitFlag(str, enum.Enum):
    IN_LIMIT = "IN_LIMIT"
    OVER_LIMIT = "OVER_LIMIT"
    UNLIMITED = "UNLIMITED"


class HireStatus(str, enum.Enum):
    CARRYOVER = "CARRYOVER"  # Перенос
    NEW_HIRE = "NEW_HIRE"  # Новый найм
    PLANNED_HIRE = "PLANNED_HIRE"  # Найм (план)


class MonthFactStatus(str, enum.Enum):
    OPEN = "OPEN"
    FACT_LOADED = "FACT_LOADED"
    CLOSED = "CLOSED"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False))
    scope_org_codes: Mapped[list] = mapped_column(JSON, default=list)


class OrgUnit(Base):
    __tablename__ = "org_units"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(256))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"), nullable=True)


class Position(Base):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"))
    job_title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    specialization: Mapped[str] = mapped_column(String(128))
    level: Mapped[str] = mapped_column(String(64))
    limit_flag: Mapped[LimitFlag] = mapped_column(Enum(LimitFlag, native_enum=False), default=LimitFlag.IN_LIMIT)
    hire_status: Mapped[HireStatus | None] = mapped_column(Enum(HireStatus, native_enum=False), nullable=True)
    hire_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_vacancy: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    org_unit: Mapped["OrgUnit"] = relationship()


class PositionIdSequence(Base):
    """Атомарная выдача ИД позиций П001, П002, …"""

    __tablename__ = "position_id_sequence"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    last_value: Mapped[int] = mapped_column(Integer, default=0)


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    full_name: Mapped[str | None] = mapped_column(String(256), nullable=True)


class PositionAssignment(Base):
    __tablename__ = "position_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    specialization: Mapped[str] = mapped_column(String(128))
    level: Mapped[str] = mapped_column(String(64))
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)


class DecSnapshot(Base):
    __tablename__ = "dec_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"))
    article: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(8), default="RUB")


class PlanVersion(Base):
    __tablename__ = "plan_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_year: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(128))
    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus, native_enum=False), default=PlanStatus.DRAFT)
    base_month: Mapped[int] = mapped_column(Integer, default=12)
    parent_version_id: Mapped[int | None] = mapped_column(ForeignKey("plan_versions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlannedEvent(Base):
    __tablename__ = "planned_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    event_type: Mapped[str] = mapped_column(String(64))
    effective_month: Mapped[int] = mapped_column(Integer)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), nullable=True)
    position_id: Mapped[int | None] = mapped_column(ForeignKey("positions.id"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_order: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MonthlyPlanLine(Base):
    __tablename__ = "monthly_plan_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    employee_external_id: Mapped[str] = mapped_column(String(64))
    position_external_id: Mapped[str] = mapped_column(String(64))
    org_unit_code: Mapped[str] = mapped_column(String(64))
    month: Mapped[int] = mapped_column(Integer)
    article: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(8))


class SalaryRangeCatalog(Base):
    __tablename__ = "salary_range_catalogs"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_year: Mapped[int] = mapped_column(Integer)
    version_label: Mapped[str] = mapped_column(String(128))
    valid_from: Mapped[date] = mapped_column(Date)


class SalaryRangeBand(Base):
    __tablename__ = "salary_range_bands"
    __table_args__ = (UniqueConstraint("catalog_id", "specialization", "level"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_id: Mapped[int] = mapped_column(ForeignKey("salary_range_catalogs.id"))
    specialization: Mapped[str] = mapped_column(String(128))
    level: Mapped[str] = mapped_column(String(64))
    min_salary: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    midpoint: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    max_salary: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(8), default="RUB")


class MonthlyFactLine(Base):
    __tablename__ = "monthly_fact_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    employee_external_id: Mapped[str] = mapped_column(String(64))
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    article: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(8), default="RUB")


class MonthStatus(Base):
    __tablename__ = "month_statuses"
    __table_args__ = (UniqueConstraint("plan_version_id", "year", "month"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)
    status: Mapped[MonthFactStatus] = mapped_column(Enum(MonthFactStatus, native_enum=False), default=MonthFactStatus.OPEN)


class CurrencyRate(Base):
    __tablename__ = "currency_rates"
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_version_id: Mapped[int] = mapped_column(ForeignKey("plan_versions.id"))
    currency: Mapped[str] = mapped_column(String(8))
    rate_to_rub: Mapped[Decimal] = mapped_column(Numeric(18, 6))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ImportHistory(Base):
    __tablename__ = "import_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    import_type: Mapped[str] = mapped_column(String(64))
    filename: Mapped[str | None] = mapped_column(String(256), nullable=True)
    rows_ok: Mapped[int] = mapped_column(Integer, default=0)
    rows_error: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
