from fastapi import FastAPI

from .database import Base, engine
from .event_engine import EventInput, PlanState, replay_events

app = FastAPI(title="FOT Planner MVP API")


@app.on_event("startup")
def on_startup() -> None:
  Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok"}


@app.get("/api/planning/demo")
def demo_replay() -> dict:
  state = PlanState(
    base=[180000.0] * 12,
    bonus=[20000.0] * 12,
    specialization=["Engineering"] * 12,
    level=["Senior"] * 12,
    status="Occupied",
    employee_name="Demo User",
  )
  events = [
    EventInput(event_type="MANUAL_OVERRIDE", effective_month=4, created_order=1, payload={"base": 200000.0}),
    EventInput(event_type="INDEXATION", effective_month=8, created_order=2, payload={"percent": 5}),
  ]
  result = replay_events(state, events)
  return {
    "base": result.base,
    "bonus": result.bonus,
    "status": result.status,
    "employee_name": result.employee_name,
  }

