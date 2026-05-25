from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
import json
import re


def _to_pnnn_id(raw_id: str, fallback_n: int) -> str:
    m = re.match(r"^[PП]-?(\d+)$", raw_id or "", re.IGNORECASE)
    if m:
        return f"П{int(m.group(1)):03d}"
    return f"П{fallback_n:03d}"


def migrate_schema(engine: Engine) -> None:
    """Добавляет новые колонки/таблицы в существующую SQLite БД без Alembic."""
    insp = inspect(engine)
    with engine.begin() as conn:
        if "positions" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("positions")}
            if "job_title" not in cols:
                conn.execute(text("ALTER TABLE positions ADD COLUMN job_title VARCHAR(256)"))
            if "hire_status" not in cols:
                conn.execute(text("ALTER TABLE positions ADD COLUMN hire_status VARCHAR(32)"))
            if "hire_month" not in cols:
                conn.execute(text("ALTER TABLE positions ADD COLUMN hire_month INTEGER"))

        if "position_id_sequence" not in insp.get_table_names():
            conn.execute(
                text(
                    "CREATE TABLE position_id_sequence (id INTEGER PRIMARY KEY, last_value INTEGER DEFAULT 0)"
                )
            )
            conn.execute(text("INSERT INTO position_id_sequence (id, last_value) VALUES (1, 0)"))

        if "positions" in insp.get_table_names():
            pos_rows = conn.execute(text("SELECT id, external_id FROM positions ORDER BY id")).fetchall()
            remap: dict[str, str] = {}
            used_ids: set[str] = set()
            next_fallback = 1
            for row in pos_rows:
                old_id = row.external_id
                new_id = _to_pnnn_id(old_id, next_fallback)
                while new_id in used_ids:
                    next_fallback += 1
                    new_id = _to_pnnn_id("", next_fallback)
                used_ids.add(new_id)
                if old_id != new_id:
                    remap[old_id] = new_id
            for old_id, new_id in remap.items():
                conn.execute(
                    text("UPDATE positions SET external_id = :new_id WHERE external_id = :old_id"),
                    {"old_id": old_id, "new_id": new_id},
                )
                if "monthly_plan_lines" in insp.get_table_names():
                    conn.execute(
                        text(
                            "UPDATE monthly_plan_lines SET position_external_id = :new_id WHERE position_external_id = :old_id"
                        ),
                        {"old_id": old_id, "new_id": new_id},
                    )

            if remap and "planned_events" in insp.get_table_names():
                ev_rows = conn.execute(text("SELECT id, payload FROM planned_events")).fetchall()
                for ev in ev_rows:
                    payload = ev.payload
                    if isinstance(payload, str):
                        try:
                            payload = json.loads(payload)
                        except json.JSONDecodeError:
                            payload = {}
                    payload = payload or {}
                    changed = False
                    for key in ("position_external_id", "from_position_external_id", "to_position_external_id"):
                        value = payload.get(key)
                        if isinstance(value, str) and value in remap:
                            payload[key] = remap[value]
                            changed = True
                    if changed:
                        conn.execute(
                            text("UPDATE planned_events SET payload = :payload WHERE id = :id"),
                            {"id": ev.id, "payload": json.dumps(payload, ensure_ascii=False)},
                        )
