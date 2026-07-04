from app.costing.schemas import (
    CamProgrammingInput,
    CostLine,
    FormulaVersion,
    OperationInput,
    QuoteInput,
    QuoteResult,
)


def _round_money(value: float) -> float:
    return round(value + 1e-9, 2)


def _hours(minutes: float) -> float:
    return minutes / 60


def _material_cost(quote: QuoteInput) -> tuple[float, CostLine]:
    material = quote.material
    cost = (
        material.stock_piece_cost_eur * material.stock_pieces_required
        - material.scrap_recovery_eur
    )
    cost = max(cost, 0)
    line = CostLine(
        code="material",
        label=f"Material: {material.name}",
        cost_eur=_round_money(cost),
        unit_cost_eur=_round_money(cost / quote.quantity),
        details={
            "stock_piece_cost_eur": material.stock_piece_cost_eur,
            "stock_pieces_required": material.stock_pieces_required,
            "scrap_recovery_eur": material.scrap_recovery_eur,
            "assumption_quality": material.assumption_quality,
        },
    )
    return cost, line


def _cam_programming_cost(cam: CamProgrammingInput | None, quantity: int) -> tuple[float, CostLine | None]:
    if cam is None or not cam.required:
        return 0.0, None

    gross_minutes = cam.estimated_programming_minutes + cam.setup_proveout_minutes
    billable_minutes = gross_minutes * (1 - cam.reusable_program_percent)
    total = _hours(billable_minutes) * cam.programming_labor_hour_rate_eur
    line = CostLine(
        code="engineering.cam_programming",
        label="CAM programming and prove-out",
        cost_eur=_round_money(total),
        unit_cost_eur=_round_money(total / quantity),
        details={
            "is_new_part": str(cam.is_new_part),
            "complexity": cam.complexity,
            "estimated_programming_minutes": cam.estimated_programming_minutes,
            "setup_proveout_minutes": cam.setup_proveout_minutes,
            "reusable_program_percent": cam.reusable_program_percent,
            "programming_labor_hour_rate_eur": cam.programming_labor_hour_rate_eur,
            "assumption_quality": cam.assumption_quality,
        },
    )
    return total, line


def _operation_cost(operation: OperationInput, quantity: int) -> tuple[float, CostLine]:
    label = operation.name or operation.operation_type.replace("_", " ").title()
    setup_machine_cost = _hours(operation.setup_machine_minutes) * operation.machine_hour_rate_eur
    setup_labor_cost = _hours(operation.setup_labor_minutes) * operation.labor_hour_rate_eur
    run_machine_cost = (
        quantity
        * _hours(operation.run_machine_minutes_per_part)
        * operation.machine_hour_rate_eur
    )
    run_labor_cost = (
        quantity
        * _hours(operation.run_labor_minutes_per_part)
        * operation.labor_hour_rate_eur
    )
    variable_unit_cost = (
        operation.tooling_cost_per_part_eur
        + operation.consumables_cost_per_part_eur
        + operation.outsourced_cost_per_part_eur
    )
    variable_cost = quantity * variable_unit_cost
    base_cost = (
        setup_machine_cost
        + setup_labor_cost
        + run_machine_cost
        + run_labor_cost
        + variable_cost
        + operation.outsourced_batch_cost_eur
    )
    scrap_allowance = base_cost * operation.scrap_allowance_percent
    total = base_cost + scrap_allowance
    line = CostLine(
        code=f"operation.{operation.operation_type}",
        label=label,
        cost_eur=_round_money(total),
        unit_cost_eur=_round_money(total / quantity),
        details={
            "setup_machine_cost_eur": _round_money(setup_machine_cost),
            "setup_labor_cost_eur": _round_money(setup_labor_cost),
            "run_machine_cost_eur": _round_money(run_machine_cost),
            "run_labor_cost_eur": _round_money(run_labor_cost),
            "variable_cost_eur": _round_money(variable_cost),
            "outsourced_batch_cost_eur": operation.outsourced_batch_cost_eur,
            "scrap_allowance_eur": _round_money(scrap_allowance),
            "assumption_quality": operation.assumption_quality,
        },
    )
    return total, line


def calculate_quote(quote: QuoteInput) -> QuoteResult:
    lines: list[CostLine] = []
    assumptions_used: list[str] = []
    warnings: list[str] = []

    material_cost, material_line = _material_cost(quote)
    lines.append(material_line)

    if quote.material.assumption_quality != "measured":
        assumptions_used.append(
            f"Material '{quote.material.name}' uses {quote.material.assumption_quality} data."
        )

    engineering_cost, engineering_line = _cam_programming_cost(
        quote.cam_programming,
        quote.quantity,
    )
    if engineering_line is not None:
        lines.append(engineering_line)

    if quote.cad_file is not None and quote.cad_file.filename:
        assumptions_used.append(
            f"CAD file '{quote.cad_file.filename}' is recorded with "
            f"{quote.cad_file.geometry_confidence} geometry confidence."
        )
    if quote.cam_programming is not None and quote.cam_programming.assumption_quality != "measured":
        assumptions_used.append(
            "CAM programming time uses "
            f"{quote.cam_programming.assumption_quality} data."
        )
        if quote.cad_file is not None:
            warnings.append(
                "STEP geometry is not parsed yet; CAM time is estimated from complexity inputs."
            )

    operation_cost = 0.0
    for operation in quote.operations:
        cost, line = _operation_cost(operation, quote.quantity)
        operation_cost += cost
        lines.append(line)

        if operation.assumption_quality != "measured":
            assumptions_used.append(
                f"Operation '{operation.operation_type}' uses {operation.assumption_quality} data."
            )
        if operation.machine_hour_rate_eur == 0 and operation.run_machine_minutes_per_part > 0:
            warnings.append(f"Operation '{operation.operation_type}' has machine time but zero machine rate.")
        if operation.labor_hour_rate_eur == 0 and (
            operation.setup_labor_minutes > 0 or operation.run_labor_minutes_per_part > 0
        ):
            warnings.append(f"Operation '{operation.operation_type}' has labor time but zero labor rate.")

    subtotal_before_policy = material_cost + engineering_cost + operation_cost
    overhead_cost = subtotal_before_policy * quote.commercial_policy.overhead_percent
    risk_allowance = (
        subtotal_before_policy + overhead_cost
    ) * quote.commercial_policy.risk_allowance_percent
    minimum_order_admin_cost = quote.commercial_policy.minimum_order_admin_cost_eur
    total_cost = subtotal_before_policy + overhead_cost + risk_allowance + minimum_order_admin_cost

    margin_percent = quote.commercial_policy.margin_percent
    sell_price = total_cost / (1 - margin_percent)

    if quote.quantity < 10:
        warnings.append("Low quantity: setup amortization may dominate the unit price.")
    if quote.precision_level.value == "fast_estimate":
        warnings.append("Fast estimate: verify route, setup time, and cycle time before committing price.")

    return QuoteResult(
        formula_version=FormulaVersion.V0_1,
        quote_id=quote.quote_id,
        part_name=quote.part_name,
        quantity=quote.quantity,
        precision_level=quote.precision_level,
        rate_mode=quote.rate_mode,
        material_cost_eur=_round_money(material_cost),
        engineering_cost_eur=_round_money(engineering_cost),
        operation_cost_eur=_round_money(operation_cost),
        overhead_cost_eur=_round_money(overhead_cost),
        risk_allowance_eur=_round_money(risk_allowance),
        minimum_order_admin_cost_eur=_round_money(minimum_order_admin_cost),
        total_cost_eur=_round_money(total_cost),
        unit_cost_eur=_round_money(total_cost / quote.quantity),
        margin_percent=margin_percent,
        sell_price_eur=_round_money(sell_price),
        unit_sell_price_eur=_round_money(sell_price / quote.quantity),
        lines=lines,
        assumptions_used=assumptions_used,
        warnings=warnings,
    )
