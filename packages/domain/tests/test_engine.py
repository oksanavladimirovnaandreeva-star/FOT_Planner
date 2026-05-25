from decimal import Decimal

from fot_domain.engine import (
    AssignmentInput,
    DecAmount,
    PlanCalculator,
    PlannedEventInput,
    SalaryBand,
)


def test_december_spread_and_indexation():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[
            AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None),
        ],
        dec_amounts=[
            DecAmount("E1", "P1", "BASE", Decimal("100000")),
        ],
        events=[
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=4,
                index_percent=Decimal("10"),
                index_article="BASE",
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100"), Decimal("120"))],
    )
    lines = calc.calculate()
    jan = next(l for l in lines if l.month == 1 and l.article == "BASE")
    apr = next(l for l in lines if l.month == 4 and l.article == "BASE")
    assert jan.amount == Decimal("100000")
    assert apr.amount == Decimal("110000")


def test_cr_review():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("90000"))],
        events=[
            PlannedEventInput(
                event_type="SALARY_REVIEW",
                effective_month=6,
                employee_external_id="E1",
                target_cr=Decimal("1.0"),
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    jun = next(l for l in lines if l.month == 6 and l.article == "BASE")
    assert jun.amount == Decimal("100000.00")


def test_manual_single_month_override_keeps_explicit_value():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("100000"))],
        events=[
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=5,
                employee_external_id="E1",
                position_external_id="P1",
                new_amounts={"BASE": Decimal("120000")},
                propagate_forward=False,
                created_order=1,
            ),
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=4,
                index_percent=Decimal("10"),
                index_article="BASE",
                created_order=2,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    apr = next(l for l in lines if l.month == 4 and l.article == "BASE")
    may = next(l for l in lines if l.month == 5 and l.article == "BASE")
    assert apr.amount == Decimal("110000.00")
    assert may.amount == Decimal("120000")


def test_manual_override_after_indexation_wins_to_year_end():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("100000"))],
        events=[
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=4,
                index_percent=Decimal("10"),
                index_article="BASE",
                created_order=1,
            ),
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=6,
                employee_external_id="E1",
                position_external_id="P1",
                new_amounts={"BASE": Decimal("200000")},
                propagate_forward=True,
                created_order=2,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    may = next(l for l in lines if l.month == 5 and l.article == "BASE")
    jun = next(l for l in lines if l.month == 6 and l.article == "BASE")
    dec = next(l for l in lines if l.month == 12 and l.article == "BASE")
    assert may.amount == Decimal("110000.00")
    assert jun.amount == Decimal("200000")
    assert dec.amount == Decimal("200000")


def test_existing_future_indexation_recalculates_after_manual_change():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("100000"))],
        events=[
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=9,
                index_percent=Decimal("5"),
                index_article="BASE",
                created_order=1,
            ),
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=5,
                employee_external_id="E1",
                position_external_id="P1",
                new_amounts={"BASE": Decimal("200000")},
                propagate_forward=True,
                created_order=2,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    aug = next(l for l in lines if l.month == 8 and l.article == "BASE")
    sep = next(l for l in lines if l.month == 9 and l.article == "BASE")
    assert aug.amount == Decimal("200000")
    assert sep.amount == Decimal("210000.00")


def test_termination_to_vacancy_scoped_by_position_only():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[
            AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None),
            AssignmentInput("E1", "P2", "DEPT", "Backend", "Senior", 1, None),
        ],
        dec_amounts=[
            DecAmount("E1", "P1", "BASE", Decimal("100000")),
            DecAmount("E1", "P2", "BASE", Decimal("150000")),
        ],
        events=[
            PlannedEventInput(
                event_type="TERMINATION_TO_VACANCY",
                effective_month=6,
                employee_external_id="E1",
                position_external_id="P1",
                created_order=1,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    jun_p1 = next(
        l for l in lines if l.month == 6 and l.article == "BASE" and l.position_external_id == "P1" and l.employee_external_id == "E1"
    )
    jun_p2 = next(
        l for l in lines if l.month == 6 and l.article == "BASE" and l.position_external_id == "P2" and l.employee_external_id == "E1"
    )
    assert jun_p1.amount == Decimal("0")
    assert jun_p2.amount == Decimal("150000")


def test_transfer_events_keep_old_vacancy_budget_and_new_position_budget():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[
            AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, 5),
            AssignmentInput("VACANCY-P1", "P1", "DEPT", "Backend", "Senior", 6, None),
            AssignmentInput("E1", "P2", "DEPT", "Backend", "Senior", 6, None),
        ],
        dec_amounts=[
            DecAmount("E1", "P1", "BASE", Decimal("100000")),
            DecAmount("E1", "P1", "BONUS_PLAN", Decimal("10000")),
            DecAmount("E1", "P2", "BASE", Decimal("0")),
        ],
        events=[
            PlannedEventInput(
                event_type="TERMINATION_TO_VACANCY",
                effective_month=6,
                employee_external_id="E1",
                position_external_id="P1",
                created_order=1,
            ),
            PlannedEventInput(
                event_type="PLANNED_HIRE",
                effective_month=6,
                position_external_id="P1",
                hire_amounts={"BASE": Decimal("100000"), "BONUS_PLAN": Decimal("10000")},
                created_order=2,
            ),
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=6,
                employee_external_id="E1",
                position_external_id="P2",
                new_amounts={"BASE": Decimal("100000"), "BONUS_PLAN": Decimal("10000")},
                propagate_forward=True,
                created_order=3,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    jun_old_vac = next(
        l
        for l in lines
        if l.month == 6 and l.article == "BASE" and l.position_external_id == "P1" and l.employee_external_id == "VACANCY-P1"
    )
    jun_new_pos = next(
        l for l in lines if l.month == 6 and l.article == "BASE" and l.position_external_id == "P2" and l.employee_external_id == "E1"
    )
    assert jun_old_vac.amount == Decimal("100000")
    assert jun_new_pos.amount == Decimal("100000")


def test_indexation_same_month_applies_on_top_of_manual_override_even_if_index_created_earlier():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("100000"))],
        events=[
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=9,
                index_percent=Decimal("5"),
                index_article="BASE",
                created_order=1,
            ),
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=9,
                employee_external_id="E1",
                position_external_id="P1",
                new_amounts={"BASE": Decimal("200000")},
                propagate_forward=True,
                created_order=2,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    sep = next(l for l in lines if l.month == 9 and l.article == "BASE")
    assert sep.amount == Decimal("210000.00")


def test_indexation_same_month_applies_on_top_of_manual_override_even_if_manual_created_earlier():
    calc = PlanCalculator(
        plan_year=2026,
        assignments=[AssignmentInput("E1", "P1", "DEPT", "Backend", "Senior", 1, None)],
        dec_amounts=[DecAmount("E1", "P1", "BASE", Decimal("100000"))],
        events=[
            PlannedEventInput(
                event_type="MANUAL_OVERRIDE",
                effective_month=9,
                employee_external_id="E1",
                position_external_id="P1",
                new_amounts={"BASE": Decimal("200000")},
                propagate_forward=True,
                created_order=1,
            ),
            PlannedEventInput(
                event_type="INDEXATION",
                effective_month=9,
                index_percent=Decimal("5"),
                index_article="BASE",
                created_order=2,
            ),
        ],
        bands=[SalaryBand("Backend", "Senior", Decimal("80"), Decimal("100000"), Decimal("120"))],
    )
    lines = calc.calculate()
    sep = next(l for l in lines if l.month == 9 and l.article == "BASE")
    assert sep.amount == Decimal("210000.00")
