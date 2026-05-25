from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanCreate(BaseModel):
    plan_year: int
    label: str = "baseline"
    parent_version_id: int | None = None


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_year: int
    label: str
    status: str
    created_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def status_to_str(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)


class EventCreate(BaseModel):
    event_type: str
    effective_month: int = Field(ge=1, le=12)
    employee_external_id: str | None = None
    position_external_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class IndexationCreate(BaseModel):
    effective_month: int
    index_percent: float | None = None
    index_fixed: float | None = None
    index_article: str = "BASE"
    scope_org_unit: str | None = None
    scope_specialization: str | None = None


class ReviewCreate(BaseModel):
    effective_month: int
    employee_external_id: str
    specialization: str | None = None
    level: str | None = None
    new_amounts: dict[str, float] | None = None
    percent_change: float | None = None
    target_cr: float | None = None
    band_anchor: str | None = None


class TargetSalaryCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    position_external_id: str
    employee_external_id: str | None = None
    target_amount: float


class ManualOverrideCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    position_external_id: str
    employee_external_id: str | None = None
    base_amount: float | None = None
    bonus_amount: float | None = None
    propagate_forward: bool = True


class TerminationCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    employee_external_id: str
    position_external_id: str
    to_vacancy: bool = False


class ClosePositionCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    position_external_id: str


class ClassificationChangeCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    position_external_id: str
    employee_external_id: str | None = None
    specialization: str
    level: str


class EmployeeTransferCreate(BaseModel):
    effective_month: int = Field(ge=1, le=12)
    employee_external_id: str
    from_position_external_id: str
    to_position_external_id: str
    base_amount: float | None = None
    bonus_amount: float | None = None


class VacancyCreate(BaseModel):
    plan_id: int
    org_unit_code: str
    job_title: str | None = None
    specialization: str
    level: str
    base_salary: float
    variable_salary: float = 0
    hire_month: int = Field(ge=1, le=12)
    limit_flag: str = "IN_LIMIT"
    hire_status: str = "NEW_HIRE"


class UserOut(BaseModel):
    username: str
    display_name: str
    role: str
    scope_org_codes: list[str]

    @field_validator("role", mode="before")
    @classmethod
    def role_to_str(cls, v: Any) -> str:
        return v.value if hasattr(v, "value") else str(v)


class SalaryBandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    specialization: str
    level: str
    min_salary: float
    midpoint: float
    max_salary: float
    currency: str

    @field_validator("min_salary", "midpoint", "max_salary", mode="before")
    @classmethod
    def dec_to_float(cls, v: Any) -> float:
        return float(v)


class CrOut(BaseModel):
    employee_external_id: str
    month: int
    base_amount: float
    midpoint: float | None
    cr: float | None


class VarianceRow(BaseModel):
    position_external_id: str
    org_unit_code: str
    month: int
    article: str
    plan_amount: float
    fact_amount: float
    variance: float
    variance_pct: float | None
    reason_hint: str | None = None
