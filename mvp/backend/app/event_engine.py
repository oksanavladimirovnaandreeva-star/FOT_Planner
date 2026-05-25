from dataclasses import dataclass, field

BASE_FORMING = {"MANUAL_OVERRIDE", "TARGET_SALARY", "CLASSIFICATION_CHANGE", "PLANNED_HIRE"}
INDEXATION = {"INDEXATION"}
FINALIZING = {"TERMINATION", "TERMINATION_TO_VACANCY", "CLOSE_POSITION", "CANCEL_VACANCY"}


@dataclass
class PlanState:
  base: list[float]
  bonus: list[float]
  specialization: list[str]
  level: list[str]
  status: str = "Occupied"
  employee_name: str | None = None
  transfer_to_position_id: str | None = None


@dataclass
class EventInput:
  event_type: str
  effective_month: int
  created_order: int
  payload: dict = field(default_factory=dict)


def _priority(event_type: str) -> int:
  if event_type in BASE_FORMING:
    return 1
  if event_type in INDEXATION:
    return 2
  return 3


def _apply_event(state: PlanState, event: EventInput) -> None:
  month = max(0, min(11, event.effective_month))
  payload = event.payload

  if event.event_type in {"MANUAL_OVERRIDE", "TARGET_SALARY"}:
    for idx in range(month, 12):
      if payload.get("base") is not None:
        state.base[idx] = float(payload["base"])
      if payload.get("bonus") is not None:
        state.bonus[idx] = float(payload["bonus"])
      if payload.get("specialization"):
        state.specialization[idx] = str(payload["specialization"])
      if payload.get("level"):
        state.level[idx] = str(payload["level"])
    return

  if event.event_type == "CLASSIFICATION_CHANGE":
    for idx in range(month, 12):
      if payload.get("specialization"):
        state.specialization[idx] = str(payload["specialization"])
      if payload.get("level"):
        state.level[idx] = str(payload["level"])
    return

  if event.event_type == "PLANNED_HIRE":
    state.status = "Occupied"
    if payload.get("employee_name"):
      state.employee_name = str(payload["employee_name"])
    return

  if event.event_type == "INDEXATION":
    rate = float(payload.get("percent", 0)) / 100.0
    for idx in range(month, 12):
      state.base[idx] = round(state.base[idx] * (1 + rate), 2)
      state.bonus[idx] = round(state.bonus[idx] * (1 + rate), 2)
    return

  if event.event_type == "TERMINATION":
    state.employee_name = None
    state.status = "Vacancy"
    for idx in range(month, 12):
      state.bonus[idx] = 0
    return

  if event.event_type == "TERMINATION_TO_VACANCY":
    state.employee_name = None
    state.status = "Vacancy"
    return

  if event.event_type == "TRANSFER":
    state.employee_name = None
    state.status = "Vacancy"
    state.transfer_to_position_id = payload.get("transfer_to_position_id")
    return

  if event.event_type == "CLOSE_POSITION":
    state.employee_name = None
    state.status = "Closed"
    for idx in range(month, 12):
      state.base[idx] = 0
      state.bonus[idx] = 0
    return

  if event.event_type == "CANCEL_VACANCY":
    state.status = "Closed"


def replay_events(state: PlanState, events: list[EventInput]) -> PlanState:
  ordered = sorted(events, key=lambda item: (item.effective_month, _priority(item.event_type), item.created_order))
  for event in ordered:
    _apply_event(state, event)
  return state

