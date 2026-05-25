import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.migrate import migrate_schema
from app.seed import seed_database
from app.routers import plans, plans_export, salary_ranges, employees, positions, imports, users, audit, admin, lookups

app = FastAPI(title="FOT Planner API", version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "path": str(request.url.path)},
    )


app.include_router(plans.router)
app.include_router(plans_export.router)
app.include_router(salary_ranges.router)
app.include_router(employees.router)
app.include_router(positions.router)
app.include_router(imports.router)
app.include_router(users.router)
app.include_router(audit.router)
app.include_router(admin.router)
app.include_router(lookups.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    migrate_schema(engine)
    db = SessionLocal()
    try:
        seed_database(db)
        from app.models import PlanVersion
        from app.services.carryover import apply_carryover_events
        from app.services.recalc import recalculate_plan

        for plan in db.query(PlanVersion).all():
            if apply_carryover_events(db, plan):
                db.commit()
                recalculate_plan(db, plan)
    except Exception:
        traceback.print_exc()
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "service": "FOT Planner API",
        "docs": "/docs",
        "health": "/api/health",
        "ui_dev": "http://localhost:5180 — npm run dev в apps/web",
    }


@app.get("/api/health")
def health():
    db = SessionLocal()
    try:
        from app.models import PlanVersion, User

        return {
            "status": "ok",
            "users": db.query(User).count(),
            "plans": db.query(PlanVersion).count(),
        }
    finally:
        db.close()
