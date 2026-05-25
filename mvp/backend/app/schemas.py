from pydantic import BaseModel, Field


class EventPayload(BaseModel):
  month: int = Field(ge=0, le=11)
  percent: float | None = None
  base: float | None = None
  bonus: float | None = None
  specialization: str | None = None
  level: str | None = None
  transfer_to_position_id: str | None = None


class EventCreate(BaseModel):
  position_id: str
  event_type: str
  created_order: int = 1
  payload: EventPayload


class PositionSummary(BaseModel):
  position_id: str
  role: str
  employee_name: str | None
  status: str
  annual_total: float

