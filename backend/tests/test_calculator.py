from app.costing.calculator import calculate_quote
from app.costing.schemas import (
    CadFileInput,
    CamProgrammingInput,
    MaterialInput,
    OperationInput,
    QuoteInput,
    RateDriversInput,
)


def _base_quote(cam_programming: CamProgrammingInput) -> QuoteInput:
    return QuoteInput(
        quote_id="Q-001",
        part_name="Test bracket",
        quantity=20,
        cad_file=CadFileInput(filename="bracket.step", file_size_bytes=250000),
        cam_programming=cam_programming,
        material=MaterialInput(
            name="S355 plate blank",
            stock_piece_cost_eur=100,
            stock_pieces_required=2,
            scrap_recovery_eur=10,
        ),
        operations=[
            OperationInput(
                operation_type="saw_cutting",
                machine_hour_rate_eur=22,
                labor_hour_rate_eur=18,
                setup_machine_minutes=15,
                setup_labor_minutes=15,
                run_machine_minutes_per_part=1,
                run_labor_minutes_per_part=0.5,
            ),
            OperationInput(
                operation_type="milling_3_axis",
                machine_hour_rate_eur=55,
                labor_hour_rate_eur=22,
                setup_machine_minutes=60,
                setup_labor_minutes=90,
                run_machine_minutes_per_part=8,
                run_labor_minutes_per_part=1,
                tooling_cost_per_part_eur=1.5,
                scrap_allowance_percent=0.03,
            ),
        ],
    )


def test_quote_calculation_breaks_out_material_engineering_operations_and_margin() -> None:
    quote = _base_quote(
        CamProgrammingInput(
            is_new_part=True,
            complexity="medium",
            estimated_programming_minutes=90,
            setup_proveout_minutes=30,
            programming_labor_hour_rate_eur=32,
        )
    )

    result = calculate_quote(quote)

    assert result.formula_version == "costing.v0.2"
    assert result.material_cost_eur == 190
    assert result.engineering_cost_eur == 64
    assert result.operation_cost_eur > 0
    assert result.total_cost_eur > (
        result.material_cost_eur + result.engineering_cost_eur + result.operation_cost_eur
    )
    assert result.sell_price_eur > result.total_cost_eur
    assert result.unit_sell_price_eur == round(result.sell_price_eur / 20, 2)
    assert len(result.lines) == 4


def test_repeat_part_reuses_existing_cam_program_with_lower_cost() -> None:
    new_part = calculate_quote(
        _base_quote(
            CamProgrammingInput(
                is_new_part=True,
                estimated_programming_minutes=90,
                setup_proveout_minutes=30,
                programming_labor_hour_rate_eur=32,
                reusable_program_percent=0,
            )
        )
    )
    repeat_part = calculate_quote(
        _base_quote(
            CamProgrammingInput(
                is_new_part=False,
                estimated_programming_minutes=90,
                setup_proveout_minutes=30,
                programming_labor_hour_rate_eur=32,
                reusable_program_percent=0.85,
            )
        )
    )

    assert repeat_part.engineering_cost_eur == 9.6
    assert repeat_part.sell_price_eur < new_part.sell_price_eur


def test_scrap_allowance_excludes_setup_and_outsourced_batch_cost() -> None:
    op_with_scrap = OperationInput(
        operation_type="milling_3_axis",
        machine_hour_rate_eur=55,
        labor_hour_rate_eur=22,
        setup_machine_minutes=60,
        setup_labor_minutes=90,
        run_machine_minutes_per_part=8,
        run_labor_minutes_per_part=1,
        tooling_cost_per_part_eur=1.5,
        outsourced_batch_cost_eur=100,
        scrap_allowance_percent=0.10,
    )
    quote = QuoteInput(
        part_name="Scrap check",
        quantity=20,
        material=MaterialInput(name="blank", stock_piece_cost_eur=10, stock_pieces_required=1),
        operations=[op_with_scrap],
    )
    result = calculate_quote(quote)
    details = result.lines[-1].details

    setup_cost = details["setup_machine_cost_eur"] + details["setup_labor_cost_eur"]
    run_and_variable = details["run_machine_cost_eur"] + details["run_labor_cost_eur"] + details["variable_cost_eur"]
    expected_scrap = round(run_and_variable * 0.10, 2)

    assert details["scrap_allowance_eur"] == expected_scrap
    # Scrap allowance must not be a function of setup or the outsourced batch cost.
    assert details["scrap_allowance_eur"] != round((setup_cost + run_and_variable + 100) * 0.10, 2)


def test_cumulative_yield_inflates_started_quantity_for_upstream_operations() -> None:
    ops = [
        OperationInput(
            operation_type="saw_cutting",
            machine_hour_rate_eur=20,
            run_machine_minutes_per_part=2,
            scrap_allowance_percent=0.10,
        ),
        OperationInput(
            operation_type="milling_3_axis",
            machine_hour_rate_eur=50,
            run_machine_minutes_per_part=5,
            scrap_allowance_percent=0.05,
        ),
    ]
    quote = QuoteInput(
        part_name="Yield check",
        quantity=100,
        material=MaterialInput(name="blank", stock_piece_cost_eur=10, stock_pieces_required=1),
        operations=ops,
    )
    result = calculate_quote(quote)

    first_op_started = result.lines[1].details["started_quantity"]
    second_op_started = result.lines[2].details["started_quantity"]

    # To ship 100 good parts, op 2 (5% scrap) must start 100 / 0.95.
    assert second_op_started == round(100 / 0.95, 2)
    # Op 1 must additionally cover its own 10% scrap on top of op 2's requirement.
    assert first_op_started == round(second_op_started / 0.90, 2)
    assert first_op_started > second_op_started > 100


def test_overhead_percent_base_excludes_material_and_pass_through_cost() -> None:
    op = OperationInput(
        operation_type="milling_3_axis",
        machine_hour_rate_eur=50,
        labor_hour_rate_eur=20,
        run_machine_minutes_per_part=10,
        run_labor_minutes_per_part=5,
        outsourced_cost_per_part_eur=5,
    )
    material = MaterialInput(name="expensive blank", stock_piece_cost_eur=1000, stock_pieces_required=1)
    quote_low_material = QuoteInput(
        part_name="Overhead base check (cheap material)",
        quantity=10,
        material=MaterialInput(name="cheap blank", stock_piece_cost_eur=1, stock_pieces_required=1),
        operations=[op],
        commercial_policy={"overhead_percent": 0.2, "margin_percent": 0.2, "risk_allowance_percent": 0},
    )
    quote_high_material = QuoteInput(
        part_name="Overhead base check (expensive material)",
        quantity=10,
        material=material,
        operations=[op],
        commercial_policy={"overhead_percent": 0.2, "margin_percent": 0.2, "risk_allowance_percent": 0},
    )

    low = calculate_quote(quote_low_material)
    high = calculate_quote(quote_high_material)

    # Overhead is driven by conversion cost only, so it must be identical regardless of
    # how expensive the pass-through material is.
    assert low.overhead_cost_eur == high.overhead_cost_eur


def test_pass_through_visibility_warning_fires_above_40_percent() -> None:
    op = OperationInput(
        operation_type="saw_cutting",
        machine_hour_rate_eur=10,
        run_machine_minutes_per_part=1,
    )
    expensive_material_quote = QuoteInput(
        part_name="Pass-through heavy",
        quantity=10,
        material=MaterialInput(name="expensive blank", stock_piece_cost_eur=500, stock_pieces_required=1),
        operations=[op],
    )
    result = calculate_quote(expensive_material_quote)

    assert any("pass-through" in warning.lower() for warning in result.warnings)


def test_commercial_multiplier_reflects_sell_price_over_subtotal() -> None:
    quote = _base_quote(
        CamProgrammingInput(
            is_new_part=True,
            estimated_programming_minutes=90,
            setup_proveout_minutes=30,
            programming_labor_hour_rate_eur=32,
        )
    )
    result = calculate_quote(quote)
    subtotal = result.material_cost_eur + result.engineering_cost_eur + result.operation_cost_eur

    assert result.commercial_multiplier == round(result.sell_price_eur / subtotal, 3)
    assert result.commercial_multiplier > 1


def test_rate_driver_mismatch_over_1_percent_produces_warning() -> None:
    op = OperationInput(
        operation_type="milling_3_axis",
        machine_hour_rate_eur=100,  # deliberately far from what the drivers compute
        run_machine_minutes_per_part=10,
        rate_drivers=RateDriversInput(
            fixed_cost_eur_per_month=1565,
            planned_hours_per_month=160,
            utilization_percent=0.95,
            availability_percent=0.90,
            variable_cost_eur_per_hour=5,
            overhead_eur_per_hour=18.8,
        ),
    )
    quote = QuoteInput(
        part_name="Driver mismatch check",
        quantity=10,
        material=MaterialInput(name="blank", stock_piece_cost_eur=10, stock_pieces_required=1),
        operations=[op],
    )
    result = calculate_quote(quote)

    assert any("rate label may not match drivers" in warning for warning in result.warnings)


def test_rate_driver_match_within_1_percent_produces_no_warning() -> None:
    op = OperationInput(
        operation_type="milling_3_axis",
        machine_hour_rate_eur=35.24,  # matches the seed cnc_milling_3_axis target rate
        run_machine_minutes_per_part=10,
        rate_drivers=RateDriversInput(
            fixed_cost_eur_per_month=1565,
            planned_hours_per_month=160,
            utilization_percent=0.95,
            availability_percent=0.90,
            variable_cost_eur_per_hour=5,
            overhead_eur_per_hour=18.8,
        ),
    )
    quote = QuoteInput(
        part_name="Driver match check",
        quantity=10,
        material=MaterialInput(name="blank", stock_piece_cost_eur=10, stock_pieces_required=1),
        operations=[op],
    )
    result = calculate_quote(quote)

    assert not any("rate label may not match drivers" in warning for warning in result.warnings)
