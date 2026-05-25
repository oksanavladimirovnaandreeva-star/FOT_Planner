"""Расчётный движок плана ФОТ — чистая логика без БД."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

ArticleCode = str
EventType = Literal[
    "INDEXATION",
    "SALARY_REVIEW",
    "TARGET_SALARY",
    "PLANNED_HIRE",
    "TERMINATION",
    "TERMINATION_TO_VACANCY",
    "TERMINATION_CLOSE_POSITION",
    "MANUAL_OVERRIDE",
    "CANCEL_VACANCY",
    "POSITION_CARRYOVER",
]

ARTICLES = ("BASE", "BONUS_PLAN", "RK_SN", "OTHER")


def _event_priority(ev_type: str) -> int:
    # Business order inside one month:
    # 1) manual/target changes define the base
    # 2) indexation applies on top of that base
    # 3) terminations/closures zero out from the month
    if ev_type in ("MANUAL_OVERRIDE", "SALARY_REVIEW", "TARGET_SALARY", "PLANNED_HIRE"):
        return 10
    if ev_type == "INDEXATION":
        return 20
    if ev_type in ("TERMINATION", "TERMINATION_TO_VACANCY", "TERMINATION_CLOSE_POSITION", "CANCEL_VACANCY"):
        return 90
    return 50


@dataclass
class DecAmount:
    employee_external_id: str
    position_external_id: str
    article: ArticleCode
    amount: Decimal
    currency: str = "RUB"


@dataclass
class AssignmentInput:
    employee_external_id: str
    position_external_id: str
    org_unit_code: str
    specialization: str
    level: str
    valid_from_month: int  # 1-12, year scope
    valid_to_month: int | None  # inclusive end or None = open


@dataclass
class PlannedEventInput:
    event_type: EventType
    effective_month: int
    employee_external_id: str | None = None
    position_external_id: str | None = None
    org_unit_code: str | None = None
    specialization: str | None = None
    level: str | None = None
    limit_flag: str | None = None
    index_percent: Decimal | None = None
    index_fixed: Decimal | None = None
    index_article: ArticleCode | None = None
    scope_org_unit: str | None = None
    scope_specialization: str | None = None
    scope_limit_flag: str | None = None
    new_amounts: dict[ArticleCode, Decimal] = field(default_factory=dict)
    percent_change: Decimal | None = None
    target_cr: Decimal | None = None
    band_anchor: Literal["min", "midpoint", "max"] | None = None
    hire_amounts: dict[ArticleCode, Decimal] = field(default_factory=dict)
    propagate_forward: bool = True
    created_order: int = 0


@dataclass
class MonthlyLine:
    employee_external_id: str
    position_external_id: str
    org_unit_code: str
    month: int
    article: ArticleCode
    amount: Decimal
    currency: str


@dataclass
class SalaryBand:
    specialization: str
    level: str
    min_salary: Decimal
    midpoint: Decimal
    max_salary: Decimal
    currency: str = "RUB"


class PlanCalculator:
    def __init__(
        self,
        plan_year: int,
        assignments: list[AssignmentInput],
        dec_amounts: list[DecAmount],
        events: list[PlannedEventInput],
        bands: list[SalaryBand],
        currency_rates: dict[str, Decimal] | None = None,
    ):
        self.plan_year = plan_year
        self.assignments = assignments
        self.dec_amounts = dec_amounts
        self.events = sorted(events, key=lambda e: (e.effective_month, e.created_order))
        self.bands = {(b.specialization, b.level): b for b in bands}
        self.currency_rates = currency_rates or {"RUB": Decimal("1")}

    def _band(self, spec: str, level: str) -> SalaryBand | None:
        return self.bands.get((spec, level))

    def _dec_map(self) -> dict[tuple[str, str, str], DecAmount]:
        m: dict[tuple[str, str, str], DecAmount] = {}
        for d in self.dec_amounts:
            m[(d.employee_external_id, d.position_external_id, d.article)] = d
        return m

    def _active(self, a: AssignmentInput, month: int) -> bool:
        if month < a.valid_from_month:
            return False
        if a.valid_to_month is not None and month > a.valid_to_month:
            return False
        return True

    def _match_scope(self, ev: PlannedEventInput, a: AssignmentInput) -> bool:
        if ev.scope_org_unit and a.org_unit_code != ev.scope_org_unit:
            if not a.org_unit_code.startswith(ev.scope_org_unit):
                return False
        if ev.scope_specialization and a.specialization != ev.scope_specialization:
            return False
        return True

    def _apply_review_amount(
        self,
        base: Decimal,
        ev: PlannedEventInput,
        spec: str,
        level: str,
    ) -> dict[ArticleCode, Decimal]:
        band = self._band(spec, level)
        result: dict[ArticleCode, Decimal] = {}
        if ev.new_amounts:
            for art, amt in ev.new_amounts.items():
                result[art] = amt
            return result
        if ev.target_cr is not None and band:
            result["BASE"] = (ev.target_cr * band.midpoint).quantize(Decimal("0.01"))
            return result
        if ev.band_anchor and band:
            anchor = {"min": band.min_salary, "midpoint": band.midpoint, "max": band.max_salary}[
                ev.band_anchor
            ]
            result["BASE"] = anchor
            return result
        if ev.percent_change is not None:
            result["BASE"] = (base * (Decimal("1") + ev.percent_change / Decimal("100"))).quantize(
                Decimal("0.01")
            )
            return result
        return result

    def _emit_lines(
        self,
        lines: list[MonthlyLine],
        month: int,
        state: dict[tuple[str, str, str], Decimal],
        currency: dict[tuple[str, str, str], str],
        single_month_overrides: dict[tuple[int, str, str, str], tuple[int, Decimal]],
    ) -> None:
        for a in self.assignments:
            if not self._active(a, month):
                continue
            for art in ARTICLES:
                key = (a.employee_external_id, a.position_external_id, art)
                amt = state.get(key, Decimal("0"))
                ov = single_month_overrides.get((month, a.employee_external_id, a.position_external_id, art))
                if ov is not None:
                    _, ov_amount = ov
                    amt = ov_amount
                if amt == 0 and art != "BASE":
                    continue
                lines.append(
                    MonthlyLine(
                        employee_external_id=a.employee_external_id,
                        position_external_id=a.position_external_id,
                        org_unit_code=a.org_unit_code,
                        month=month,
                        article=art,
                        amount=amt,
                        currency=currency.get(key, "RUB"),
                    )
                )

    def calculate(self) -> list[MonthlyLine]:
        dec = self._dec_map()
        state: dict[tuple[str, str, str], Decimal] = {}
        currency: dict[tuple[str, str, str], str] = {}
        single_month_overrides: dict[tuple[int, str, str, str], tuple[int, Decimal]] = {}

        for a in self.assignments:
            for art in ARTICLES:
                key = (a.employee_external_id, a.position_external_id, art)
                d = dec.get(key)
                if d:
                    state[key] = d.amount
                    currency[key] = d.currency
                elif art == "BASE":
                    state[key] = Decimal("0")
                    currency[key] = "RUB"

        lines: list[MonthlyLine] = []

        for month in range(1, 13):
            month_events = [e for e in self.events if e.effective_month == month]
            month_events.sort(key=lambda e: (_event_priority(e.event_type), e.created_order))

            for ev in month_events:
                if ev.event_type in ("POSITION_CARRYOVER",):
                    continue

                if ev.event_type == "TERMINATION_CLOSE_POSITION" and ev.position_external_id:
                    for a in self.assignments:
                        if a.position_external_id != ev.position_external_id:
                            continue
                        if month >= ev.effective_month:
                            for art in ARTICLES:
                                key = (a.employee_external_id, a.position_external_id, art)
                                state[key] = Decimal("0")
                    continue

                if ev.event_type in ("TERMINATION", "TERMINATION_TO_VACANCY"):
                    emp = ev.employee_external_id
                    pos = ev.position_external_id
                    if not emp:
                        continue
                    for a in self.assignments:
                        if a.employee_external_id != emp:
                            continue
                        if pos and a.position_external_id != pos:
                            continue
                        if month >= ev.effective_month:
                            for art in ARTICLES:
                                key = (a.employee_external_id, a.position_external_id, art)
                                state[key] = Decimal("0")
                    continue

                if ev.event_type in ("SALARY_REVIEW", "TARGET_SALARY") and (
                    ev.employee_external_id or ev.position_external_id
                ):
                    for a in self.assignments:
                        if ev.employee_external_id and a.employee_external_id != ev.employee_external_id:
                            continue
                        if ev.position_external_id and a.position_external_id != ev.position_external_id:
                            continue
                        spec = ev.specialization or a.specialization
                        lvl = ev.level or a.level
                        base_key = (a.employee_external_id, a.position_external_id, "BASE")
                        base = state.get(base_key, Decimal("0"))
                        updates = self._apply_review_amount(base, ev, spec, lvl)
                        for art, amt in updates.items():
                            key = (a.employee_external_id, a.position_external_id, art)
                            state[key] = amt
                        for art, amt in ev.new_amounts.items():
                            key = (a.employee_external_id, a.position_external_id, art)
                            state[key] = amt

                if ev.event_type == "MANUAL_OVERRIDE":
                    pos_id = ev.position_external_id
                    emp_id = ev.employee_external_id
                    for art, amt in ev.new_amounts.items():
                        for a in self.assignments:
                            if pos_id and a.position_external_id != pos_id:
                                continue
                            if emp_id and a.employee_external_id != emp_id:
                                continue
                            key = (a.employee_external_id, a.position_external_id, art)
                            if ev.propagate_forward:
                                state[key] = amt
                            else:
                                ov_key = (ev.effective_month, a.employee_external_id, a.position_external_id, art)
                                prev = single_month_overrides.get(ov_key)
                                if prev is None or ev.created_order >= prev[0]:
                                    single_month_overrides[ov_key] = (ev.created_order, amt)

                if ev.event_type == "INDEXATION":
                    for a in self.assignments:
                        if not self._active(a, month) or not self._match_scope(ev, a):
                            continue
                        art = ev.index_article or "BASE"
                        key = (a.employee_external_id, a.position_external_id, art)
                        if key not in state:
                            continue
                        if ev.index_percent is not None:
                            state[key] = (state[key] * (Decimal("1") + ev.index_percent / Decimal("100"))).quantize(
                                Decimal("0.01")
                            )
                        elif ev.index_fixed is not None:
                            state[key] = state[key] + ev.index_fixed

                if ev.event_type == "PLANNED_HIRE" and ev.position_external_id:
                    vac_emp = ev.employee_external_id or f"VACANCY-{ev.position_external_id}"
                    for art, amt in ev.hire_amounts.items():
                        key = (vac_emp, ev.position_external_id, art)
                        state[key] = amt
                        currency[key] = currency.get(key, "RUB")

                if ev.event_type == "CANCEL_VACANCY" and ev.position_external_id:
                    vac_emp = f"VACANCY-{ev.position_external_id}"
                    for art in ARTICLES:
                        key = (vac_emp, ev.position_external_id, art)
                        state[key] = Decimal("0")

            self._emit_lines(lines, month, state, currency, single_month_overrides)

        return lines

    @staticmethod
    def compa_ratio(salary: Decimal, midpoint: Decimal) -> Decimal | None:
        if midpoint == 0:
            return None
        return (salary / midpoint).quantize(Decimal("0.0001"))
