from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class FormulaVersion(StrEnum):
    V0_1 = "costing.v0.1"
    V0_2 = "costing.v0.2"


class PrecisionLevel(StrEnum):
    FAST_ESTIMATE = "fast_estimate"
    OPERATION_BASED = "operation_based"
    RESOURCE_ACCURATE = "resource_accurate"
    ACTUALS_FEEDBACK = "actuals_feedback"


class RateMode(StrEnum):
    ACCOUNTING_FULL_COST = "accounting_full_cost"
    TARGET_COMPETITIVE = "target_competitive"


class MaterialInput(BaseModel):
    name: str
    stock_piece_cost_eur: float = Field(ge=0)
    stock_pieces_required: float = Field(gt=0)
    scrap_recovery_eur: float = Field(default=0, ge=0)
    assumption_quality: str = "company_estimate"


class CadFileInput(BaseModel):
    filename: str | None = None
    file_size_bytes: int | None = Field(default=None, ge=0)
    file_type: str = "step"
    geometry_confidence: str = "not_parsed"


class CamProgrammingInput(BaseModel):
    required: bool = True
    is_new_part: bool = True
    complexity: str = "medium"
    programming_labor_hour_rate_eur: float = Field(default=32, ge=0)
    estimated_programming_minutes: float = Field(default=90, ge=0)
    setup_proveout_minutes: float = Field(default=30, ge=0)
    reusable_program_percent: float = Field(default=0, ge=0, le=1)
    assumption_quality: str = "industry_estimate"


class RateDriversInput(BaseModel):
    """Optional machine-rate inputs alongside an already-resolved machine_hour_rate_eur.

    When present, the backend recomputes the rate from these drivers (see
    app/costing/rates.py, the same formula as frontend/src/main.tsx) and warns if it
    disagrees with the label by more than 1% -- rate_mode alone is decorative unless the
    backend can verify the number it names.
    """

    fixed_cost_eur_per_month: float = Field(ge=0)
    planned_hours_per_month: float = Field(gt=0)
    utilization_percent: float = Field(gt=0, le=1)
    availability_percent: float = Field(gt=0, le=1)
    variable_cost_eur_per_hour: float = Field(default=0, ge=0)
    overhead_eur_per_hour: float = Field(default=0, ge=0)


class OperationInput(BaseModel):
    operation_type: str
    name: str | None = None
    machine_hour_rate_eur: float = Field(default=0, ge=0)
    labor_hour_rate_eur: float = Field(default=0, ge=0)
    setup_machine_minutes: float = Field(default=0, ge=0)
    setup_labor_minutes: float = Field(default=0, ge=0)
    run_machine_minutes_per_part: float = Field(default=0, ge=0)
    run_labor_minutes_per_part: float = Field(default=0, ge=0)
    tooling_cost_per_part_eur: float = Field(default=0, ge=0)
    consumables_cost_per_part_eur: float = Field(default=0, ge=0)
    outsourced_cost_per_part_eur: float = Field(default=0, ge=0)
    outsourced_batch_cost_eur: float = Field(default=0, ge=0)
    missing_tool_batch_cost_eur: float = Field(default=0, ge=0)
    scrap_allowance_percent: float = Field(default=0, ge=0, le=1)
    rate_drivers: RateDriversInput | None = None
    assumption_quality: str = "company_estimate"


class CommercialPolicyInput(BaseModel):
    margin_percent: float = Field(default=0.25, ge=0, lt=1)
    overhead_percent: float = Field(default=0, ge=0)
    risk_allowance_percent: float = Field(default=0.05, ge=0)
    minimum_order_admin_cost_eur: float = Field(default=0, ge=0)


class QuoteInput(BaseModel):
    quote_id: str | None = None
    part_name: str
    quantity: int = Field(gt=0)
    precision_level: PrecisionLevel = PrecisionLevel.OPERATION_BASED
    rate_mode: RateMode = RateMode.TARGET_COMPETITIVE
    cad_file: CadFileInput | None = None
    cam_programming: CamProgrammingInput | None = None
    material: MaterialInput
    operations: list[OperationInput] = Field(default_factory=list)
    commercial_policy: CommercialPolicyInput = Field(default_factory=CommercialPolicyInput)

    @model_validator(mode="after")
    def require_operations_for_deeper_quotes(self) -> "QuoteInput":
        if self.precision_level != PrecisionLevel.FAST_ESTIMATE and not self.operations:
            raise ValueError("operation-based quotes require at least one operation")
        return self


class CostLine(BaseModel):
    code: str
    label: str
    cost_eur: float
    unit_cost_eur: float
    details: dict[str, float | str]


class QuoteResult(BaseModel):
    formula_version: FormulaVersion
    quote_id: str | None
    part_name: str
    quantity: int
    precision_level: PrecisionLevel
    rate_mode: RateMode
    material_cost_eur: float
    engineering_cost_eur: float
    operation_cost_eur: float
    missing_tool_cost_eur: float
    overhead_cost_eur: float
    risk_allowance_eur: float
    minimum_order_admin_cost_eur: float
    total_cost_eur: float
    unit_cost_eur: float
    margin_percent: float
    sell_price_eur: float
    unit_sell_price_eur: float
    commercial_multiplier: float
    lines: list[CostLine]
    assumptions_used: list[str]
    warnings: list[str]
