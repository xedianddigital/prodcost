from app.costing.rates import MachineRateDrivers, machine_rate_from_drivers
from app.costing.schemas import (
    CamProgrammingInput,
    CostLine,
    FormulaVersion,
    OperationInput,
    QuoteInput,
    QuoteResult,
)

_RATE_MISMATCH_TOLERANCE_PERCENT = 0.01


def _rate_driver_mismatch_warning(operation: OperationInput) -> str | None:
    if operation.rate_drivers is None:
        return None
    drivers = MachineRateDrivers(
        fixed_cost_eur_per_month=operation.rate_drivers.fixed_cost_eur_per_month,
        planned_hours_per_month=operation.rate_drivers.planned_hours_per_month,
        utilization_percent=operation.rate_drivers.utilization_percent,
        availability_percent=operation.rate_drivers.availability_percent,
        variable_cost_eur_per_hour=operation.rate_drivers.variable_cost_eur_per_hour,
    )
    computed_rate = machine_rate_from_drivers(drivers, operation.rate_drivers.overhead_eur_per_hour)
    labeled_rate = operation.machine_hour_rate_eur
    if labeled_rate <= 0:
        return None
    deviation = abs(computed_rate - labeled_rate) / labeled_rate
    if deviation <= _RATE_MISMATCH_TOLERANCE_PERCENT:
        return None
    label = operation.name or operation.operation_type
    return (
        f"Operation '{label}': rate label may not match drivers "
        f"(labeled {labeled_rate:.2f} EUR/h, drivers compute {computed_rate:.2f} EUR/h)."
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


_MAX_SCRAP_ALLOWANCE_PERCENT = 0.95


def _effective_scrap_percent(operation: OperationInput) -> float:
    return min(operation.scrap_allowance_percent, _MAX_SCRAP_ALLOWANCE_PERCENT)


def _started_quantities(operations: list[OperationInput], quantity: int) -> list[float]:
    """Sequential yield: to ship `quantity` good parts, the quantity fed into operation i
    must cover its own scrap plus every downstream operation's scrap. Computed backward
    from the last operation so each op's started quantity is Q / prod(1 - scrap_j) for j >= i.
    """
    started = [0.0] * len(operations)
    running_yield = 1.0
    for i in range(len(operations) - 1, -1, -1):
        running_yield *= 1 - _effective_scrap_percent(operations[i])
        started[i] = quantity / max(running_yield, 1 - _MAX_SCRAP_ALLOWANCE_PERCENT)
    return started


def _operation_cost(
    operation: OperationInput, quantity: int, started_quantity: float
) -> tuple[float, float, float, CostLine]:
    """Returns (total_cost, conversion_cost, pass_through_cost, line).

    conversion_cost is setup + run machine/labor cost plus its share of the scrap
    allowance -- the base for percent-of-cost overhead (item 6c). pass_through_cost is
    tooling/consumables/outsourced-per-part plus outsourced batch cost plus their share
    of scrap -- risk/margin still apply to it, but overhead does not, and it feeds the
    pass-through visibility warning (item 6d).
    """
    label = operation.name or operation.operation_type.replace("_", " ").title()
    scrap_percent = _effective_scrap_percent(operation)

    setup_machine_cost = _hours(operation.setup_machine_minutes) * operation.machine_hour_rate_eur
    setup_labor_cost = _hours(operation.setup_labor_minutes) * operation.labor_hour_rate_eur
    run_machine_cost = (
        started_quantity
        * _hours(operation.run_machine_minutes_per_part)
        * operation.machine_hour_rate_eur
    )
    run_labor_cost = (
        started_quantity
        * _hours(operation.run_labor_minutes_per_part)
        * operation.labor_hour_rate_eur
    )
    variable_unit_cost = (
        operation.tooling_cost_per_part_eur
        + operation.consumables_cost_per_part_eur
        + operation.outsourced_cost_per_part_eur
    )
    variable_cost = started_quantity * variable_unit_cost

    # Scrap allowance covers run cost and per-part variable cost only -- setup and the
    # outsourced batch cost are paid once per batch regardless of scrap, so they stay outside.
    scrap_on_run = (run_machine_cost + run_labor_cost) * scrap_percent
    scrap_on_variable = variable_cost * scrap_percent
    scrap_allowance = scrap_on_run + scrap_on_variable

    conversion_cost = setup_machine_cost + setup_labor_cost + run_machine_cost + run_labor_cost + scrap_on_run
    pass_through_cost = variable_cost + scrap_on_variable + operation.outsourced_batch_cost_eur
    total = conversion_cost + pass_through_cost

    line = CostLine(
        code=f"operation.{operation.operation_type}",
        label=label,
        cost_eur=_round_money(total),
        unit_cost_eur=_round_money(total / quantity),
        details={
            "started_quantity": round(started_quantity, 2),
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
    return total, conversion_cost, pass_through_cost, line


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

    started_quantities = _started_quantities(quote.operations, quote.quantity)

    operation_cost = 0.0
    conversion_cost = engineering_cost
    pass_through_cost = 0.0
    for operation, started_quantity in zip(quote.operations, started_quantities):
        cost, op_conversion, op_pass_through, line = _operation_cost(
            operation, quote.quantity, started_quantity
        )
        operation_cost += cost
        conversion_cost += op_conversion
        pass_through_cost += op_pass_through
        lines.append(line)

        if operation.scrap_allowance_percent >= _MAX_SCRAP_ALLOWANCE_PERCENT:
            warnings.append(
                f"Operation '{operation.operation_type}' scrap allowance "
                f"{operation.scrap_allowance_percent:.0%} is capped at "
                f"{_MAX_SCRAP_ALLOWANCE_PERCENT:.0%} to avoid an unbounded started quantity."
            )
        rate_mismatch = _rate_driver_mismatch_warning(operation)
        if rate_mismatch is not None:
            warnings.append(rate_mismatch)
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
    # Overhead (admin/sales/quality/facility) is absorbed against conversion cost --
    # setup + run machine/labor time, post-scrap, plus engineering -- not against material,
    # tooling/consumables/outsourced-per-part, or outsourced batch cost. Those pass-through
    # costs don't consume the shop's own conversion capacity, so loading overhead onto them
    # would make material-heavy quotes diverge between the two overhead allocation methods.
    overhead_cost = conversion_cost * quote.commercial_policy.overhead_percent
    risk_allowance = (
        subtotal_before_policy + overhead_cost
    ) * quote.commercial_policy.risk_allowance_percent
    minimum_order_admin_cost = quote.commercial_policy.minimum_order_admin_cost_eur
    total_cost = subtotal_before_policy + overhead_cost + risk_allowance + minimum_order_admin_cost

    margin_percent = quote.commercial_policy.margin_percent
    sell_price = total_cost / (1 - margin_percent)
    commercial_multiplier = sell_price / subtotal_before_policy if subtotal_before_policy > 0 else 0.0

    pass_through_total = material_cost + pass_through_cost
    if total_cost > 0 and pass_through_total / total_cost > 0.4:
        warnings.append(
            "Material and outsourced/pass-through cost is "
            f"{pass_through_total / total_cost:.0%} of total cost: full risk and margin are "
            "being applied to pass-through cost, a known driver of uncompetitive quotes."
        )

    if quote.quantity < 10:
        warnings.append("Low quantity: setup amortization may dominate the unit price.")
    if quote.precision_level.value == "fast_estimate":
        warnings.append("Fast estimate: verify route, setup time, and cycle time before committing price.")

    return QuoteResult(
        formula_version=FormulaVersion.V0_2,
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
        commercial_multiplier=round(commercial_multiplier, 3),
        lines=lines,
        assumptions_used=assumptions_used,
        warnings=warnings,
    )
