from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

EVENT_TYPES = (
  "INDEXATION",
  "MANUAL_OVERRIDE",
  "TARGET_SALARY",
  "CLASSIFICATION_CHANGE",
  "TERMINATION",
  "TERMINATION_TO_VACANCY",
  "CLOSE_POSITION",
  "PLANNED_HIRE",
  "CANCEL_VACANCY",
  "TRANSFER",
  "POSITION_CARRYOVER",
)

LINE_TYPES = ("BASE", "BONUS_PLAN", "TOTAL")


class Position(Base):
  __tablename__ = "positions"

  id: Mapped[str] = mapped_column(String(16), primary_key=True)
  role: Mapped[str] = mapped_column(String(255))
  department: Mapped[str] = mapped_column(String(128))
  status: Mapped[str] = mapped_column(String(32), default="Vacancy")
  assignments: Mapped[list["Assignment"]] = relationship(back_populates="position", cascade="all, delete-orphan")
  events: Mapped[list["PlannedEvent"]] = relationship(back_populates="position", cascade="all, delete-orphan")
  plan_lines: Mapped[list["MonthlyPlanLine"]] = relationship(back_populates="position", cascade="all, delete-orphan")


class Employee(Base):
  __tablename__ = "employees"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
  full_name: Mapped[str] = mapped_column(String(255), nullable=False)
  assignments: Mapped[list["Assignment"]] = relationship(back_populates="employee")


class Assignment(Base):
  __tablename__ = "assignments"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
  employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
  position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), nullable=False)
  valid_from: Mapped[date] = mapped_column(Date, nullable=False)
  valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

  employee: Mapped[Employee] = relationship(back_populates="assignments")
  position: Mapped[Position] = relationship(back_populates="assignments")


class PlannedEvent(Base):
  __tablename__ = "planned_events"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
  position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), nullable=False)
  event_type: Mapped[str] = mapped_column(Enum(*EVENT_TYPES, name="event_type"), nullable=False)
  effective_month: Mapped[int] = mapped_column(Integer, nullable=False)
  created_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
  payload: Mapped[dict] = mapped_column(JSON, default=dict)
  created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

  position: Mapped[Position] = relationship(back_populates="events")


class MonthlyPlanLine(Base):
  __tablename__ = "monthly_plan_lines"

  id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
  position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), nullable=False)
  month: Mapped[int] = mapped_column(Integer, nullable=False)
  line_type: Mapped[str] = mapped_column(Enum(*LINE_TYPES, name="line_type"), nullable=False)
  amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
  specialization: Mapped[str] = mapped_column(String(64), nullable=False)
  level: Mapped[str] = mapped_column(String(64), nullable=False)

  position: Mapped[Position] = relationship(back_populates="plan_lines")

