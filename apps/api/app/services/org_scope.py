from sqlalchemy.orm import Session

from app.models import OrgUnit


def build_org_subtree(db: Session) -> dict[str, set[str]]:
    units = db.query(OrgUnit).all()
    children: dict[str, list[str]] = {}
    for u in units:
        parent = None
        if u.parent_id:
            p = next((x for x in units if x.id == u.parent_id), None)
            parent = p.code if p else None
        children.setdefault(parent or "", []).append(u.code)

    result: dict[str, set[str]] = {}

    def collect(code: str) -> set[str]:
        if code in result:
            return result[code]
        desc = {code}
        for ch in children.get(code, []):
            desc |= collect(ch)
        result[code] = desc
        return desc

    for u in units:
        collect(u.code)
    return result


def filter_org_codes(codes: list[str], scope: list[str], subtree: dict[str, set[str]], is_admin: bool) -> set[str]:
    if is_admin:
        return set(codes)
    allowed: set[str] = set()
    for s in scope:
        allowed |= subtree.get(s, {s})
    return {c for c in codes if c in allowed}
