from app.costing.calculator import calculate_quote
from app.costing.schemas import (
    CadFileInput,
    CamProgrammingInput,
    MaterialInput,
    OperationInput,
    QuoteInput,
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

    assert result.formula_version == "costing.v0.1"
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
