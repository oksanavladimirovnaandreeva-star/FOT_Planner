import re

from sqlalchemy.orm import Session

from app.models import Position, PositionIdSequence


def _sync_sequence_from_positions(db: Session) -> None:
    seq = db.get(PositionIdSequence, 1)
    if not seq:
        seq = PositionIdSequence(id=1, last_value=0)
        db.add(seq)
        db.flush()
    max_n = seq.last_value
    for (ext_id,) in db.query(Position.external_id).all():
        m = re.match(r"^[ПP](\d+)$", ext_id or "", re.IGNORECASE)
        if m:
            max_n = max(max_n, int(m.group(1)))
    if max_n > seq.last_value:
        seq.last_value = max_n
        db.commit()


def allocate_position_id(db: Session) -> str:
    seq = (
        db.query(PositionIdSequence)
        .filter(PositionIdSequence.id == 1)
        .with_for_update()
        .first()
    )
    if not seq:
        seq = PositionIdSequence(id=1, last_value=0)
        db.add(seq)
        db.flush()
        seq = (
            db.query(PositionIdSequence)
            .filter(PositionIdSequence.id == 1)
            .with_for_update()
            .first()
        )
    seq.last_value += 1
    db.flush()
    return f"П{seq.last_value:03d}"
