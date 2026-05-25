from app.event_engine import EventInput, PlanState, replay_events


def make_state() -> PlanState:
  return PlanState(
    base=[100000.0] * 12,
    bonus=[10000.0] * 12,
    specialization=["Engineering"] * 12,
    level=["Middle"] * 12,
    status="Occupied",
    employee_name="Иван",
  )


def test_uat_a_indexation_over_manual() -> None:
  state = make_state()
  events = [
    EventInput(event_type="MANUAL_OVERRIDE", effective_month=4, created_order=1, payload={"base": 200000.0}),
    EventInput(event_type="INDEXATION", effective_month=8, created_order=2, payload={"percent": 5}),
  ]
  result = replay_events(state, events)
  assert result.base[8] == 210000.0
  assert result.base[11] == 210000.0


def test_uat_b_termination_to_vacancy_preserves_budget() -> None:
  state = make_state()
  result = replay_events(
    state,
    [EventInput(event_type="TERMINATION_TO_VACANCY", effective_month=5, created_order=1, payload={})],
  )
  assert result.status == "Vacancy"
  assert result.base[5] == 100000.0
  assert result.base[11] == 100000.0


def test_uat_c_transfer_to_vacancy() -> None:
  state = make_state()
  result = replay_events(
    state,
    [EventInput(event_type="TRANSFER", effective_month=6, created_order=1, payload={"transfer_to_position_id": "P777"})],
  )
  assert result.status == "Vacancy"
  assert result.transfer_to_position_id == "P777"

