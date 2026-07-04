import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BookOpen,
  Calculator,
  Database,
  Factory,
  Gauge,
  LibraryBig,
  Plus,
  Save,
  Send,
  SplitSquareVertical,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload
} from "lucide-react";
import "./styles.css";

type View = "quote" | "client_portal" | "resources" | "scenarios" | "print" | "business_case" | "guide" | "profitability";
type ResourceSubView = "values" | "explanations";
type RateMode = "accounting_full_cost" | "target_competitive";
type PrintDocumentMode = "customer_offer" | "internal_cost_sheet";

type ErpPartSummary = {
  id: string;
  part_number: string;
  revision: string;
  name: string;
  customer_id: string;
  customer_name: string;
  rfq_reference: string;
  default_quantity: number;
  quantity_breaks: number[];
  is_new_part: boolean;
  operation_count: number;
  bom_count: number;
};

type ErpRouteOperation = {
  sequence: number;
  operation_type: string;
  name: string;
  machine_class_id: string | null;
  labor_class_id: string | null;
  setup_machine_minutes: number;
  setup_labor_minutes: number;
  run_machine_minutes_per_part: number;
  run_labor_minutes_per_part: number;
  tooling_cost_per_part_eur: number;
  consumables_cost_per_part_eur: number;
  outsourced_cost_per_part_eur: number;
  outsourced_batch_cost_eur: number;
  scrap_allowance_percent: number;
};

type ErpImportPayload = {
  source: string;
  imported_at: string;
  part: {
    id: string;
    part_number: string;
    revision: string;
    name: string;
    rfq_reference: string;
    default_quantity: number;
    quantity_breaks: number[];
    is_new_part: boolean;
    cam_complexity: string;
    programming_minutes: number;
    proveout_minutes: number;
    delivery_estimate: string;
  };
  customer: {
    id: string;
    name: string;
    payment_terms: string;
  };
  material: {
    name: string;
    stock_description: string;
    stock_piece_cost_eur: number;
    stock_pieces_required: number;
    scrap_recovery_eur: number;
  };
  route: ErpRouteOperation[];
  availability_notes: string[];
};

type ErpSourceState = {
  partId: string;
  partNumber: string;
  revision: string;
  importedAt: string;
} | null;

type ErpOfferPayload = {
  id: string;
  status: string;
  quote_number: string;
  created_at: string;
};

type QuoteOperation = {
  id: string;
  operationType: string;
  name: string;
  machineClassId: string | null;
  laborClassId: string | null;
  setupMachineMinutes: number;
  setupLaborMinutes: number;
  runMachineMinutesPerPart: number;
  runLaborMinutesPerPart: number;
  toolingCostPerPart: number;
  consumablesCostPerPart: number;
  outsourcedCostPerPart: number;
  outsourcedBatchCost: number;
  scrapAllowancePercent: number;
  toolRequirements: ToolRequirement[];
};

type ActualOperation = {
  operationId: string;
  actualSetupMachineMinutes: number;
  actualSetupLaborMinutes: number;
  actualRunMachineMinutesPerPart: number;
  actualRunLaborMinutesPerPart: number;
  actualScrapPercent: number;
  notes: string;
};

type QuoteDraft = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  quote_state: Record<string, unknown>;
  target_result: QuoteResult | null;
  accounting_result: QuoteResult | null;
  assumptions_snapshot: Assumptions | null;
};

type QuoteResult = {
  material_cost_eur: number;
  engineering_cost_eur: number;
  operation_cost_eur: number;
  risk_allowance_eur: number;
  total_cost_eur: number;
  unit_cost_eur: number;
  margin_percent: number;
  sell_price_eur: number;
  unit_sell_price_eur: number;
  commercial_multiplier: number;
  lines: Array<{ code: string; label: string; cost_eur: number; unit_cost_eur: number }>;
  assumptions_used: string[];
  warnings: string[];
};

type PortalPart = {
  id: string;
  partName: string;
  fileName: string;
  fileSizeBytes: number;
  drawingFileName: string;
  drawingSizeBytes: number;
  materialId: string;
  materialRequirement: string;
  stockName: string;
  stockCost: number;
  cutLengthMm: number;
  cutWidthMm: number;
  quantity: number;
  annualVolume: number;
  toleranceRequirement: "standard" | "drawing" | "custom";
  documentationRequirement: "standard" | "dimensional_report" | "full_fai";
  surfaceFinish: string;
  deliveryRequirement: "standard" | "expedite" | "date_critical";
  threadOrInsertRequirement: "none" | "yes" | "unknown";
  notes: string;
};

type PortalEstimate = {
  result: QuoteResult;
  accountingSellPriceEur: number;
  lowTotalEur: number;
  highTotalEur: number;
  lowUnitEur: number;
  highUnitEur: number;
  confidence: string;
  readinessIssues: string[];
};

type LaborClass = {
  id: string;
  name: string;
  employer_cost_per_hour_eur: number;
  gross_monthly_salary_eur?: number;
  employer_social_contribution_rate?: number;
  paid_hours_per_month?: number;
  cost_method?: "direct_hourly" | "gross_monthly";
  derived_employer_cost_per_hour_eur?: number;
  quality: string;
};

type MachineClass = {
  id: string;
  name: string;
  accounting_full_cost_rate_eur_per_hour: number;
  target_competitive_rate_eur_per_hour: number;
  actual_oee_percent: number;
  target_oee_percent: number;
  actual_availability_percent?: number;
  target_availability_percent?: number;
  actual_utilization_percent?: number;
  target_utilization_percent?: number;
  loaded_power_kw: number;
  monthly_fixed_cost_eur?: number;
  planned_hours_per_month?: number;
  variable_cost_eur_per_hour?: number;
  target_rate_discount_percent?: number;
  purchase_price_eur?: number;
  useful_life_years?: number;
  salvage_percent?: number;
  other_monthly_fixed_cost_eur?: number;
  quality: string;
};

type OverheadItem = {
  id: string;
  name: string;
  monthly_cost_eur: number;
  quality: string;
};

type OverheadAllocation = {
  allocation_method: "per_machine_hour" | "percent_of_cost";
  monthly_items: OverheadItem[];
};

type StockShape = "round_bar" | "hex_bar" | "square_bar" | "tube" | "plate";

type MaterialExample = {
  id: string;
  name: string;
  unit: string;
  stock_piece_cost_eur: number;
  category?: string;
  material_grade?: string;
  stock_description?: string;
  supplier?: string;
  minimum_order_quantity?: number;
  scrap_recovery_percent?: number;
  last_updated?: string;
  quality: string;
  stock_shape?: StockShape;
  stock_length_mm?: number;
  stock_width_mm?: number;
  kerf_mm?: number;
};

type ToolInventoryItem = {
  id: string;
  name: string;
  type: string;
  diameter_mm: number;
  corner_radius_mm: number;
  material_groups: string[];
  available_quantity: number;
  replacement_cost_eur: number;
  lead_time_days: number;
  reusable: boolean;
  quality: string;
};

type ToolChargeMode = "included" | "charge_full" | "amortize";

type ToolRequirement = {
  id: string;
  description: string;
  toolType: string;
  diameterMm: number;
  cornerRadiusMm: number;
  materialGroup: string;
  quantity: number;
  estimatedReplacementCostEur: number;
  chargeMode: ToolChargeMode;
  amortizationQuantity: number;
};

type ToolCheckResult = {
  operation: QuoteOperation;
  requirement: ToolRequirement;
  status: "available" | "missing";
  matchedTool: ToolInventoryItem | null;
  quoteCostEur: number;
};

type OperationTemplate = {
  operation_type: string;
  default_machine_class_id: string | null;
  default_labor_class_id: string | null;
  default_setup_machine_minutes?: number;
  default_setup_labor_minutes?: number;
  default_run_machine_minutes_per_part?: number;
  default_run_labor_minutes_per_part?: number;
  default_tooling_cost_per_part_eur?: number;
  default_consumables_cost_per_part_eur?: number;
  default_outsourced_cost_per_part_eur?: number;
  default_outsourced_batch_cost_eur?: number;
  default_scrap_allowance_percent?: number;
  quality?: string;
};

type Assumptions = {
  id: string;
  name: string;
  currency: string;
  country: string;
  formula_version: string;
  cam_programming_defaults: {
    new_part_reusable_program_percent: number;
    repeat_part_reusable_program_percent: number;
    simple_programming_minutes: number;
    medium_programming_minutes: number;
    complex_programming_minutes: number;
    default_setup_proveout_minutes: number;
    programming_labor_class_id: string;
    quality: string;
  };
  commercial_policy: {
    default_margin_percent: number;
    risk_allowance_percent: number;
    minimum_order_admin_cost_eur: number;
  };
  payroll_tax_defaults?: {
    country: string;
    employer_social_contribution_rate: number;
    employee_social_contribution_rate: number;
    standard_total_vsaoi_rate: number;
    paid_hours_per_month: number;
    source_url: string;
    quality: string;
  };
  labor_classes: LaborClass[];
  machine_classes: MachineClass[];
  operation_templates: OperationTemplate[];
  material_examples: MaterialExample[];
  tool_inventory?: ToolInventoryItem[];
  overhead?: OverheadAllocation;
  client_portal?: {
    range_low_factor: number;
    range_high_factor: number;
    annual_volume_relief_percent: number;
  };
  [key: string]: unknown;
};

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
});

function numericValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function operationLabel(operationType: string) {
  return operationType.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deriveLaborHourlyCost(labor: LaborClass, assumptions: Assumptions | null) {
  const defaultTaxRate = assumptions?.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359;
  const defaultHours = assumptions?.payroll_tax_defaults?.paid_hours_per_month ?? 160;
  const gross = labor.gross_monthly_salary_eur ?? 0;
  const employerRate = labor.employer_social_contribution_rate ?? defaultTaxRate;
  const paidHours = labor.paid_hours_per_month ?? defaultHours;

  if (paidHours <= 0) {
    return 0;
  }

  return roundMoney((gross * (1 + employerRate)) / paidHours);
}

// OEE = how well a machine performs when it has work loaded (availability x performance x quality).
// Utilization = how much of available planned time actually gets loaded with orders in the first place.
// These are independent gauges: this project's diagnosis is OK-ish OEE with low Utilization.
// Idleness is the empty-order gap and is derived from Utilization, never from OEE.
function idlenessPercent(utilization: number) {
  return Math.max(0, 1 - utilization);
}

// Only availability belongs in the rate denominator. Cycle/setup times already carry
// performance losses, and scrap allowance already covers quality losses -- multiplying by
// full OEE (availability x performance x quality) here would double-charge both. OEE stays
// a diagnostic display elsewhere and no longer enters this formula.
function machineRateFromDrivers(machine: MachineClass, availability: number, utilization: number, overheadPerHour = 0) {
  const fixedCost = machine.monthly_fixed_cost_eur ?? 0;
  const plannedHours = machine.planned_hours_per_month ?? 160;
  const variableCost = machine.variable_cost_eur_per_hour ?? 0;
  const effectiveHours = plannedHours * Math.max(0.01, utilization) * Math.max(0.01, availability);
  return roundMoney(fixedCost / Math.max(1, effectiveHours) + variableCost + overheadPerHour);
}

function totalMonthlyOverheadEur(assumptions: Assumptions | null) {
  return (assumptions?.overhead?.monthly_items ?? []).reduce(
    (sum, item) => sum + (item.monthly_cost_eur || 0),
    0
  );
}

type OeeField = "actual_oee_percent" | "target_oee_percent";
type AvailabilityField = "actual_availability_percent" | "target_availability_percent";
type UtilizationField = "actual_utilization_percent" | "target_utilization_percent";

function availabilityValue(machine: MachineClass, availabilityField: AvailabilityField) {
  return machine[availabilityField] ?? (availabilityField === "target_availability_percent" ? 0.9 : 0.8);
}

function totalPlannedProductiveHours(
  assumptions: Assumptions | null,
  availabilityField: AvailabilityField,
  utilizationField: UtilizationField
) {
  return (assumptions?.machine_classes ?? []).reduce((sum, machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    const availability = Math.max(0.01, availabilityValue(machine, availabilityField));
    const utilization = Math.max(0.01, machine[utilizationField] ?? 1);
    return sum + plannedHours * availability * utilization;
  }, 0);
}

function overheadPerMachineHour(
  assumptions: Assumptions | null,
  availabilityField: AvailabilityField,
  utilizationField: UtilizationField
) {
  const hours = totalPlannedProductiveHours(assumptions, availabilityField, utilizationField);
  return roundMoney(totalMonthlyOverheadEur(assumptions) / Math.max(1, hours));
}

function blendedDirectMachineRate(
  assumptions: Assumptions | null,
  availabilityField: AvailabilityField,
  utilizationField: UtilizationField
) {
  const machines = assumptions?.machine_classes ?? [];
  let weightedSum = 0;
  let totalHours = 0;
  machines.forEach((machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    const availability = Math.max(0.01, availabilityValue(machine, availabilityField));
    const utilization = Math.max(0.01, machine[utilizationField] ?? 1);
    const hours = plannedHours * availability * utilization;
    const fixedCost = machine.monthly_fixed_cost_eur ?? 0;
    const variableCost = machine.variable_cost_eur_per_hour ?? 0;
    const directRate = fixedCost / Math.max(1, hours) + variableCost;
    weightedSum += directRate * hours;
    totalHours += hours;
  });
  return totalHours > 0 ? weightedSum / totalHours : 0;
}

// Expresses the per-machine-hour overhead figure as an equivalent coefficient on direct cost,
// derived from the same total-overhead input, so the two allocation methods stay comparable.
function overheadPercentEquivalent(
  assumptions: Assumptions | null,
  availabilityField: AvailabilityField,
  utilizationField: UtilizationField
) {
  const perHour = overheadPerMachineHour(assumptions, availabilityField, utilizationField);
  const blendedRate = blendedDirectMachineRate(assumptions, availabilityField, utilizationField);
  return blendedRate > 0 ? perHour / blendedRate : 0;
}

// Overhead going into a quote's commercial_policy.overhead_percent must be 0 when the
// per-machine-hour method is active, because it is already folded into each machine's
// EUR/h by withCalculatedMachineRates -- otherwise overhead would be double-counted.
function overheadPercentForMode(assumptions: Assumptions | null, mode: RateMode) {
  if (!assumptions?.overhead || assumptions.overhead.allocation_method === "per_machine_hour") {
    return 0;
  }
  return mode === "target_competitive"
    ? overheadPercentEquivalent(assumptions, "target_availability_percent", "target_utilization_percent")
    : overheadPercentEquivalent(assumptions, "actual_availability_percent", "actual_utilization_percent");
}

function calculatedAccountingMachineRate(machine: MachineClass, assumptions?: Assumptions | null) {
  const utilization = machine.actual_utilization_percent ?? 1;
  const availability = availabilityValue(machine, "actual_availability_percent");
  const overheadPerHour =
    assumptions?.overhead?.allocation_method === "per_machine_hour"
      ? overheadPerMachineHour(assumptions, "actual_availability_percent", "actual_utilization_percent")
      : 0;
  return machineRateFromDrivers(machine, availability, utilization, overheadPerHour);
}

// Default target Utilization is 95%, not 100%: pricing off a fully-booked assumption risks
// under-recovering fixed cost once real bookings land below that fantasy ceiling (the mirror
// image of the death spiral). 95% is a near-fully-booked commercial ambition with a small
// buffer below theoretical capacity, editable per machine, never hardcoded.
const DEFAULT_TARGET_UTILIZATION_PERCENT = 0.95;

function calculatedTargetMachineRate(machine: MachineClass, assumptions?: Assumptions | null) {
  const discount = machine.target_rate_discount_percent ?? 0;
  const utilization = machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT;
  const availability = availabilityValue(machine, "target_availability_percent");
  const overheadPerHour =
    assumptions?.overhead?.allocation_method === "per_machine_hour"
      ? overheadPerMachineHour(assumptions, "target_availability_percent", "target_utilization_percent")
      : 0;
  return roundMoney(
    machineRateFromDrivers(machine, availability, utilization, overheadPerHour) * (1 - discount)
  );
}

function withCalculatedMachineRates(machine: MachineClass, assumptions?: Assumptions | null) {
  return {
    ...machine,
    accounting_full_cost_rate_eur_per_hour: calculatedAccountingMachineRate(machine, assumptions),
    target_competitive_rate_eur_per_hour: calculatedTargetMachineRate(machine, assumptions)
  };
}

// Overhead depends on totals across all machines (shared shop-wide overhead pool), so every
// machine's rate must be recomputed together whenever assumptions load or change.
function withRecalculatedAssumptions(assumptions: Assumptions): Assumptions {
  return {
    ...assumptions,
    machine_classes: assumptions.machine_classes.map((machine) =>
      withCalculatedMachineRates(machine, assumptions)
    )
  };
}

function suggestedFixedCostFromPurchase(machine: MachineClass) {
  const purchasePrice = machine.purchase_price_eur ?? 0;
  const usefulLifeYears = Math.max(0.1, machine.useful_life_years ?? 10);
  const salvagePercent = machine.salvage_percent ?? 0;
  const otherMonthlyFixedCost = machine.other_monthly_fixed_cost_eur ?? 0;
  const depreciationPerMonth = (purchasePrice * (1 - salvagePercent)) / (usefulLifeYears * 12);
  return roundMoney(depreciationPerMonth + otherMonthlyFixedCost);
}

// Profitability Calculator: "can we be profitable" independent of any single quote.
// Always uses target availability (performance/quality losses live in cycle times and scrap,
// not here) with a stress-testable shop-wide Utilization scenario, so the user can ask
// "what if Utilization reached X%?".
function profitabilityEffectiveHours(machine: MachineClass, utilizationScenario: number) {
  const plannedHours = machine.planned_hours_per_month ?? 160;
  const availability = Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
  return plannedHours * availability * Math.max(0.01, utilizationScenario);
}

function profitabilityDirectCostMonth(assumptions: Assumptions | null, utilizationScenario: number) {
  return (assumptions?.machine_classes ?? []).reduce((sum, machine) => {
    const hours = profitabilityEffectiveHours(machine, utilizationScenario);
    const fixedCost = machine.monthly_fixed_cost_eur ?? 0;
    const variableCost = machine.variable_cost_eur_per_hour ?? 0;
    return sum + fixedCost + variableCost * hours;
  }, 0);
}

// Revenue and cost must move independently, or gross profit can never go negative (item 5).
// Price is fixed at the shop's commercial policy -- a blended target sell rate EUR/h, priced
// once at target Utilization/Availability and grossed up by risk and margin. Sold hours then
// follow the *scenario* Utilization, which is the free variable being stress-tested. Costs are
// the full monthly fixed cost (does not shrink with the scenario) plus variable cost over sold
// hours, plus the full monthly overhead -- never derived from revenue.
function profitabilityTargetSellRatePerHour(assumptions: Assumptions | null, marginPercent: number, riskPercent: number) {
  const directPlusOverhead =
    blendedDirectMachineRate(assumptions, "target_availability_percent", "target_utilization_percent") +
    overheadPerMachineHour(assumptions, "target_availability_percent", "target_utilization_percent");
  return (directPlusOverhead * (1 + riskPercent)) / Math.max(0.01, 1 - marginPercent);
}

function profitabilityRevenueMonth(assumptions: Assumptions | null, utilizationScenario: number, sellRatePerHour: number) {
  const soldHours = (assumptions?.machine_classes ?? []).reduce(
    (sum, machine) => sum + profitabilityEffectiveHours(machine, utilizationScenario),
    0
  );
  return soldHours * sellRatePerHour;
}

// Closed-form break-even: solve revenue(u) = cost(u) for the scenario Utilization u, using
// that both sold hours and variable cost scale linearly with u while fixed cost and overhead
// don't. Returns null when the sell rate can never cover marginal (variable) cost, so no
// Utilization closes the gap.
function profitabilityBreakEvenUtilization(assumptions: Assumptions | null, sellRatePerHour: number) {
  const machines = assumptions?.machine_classes ?? [];
  let hoursAtFullUtilization = 0;
  let variableCostAtFullUtilization = 0;
  let fixedCostMonth = 0;
  machines.forEach((machine) => {
    const hours = profitabilityEffectiveHours(machine, 1);
    hoursAtFullUtilization += hours;
    variableCostAtFullUtilization += hours * (machine.variable_cost_eur_per_hour ?? 0);
    fixedCostMonth += machine.monthly_fixed_cost_eur ?? 0;
  });
  const overheadMonth = totalMonthlyOverheadEur(assumptions);
  const denominator = sellRatePerHour * hoursAtFullUtilization - variableCostAtFullUtilization;
  if (denominator <= 0) {
    return null;
  }
  return (fixedCostMonth + overheadMonth) / denominator;
}

function averageActualUtilization(assumptions: Assumptions | null) {
  const machines = assumptions?.machine_classes ?? [];
  if (machines.length === 0) {
    return 0.5;
  }
  const sum = machines.reduce((total, machine) => total + (machine.actual_utilization_percent ?? 1), 0);
  return sum / machines.length;
}

function averageTargetUtilization(assumptions: Assumptions | null) {
  const machines = assumptions?.machine_classes ?? [];
  if (machines.length === 0) {
    return DEFAULT_TARGET_UTILIZATION_PERCENT;
  }
  const sum = machines.reduce((total, machine) => total + (machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT), 0);
  return sum / machines.length;
}

// Cutoff calculator: how many fixed-dimension stock units must be purchased to cover an order,
// accounting for the waste created because parts rarely divide evenly into stock length/area.
// Linear shapes (bar/hex/square/tube): 1D cutting-stock division, with saw kerf lost per cut.
function piecesPerLinearStockUnit(stockLengthMm: number, kerfMm: number, cutLengthMm: number) {
  const cutWithKerf = Math.max(1, cutLengthMm + kerfMm);
  return Math.max(1, Math.floor((stockLengthMm + kerfMm) / cutWithKerf));
}

function linearStockPiecesRequired(stockLengthMm: number, kerfMm: number, cutLengthMm: number, quantity: number) {
  const perUnit = piecesPerLinearStockUnit(stockLengthMm, kerfMm, cutLengthMm);
  return Math.max(1, Math.ceil(quantity / perUnit));
}

// Plate/sheet is a rough area-based estimate, not true 2D nesting (no rectangle packing or
// rotation optimization) -- packingEfficiency approximates typical real-world nesting loss.
function platePiecesRequired(
  stockLengthMm: number,
  stockWidthMm: number,
  blankLengthMm: number,
  blankWidthMm: number,
  quantity: number,
  packingEfficiency = 0.82
) {
  const usableStockArea = stockLengthMm * stockWidthMm * packingEfficiency;
  const areaNeeded = blankLengthMm * blankWidthMm * quantity;
  return Math.max(1, Math.ceil(areaNeeded / Math.max(1, usableStockArea)));
}

function stockPiecesRequiredForMaterial(
  material: MaterialExample | undefined | null,
  cutLengthMm: number,
  cutWidthMm: number,
  quantity: number
) {
  if (!material || cutLengthMm <= 0 || quantity <= 0) {
    return null;
  }
  if (material.stock_shape === "plate") {
    if (!material.stock_length_mm || !material.stock_width_mm || cutWidthMm <= 0) {
      return null;
    }
    return platePiecesRequired(material.stock_length_mm, material.stock_width_mm, cutLengthMm, cutWidthMm, quantity);
  }
  if (material.stock_length_mm) {
    return linearStockPiecesRequired(material.stock_length_mm, material.kerf_mm ?? 0, cutLengthMm, quantity);
  }
  return null;
}

function replaceArrayItem<T>(items: T[], index: number, replacement: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? replacement : item));
}

function createToolRequirement(
  operationType: string,
  description: string,
  toolType: string,
  diameterMm: number,
  cornerRadiusMm: number,
  materialGroup: string,
  estimatedReplacementCostEur: number,
  chargeMode: ToolChargeMode = "charge_full",
  amortizationQuantity = 5
): ToolRequirement {
  return {
    id: `${operationType}-${toolType}-${diameterMm}-${cornerRadiusMm}-${materialGroup}`,
    description,
    toolType,
    diameterMm,
    cornerRadiusMm,
    materialGroup,
    quantity: 1,
    estimatedReplacementCostEur,
    chargeMode,
    amortizationQuantity
  };
}

function defaultToolRequirementsForOperation(operationType: string): ToolRequirement[] {
  const requirements: Record<string, ToolRequirement[]> = {
    milling_3_axis: [
      createToolRequirement(operationType, "Profile and pocket end mill", "end_mill", 10, 1, "aluminium", 58),
      createToolRequirement(operationType, "Small corner finishing end mill", "end_mill", 6, 0.5, "aluminium", 42, "amortize", 10)
    ],
    milling_5_axis: [
      createToolRequirement(operationType, "5-axis finishing end mill", "end_mill", 6, 0.5, "aluminium", 64),
      createToolRequirement(operationType, "Long reach ball end mill", "ball_end_mill", 8, 4, "aluminium", 92)
    ],
    drilling: [
      createToolRequirement(operationType, "Main hole drill", "drill", 5, 0, "general", 18, "amortize", 20)
    ],
    tapping: [
      createToolRequirement(operationType, "M5 machine tap", "tap", 5, 0, "general", 31)
    ],
    engraving: [
      createToolRequirement(operationType, "Part marking engraving cutter", "engraving_tool", 3, 0, "general", 24)
    ],
    turning: [
      createToolRequirement(operationType, "General turning insert", "turning_insert", 0, 0.8, "steel", 9, "amortize", 10)
    ]
  };

  return requirements[operationType] ?? [];
}

function createOperation(template: OperationTemplate): QuoteOperation {
  return {
    id: `${template.operation_type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    operationType: template.operation_type,
    name: operationLabel(template.operation_type),
    machineClassId: template.default_machine_class_id,
    laborClassId: template.default_labor_class_id,
    setupMachineMinutes: template.default_setup_machine_minutes ?? 0,
    setupLaborMinutes: template.default_setup_labor_minutes ?? 0,
    runMachineMinutesPerPart: template.default_run_machine_minutes_per_part ?? 0,
    runLaborMinutesPerPart: template.default_run_labor_minutes_per_part ?? 0,
    toolingCostPerPart: template.default_tooling_cost_per_part_eur ?? 0,
    consumablesCostPerPart: template.default_consumables_cost_per_part_eur ?? 0,
    outsourcedCostPerPart: template.default_outsourced_cost_per_part_eur ?? 0,
    outsourcedBatchCost: template.default_outsourced_batch_cost_eur ?? 0,
    scrapAllowancePercent: template.default_scrap_allowance_percent ?? 0,
    toolRequirements: defaultToolRequirementsForOperation(template.operation_type)
  };
}

function createPortalPart(file?: File): PortalPart {
  const cleanName = file?.name.replace(/\.(step|stp)$/i, "") || "New STEP part";
  return {
    id: `portal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    partName: cleanName,
    fileName: file?.name ?? "",
    fileSizeBytes: file?.size ?? 0,
    drawingFileName: "",
    drawingSizeBytes: 0,
    materialId: "",
    materialRequirement: "",
    stockName: "Unconfirmed material stock",
    stockCost: 100,
    cutLengthMm: 100,
    cutWidthMm: 100,
    quantity: 10,
    annualVolume: 0,
    toleranceRequirement: "drawing",
    documentationRequirement: "standard",
    surfaceFinish: "As machined",
    deliveryRequirement: "standard",
    threadOrInsertRequirement: "unknown",
    notes: ""
  };
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const utilizationPercent = Math.max(0, Math.min(1, utilization)) * 100;
  const idlePercent = 100 - utilizationPercent;
  return (
    <div className="utilizationBar" role="img" aria-label={`${Math.round(utilizationPercent)} percent utilized, ${Math.round(idlePercent)} percent idle`}>
      <div className="filled" style={{ width: `${utilizationPercent}%` }} />
      <div className="idle" style={{ width: `${idlePercent}%` }} />
    </div>
  );
}

function ProfitBridgeChart({
  revenue,
  directCost,
  overhead,
  grossProfit
}: {
  revenue: number;
  directCost: number;
  overhead: number;
  grossProfit: number;
}) {
  const chartHeight = 220;
  const afterDirectCost = revenue - directCost;
  const totals = [0, revenue, afterDirectCost, grossProfit];
  const scaleMax = Math.max(...totals, 0) * 1.1 || 1;
  const scaleMin = Math.min(...totals, 0) * 1.1;
  const range = scaleMax - scaleMin || 1;

  function segment(from: number, to: number) {
    const top = Math.max(from, to);
    const bottom = Math.min(from, to);
    const topPx = ((scaleMax - top) / range) * chartHeight;
    const heightPx = Math.max(2, ((top - bottom) / range) * chartHeight);
    return { top: topPx, height: heightPx };
  }

  const revenueSeg = segment(0, revenue);
  const directCostSeg = segment(revenue, afterDirectCost);
  const overheadSeg = segment(afterDirectCost, grossProfit);
  const totalSeg = segment(0, grossProfit);
  const zeroLinePx = ((scaleMax - 0) / range) * chartHeight;
  const isProfit = grossProfit >= 0;

  return (
    <div className="profitBridge">
      <div className="profitBridgeLegend">
        <span><span className="swatch add" /> Adds</span>
        <span><span className="swatch subtract" /> Subtracts</span>
        <span><span className="swatch result-good" /> Result (profit)</span>
        <span><span className="swatch result-bad" /> Result (loss)</span>
      </div>
      <div className="profitBridgeChart" style={{ height: chartHeight }}>
        <div className="profitBridgeZeroLine" style={{ top: zeroLinePx }} />
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar add" style={{ top: revenueSeg.top, height: revenueSeg.height }} />
          <span className="profitBridgeValue" style={{ top: revenueSeg.top - 20 }}>{money.format(revenue)}</span>
          <span className="profitBridgeLabel">Revenue capacity</span>
        </div>
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar subtract" style={{ top: directCostSeg.top, height: directCostSeg.height }} />
          <span className="profitBridgeValue" style={{ top: directCostSeg.top - 20 }}>-{money.format(directCost)}</span>
          <span className="profitBridgeLabel">Machine direct cost</span>
        </div>
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar subtract" style={{ top: overheadSeg.top, height: overheadSeg.height }} />
          <span className="profitBridgeValue" style={{ top: overheadSeg.top - 20 }}>-{money.format(overhead)}</span>
          <span className="profitBridgeLabel">Overhead</span>
        </div>
        <div className="profitBridgeColumn">
          <div className={`profitBridgeBar ${isProfit ? "result-good" : "result-bad"}`} style={{ top: totalSeg.top, height: totalSeg.height }} />
          <span className="profitBridgeValue" style={{ top: totalSeg.top - 20 }}>{money.format(grossProfit)}</span>
          <span className="profitBridgeLabel">
            {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isProfit ? "Gross profit" : "Gross loss"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PrintableQuote({
  accountingResult,
  actualOperations,
  assumptions,
  customerName,
  deliveryEstimate,
  printDocumentMode,
  partName,
  paymentTerms,
  quantity,
  quantityBreakResults,
  quoteNumber,
  quoteOperations,
  rfqReference,
  stockName,
  targetResult,
  validityDate
}: {
  accountingResult: QuoteResult | null;
  actualOperations: ActualOperation[];
  assumptions: Assumptions | null;
  customerName: string;
  deliveryEstimate: string;
  printDocumentMode: PrintDocumentMode;
  partName: string;
  paymentTerms: string;
  quantity: number;
  quantityBreakResults: Array<{ quantity: number; target: QuoteResult; accounting: QuoteResult; materialScaledLinearly?: boolean }>;
  quoteNumber: string;
  quoteOperations: QuoteOperation[];
  rfqReference: string;
  stockName: string;
  targetResult: QuoteResult | null;
  validityDate: string;
}) {
  const generatedAt = new Date().toLocaleString("en-GB");
  const isCustomerOffer = printDocumentMode === "customer_offer";

  return (
    <section className="printPage">
      <header className="printHeader">
        <div>
          <h1>{quoteNumber || (isCustomerOffer ? "Customer Offer" : "Internal Cost Sheet")}</h1>
          <p>{partName} | Quantity {quantity}</p>
          <p>{customerName || "No customer entered"}{rfqReference ? ` | RFQ ${rfqReference}` : ""}</p>
        </div>
        <div className="printMeta">
          <span>Generated {generatedAt}</span>
          <span>Valid until {validityDate || "not set"}</span>
          <span>Delivery {deliveryEstimate || "not set"}</span>
          <span>{paymentTerms || "Payment terms not set"}</span>
          <span>{isCustomerOffer ? "Customer Offer" : "Internal Cost Sheet"}</span>
          <span>Formula {assumptions?.formula_version ?? "costing.v0.2"}</span>
        </div>
      </header>

      <section className="printSummaryGrid">
        <div><span>Material stock</span><strong>{stockName}</strong></div>
        <div><span>Target sell price</span><strong>{targetResult ? money.format(targetResult.sell_price_eur) : "Not calculated"}</strong></div>
        <div><span>Target unit price</span><strong>{targetResult ? money.format(targetResult.unit_sell_price_eur) : "Not calculated"}</strong></div>
        {!isCustomerOffer ? <div><span>Accounting sell price</span><strong>{accountingResult ? money.format(accountingResult.sell_price_eur) : "Not calculated"}</strong></div> : null}
        {!isCustomerOffer ? <div><span>Accounting unit price</span><strong>{accountingResult ? money.format(accountingResult.unit_sell_price_eur) : "Not calculated"}</strong></div> : null}
      </section>

      <section className="printSection">
        <h2>Quantity Pricing</h2>
        <table>
          <thead>
            <tr>{isCustomerOffer ? <><th>Qty, pcs</th><th>Total price, EUR</th><th>Unit price, EUR/pc</th></> : <><th>Qty, pcs</th><th>Target total, EUR</th><th>Target unit, EUR/pc</th><th>Accounting total, EUR</th><th>Accounting unit, EUR/pc</th><th>Premium, EUR/pc</th></>}</tr>
          </thead>
          <tbody>
            {quantityBreakResults.map((item) => (
              <tr key={item.quantity}>
                {isCustomerOffer ? (
                  <>
                    <td>{item.quantity}</td>
                    <td>{money.format(item.target.sell_price_eur)}</td>
                    <td>{money.format(item.target.unit_sell_price_eur)}</td>
                  </>
                ) : (
                  <>
                    <td>{item.quantity}</td>
                    <td>{money.format(item.target.sell_price_eur)}</td>
                    <td>{money.format(item.target.unit_sell_price_eur)}</td>
                    <td>{money.format(item.accounting.sell_price_eur)}</td>
                    <td>{money.format(item.accounting.unit_sell_price_eur)}</td>
                    <td>{money.format(item.accounting.unit_sell_price_eur - item.target.unit_sell_price_eur)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="printSection">
        <h2>Route</h2>
        <table>
          <thead><tr><th>Operation</th><th>Machine</th><th>Labor</th><th>Setup, min</th><th>Cycle, min/part</th></tr></thead>
          <tbody>
            {quoteOperations.map((operation) => (
              <tr key={operation.id}>
                <td>{operation.name}</td>
                <td>{assumptions?.machine_classes.find((item) => item.id === operation.machineClassId)?.name ?? "-"}</td>
                <td>{assumptions?.labor_classes.find((item) => item.id === operation.laborClassId)?.name ?? "-"}</td>
                <td>{operation.setupMachineMinutes + operation.setupLaborMinutes}</td>
                <td>{operation.runMachineMinutesPerPart + operation.runLaborMinutesPerPart}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!isCustomerOffer ? (
        <>
          <section className="printSection printTwoColumns">
            <div>
              <h2>Target Cost Breakdown</h2>
              <table>
                <thead><tr><th>Line</th><th>Total</th><th>Unit</th></tr></thead>
                <tbody>
                  {targetResult?.lines.map((line) => (
                    <tr key={line.code}><td>{line.label}</td><td>{money.format(line.cost_eur)}</td><td>{money.format(line.unit_cost_eur)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2>Accounting Cost Breakdown</h2>
              <table>
                <thead><tr><th>Line</th><th>Total</th><th>Unit</th></tr></thead>
                <tbody>
                  {accountingResult?.lines.map((line) => (
                    <tr key={line.code}><td>{line.label}</td><td>{money.format(line.cost_eur)}</td><td>{money.format(line.unit_cost_eur)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="printSection">
            <h2>Actuals Feedback</h2>
            <table>
              <thead><tr><th>Operation</th><th>Setup, min</th><th>Cycle, min/part</th><th>Scrap, %</th><th>Notes</th></tr></thead>
              <tbody>
                {quoteOperations.map((operation) => {
                  const actual = actualOperations.find((item) => item.operationId === operation.id);
                  return (
                    <tr key={operation.id}>
                      <td>{operation.name}</td>
                      <td>{actual ? actual.actualSetupMachineMinutes + actual.actualSetupLaborMinutes : "-"}</td>
                      <td>{actual ? actual.actualRunMachineMinutesPerPart + actual.actualRunLaborMinutesPerPart : "-"}</td>
                      <td>{actual ? `${formatPercent(actual.actualScrapPercent)}%` : "-"}</td>
                      <td>{actual?.notes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="printSection">
            <h2>Assumptions Snapshot</h2>
            <p>Commercial margin {assumptions ? `${formatPercent(assumptions.commercial_policy.default_margin_percent)}%` : "-"}; risk allowance {assumptions ? `${formatPercent(assumptions.commercial_policy.risk_allowance_percent)}%` : "-"}; minimum admin cost {assumptions ? money.format(assumptions.commercial_policy.minimum_order_admin_cost_eur) : "-"}.</p>
          </section>
        </>
      ) : (
        <section className="printSection">
          <h2>Commercial Notes</h2>
          <p>This offer is based on the supplied RFQ information and current assumptions. Internal cost breakdowns and accounting-rate comparison are intentionally excluded.</p>
        </section>
      )}
    </section>
  );
}

function App() {
  const [activeView, setActiveView] = useState<View>("quote");
  const [resourceSubView, setResourceSubView] = useState<ResourceSubView>("values");
  const [partName, setPartName] = useState("S355 mounting bracket");
  const [customerName, setCustomerName] = useState("Customer Ltd.");
  const [rfqReference, setRfqReference] = useState("RFQ-001");
  const [quoteNumber, setQuoteNumber] = useState("Q-2026-001");
  const [validityDate, setValidityDate] = useState("2026-08-03");
  const [deliveryEstimate, setDeliveryEstimate] = useState("3-4 weeks after order confirmation");
  const [paymentTerms, setPaymentTerms] = useState("50% advance, 50% before delivery");
  const [printDocumentMode, setPrintDocumentMode] = useState<PrintDocumentMode>("customer_offer");
  const [quantity, setQuantity] = useState(20);
  const [quantityBreakText, setQuantityBreakText] = useState("10, 20, 50, 100");
  const [quantityBreakResults, setQuantityBreakResults] = useState<Array<{ quantity: number; target: QuoteResult; accounting: QuoteResult; materialScaledLinearly?: boolean }>>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [stockName, setStockName] = useState("S355 plate blank");
  const [stockCost, setStockCost] = useState(100);
  const [stockPieces, setStockPieces] = useState(2);
  const [cutLengthMm, setCutLengthMm] = useState(100);
  const [cutWidthMm, setCutWidthMm] = useState(100);
  const [scrapRecovery, setScrapRecovery] = useState(10);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<QuoteDraft[]>([]);
  const [draftStatus, setDraftStatus] = useState("No draft saved yet");
  const [erpParts, setErpParts] = useState<ErpPartSummary[]>([]);
  const [selectedErpPartId, setSelectedErpPartId] = useState("");
  const [erpStatus, setErpStatus] = useState("ERP connection demo ready");
  const [erpSource, setErpSource] = useState<ErpSourceState>(null);
  const [lastErpOffer, setLastErpOffer] = useState<ErpOfferPayload | null>(null);
  const [cadFile, setCadFile] = useState<File | null>(null);
  const [isNewPart, setIsNewPart] = useState(true);
  const [camComplexity, setCamComplexity] = useState("medium");
  const [programmingMinutes, setProgrammingMinutes] = useState(90);
  const [proveoutMinutes, setProveoutMinutes] = useState(30);
  const [programmingRate, setProgrammingRate] = useState(32);
  const [rateMode, setRateMode] = useState<RateMode>("target_competitive");
  const [selectedTemplateType, setSelectedTemplateType] = useState("milling_3_axis");
  const [quoteOperations, setQuoteOperations] = useState<QuoteOperation[]>([]);
  const [actualOperations, setActualOperations] = useState<ActualOperation[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [assumptionsText, setAssumptionsText] = useState("");
  const [expandedFixedCostHelpers, setExpandedFixedCostHelpers] = useState<Record<string, boolean>>({});
  const [expandedPortalDetails, setExpandedPortalDetails] = useState<Record<string, boolean>>({});
  const [profitabilityUtilization, setProfitabilityUtilization] = useState(0.7);
  const [assumptionStatus, setAssumptionStatus] = useState("Loading assumptions...");
  const [targetResult, setTargetResult] = useState<QuoteResult | null>(null);
  const [accountingResult, setAccountingResult] = useState<QuoteResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [portalCustomerName, setPortalCustomerName] = useState("Client A Manufacturing");
  const [portalContact, setPortalContact] = useState("procurement@example.com");
  const [portalParts, setPortalParts] = useState<PortalPart[]>([createPortalPart()]);
  const [portalEstimates, setPortalEstimates] = useState<Record<string, PortalEstimate>>({});
  const [portalStatus, setPortalStatus] = useState("Upload STEP files and drawings/specifications, then calculate a preliminary customer estimate.");

  useEffect(() => {
    let cancelled = false;

    async function loadAssumptions() {
      try {
        const response = await fetch("/api/assumptions");
        if (!response.ok) {
          throw new Error(`Assumptions returned ${response.status}`);
        }
        const rawData = (await response.json()) as Assumptions;
        if (cancelled) {
          return;
        }
        const data = withRecalculatedAssumptions(rawData);
        setAssumptions(data);
        setAssumptionsText(JSON.stringify(data, null, 2));
        setAssumptionStatus("Assumptions loaded");
        setProveoutMinutes(data.cam_programming_defaults.default_setup_proveout_minutes);
        setProgrammingMinutes(data.cam_programming_defaults.medium_programming_minutes);
        setSelectedTemplateType(data.operation_templates[0]?.operation_type ?? "milling_3_axis");
        const firstMaterial = data.material_examples[0];
        if (firstMaterial) {
          setSelectedMaterialId(firstMaterial.id);
          setStockName(firstMaterial.stock_description || firstMaterial.name);
          setStockCost(firstMaterial.stock_piece_cost_eur);
        }
        setQuoteOperations((current) => {
          if (current.length > 0) {
            return current;
          }
          const route = ["saw_cutting", "milling_3_axis", "manual_inspection"];
          return route
            .map((operationType) => data.operation_templates.find((item) => item.operation_type === operationType))
            .filter((template): template is OperationTemplate => Boolean(template))
            .map(createOperation);
        });
        const programmingLabor = data.labor_classes.find(
          (item) => item.id === data.cam_programming_defaults.programming_labor_class_id
        );
        if (programmingLabor) {
          setProgrammingRate(programmingLabor.employer_cost_per_hour_eur);
        }
      } catch (error) {
        if (!cancelled) {
          setAssumptionStatus(error instanceof Error ? error.message : "Failed to load assumptions");
        }
      }
    }

    loadAssumptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDrafts() {
      try {
        const response = await fetch("/api/quote-drafts");
        if (!response.ok) {
          throw new Error(`Draft list returned ${response.status}`);
        }
        const data = (await response.json()) as QuoteDraft[];
        if (!cancelled) {
          setDrafts(data);
        }
      } catch (error) {
        if (!cancelled) {
          setDraftStatus(error instanceof Error ? error.message : "Failed to load drafts");
        }
      }
    }

    loadDrafts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadErpParts() {
      try {
        const response = await fetch("/api/erp/parts");
        if (!response.ok) {
          throw new Error(`ERP parts returned ${response.status}`);
        }
        const data = (await response.json()) as ErpPartSummary[];
        if (!cancelled) {
          setErpParts(data);
          setSelectedErpPartId((current) => current || data[0]?.id || "");
          setErpStatus(data.length > 0 ? "Sample ERP parts loaded" : "Sample ERP contains no parts");
        }
      } catch (error) {
        if (!cancelled) {
          setErpStatus(error instanceof Error ? error.message : "Failed to load sample ERP parts");
        }
      }
    }

    loadErpParts();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedResult = rateMode === "accounting_full_cost" ? accountingResult : targetResult;

  const reusableProgramPercent = assumptions
    ? isNewPart
      ? assumptions.cam_programming_defaults.new_part_reusable_program_percent
      : assumptions.cam_programming_defaults.repeat_part_reusable_program_percent
    : isNewPart
      ? 0
      : 0.85;

  const commercialPolicy = assumptions?.commercial_policy ?? {
    default_margin_percent: 0.25,
    risk_allowance_percent: 0.05,
    minimum_order_admin_cost_eur: 45
  };

  const machineById = useMemo(
    () => new Map((assumptions?.machine_classes ?? []).map((machine) => [machine.id, machine])),
    [assumptions]
  );
  const laborById = useMemo(
    () => new Map((assumptions?.labor_classes ?? []).map((labor) => [labor.id, labor])),
    [assumptions]
  );

  function machineRate(machineClassId: string | null, mode: RateMode) {
    if (!machineClassId) {
      return 0;
    }
    const machine = machineById.get(machineClassId);
    if (!machine) {
      return 0;
    }
    return mode === "accounting_full_cost"
      ? machine.accounting_full_cost_rate_eur_per_hour
      : machine.target_competitive_rate_eur_per_hour;
  }

  // Sends the rate math's own inputs alongside the resolved EUR/h so the backend can
  // recompute and verify it (app/costing/rates.py is the authoritative contract, mirrored
  // here) -- otherwise rate_mode is just a label the backend never checks.
  function rateDriversForOperation(machineClassId: string | null, mode: RateMode) {
    if (!machineClassId || !assumptions) {
      return null;
    }
    const machine = machineById.get(machineClassId);
    if (!machine) {
      return null;
    }
    const utilizationField: UtilizationField = mode === "accounting_full_cost" ? "actual_utilization_percent" : "target_utilization_percent";
    const availabilityField: AvailabilityField = mode === "accounting_full_cost" ? "actual_availability_percent" : "target_availability_percent";
    const utilization = machine[utilizationField] ?? (mode === "accounting_full_cost" ? 1 : DEFAULT_TARGET_UTILIZATION_PERCENT);
    const availability = availabilityValue(machine, availabilityField);
    const overheadPerHour =
      assumptions.overhead?.allocation_method === "per_machine_hour"
        ? overheadPerMachineHour(assumptions, availabilityField, utilizationField)
        : 0;
    return {
      fixed_cost_eur_per_month: machine.monthly_fixed_cost_eur ?? 0,
      planned_hours_per_month: machine.planned_hours_per_month ?? 160,
      utilization_percent: utilization,
      availability_percent: availability,
      variable_cost_eur_per_hour: machine.variable_cost_eur_per_hour ?? 0,
      overhead_eur_per_hour: overheadPerHour
    };
  }

  function laborRate(laborClassId: string | null) {
    if (!laborClassId) {
      return 0;
    }
    return laborById.get(laborClassId)?.employer_cost_per_hour_eur ?? 0;
  }

  function toolMatchesRequirement(tool: ToolInventoryItem, requirement: ToolRequirement) {
    const typeMatches = tool.type === requirement.toolType;
    const diameterMatches = requirement.diameterMm === 0 || Math.abs(tool.diameter_mm - requirement.diameterMm) <= 0.01;
    const radiusMatches = requirement.cornerRadiusMm === 0 || Math.abs(tool.corner_radius_mm - requirement.cornerRadiusMm) <= 0.01;
    const materialMatches = tool.material_groups.includes(requirement.materialGroup) || tool.material_groups.includes("general") || requirement.materialGroup === "general";
    return typeMatches && diameterMatches && radiusMatches && materialMatches;
  }

  function findToolForRequirement(requirement: ToolRequirement, includeUnavailable = false) {
    return (assumptions?.tool_inventory ?? []).find((tool) =>
      toolMatchesRequirement(tool, requirement) && (includeUnavailable || tool.available_quantity >= requirement.quantity)
    ) ?? null;
  }

  function toolRequirementCost(requirement: ToolRequirement) {
    if (requirement.chargeMode === "included") {
      return 0;
    }
    const exactTool = findToolForRequirement(requirement, true);
    const baseCost = (exactTool?.replacement_cost_eur ?? requirement.estimatedReplacementCostEur) * requirement.quantity;
    if (requirement.chargeMode === "amortize") {
      return roundMoney(baseCost / Math.max(1, requirement.amortizationQuantity));
    }
    return roundMoney(baseCost);
  }

  function checkToolRequirement(operation: QuoteOperation, requirement: ToolRequirement): ToolCheckResult {
    const matchedTool = findToolForRequirement(requirement);
    return {
      operation,
      requirement,
      status: matchedTool ? "available" : "missing",
      matchedTool,
      quoteCostEur: matchedTool ? 0 : toolRequirementCost(requirement)
    };
  }

  function toolCheckResults() {
    return quoteOperations.flatMap((operation) =>
      (operation.toolRequirements ?? []).map((requirement) => checkToolRequirement(operation, requirement))
    );
  }

  function missingToolBatchCost(toolRequirements: ToolRequirement[], operation?: QuoteOperation) {
    return toolRequirements.reduce((sum, requirement) => {
      const result = checkToolRequirement(operation ?? ({ toolRequirements } as QuoteOperation), requirement);
      return sum + (result.status === "missing" ? result.quoteCostEur : 0);
    }, 0);
  }

  function missingToolBatchCostForOperation(operation: QuoteOperation) {
    return missingToolBatchCost(operation.toolRequirements ?? [], operation);
  }

  function toolRequirementLabel(requirement: ToolRequirement) {
    const radius = requirement.cornerRadiusMm > 0 ? ` R${requirement.cornerRadiusMm}` : "";
    const diameter = requirement.diameterMm > 0 ? ` D${requirement.diameterMm}` : "";
    return `${requirement.description} (${requirement.toolType}${diameter}${radius})`;
  }

  function ensureActualForOperation(operation: QuoteOperation): ActualOperation {
    return actualOperations.find((item) => item.operationId === operation.id) ?? {
      operationId: operation.id,
      actualSetupMachineMinutes: operation.setupMachineMinutes,
      actualSetupLaborMinutes: operation.setupLaborMinutes,
      actualRunMachineMinutesPerPart: operation.runMachineMinutesPerPart,
      actualRunLaborMinutesPerPart: operation.runLaborMinutesPerPart,
      actualScrapPercent: operation.scrapAllowancePercent,
      notes: ""
    };
  }

  function operationCost(operation: QuoteOperation, mode: RateMode, actual?: ActualOperation) {
    const setupMachineMinutes = actual?.actualSetupMachineMinutes ?? operation.setupMachineMinutes;
    const setupLaborMinutes = actual?.actualSetupLaborMinutes ?? operation.setupLaborMinutes;
    const runMachineMinutes = actual?.actualRunMachineMinutesPerPart ?? operation.runMachineMinutesPerPart;
    const runLaborMinutes = actual?.actualRunLaborMinutesPerPart ?? operation.runLaborMinutesPerPart;
    const scrapPercent = actual?.actualScrapPercent ?? operation.scrapAllowancePercent;
    const machineHourly = machineRate(operation.machineClassId, mode);
    const laborHourly = laborRate(operation.laborClassId);
    const setup = (setupMachineMinutes / 60) * machineHourly + (setupLaborMinutes / 60) * laborHourly;
    const run = quantity * ((runMachineMinutes / 60) * machineHourly + (runLaborMinutes / 60) * laborHourly);
    const perPartVariable = quantity * (operation.toolingCostPerPart + operation.consumablesCostPerPart + operation.outsourcedCostPerPart);
    const outsourcedBatch = operation.outsourcedBatchCost + missingToolBatchCostForOperation(operation);
    // Scrap allowance only covers run cost and per-part variable cost -- setup and the
    // outsourced batch cost are one-off per-batch costs scrap doesn't multiply (mirrors
    // backend/app/costing/calculator.py).
    const scrapAllowance = (run + perPartVariable) * scrapPercent;
    return setup + run + perPartVariable + outsourcedBatch + scrapAllowance;
  }

  // Quantity breaks must not reuse the main quantity's frozen material quantity -- a 250-pc
  // break priced with 50 pcs of material understates its true cost. When the selected
  // library material has cutoff data, recompute stock pieces for the break quantity via the
  // real cutoff calculator; otherwise scale the manually-entered stock pieces linearly.
  function stockPiecesForQuantity(targetQuantity: number): { pieces: number; scaledLinearly: boolean } {
    const selectedMaterial = assumptions?.material_examples.find((material) => material.id === selectedMaterialId);
    if (selectedMaterial) {
      const isPlate = selectedMaterial.stock_shape === "plate";
      const recomputed = stockPiecesRequiredForMaterial(selectedMaterial, cutLengthMm, isPlate ? cutWidthMm : 0, targetQuantity);
      if (recomputed !== null) {
        return { pieces: recomputed, scaledLinearly: false };
      }
    }
    if (targetQuantity === quantity) {
      return { pieces: stockPieces, scaledLinearly: false };
    }
    return { pieces: Math.max(1, Math.ceil((stockPieces / quantity) * targetQuantity)), scaledLinearly: true };
  }

  function quotePayloadForMode(mode: RateMode, overrideQuantity = quantity) {
    const materialForBreak = stockPiecesForQuantity(overrideQuantity);
    return {
      part_name: partName,
      quantity: overrideQuantity,
      precision_level: "operation_based",
      rate_mode: mode,
      cad_file: cadFile
        ? {
            filename: cadFile.name,
            file_size_bytes: cadFile.size,
            file_type: cadFile.name.toLowerCase().endsWith(".stp") ? "stp" : "step",
            geometry_confidence: "not_parsed"
          }
        : null,
      cam_programming: {
        required: true,
        is_new_part: isNewPart,
        complexity: camComplexity,
        programming_labor_hour_rate_eur: programmingRate,
        estimated_programming_minutes: programmingMinutes,
        setup_proveout_minutes: proveoutMinutes,
        reusable_program_percent: reusableProgramPercent,
        assumption_quality: "industry_estimate"
      },
      material: {
        name: stockName,
        stock_piece_cost_eur: stockCost,
        stock_pieces_required: materialForBreak.pieces,
        scrap_recovery_eur: scrapRecovery,
        assumption_quality: "company_estimate"
      },
      operations: quoteOperations.map((operation) => ({
        operation_type: operation.operationType,
        name: operation.name,
        machine_hour_rate_eur: machineRate(operation.machineClassId, mode),
        labor_hour_rate_eur: laborRate(operation.laborClassId),
        setup_machine_minutes: operation.setupMachineMinutes,
        setup_labor_minutes: operation.setupLaborMinutes,
        run_machine_minutes_per_part: operation.runMachineMinutesPerPart,
        run_labor_minutes_per_part: operation.runLaborMinutesPerPart,
        tooling_cost_per_part_eur: operation.toolingCostPerPart,
        consumables_cost_per_part_eur: operation.consumablesCostPerPart,
        outsourced_cost_per_part_eur: operation.outsourcedCostPerPart,
        outsourced_batch_cost_eur: operation.outsourcedBatchCost + missingToolBatchCostForOperation(operation),
        scrap_allowance_percent: operation.scrapAllowancePercent,
        rate_drivers: rateDriversForOperation(operation.machineClassId, mode),
        assumption_quality: "industry_estimate"
      })),
      commercial_policy: {
        margin_percent: commercialPolicy.default_margin_percent,
        overhead_percent: overheadPercentForMode(assumptions, mode),
        risk_allowance_percent: commercialPolicy.risk_allowance_percent,
        minimum_order_admin_cost_eur: commercialPolicy.minimum_order_admin_cost_eur
      }
    };
  }

  function portalSelectedMaterial(part: PortalPart) {
    return assumptions?.material_examples.find((item) => item.id === part.materialId);
  }

  function portalStockPiecesRequired(part: PortalPart) {
    const material = portalSelectedMaterial(part);
    const isPlate = material?.stock_shape === "plate";
    const computed = stockPiecesRequiredForMaterial(material, part.cutLengthMm, isPlate ? part.cutWidthMm : 0, part.quantity);
    return computed ?? part.quantity;
  }

  function portalReadinessIssues(part: PortalPart) {
    const issues: string[] = [];
    if (!part.fileName) issues.push("STEP model missing");
    if (!part.drawingFileName) issues.push("2D drawing/specification missing");
    if (!part.materialRequirement.trim()) issues.push("material not specified");
    if (part.toleranceRequirement === "custom" && !part.drawingFileName) issues.push("custom tolerances need drawing confirmation");
    if (part.threadOrInsertRequirement === "unknown") issues.push("threads/inserts not confirmed");
    if (!portalSelectedMaterial(part)) {
      issues.push("no library stock item selected: cutoff/waste cannot be calculated, conservative 1 stock piece per part assumed");
    }
    return issues;
  }

  // File-size-in-bytes was dropped as a complexity signal: a STEP file's byte count reflects
  // export settings and tessellation density, not part complexity, so it was noise rather than
  // signal. Its removed weight (1.0 of the old 9.0-point scale) is redistributed proportionally
  // (x1.125) across the remaining signals so the same seed inputs land in the same complexity
  // class as before wherever the classification didn't depend on file size specifically.
  function inferredPortalComplexity(part: PortalPart): "simple" | "medium" | "complex" {
    let score = 0;
    if (part.drawingFileName) score += 0.56;
    if (part.toleranceRequirement === "custom") score += 2.25;
    if (part.toleranceRequirement === "drawing") score += 1.13;
    if (part.documentationRequirement === "full_fai") score += 1.69;
    if (part.documentationRequirement === "dimensional_report") score += 0.84;
    if (part.surfaceFinish.toLowerCase().includes("anod") || part.surfaceFinish.toLowerCase().includes("coat")) score += 0.84;
    if (part.threadOrInsertRequirement === "yes") score += 0.84;
    if (part.deliveryRequirement !== "standard") score += 0.84;
    if (score >= 3.25) return "complex";
    if (score >= 1.25) return "medium";
    return "simple";
  }

  function portalAdjustmentFactors(part: PortalPart) {
    const complexity = inferredPortalComplexity(part);
    const complexityFactor = complexity === "complex" ? 1.6 : complexity === "simple" ? 0.75 : 1;
    const toleranceFactor = part.toleranceRequirement === "custom" ? 1.55 : part.toleranceRequirement === "drawing" ? 1.25 : 1;
    const qcFactor = part.documentationRequirement === "full_fai" ? 1.45 : part.documentationRequirement === "dimensional_report" ? 1.2 : 1;
    const deliveryFactor = part.deliveryRequirement === "date_critical" ? 1.2 : part.deliveryRequirement === "expedite" ? 1.12 : 1;
    return { complexity, complexityFactor, toleranceFactor, qcFactor, deliveryFactor, combined: complexityFactor * toleranceFactor * deliveryFactor };
  }

  function portalMaterialCost(part: PortalPart) {
    const reliefFactor = assumptions?.client_portal?.annual_volume_relief_percent ?? 0.92;
    const annualRelief = part.annualVolume >= part.quantity * 4 && part.quantity > 0 ? reliefFactor : 1;
    return roundMoney(part.stockCost * annualRelief);
  }

  // Threads/inserts route through a real tapping operation (with real tap-tool inventory
  // matching) instead of a flat guessed tooling add-on.
  function portalRouteOperationTypes(part: PortalPart) {
    return ["saw_cutting", "milling_3_axis", "drilling", ...(part.threadOrInsertRequirement === "yes" ? ["tapping"] : []), "manual_inspection"];
  }

  function portalToolCheckResults(part: PortalPart) {
    return portalRouteOperationTypes(part).flatMap((operationType) =>
      defaultToolRequirementsForOperation(operationType).map((requirement) => {
        const matchedTool = findToolForRequirement(requirement);
        return {
          operationType,
          requirement,
          status: matchedTool ? ("available" as const) : ("missing" as const),
          costEur: matchedTool ? 0 : toolRequirementCost(requirement)
        };
      })
    );
  }

  function portalOperations(part: PortalPart, mode: RateMode) {
    if (!assumptions) {
      return [];
    }
    const route = portalRouteOperationTypes(part);
    const factors = portalAdjustmentFactors(part);
    return route
      .map((operationType) => assumptions.operation_templates.find((template) => template.operation_type === operationType))
      .filter((template): template is OperationTemplate => Boolean(template))
      .map((template) => {
        const isInspection = template.operation_type === "manual_inspection";
        const setupFactor = isInspection ? factors.qcFactor : factors.combined;
        const runFactor = isInspection ? factors.qcFactor : factors.combined;
        const toolRequirements = defaultToolRequirementsForOperation(template.operation_type);
        return {
          operation_type: template.operation_type,
          name: isInspection ? `QC - ${part.documentationRequirement.replace(/_/g, " ")}` : operationLabel(template.operation_type),
          machine_hour_rate_eur: machineRate(template.default_machine_class_id, mode),
          labor_hour_rate_eur: laborRate(template.default_labor_class_id),
          setup_machine_minutes: roundMoney((template.default_setup_machine_minutes ?? 0) * setupFactor),
          setup_labor_minutes: roundMoney((template.default_setup_labor_minutes ?? 0) * setupFactor),
          run_machine_minutes_per_part: roundMoney((template.default_run_machine_minutes_per_part ?? 0) * runFactor),
          run_labor_minutes_per_part: roundMoney((template.default_run_labor_minutes_per_part ?? 0) * runFactor),
          tooling_cost_per_part_eur: template.default_tooling_cost_per_part_eur ?? 0,
          consumables_cost_per_part_eur: template.default_consumables_cost_per_part_eur ?? 0,
          outsourced_cost_per_part_eur: 0,
          outsourced_batch_cost_eur:
            (part.surfaceFinish.toLowerCase().includes("anod") || part.surfaceFinish.toLowerCase().includes("coat") ? 45 : 0)
            + missingToolBatchCost(toolRequirements),
          scrap_allowance_percent: Math.min(0.14, (template.default_scrap_allowance_percent ?? 0) + (part.toleranceRequirement === "custom" ? 0.03 : part.toleranceRequirement === "drawing" ? 0.015 : 0)),
          assumption_quality: "portal_preliminary"
        };
      });
  }

  function portalQuotePayload(part: PortalPart, mode: RateMode) {
    const factors = portalAdjustmentFactors(part);
    const complexityMinutes = assumptions?.cam_programming_defaults[`${factors.complexity}_programming_minutes` as keyof Assumptions["cam_programming_defaults"]];
    const missingInfoRisk = portalReadinessIssues(part).length * 0.025;
    return {
      part_name: part.partName,
      quantity: part.quantity,
      precision_level: "operation_based",
      rate_mode: mode,
      cad_file: part.fileName ? {
        filename: part.fileName,
        file_size_bytes: part.fileSizeBytes,
        file_type: part.fileName.toLowerCase().endsWith(".stp") ? "stp" : "step",
        geometry_confidence: part.drawingFileName ? "step_plus_drawing_metadata" : "step_only_metadata"
      } : null,
      cam_programming: {
        required: true,
        is_new_part: true,
        complexity: factors.complexity,
        programming_labor_hour_rate_eur: programmingRate,
        estimated_programming_minutes: roundMoney((typeof complexityMinutes === "number" ? complexityMinutes : 90) * factors.combined),
        setup_proveout_minutes: roundMoney(proveoutMinutes * (part.toleranceRequirement === "custom" ? 1.4 : part.toleranceRequirement === "drawing" ? 1.2 : 1)),
        reusable_program_percent: 0,
        assumption_quality: "portal_preliminary"
      },
      material: {
        name: part.materialRequirement || part.stockName,
        stock_piece_cost_eur: portalMaterialCost(part),
        stock_pieces_required: portalStockPiecesRequired(part),
        scrap_recovery_eur: 0,
        assumption_quality: "portal_preliminary"
      },
      operations: portalOperations(part, mode),
      commercial_policy: {
        margin_percent: commercialPolicy.default_margin_percent,
        overhead_percent: overheadPercentForMode(assumptions, mode),
        risk_allowance_percent: commercialPolicy.risk_allowance_percent + missingInfoRisk + (part.documentationRequirement === "full_fai" ? 0.02 : 0),
        minimum_order_admin_cost_eur: commercialPolicy.minimum_order_admin_cost_eur
      }
    };
  }

  // Range is deliberately widened asymmetrically (low factor closer to 1 than high factor is
  // far from it): pending calibration against actuals, an underquote is cheaper to fix than an
  // overquote that loses the order, so the client-facing band leans toward showing headroom
  // upward rather than downward. Both factors are editable assumptions, not hardcoded.
  function portalEstimateFromResult(part: PortalPart, result: QuoteResult, accountingResult: QuoteResult): PortalEstimate {
    const issues = portalReadinessIssues(part);
    const rangeLowFactor = assumptions?.client_portal?.range_low_factor ?? 0.85;
    const rangeHighFactor = assumptions?.client_portal?.range_high_factor ?? 1.35;
    const lowTotal = roundMoney(result.sell_price_eur * rangeLowFactor);
    const highTotal = roundMoney(result.sell_price_eur * rangeHighFactor);
    return {
      result,
      accountingSellPriceEur: accountingResult.sell_price_eur,
      lowTotalEur: lowTotal,
      highTotalEur: highTotal,
      lowUnitEur: roundMoney(lowTotal / part.quantity),
      highUnitEur: roundMoney(highTotal / part.quantity),
      confidence: issues.length === 0 ? "Medium - ready for manual review" : "Low - missing RFQ information",
      readinessIssues: issues
    };
  }

  // Informational only: shows the sales team what a *future* repeat order could cost once CAM
  // is reused, without changing the price of *this* (necessarily new-part) order.
  function portalRepeatOrderCamSavingsEur(part: PortalPart) {
    if (!assumptions || part.annualVolume < part.quantity * 2) {
      return null;
    }
    const factors = portalAdjustmentFactors(part);
    const complexityMinutes = assumptions.cam_programming_defaults[`${factors.complexity}_programming_minutes` as keyof Assumptions["cam_programming_defaults"]];
    const grossMinutes = roundMoney((typeof complexityMinutes === "number" ? complexityMinutes : 90) * factors.combined) + proveoutMinutes;
    const reusePercent = assumptions.cam_programming_defaults.repeat_part_reusable_program_percent ?? 0;
    return roundMoney((grossMinutes * reusePercent / 60) * programmingRate);
  }

  function updatePortalPart(partId: string, changes: Partial<PortalPart>) {
    setPortalParts((current) => current.map((part) => part.id === partId ? { ...part, ...changes } : part));
    setPortalEstimates((current) => {
      const next = { ...current };
      delete next[partId];
      return next;
    });
  }

  function addPortalFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setPortalParts((current) => [...current, ...Array.from(files).map(createPortalPart)]);
    setPortalStatus(`${files.length} STEP file(s) added. Add drawings/specifications for a more reliable estimate.`);
  }

  function addBlankPortalPart() {
    setPortalParts((current) => [...current, createPortalPart()]);
  }

  function removePortalPart(partId: string) {
    setPortalParts((current) => current.filter((part) => part.id !== partId));
    setPortalEstimates((current) => {
      const next = { ...current };
      delete next[partId];
      return next;
    });
  }

  // Bridge from a portal RFQ into a real Quote Builder draft for the manual confirmation
  // the portal copy promises. Without this, a portal RFQ was a dead end once you left the tab.
  function sendPortalPartToQuoteBuilder(part: PortalPart) {
    if (!assumptions) return;
    const factors = portalAdjustmentFactors(part);
    const route = portalRouteOperationTypes(part);
    const operations: QuoteOperation[] = route
      .map((operationType) => assumptions.operation_templates.find((template) => template.operation_type === operationType))
      .filter((template): template is OperationTemplate => Boolean(template))
      .map((template) => {
        const isInspection = template.operation_type === "manual_inspection";
        const factor = isInspection ? factors.qcFactor : factors.combined;
        return {
          id: `${template.operation_type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          operationType: template.operation_type,
          name: isInspection ? `QC - ${part.documentationRequirement.replace(/_/g, " ")}` : operationLabel(template.operation_type),
          machineClassId: template.default_machine_class_id,
          laborClassId: template.default_labor_class_id,
          setupMachineMinutes: roundMoney((template.default_setup_machine_minutes ?? 0) * factor),
          setupLaborMinutes: roundMoney((template.default_setup_labor_minutes ?? 0) * factor),
          runMachineMinutesPerPart: roundMoney((template.default_run_machine_minutes_per_part ?? 0) * factor),
          runLaborMinutesPerPart: roundMoney((template.default_run_labor_minutes_per_part ?? 0) * factor),
          toolingCostPerPart: template.default_tooling_cost_per_part_eur ?? 0,
          consumablesCostPerPart: template.default_consumables_cost_per_part_eur ?? 0,
          outsourcedCostPerPart: 0,
          outsourcedBatchCost: part.surfaceFinish.toLowerCase().includes("anod") || part.surfaceFinish.toLowerCase().includes("coat") ? 45 : 0,
          scrapAllowancePercent: Math.min(0.14, (template.default_scrap_allowance_percent ?? 0) + (part.toleranceRequirement === "custom" ? 0.03 : part.toleranceRequirement === "drawing" ? 0.015 : 0)),
          toolRequirements: defaultToolRequirementsForOperation(template.operation_type)
        };
      });
    const complexityMinutes = assumptions.cam_programming_defaults[`${factors.complexity}_programming_minutes` as keyof Assumptions["cam_programming_defaults"]];

    setDraftId(null);
    setPartName(part.partName);
    setCustomerName(portalCustomerName);
    setQuantity(part.quantity);
    setQuantityBreakText(String(part.quantity));
    setSelectedMaterialId(part.materialId);
    setStockName(part.materialRequirement || part.stockName);
    setStockCost(portalMaterialCost(part));
    setStockPieces(portalStockPiecesRequired(part));
    setCutLengthMm(part.cutLengthMm);
    setCutWidthMm(part.cutWidthMm);
    setScrapRecovery(0);
    setIsNewPart(true);
    setCamComplexity(factors.complexity);
    setProgrammingMinutes(roundMoney((typeof complexityMinutes === "number" ? complexityMinutes : 90) * factors.combined));
    setProveoutMinutes(roundMoney(proveoutMinutes * (part.toleranceRequirement === "custom" ? 1.4 : part.toleranceRequirement === "drawing" ? 1.2 : 1)));
    setQuoteOperations(operations);
    setRateMode("target_competitive");
    setActiveView("quote");
    setPortalStatus(`"${part.partName}" sent to Quote Builder for manual confirmation.`);
  }

  async function calculatePortalEstimates() {
    if (!assumptions) {
      setPortalStatus("Assumptions are still loading");
      return;
    }
    if (portalParts.length === 0) {
      setPortalStatus("Add at least one part before calculating");
      return;
    }
    try {
      const entries = await Promise.all(portalParts.map(async (part) => {
        const [targetResponse, accountingResponse] = await Promise.all([
          fetch("/api/quotes/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(portalQuotePayload(part, "target_competitive"))
          }),
          fetch("/api/quotes/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(portalQuotePayload(part, "accounting_full_cost"))
          })
        ]);
        if (!targetResponse.ok || !accountingResponse.ok) {
          throw new Error(`Portal calculator returned ${targetResponse.status}/${accountingResponse.status}`);
        }
        const result = (await targetResponse.json()) as QuoteResult;
        const accountingResult = (await accountingResponse.json()) as QuoteResult;
        return [part.id, portalEstimateFromResult(part, result, accountingResult)] as const;
      }));
      setPortalEstimates(Object.fromEntries(entries));
      setPortalStatus(`Preliminary estimate calculated for ${entries.length} part(s). Final offer still requires drawing, material, tolerance, tooling, and capacity confirmation.`);
    } catch (error) {
      setPortalStatus(error instanceof Error ? error.message : "Portal calculation failed");
    }
  }

  function quantityBreaks() {
    const values = quantityBreakText
      .split(/[ ,;\n]+/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => Math.round(item));
    return Array.from(new Set(values)).sort((a, b) => a - b);
  }

  const calculationKey = useMemo(
    () => JSON.stringify({
      cadFile: cadFile ? { name: cadFile.name, size: cadFile.size } : null,
      camComplexity,
      commercialPolicy,
      isNewPart,
      partName,
      programmingMinutes,
      programmingRate,
      proveoutMinutes,
      quantity,
      quantityBreakText,
      quoteOperations,
      actualOperations,
      reusableProgramPercent,
      scrapRecovery,
      stockCost,
      stockName,
      stockPieces,
      machineRates: assumptions?.machine_classes,
      laborRates: assumptions?.labor_classes,
      toolInventory: assumptions?.tool_inventory
    }),
    [
      assumptions?.labor_classes,
      assumptions?.machine_classes,
      assumptions?.tool_inventory,
      cadFile,
      camComplexity,
      commercialPolicy,
      isNewPart,
      partName,
      programmingMinutes,
      programmingRate,
      proveoutMinutes,
      quantity,
      quantityBreakText,
      quoteOperations,
      actualOperations,
      reusableProgramPercent,
      scrapRecovery,
      stockCost,
      stockName,
      stockPieces
    ]
  );

  useEffect(() => {
    if (!assumptions || quoteOperations.length === 0) {
      return;
    }
    let cancelled = false;

    async function calculateBothModes() {
      try {
        const [targetResponse, accountingResponse] = await Promise.all([
          fetch("/api/quotes/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quotePayloadForMode("target_competitive"))
          }),
          fetch("/api/quotes/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quotePayloadForMode("accounting_full_cost"))
          })
        ]);
        if (!targetResponse.ok || !accountingResponse.ok) {
          throw new Error(`Calculator returned ${targetResponse.status}/${accountingResponse.status}`);
        }
        const [targetData, accountingData] = (await Promise.all([
          targetResponse.json(),
          accountingResponse.json()
        ])) as [QuoteResult, QuoteResult];
        if (!cancelled) {
          setTargetResult(targetData);
          setAccountingResult(accountingData);
          const breaks = quantityBreaks();
          const breakResults = await Promise.all(
            breaks.map(async (breakQuantity) => {
              const [targetBreakResponse, accountingBreakResponse] = await Promise.all([
                fetch("/api/quotes/calculate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(quotePayloadForMode("target_competitive", breakQuantity))
                }),
                fetch("/api/quotes/calculate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(quotePayloadForMode("accounting_full_cost", breakQuantity))
                })
              ]);
              if (!targetBreakResponse.ok || !accountingBreakResponse.ok) {
                throw new Error(`Quantity break returned ${targetBreakResponse.status}/${accountingBreakResponse.status}`);
              }
              return {
                quantity: breakQuantity,
                target: (await targetBreakResponse.json()) as QuoteResult,
                accounting: (await accountingBreakResponse.json()) as QuoteResult,
                materialScaledLinearly: stockPiecesForQuantity(breakQuantity).scaledLinearly
              };
            })
          );
          if (!cancelled) {
            setQuantityBreakResults(breakResults);
          }
          setApiError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : "Calculator request failed");
        }
      }
    }

    calculateBothModes();
    return () => {
      cancelled = true;
    };
  }, [calculationKey, assumptions, quoteOperations.length]);

  function updateAssumptions(next: Assumptions) {
    const recalculated = withRecalculatedAssumptions(next);
    setAssumptions(recalculated);
    setAssumptionsText(JSON.stringify(recalculated, null, 2));
    setAssumptionStatus("Unsaved changes");
  }

  function updateCommercialField(field: keyof Assumptions["commercial_policy"], value: number) {
    if (!assumptions) return;
    updateAssumptions({
      ...assumptions,
      commercial_policy: { ...assumptions.commercial_policy, [field]: value }
    });
  }

  function updateClientPortalField(field: keyof NonNullable<Assumptions["client_portal"]>, value: number) {
    if (!assumptions) return;
    const current = assumptions.client_portal ?? { range_low_factor: 0.85, range_high_factor: 1.35, annual_volume_relief_percent: 0.92 };
    updateAssumptions({
      ...assumptions,
      client_portal: { ...current, [field]: value }
    });
  }

  function updateCamField(field: keyof Assumptions["cam_programming_defaults"], value: number | string) {
    if (!assumptions) return;
    updateAssumptions({
      ...assumptions,
      cam_programming_defaults: { ...assumptions.cam_programming_defaults, [field]: value }
    });
  }

  function updateLabor(index: number, field: keyof LaborClass, value: string | number) {
    if (!assumptions) return;
    const nextLabor = {
      ...assumptions.labor_classes[index],
      [field]: value
    };
    nextLabor.derived_employer_cost_per_hour_eur = deriveLaborHourlyCost(nextLabor, assumptions);
    if (nextLabor.cost_method === "gross_monthly") {
      nextLabor.employer_cost_per_hour_eur = nextLabor.derived_employer_cost_per_hour_eur;
    }
    updateAssumptions({
      ...assumptions,
      labor_classes: replaceArrayItem(assumptions.labor_classes, index, nextLabor)
    });
  }

  function updateMachine(index: number, field: keyof MachineClass, value: string | number) {
    if (!assumptions) return;
    const nextMachine = {
      ...assumptions.machine_classes[index],
      [field]: value
    };
    updateAssumptions({
      ...assumptions,
      machine_classes: replaceArrayItem(assumptions.machine_classes, index, nextMachine)
    });
  }

  function applySuggestedFixedCost(index: number) {
    if (!assumptions) return;
    const machine = assumptions.machine_classes[index];
    updateMachine(index, "monthly_fixed_cost_eur", suggestedFixedCostFromPurchase(machine));
  }

  function updateOverheadMethod(method: OverheadAllocation["allocation_method"]) {
    if (!assumptions) return;
    const overhead = assumptions.overhead ?? { allocation_method: method, monthly_items: [] };
    updateAssumptions({ ...assumptions, overhead: { ...overhead, allocation_method: method } });
  }

  function updateOverheadItem(index: number, field: keyof OverheadItem, value: string | number) {
    if (!assumptions?.overhead) return;
    const nextItem = { ...assumptions.overhead.monthly_items[index], [field]: value };
    updateAssumptions({
      ...assumptions,
      overhead: {
        ...assumptions.overhead,
        monthly_items: replaceArrayItem(assumptions.overhead.monthly_items, index, nextItem)
      }
    });
  }

  function addOverheadItem() {
    if (!assumptions) return;
    const overhead = assumptions.overhead ?? { allocation_method: "per_machine_hour" as const, monthly_items: [] };
    const newItem: OverheadItem = {
      id: `overhead_item_${overhead.monthly_items.length + 1}`,
      name: "New overhead item",
      monthly_cost_eur: 0,
      quality: "company_estimate"
    };
    updateAssumptions({ ...assumptions, overhead: { ...overhead, monthly_items: [...overhead.monthly_items, newItem] } });
  }

  function removeOverheadItem(index: number) {
    if (!assumptions?.overhead) return;
    updateAssumptions({
      ...assumptions,
      overhead: {
        ...assumptions.overhead,
        monthly_items: assumptions.overhead.monthly_items.filter((_, itemIndex) => itemIndex !== index)
      }
    });
  }

  function updateOperationTemplate(index: number, field: keyof OperationTemplate, value: string | number | null) {
    if (!assumptions) return;
    updateAssumptions({
      ...assumptions,
      operation_templates: replaceArrayItem(assumptions.operation_templates, index, {
        ...assumptions.operation_templates[index],
        [field]: value
      })
    });
  }

  function updateMaterial(index: number, field: keyof MaterialExample, value: string | number) {
    if (!assumptions) return;
    updateAssumptions({
      ...assumptions,
      material_examples: replaceArrayItem(assumptions.material_examples, index, {
        ...assumptions.material_examples[index],
        [field]: value
      })
    });
  }

  function updateTool(index: number, field: keyof ToolInventoryItem, value: string | number | boolean | string[]) {
    if (!assumptions) return;
    updateAssumptions({
      ...assumptions,
      tool_inventory: replaceArrayItem(assumptions.tool_inventory ?? [], index, {
        ...(assumptions.tool_inventory ?? [])[index],
        [field]: value
      })
    });
  }

  function addMaterial() {
    if (!assumptions) return;
    const nextMaterial: MaterialExample = {
      id: `material_${Date.now()}`,
      name: "New material",
      unit: "stock_piece",
      stock_piece_cost_eur: 0,
      category: "raw_stock",
      material_grade: "",
      stock_description: "",
      supplier: "",
      minimum_order_quantity: 1,
      scrap_recovery_percent: 0,
      last_updated: new Date().toISOString().slice(0, 10),
      quality: "company_estimate"
    };
    updateAssumptions({ ...assumptions, material_examples: [...assumptions.material_examples, nextMaterial] });
  }

  function addTool() {
    if (!assumptions) return;
    const nextTool: ToolInventoryItem = {
      id: `tool_${Date.now()}`,
      name: "New tool",
      type: "end_mill",
      diameter_mm: 0,
      corner_radius_mm: 0,
      material_groups: ["general"],
      available_quantity: 0,
      replacement_cost_eur: 0,
      lead_time_days: 0,
      reusable: true,
      quality: "company_estimate"
    };
    updateAssumptions({ ...assumptions, tool_inventory: [...(assumptions.tool_inventory ?? []), nextTool] });
  }

  function selectMaterial(materialId: string) {
    setSelectedMaterialId(materialId);
    const material = assumptions?.material_examples.find((item) => item.id === materialId);
    if (!material) return;
    setStockName(material.stock_description || material.name);
    setStockCost(material.stock_piece_cost_eur);
  }

  function updateQuoteOperation(index: number, changes: Partial<QuoteOperation>) {
    setQuoteOperations((current) => replaceArrayItem(current, index, { ...current[index], ...changes }));
  }

  function updateToolRequirement(operationId: string, requirementId: string, changes: Partial<ToolRequirement>) {
    setQuoteOperations((current) => current.map((operation) => {
      if (operation.id !== operationId) {
        return operation;
      }
      return {
        ...operation,
        toolRequirements: (operation.toolRequirements ?? []).map((requirement) =>
          requirement.id === requirementId ? { ...requirement, ...changes } : requirement
        )
      };
    }));
  }

  function changeOperationTemplate(index: number, operationType: string) {
    if (!assumptions) {
      return;
    }
    const template = assumptions.operation_templates.find((item) => item.operation_type === operationType);
    if (!template) {
      return;
    }
    const nextOperation = createOperation(template);
    setQuoteOperations((current) => replaceArrayItem(current, index, { ...nextOperation, id: current[index].id }));
  }

  function addOperation() {
    if (!assumptions) {
      return;
    }
    const template = assumptions.operation_templates.find(
      (item) => item.operation_type === selectedTemplateType
    ) ?? assumptions.operation_templates[0];
    if (!template) {
      return;
    }
    setQuoteOperations((current) => [...current, createOperation(template)]);
  }

  function createOperationFromErp(row: ErpRouteOperation): QuoteOperation {
    return {
      id: `${row.operation_type}-${row.sequence}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      operationType: row.operation_type,
      name: row.name || operationLabel(row.operation_type),
      machineClassId: row.machine_class_id,
      laborClassId: row.labor_class_id,
      setupMachineMinutes: row.setup_machine_minutes,
      setupLaborMinutes: row.setup_labor_minutes,
      runMachineMinutesPerPart: row.run_machine_minutes_per_part,
      runLaborMinutesPerPart: row.run_labor_minutes_per_part,
      toolingCostPerPart: row.tooling_cost_per_part_eur,
      consumablesCostPerPart: row.consumables_cost_per_part_eur,
      outsourcedCostPerPart: row.outsourced_cost_per_part_eur,
      outsourcedBatchCost: row.outsourced_batch_cost_eur,
      scrapAllowancePercent: row.scrap_allowance_percent,
      toolRequirements: defaultToolRequirementsForOperation(row.operation_type)
    };
  }

  async function importErpRfq() {
    if (!selectedErpPartId) {
      setErpStatus("Select an ERP part first");
      return;
    }
    try {
      const response = await fetch("/api/erp/import-rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: selectedErpPartId })
      });
      if (!response.ok) {
        throw new Error(`ERP import returned ${response.status}`);
      }
      const data = (await response.json()) as ErpImportPayload;
      setPartName(data.part.name);
      setCustomerName(data.customer.name);
      setRfqReference(data.part.rfq_reference);
      setQuoteNumber(`Q-${data.part.part_number}-${data.part.revision}`);
      setDeliveryEstimate(data.part.delivery_estimate);
      setPaymentTerms(data.customer.payment_terms);
      setQuantity(data.part.default_quantity);
      setQuantityBreakText(data.part.quantity_breaks.join(", "));
      setIsNewPart(data.part.is_new_part);
      setCamComplexity(data.part.cam_complexity);
      setProgrammingMinutes(data.part.programming_minutes);
      setProveoutMinutes(data.part.proveout_minutes);
      setSelectedMaterialId("");
      setStockName(data.material.stock_description || data.material.name);
      setStockCost(data.material.stock_piece_cost_eur);
      setStockPieces(data.material.stock_pieces_required);
      setScrapRecovery(data.material.scrap_recovery_eur);
      const importedOperations = data.route.sort((a, b) => a.sequence - b.sequence).map(createOperationFromErp);
      setQuoteOperations(importedOperations);
      setActualOperations([]);
      setErpSource({
        partId: data.part.id,
        partNumber: data.part.part_number,
        revision: data.part.revision,
        importedAt: data.imported_at
      });
      setLastErpOffer(null);
      const notes = data.availability_notes.length > 0 ? ` ${data.availability_notes.join(" ")}` : "";
      setErpStatus(`Imported ${data.part.part_number} rev ${data.part.revision} from sample ERP.${notes}`);
    } catch (error) {
      setErpStatus(error instanceof Error ? error.message : "ERP import failed");
    }
  }

  async function sendCustomerOfferToErp() {
    if (!targetResult) {
      setErpStatus("Calculate a quote before sending a Customer Offer payload");
      return;
    }
    try {
      const response = await fetch("/api/erp/customer-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: quoteNumber,
          customer_name: customerName,
          rfq_reference: rfqReference,
          part_name: partName,
          quantity,
          target_sell_price_eur: targetResult.sell_price_eur,
          target_unit_sell_price_eur: targetResult.unit_sell_price_eur,
          accounting_sell_price_eur: accountingResult?.sell_price_eur ?? null,
          accounting_unit_sell_price_eur: accountingResult?.unit_sell_price_eur ?? null,
          validity_date: validityDate,
          delivery_estimate: deliveryEstimate,
          payment_terms: paymentTerms,
          quantity_breaks: quantityBreakResults.map((item) => ({
            quantity: item.quantity,
            target_unit_sell_price_eur: item.target.unit_sell_price_eur,
            target_sell_price_eur: item.target.sell_price_eur,
            accounting_unit_sell_price_eur: item.accounting.unit_sell_price_eur,
            accounting_sell_price_eur: item.accounting.sell_price_eur
          })),
          source_quote_state: currentQuoteState()
        })
      });
      if (!response.ok) {
        throw new Error(`ERP offer handoff returned ${response.status}`);
      }
      const saved = (await response.json()) as ErpOfferPayload;
      setLastErpOffer(saved);
      setErpStatus(`Customer Offer data prepared for ERP as ${saved.id}`);
    } catch (error) {
      setErpStatus(error instanceof Error ? error.message : "ERP offer handoff failed");
    }
  }

  function updateActualOperation(operationId: string, changes: Partial<ActualOperation>) {
    setActualOperations((current) => {
      const existing = current.find((item) => item.operationId === operationId);
      if (existing) {
        return current.map((item) => item.operationId === operationId ? { ...item, ...changes } : item);
      }
      return [...current, { operationId, actualSetupMachineMinutes: 0, actualSetupLaborMinutes: 0, actualRunMachineMinutesPerPart: 0, actualRunLaborMinutesPerPart: 0, actualScrapPercent: 0, notes: "", ...changes }];
    });
  }

  function applyActualsToTemplates() {
    if (!assumptions) {
      return;
    }
    const nextTemplates = assumptions.operation_templates.map((template) => {
      const matchingOperations = quoteOperations.filter((operation) => operation.operationType === template.operation_type);
      const matchingActuals = matchingOperations
        .map((operation) => actualOperations.find((actual) => actual.operationId === operation.id))
        .filter((actual): actual is ActualOperation => Boolean(actual));

      if (matchingActuals.length === 0) {
        return template;
      }

      const average = (selector: (actual: ActualOperation) => number) =>
        roundMoney(matchingActuals.reduce((sum, actual) => sum + selector(actual), 0) / matchingActuals.length);

      return {
        ...template,
        default_setup_machine_minutes: average((actual) => actual.actualSetupMachineMinutes),
        default_setup_labor_minutes: average((actual) => actual.actualSetupLaborMinutes),
        default_run_machine_minutes_per_part: average((actual) => actual.actualRunMachineMinutesPerPart),
        default_run_labor_minutes_per_part: average((actual) => actual.actualRunLaborMinutesPerPart),
        default_scrap_allowance_percent: average((actual) => actual.actualScrapPercent),
        quality: "company_estimate"
      };
    });

    updateAssumptions({ ...assumptions, operation_templates: nextTemplates });
    setAssumptionStatus("Actuals applied to operation templates. Save Resources to persist.");
  }

  function removeOperation(index: number) {
    setQuoteOperations((current) => {
      const removed = current[index];
      if (removed) {
        setActualOperations((actuals) => actuals.filter((item) => item.operationId !== removed.id));
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function loadDemoRfq() {
    setPartName("CNC aluminium sensor bracket");
    setCustomerName("Baltic Robotics Group");
    setRfqReference("RFQ-DEMO-STEP-042");
    setQuoteNumber("Q-DEMO-2026-001");
    setValidityDate("2026-08-15");
    setDeliveryEstimate("15 working days after order confirmation");
    setPaymentTerms("30% advance, 70% before delivery");
    setQuantity(50);
    setQuantityBreakText("10, 25, 50, 100, 250");
    setIsNewPart(true);
    setCamComplexity("medium");
    setProgrammingMinutes(90);
    setProveoutMinutes(30);
    setRateMode("target_competitive");
    const material = assumptions?.material_examples.find((item) => item.id === "al6082_round_bar_60") ?? assumptions?.material_examples[0];
    if (material) {
      setSelectedMaterialId(material.id);
      setStockName(material.stock_description || material.name);
      setStockCost(material.stock_piece_cost_eur);
      setStockPieces(3);
      setScrapRecovery(8);
    }
    const route = ["saw_cutting", "milling_3_axis", "drilling", "tapping", "engraving", "manual_inspection"];
    const demoOperations = route
      .map((operationType) => assumptions?.operation_templates.find((template) => template.operation_type === operationType))
      .filter((template): template is OperationTemplate => Boolean(template))
      .map(createOperation);
    setQuoteOperations(demoOperations);
    setActualOperations(
      demoOperations.map((operation, index) => ({
        operationId: operation.id,
        actualSetupMachineMinutes: roundMoney(operation.setupMachineMinutes * (index === 1 ? 0.88 : 1.05)),
        actualSetupLaborMinutes: roundMoney(operation.setupLaborMinutes * (index === 1 ? 0.92 : 1)),
        actualRunMachineMinutesPerPart: roundMoney(operation.runMachineMinutesPerPart * (index === 1 ? 0.9 : 1.08)),
        actualRunLaborMinutesPerPart: roundMoney(operation.runLaborMinutesPerPart * 1.05),
        actualScrapPercent: index === 1 ? 0.02 : operation.scrapAllowancePercent,
        notes: index === 1 ? "Actual CAM strategy was faster than estimate." : "Demo actual."
      }))
    );
    setDraftStatus("Demo RFQ loaded. Save it as a draft if you want to keep it.");
  }

  function currentQuoteState() {
    return {
      draftId,
      partName,
      customerName,
      rfqReference,
      quoteNumber,
      validityDate,
      deliveryEstimate,
      paymentTerms,
      printDocumentMode,
      quantity,
      quantityBreakText,
      quantityBreakResults,
      selectedMaterialId,
      stockName,
      stockCost,
      stockPieces,
      cutLengthMm,
      cutWidthMm,
      scrapRecovery,
      isNewPart,
      camComplexity,
      programmingMinutes,
      proveoutMinutes,
      programmingRate,
      rateMode,
      selectedTemplateType,
      quoteOperations,
      actualOperations,
      erpSource
    };
  }

  function restoreQuoteState(state: Record<string, unknown>) {
    setDraftId(typeof state.draftId === "string" ? state.draftId : null);
    if (typeof state.partName === "string") setPartName(state.partName);
    if (typeof state.customerName === "string") setCustomerName(state.customerName);
    if (typeof state.rfqReference === "string") setRfqReference(state.rfqReference);
    if (typeof state.quoteNumber === "string") setQuoteNumber(state.quoteNumber);
    if (typeof state.validityDate === "string") setValidityDate(state.validityDate);
    if (typeof state.deliveryEstimate === "string") setDeliveryEstimate(state.deliveryEstimate);
    if (typeof state.paymentTerms === "string") setPaymentTerms(state.paymentTerms);
    if (state.printDocumentMode === "customer_offer" || state.printDocumentMode === "internal_cost_sheet") setPrintDocumentMode(state.printDocumentMode);
    else if (typeof state.hideInternalCosts === "boolean") setPrintDocumentMode(state.hideInternalCosts ? "customer_offer" : "internal_cost_sheet");
    if (typeof state.quantity === "number") setQuantity(state.quantity);
    if (typeof state.quantityBreakText === "string") setQuantityBreakText(state.quantityBreakText);
    if (typeof state.selectedMaterialId === "string") setSelectedMaterialId(state.selectedMaterialId);
    if (typeof state.stockName === "string") setStockName(state.stockName);
    if (typeof state.stockCost === "number") setStockCost(state.stockCost);
    if (typeof state.stockPieces === "number") setStockPieces(state.stockPieces);
    if (typeof state.cutLengthMm === "number") setCutLengthMm(state.cutLengthMm);
    if (typeof state.cutWidthMm === "number") setCutWidthMm(state.cutWidthMm);
    if (typeof state.scrapRecovery === "number") setScrapRecovery(state.scrapRecovery);
    if (typeof state.isNewPart === "boolean") setIsNewPart(state.isNewPart);
    if (typeof state.camComplexity === "string") setCamComplexity(state.camComplexity);
    if (typeof state.programmingMinutes === "number") setProgrammingMinutes(state.programmingMinutes);
    if (typeof state.proveoutMinutes === "number") setProveoutMinutes(state.proveoutMinutes);
    if (typeof state.programmingRate === "number") setProgrammingRate(state.programmingRate);
    if (state.rateMode === "target_competitive" || state.rateMode === "accounting_full_cost") setRateMode(state.rateMode);
    if (typeof state.selectedTemplateType === "string") setSelectedTemplateType(state.selectedTemplateType);
    if (Array.isArray(state.quoteOperations)) {
      setQuoteOperations((state.quoteOperations as QuoteOperation[]).map((operation) => ({
        ...operation,
        toolRequirements: Array.isArray(operation.toolRequirements) ? operation.toolRequirements : defaultToolRequirementsForOperation(operation.operationType)
      })));
    }
    if (Array.isArray(state.actualOperations)) setActualOperations(state.actualOperations as ActualOperation[]);
    setErpSource(state.erpSource && typeof state.erpSource === "object" ? state.erpSource as ErpSourceState : null);
  }

  async function refreshDrafts() {
    const response = await fetch("/api/quote-drafts");
    if (!response.ok) {
      throw new Error(`Draft list returned ${response.status}`);
    }
    const data = (await response.json()) as QuoteDraft[];
    setDrafts(data);
  }

  async function saveQuoteDraft() {
    try {
      const response = await fetch("/api/quote-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${quoteNumber || partName} - ${customerName || "Customer"}`,
          quote_state: currentQuoteState(),
          target_result: targetResult,
          accounting_result: accountingResult,
          quantity_break_results: quantityBreakResults,
          assumptions_snapshot: assumptions
        })
      });
      if (!response.ok) {
        throw new Error(`Draft save returned ${response.status}`);
      }
      const saved = (await response.json()) as QuoteDraft;
      setDraftId(saved.id);
      restoreQuoteState(saved.quote_state);
      await refreshDrafts();
      setDraftStatus(`Saved ${saved.name}`);
    } catch (error) {
      setDraftStatus(error instanceof Error ? error.message : "Draft save failed");
    }
  }

  async function loadQuoteDraft(nextDraftId: string) {
    if (!nextDraftId) {
      setDraftId(null);
      setDraftStatus("No draft selected");
      return;
    }
    try {
      const response = await fetch(`/api/quote-drafts/${nextDraftId}`);
      if (!response.ok) {
        throw new Error(`Draft load returned ${response.status}`);
      }
      const draft = (await response.json()) as QuoteDraft;
      restoreQuoteState(draft.quote_state);
      setTargetResult(draft.target_result);
      setAccountingResult(draft.accounting_result);
      setDraftStatus(`Loaded ${draft.name}`);
    } catch (error) {
      setDraftStatus(error instanceof Error ? error.message : "Draft load failed");
    }
  }

  async function deleteQuoteDraft() {
    if (!draftId) {
      setDraftStatus("Select a draft before deleting");
      return;
    }
    try {
      const response = await fetch(`/api/quote-drafts/${draftId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Draft delete returned ${response.status}`);
      }
      setDraftId(null);
      await refreshDrafts();
      setDraftStatus("Draft deleted");
    } catch (error) {
      setDraftStatus(error instanceof Error ? error.message : "Draft delete failed");
    }
  }

  function exportQuoteDraft(format: "json" | "csv") {
    if (!draftId) {
      setDraftStatus("Save or select a draft before exporting");
      return;
    }
    window.location.href = `/api/quote-drafts/${draftId}/export.${format}`;
  }

  function applyJsonEditor() {
    try {
      const parsed = withRecalculatedAssumptions(JSON.parse(assumptionsText) as Assumptions);
      setAssumptions(parsed);
      setAssumptionsText(JSON.stringify(parsed, null, 2));
      setAssumptionStatus("JSON applied locally, not saved");
    } catch (error) {
      setAssumptionStatus(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  async function saveAssumptions() {
    try {
      const payloadToSave = JSON.parse(assumptionsText) as Assumptions;
      const response = await fetch("/api/assumptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSave)
      });
      if (!response.ok) {
        throw new Error(`Save returned ${response.status}`);
      }
      const rawSaved = (await response.json()) as Assumptions;
      const saved = withRecalculatedAssumptions(rawSaved);
      setAssumptions(saved);
      setAssumptionsText(JSON.stringify(saved, null, 2));
      setAssumptionStatus("Saved to baseline_assumptions.lv.json");
    } catch (error) {
      setAssumptionStatus(error instanceof Error ? error.message : "Save failed");
    }
  }

  const priceGap = accountingResult && targetResult
    ? accountingResult.sell_price_eur - targetResult.sell_price_eur
    : 0;

  const currentToolChecks = toolCheckResults();
  const missingToolChecks = currentToolChecks.filter((item) => item.status === "missing");
  const totalMissingToolCost = roundMoney(missingToolChecks.reduce((sum, item) => sum + item.quoteCostEur, 0));

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <Factory size={24} />
          <span>ProdCost</span>
        </div>
        <nav className="nav">
          <button
            className={`navItem ${activeView === "quote" ? "active" : ""}`}
            title="Quote builder"
            onClick={() => setActiveView("quote")}
          >
            <Calculator size={18} />
            <span>Quote</span>
          </button>
          <button
            className={`navItem ${activeView === "client_portal" ? "active" : ""}`}
            title="Client RFQ portal"
            onClick={() => setActiveView("client_portal")}
          >
            <Upload size={18} />
            <span>Client</span>
          </button>
          <button
            className={`navItem ${activeView === "resources" ? "active" : ""}`}
            title="Resources"
            onClick={() => setActiveView("resources")}
          >
            <LibraryBig size={18} />
            <span>Resources</span>
          </button>
          <button
            className={`navItem ${activeView === "scenarios" ? "active" : ""}`}
            title="Scenarios"
            onClick={() => setActiveView("scenarios")}
          >
            <SplitSquareVertical size={18} />
            <span>Scenarios</span>
          </button>
          <button
            className={`navItem ${activeView === "print" ? "active" : ""}`}
            title="Printable quote"
            onClick={() => setActiveView("print")}
          >
            <Save size={18} />
            <span>Print</span>
          </button>
          <button
            className={`navItem ${activeView === "profitability" ? "active" : ""}`}
            title="Can we be profitable?"
            onClick={() => setActiveView("profitability")}
          >
            <TrendingUp size={18} />
            <span>Profitability</span>
          </button>
          <button
            className={`navItem ${activeView === "business_case" ? "active" : ""}`}
            title="Business case"
            onClick={() => setActiveView("business_case")}
          >
            <Gauge size={18} />
            <span>Case</span>
          </button>
          <button
            className={`navItem ${activeView === "guide" ? "active" : ""}`}
            title="Principles and terminology guide"
            onClick={() => setActiveView("guide")}
          >
            <BookOpen size={18} />
            <span>Guide</span>
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{activeView === "resources" ? "Assumptions" : activeView === "client_portal" ? "Client Portal" : activeView === "scenarios" ? "Scenarios" : activeView === "print" ? "Printable Quote" : activeView === "business_case" ? "Business Case" : activeView === "guide" ? "Principles Guide" : activeView === "profitability" ? "Profitability" : "Quote Builder"}</h1>
            <p>Operation-based CNC cost estimate with editable Latvian starter assumptions.</p>
          </div>
        </header>

        {activeView === "resources" ? (
          <div className="subTabs" aria-label="Resources sections">
            <button className={`subTab ${resourceSubView === "values" ? "active" : ""}`} onClick={() => setResourceSubView("values")}>Values</button>
            <button className={`subTab ${resourceSubView === "explanations" ? "active" : ""}`} onClick={() => setResourceSubView("explanations")}>Explanations</button>
          </div>
        ) : null}

        {activeView === "quote" ? (
          <>
            <section className="demoPanel">
              <div>
                <h2>Demo Flow</h2>
                <ol>
                  <li>Import sample ERP data or load a realistic manual demo with material, route, quantity breaks, and actuals.</li>
                  <li>Compare target pricing against accounting full-cost pricing.</li>
                  <li>Open Print or send the Customer Offer payload back to sample ERP.</li>
                  <li>Apply actuals to templates to show continuous calibration.</li>
                </ol>
              </div>
              <button className="primaryButton" onClick={loadDemoRfq}>Load Demo RFQ</button>
            </section>

            <section className="panel erpPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>ERP Connection Demo</h2>
                  <p className="sectionHelp">Import BOM, route, material, and customer context from a sample ERP adapter, then send the calculated Customer Offer payload back.</p>
                </div>
                <Database size={18} />
              </div>
              <div className="erpControls">
                <label>ERP part<select value={selectedErpPartId} onChange={(event) => setSelectedErpPartId(event.target.value)}>
                  <option value="">Select ERP part</option>
                  {erpParts.map((part) => (
                    <option key={part.id} value={part.id}>{part.part_number} rev {part.revision} - {part.name} ({part.customer_name})</option>
                  ))}
                </select></label>
                <button className="primaryButton" onClick={importErpRfq}><Database size={16} /> Import ERP Data</button>
                <button className="secondaryButton" onClick={sendCustomerOfferToErp}><Send size={16} /> Send Offer Data to ERP</button>
              </div>
              <div className="erpStatusGrid">
                <p className="statusText">{erpStatus}</p>
                <p className="statusText">{erpSource ? `Source: ${erpSource.partNumber} rev ${erpSource.revision}, imported ${new Date(erpSource.importedAt).toLocaleString("en-GB")}` : "Source: manual quote or demo RFQ"}</p>
                {lastErpOffer ? <p className="statusText">Last ERP CO: {lastErpOffer.id} ({lastErpOffer.status})</p> : null}
              </div>
            </section>

            <section className="panel draftPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>Quote Drafts</h2>
                  <p className="sectionHelp">Save and reload quote routes with their target/accounting result and assumptions snapshot.</p>
                </div>
                <div className="buttonRow draftControls">
                  <select value={draftId ?? ""} onChange={(event) => loadQuoteDraft(event.target.value)}>
                    <option value="">Select draft</option>
                    {drafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>{draft.name}</option>
                    ))}
                  </select>
                  <button className="primaryButton" onClick={saveQuoteDraft}><Save size={16} /> Save Draft</button>
                  <button className="secondaryButton" onClick={() => exportQuoteDraft("json")}>JSON</button>
                  <button className="secondaryButton" onClick={() => exportQuoteDraft("csv")}>CSV</button>
                  <button className="secondaryButton" onClick={() => setActiveView("print")}>Print</button>
                  <button className="iconButton" title="Delete selected draft" onClick={deleteQuoteDraft}><Trash2 size={18} /></button>
                </div>
              </div>
              <p className="statusText">{draftStatus}</p>
            </section>

            <section className="quoteGrid">
              <div className="panel inputPanel">
                <div className="sectionHeader">
                  <h2>RFQ</h2>
                  <Gauge size={18} />
                </div>
                <div className="fieldGrid">
                  <label>Part<input value={partName} onChange={(event) => setPartName(event.target.value)} /></label>
                  <label>Customer<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
                  <label>RFQ/reference<input value={rfqReference} onChange={(event) => setRfqReference(event.target.value)} /></label>
                  <label>Quote number<input value={quoteNumber} onChange={(event) => setQuoteNumber(event.target.value)} /></label>
                  <label>Validity date<input type="date" value={validityDate} onChange={(event) => setValidityDate(event.target.value)} /></label>
                  <label>Delivery estimate<input value={deliveryEstimate} onChange={(event) => setDeliveryEstimate(event.target.value)} /></label>
                  <label>Payment terms<input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></label>
                  <label>Quantity, pcs<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, numericValue(event.target.value, 1)))} /></label>
                  <label>Quantity breaks, pcs<input value={quantityBreakText} onChange={(event) => setQuantityBreakText(event.target.value)} /></label>
                  <label>Material library<select value={selectedMaterialId} onChange={(event) => selectMaterial(event.target.value)}><option value="">Manual material</option>{(assumptions?.material_examples ?? []).map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label>
                  <label>Stock piece<input value={stockName} onChange={(event) => { setSelectedMaterialId(""); setStockName(event.target.value); }} /></label>
                  <label>Stock cost, EUR/piece<input type="number" min="0" value={stockCost} onChange={(event) => { setSelectedMaterialId(""); setStockCost(numericValue(event.target.value)); }} /></label>
                  <label>Stock pieces, pcs<input type="number" min="0.01" step="0.01" value={stockPieces} onChange={(event) => setStockPieces(Math.max(0.01, numericValue(event.target.value, 1)))} /></label>
                  <label>Scrap recovery, EUR<input type="number" min="0" value={scrapRecovery} onChange={(event) => setScrapRecovery(numericValue(event.target.value))} /></label>
                </div>
                {(() => {
                  const selectedMaterial = assumptions?.material_examples.find((material) => material.id === selectedMaterialId);
                  const isPlate = selectedMaterial?.stock_shape === "plate";
                  const suggested = selectedMaterial
                    ? stockPiecesRequiredForMaterial(selectedMaterial, cutLengthMm, isPlate ? cutWidthMm : 0, quantity)
                    : null;
                  return (
                    <div className="fixedCostHelper cutoffHelper">
                      <label>
                        Cut length, mm
                        <input type="number" min="1" value={cutLengthMm} onChange={(event) => setCutLengthMm(Math.max(1, numericValue(event.target.value, 100)))} />
                      </label>
                      {isPlate ? (
                        <label>
                          Cut width, mm
                          <input type="number" min="1" value={cutWidthMm} onChange={(event) => setCutWidthMm(Math.max(1, numericValue(event.target.value, 100)))} />
                        </label>
                      ) : null}
                      <div>
                        <div className="suggestedValue">
                          {selectedMaterial
                            ? suggested !== null
                              ? `Suggested: ${suggested} stock piece(s) for ${quantity} pcs`
                              : "Pick a material with stock dimensions to calculate"
                            : "Select a Material library item to enable the cutoff calculator"}
                        </div>
                        <button
                          type="button"
                          className="secondaryButton"
                          disabled={suggested === null}
                          onClick={() => { if (suggested !== null) setStockPieces(suggested); }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="panel resultPanel">
                <div className="sectionHeader wide summaryHeader">
                  <h2>Quote Summary</h2>
                  <div className="modeGroup compactMode" aria-label="Rate mode">
                    <button className={`mode ${rateMode === "target_competitive" ? "active" : ""}`} onClick={() => setRateMode("target_competitive")}>Target</button>
                    <button className={`mode ${rateMode === "accounting_full_cost" ? "active" : ""}`} onClick={() => setRateMode("accounting_full_cost")}>Accounting</button>
                  </div>
                </div>
                {apiError ? <p className="errorText">{apiError}</p> : null}
                <dl className="summary">
                  <div><dt>Production cost, EUR</dt><dd>{selectedResult ? money.format(selectedResult.total_cost_eur) : "..."}</dd></div>
                  <div><dt>Engineering/CAM operation, EUR</dt><dd>{selectedResult ? money.format(selectedResult.engineering_cost_eur) : "..."}</dd></div>
                  <div><dt>Sell price, EUR</dt><dd>{selectedResult ? money.format(selectedResult.sell_price_eur) : "..."}</dd></div>
                  <div><dt>Unit price, EUR/pc</dt><dd>{selectedResult ? money.format(selectedResult.unit_sell_price_eur) : "..."}</dd></div>
                  <div><dt>Commercial multiplier</dt><dd>{selectedResult ? `×${selectedResult.commercial_multiplier.toFixed(2)} (overhead, risk, margin, min-order admin)` : "..."}</dd></div>
                </dl>
              </div>
            </section>

            <section className="scenarioStrip">
              <div>
                <span className="scenarioLabel">Target price, EUR</span>
                <strong>{targetResult ? money.format(targetResult.sell_price_eur) : "..."}</strong>
                <span className="scenarioHint">Competitive target-rate price.</span>
              </div>
              <div>
                <span className="scenarioLabel">Accounting price, EUR</span>
                <strong>{accountingResult ? money.format(accountingResult.sell_price_eur) : "..."}</strong>
                <span className="scenarioHint">Current full-cost-rate price.</span>
              </div>
              <div>
                <span className="scenarioLabel">Accounting premium, EUR</span>
                <strong>{accountingResult && targetResult ? money.format(priceGap) : "..."}</strong>
                <span className="scenarioHint">Accounting minus target.</span>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Quantity Breaks</h2>
                  <p className="sectionHelp">Unit prices show how setup and CAM costs amortize across batch sizes. Material quantity is recomputed per break, not frozen at the main quantity.</p>
                </div>
              </div>
              <div className="operationTable">
                <div className="tableHead quantityBreakHead"><span>Qty, pcs</span><span>Target total, EUR</span><span>Target unit, EUR/pc</span><span>Accounting total, EUR</span><span>Accounting unit, EUR/pc</span><span>Premium, EUR/pc</span></div>
                {quantityBreakResults.map((item) => (
                  <div className="tableRow quantityBreakRow" key={item.quantity}>
                    <span>{item.quantity}{item.materialScaledLinearly ? <em className="scaledNote" title="No cutoff data for this material: stock pieces were scaled linearly from the main quantity, not cutoff-optimized."> (material scaled linearly)</em> : null}</span>
                    <span>{money.format(item.target.sell_price_eur)}</span>
                    <span>{money.format(item.target.unit_sell_price_eur)}</span>
                    <span>{money.format(item.accounting.sell_price_eur)}</span>
                    <span>{money.format(item.accounting.unit_sell_price_eur)}</span>
                    <span>{money.format(item.accounting.unit_sell_price_eur - item.target.unit_sell_price_eur)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="quoteGrid">
              <div className="panel">
                <div className="sectionHeader">
                  <h2>STEP and CAM</h2>
                  <Upload size={18} />
                </div>
                <div className="uploadBox">
                  <input id="cad-file" type="file" accept=".step,.stp" onChange={(event) => setCadFile(event.target.files?.[0] ?? null)} />
                  <label className="uploadLabel" htmlFor="cad-file">{cadFile ? cadFile.name : "Select .step or .stp file"}</label>
                </div>
                <label className="checkRow">
                  <input type="checkbox" checked={isNewPart} onChange={(event) => setIsNewPart(event.target.checked)} />
                  <span>New part, CAM program required</span>
                </label>
                <div className="fieldGrid compact">
                  <label>
                    Complexity
                    <select value={camComplexity} onChange={(event) => {
                      const next = event.target.value;
                      setCamComplexity(next);
                      if (assumptions) {
                        const key = `${next}_programming_minutes` as keyof Assumptions["cam_programming_defaults"];
                        const minutes = assumptions.cam_programming_defaults[key];
                        if (typeof minutes === "number") setProgrammingMinutes(minutes);
                      }
                    }}>
                      <option value="simple">Simple</option>
                      <option value="medium">Medium</option>
                      <option value="complex">Complex</option>
                    </select>
                  </label>
                  <label>CAM rate, EUR/h<input type="number" min="0" value={programmingRate} onChange={(event) => setProgrammingRate(numericValue(event.target.value))} /></label>
                  <label>Programming, min<input type="number" min="0" value={programmingMinutes} onChange={(event) => setProgrammingMinutes(numericValue(event.target.value))} /></label>
                  <label>Prove-out, min<input type="number" min="0" value={proveoutMinutes} onChange={(event) => setProveoutMinutes(numericValue(event.target.value))} /></label>
                </div>
              </div>

              <div className="panel">
                <div className="sectionHeader"><h2>Assumptions</h2></div>
                <ul className="noteList">
                  <li>{isNewPart ? "Full CAM cost is included." : `Existing CAM program reuse reduces CAM cost by ${formatPercent(reusableProgramPercent)}%.`}</li>
                  <li>STEP geometry is stored as metadata; geometry parsing is a later estimator layer.</li>
                  <li>{rateMode === "target_competitive" ? "Target machine rates are used for quote pricing." : "Accounting full-cost machine rates are used for quote pricing."}</li>
                  <li>{missingToolChecks.length > 0 ? `Missing tools add ${money.format(totalMissingToolCost)} as operation batch cost.` : "Required tools are available or no tool requirements are set."}</li>
                  {selectedResult?.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            </section>

            <section className="operations camOperationPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>Engineering Operation</h2>
                  <p className="sectionHelp">CAM/programming is shown as a route step because it consumes skilled labor before production starts. Repeat parts keep the same row but apply reusable-program reduction.</p>
                </div>
              </div>
              <div className="operationTable">
                <div className="tableHead camOperationHead"><span>Operation</span><span>Basis</span><span>Gross min</span><span>Reusable reduction</span><span>Cost, EUR</span></div>
                <div className="tableRow camOperationRow">
                  <span>{isNewPart ? "New-part CAM/programming" : "Repeat-part CAM review"}</span>
                  <span>{camComplexity} complexity at {money.format(programmingRate)}/h</span>
                  <span>{programmingMinutes + proveoutMinutes}</span>
                  <span>{formatPercent(reusableProgramPercent)}%</span>
                  <span>{selectedResult ? money.format(selectedResult.engineering_cost_eur) : "..."}</span>
                </div>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Operations</h2>
                  <p className="sectionHelp">Add operations from Resources templates. Rates are pulled from selected machine and labor classes.</p>
                </div>
                <div className="buttonRow addOperationControls">
                  <select value={selectedTemplateType} onChange={(event) => setSelectedTemplateType(event.target.value)}>
                    {(assumptions?.operation_templates ?? []).map((template) => (
                      <option key={template.operation_type} value={template.operation_type}>{operationLabel(template.operation_type)}</option>
                    ))}
                  </select>
                  <button className="primaryButton" onClick={addOperation}><Plus size={16} /> Add</button>
                </div>
              </div>

              <div className="operationEditor">
                <div className="operationEditorHead">
                  <span>Operation</span><span>Resources</span><span>Setup, min</span><span>Cycle, min/part</span><span>Variable, EUR</span><span>Scrap, %</span><span></span>
                </div>
                {quoteOperations.map((operation, index) => {
                  const selectedMachineRate = machineRate(operation.machineClassId, rateMode);
                  const selectedLaborRate = laborRate(operation.laborClassId);
                  return (
                    <div className="operationEditorRow" key={operation.id}>
                      <div className="stackedFields">
                        <label>Template<select value={operation.operationType} onChange={(event) => changeOperationTemplate(index, event.target.value)}>{(assumptions?.operation_templates ?? []).map((template) => <option key={template.operation_type} value={template.operation_type}>{operationLabel(template.operation_type)}</option>)}</select></label>
                        <label>Name<input value={operation.name} onChange={(event) => updateQuoteOperation(index, { name: event.target.value })} /></label>
                      </div>
                      <div className="stackedFields">
                        <label>Machine<select value={operation.machineClassId ?? ""} onChange={(event) => updateQuoteOperation(index, { machineClassId: event.target.value || null })}><option value="">No machine</option>{(assumptions?.machine_classes ?? []).map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
                        <label>Labor<select value={operation.laborClassId ?? ""} onChange={(event) => updateQuoteOperation(index, { laborClassId: event.target.value || null })}><option value="">No labor</option>{(assumptions?.labor_classes ?? []).map((labor) => <option key={labor.id} value={labor.id}>{labor.name}</option>)}</select></label>
                        <span className="rateHint">{money.format(selectedMachineRate)}/h machine, {money.format(selectedLaborRate)}/h labor</span>
                      </div>
                      <div className="miniGrid">
                        <label>Machine, min<input type="number" min="0" value={operation.setupMachineMinutes} onChange={(event) => updateQuoteOperation(index, { setupMachineMinutes: numericValue(event.target.value) })} /></label>
                        <label>Labor, min<input type="number" min="0" value={operation.setupLaborMinutes} onChange={(event) => updateQuoteOperation(index, { setupLaborMinutes: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>Machine, min/part<input type="number" min="0" value={operation.runMachineMinutesPerPart} onChange={(event) => updateQuoteOperation(index, { runMachineMinutesPerPart: numericValue(event.target.value) })} /></label>
                        <label>Labor, min/part<input type="number" min="0" value={operation.runLaborMinutesPerPart} onChange={(event) => updateQuoteOperation(index, { runLaborMinutesPerPart: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>Tool, EUR/part<input type="number" min="0" value={operation.toolingCostPerPart} onChange={(event) => updateQuoteOperation(index, { toolingCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>Cons., EUR/part<input type="number" min="0" value={operation.consumablesCostPerPart} onChange={(event) => updateQuoteOperation(index, { consumablesCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>Out, EUR/part<input type="number" min="0" value={operation.outsourcedCostPerPart} onChange={(event) => updateQuoteOperation(index, { outsourcedCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>Out, EUR/batch<input type="number" min="0" value={operation.outsourcedBatchCost} onChange={(event) => updateQuoteOperation(index, { outsourcedBatchCost: numericValue(event.target.value) })} /></label>
                      </div>
                      <label>Scrap, %<input type="number" min="0" max="100" value={formatPercent(operation.scrapAllowancePercent)} onChange={(event) => updateQuoteOperation(index, { scrapAllowancePercent: numericValue(event.target.value) / 100 })} /></label>
                      <button className="iconButton" title="Remove operation" onClick={() => removeOperation(index)}><Trash2 size={18} /></button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Tool Check</h2>
                  <p className="sectionHelp">Required tools are matched against Resources tool inventory. Missing tool charges are added as operation batch cost.</p>
                </div>
                <strong>{missingToolChecks.length > 0 ? money.format(totalMissingToolCost) : "All available"}</strong>
              </div>
              <div className="toolCheckTable">
                <div className="tableHead toolCheckHead"><span>Operation</span><span>Requirement</span><span>Status</span><span>Charge mode</span><span>Quote cost</span></div>
                {currentToolChecks.length === 0 ? (
                  <div className="tableRow toolCheckRow"><span>No tool requirements set for this route.</span><span></span><span></span><span></span><span></span></div>
                ) : currentToolChecks.map((item) => (
                  <div className={`tableRow toolCheckRow ${item.status === "missing" ? "missingTool" : ""}`} key={`${item.operation.id}-${item.requirement.id}`}>
                    <span>{item.operation.name}</span>
                    <span>{toolRequirementLabel(item.requirement)}</span>
                    <span>{item.status === "available" ? `Available: ${item.matchedTool?.name}` : "Missing / not enough quantity"}</span>
                    <div className="miniGrid">
                      <select value={item.requirement.chargeMode} onChange={(event) => updateToolRequirement(item.operation.id, item.requirement.id, { chargeMode: event.target.value as ToolChargeMode })}>
                        <option value="charge_full">Charge full</option>
                        <option value="amortize">Amortize</option>
                        <option value="included">Ignore/include</option>
                      </select>
                      <input type="number" min="1" value={item.requirement.amortizationQuantity} onChange={(event) => updateToolRequirement(item.operation.id, item.requirement.id, { amortizationQuantity: Math.max(1, numericValue(event.target.value, 1)) })} />
                    </div>
                    <span>{money.format(item.quoteCostEur)}</span>
                  </div>
                ))}
              </div>
            </section>

            {selectedResult ? (
              <section className="operations">
                <div className="sectionHeader wide"><h2>Cost Breakdown</h2></div>
                <div className="operationTable">
                  <div className="tableHead breakdownHead"><span>Line</span><span>Total</span><span>Unit</span></div>
                  {selectedResult.lines.map((line) => (
                    <div className="tableRow breakdownRow" key={line.code}>
                      <span>{line.label}</span><span>{money.format(line.cost_eur)}</span><span>{money.format(line.unit_cost_eur)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Actuals Feedback</h2>
                  <p className="sectionHelp">Record production actuals after manufacturing and compare against quoted operation cost in the selected rate mode.</p>
                </div>
                <button className="secondaryButton" onClick={applyActualsToTemplates}>Apply to Templates</button>
              </div>
              <div className="actualsTable">
                <div className="tableHead actualsHead"><span>Operation</span><span>Actual setup, min</span><span>Actual cycle, min/part</span><span>Scrap, %</span><span>Quoted, EUR</span><span>Actual, EUR</span><span>Variance, EUR</span><span>Notes</span></div>
                {quoteOperations.map((operation) => {
                  const actual = ensureActualForOperation(operation);
                  const quotedCost = operationCost(operation, rateMode);
                  const actualCost = operationCost(operation, rateMode, actual);
                  return (
                    <div className="tableRow actualsRow" key={operation.id}>
                      <span>{operation.name}</span>
                      <div className="miniGrid">
                        <label>Machine<input type="number" min="0" value={actual.actualSetupMachineMinutes} onChange={(event) => updateActualOperation(operation.id, { actualSetupMachineMinutes: numericValue(event.target.value) })} /></label>
                        <label>Labor<input type="number" min="0" value={actual.actualSetupLaborMinutes} onChange={(event) => updateActualOperation(operation.id, { actualSetupLaborMinutes: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>Machine<input type="number" min="0" value={actual.actualRunMachineMinutesPerPart} onChange={(event) => updateActualOperation(operation.id, { actualRunMachineMinutesPerPart: numericValue(event.target.value) })} /></label>
                        <label>Labor<input type="number" min="0" value={actual.actualRunLaborMinutesPerPart} onChange={(event) => updateActualOperation(operation.id, { actualRunLaborMinutesPerPart: numericValue(event.target.value) })} /></label>
                      </div>
                      <input type="number" min="0" max="100" value={formatPercent(actual.actualScrapPercent)} onChange={(event) => updateActualOperation(operation.id, { actualScrapPercent: numericValue(event.target.value) / 100 })} />
                      <span>{money.format(quotedCost)}</span>
                      <span>{money.format(actualCost)}</span>
                      <span>{money.format(actualCost - quotedCost)}</span>
                      <input value={actual.notes} onChange={(event) => updateActualOperation(operation.id, { notes: event.target.value })} />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}

        {activeView === "client_portal" ? (
          <section className="clientPortal">
            <section className="panel portalHeaderPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>Client RFQ Intake</h2>
                  <p className="sectionHelp">Customer-facing demo: clients upload STEP models and drawings/specifications, define order requirements, and receive one preliminary estimate before manual confirmation.</p>
                </div>
                <button className="primaryButton" onClick={calculatePortalEstimates}><Calculator size={16} /> Calculate Preliminary Estimate</button>
              </div>
              <div className="portalNotice">
                <strong>STEP alone is not enough for a reliable manufacturing price.</strong>
                <span>We also need drawing/specification data for tolerances, material, threads, surface finish, heat treatment, inspection reports, and delivery expectations. Missing information widens the estimate range and lowers confidence.</span>
              </div>
              <div className="fieldGrid compact">
                <label>Customer/company<input value={portalCustomerName} onChange={(event) => setPortalCustomerName(event.target.value)} /></label>
                <label>Contact/email<input value={portalContact} onChange={(event) => setPortalContact(event.target.value)} /></label>
                <label>Upload STEP files<input type="file" multiple accept=".step,.stp" onChange={(event) => addPortalFiles(event.target.files)} /></label>
                <label>RFQ status<input readOnly value="Preliminary estimate, manual confirmation required" /></label>
              </div>
              <div className="buttonRow portalButtons">
                <button className="secondaryButton" onClick={addBlankPortalPart}><Plus size={16} /> Add Part Manually</button>
              </div>
              <p className="statusText">{portalStatus}</p>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>RFQ Parts</h2>
                  <p className="sectionHelp">The client sees requirements and one preliminary estimate. Internal target/accounting rates, stock-piece quantity, and complexity assumptions stay hidden.</p>
                </div>
              </div>
              <div className="portalPartTable">
                <div className="tableHead portalPartHead"><span>Files and quantity</span><span>Manufacturing requirements</span><span>Material and finish</span><span>Readiness</span><span>Preliminary estimate</span><span></span></div>
                {portalParts.map((part) => {
                  const estimate = portalEstimates[part.id];
                  const issues = estimate?.readinessIssues ?? portalReadinessIssues(part);
                  const inferredComplexity = inferredPortalComplexity(part);
                  return (
                    <div className="tableRow portalPartRow" key={part.id}>
                      <div className="stackedFields">
                        <label>Part name<input value={part.partName} onChange={(event) => updatePortalPart(part.id, { partName: event.target.value })} /></label>
                        <label>STEP model<input value={part.fileName || "Missing STEP model"} readOnly /></label>
                        <label>Drawing/spec file<input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) updatePortalPart(part.id, { drawingFileName: file.name, drawingSizeBytes: file.size });
                        }} /></label>
                        {part.drawingFileName ? <span className="rateHint">Drawing/spec: {part.drawingFileName}</span> : <span className="rateHint warningHint">Drawing/spec missing</span>}
                        <div className="miniGrid">
                          <label>Order qty, pcs<input type="number" min="1" value={part.quantity} onChange={(event) => updatePortalPart(part.id, { quantity: Math.max(1, numericValue(event.target.value, 1)) })} /></label>
                          <label>Annual qty, pcs<input type="number" min="0" value={part.annualVolume} onChange={(event) => updatePortalPart(part.id, { annualVolume: Math.max(0, numericValue(event.target.value, 0)) })} /></label>
                        </div>
                      </div>
                      <div className="stackedFields">
                        <label>Tolerance requirement<select value={part.toleranceRequirement} onChange={(event) => updatePortalPart(part.id, { toleranceRequirement: event.target.value as PortalPart["toleranceRequirement"] })}>
                          <option value="standard">General standard tolerances</option>
                          <option value="drawing">According to drawing</option>
                          <option value="custom">Custom / tight tolerances</option>
                        </select></label>
                        <label>Inspection/documentation<select value={part.documentationRequirement} onChange={(event) => updatePortalPart(part.id, { documentationRequirement: event.target.value as PortalPart["documentationRequirement"] })}>
                          <option value="standard">Standard inspection</option>
                          <option value="dimensional_report">Dimensional report</option>
                          <option value="full_fai">Full FAI / first article</option>
                        </select></label>
                        <label>Threads/inserts<select value={part.threadOrInsertRequirement} onChange={(event) => updatePortalPart(part.id, { threadOrInsertRequirement: event.target.value as PortalPart["threadOrInsertRequirement"] })}>
                          <option value="unknown">Unknown / see drawing</option>
                          <option value="none">No</option>
                          <option value="yes">Yes</option>
                        </select></label>
                        <label>Delivery need<select value={part.deliveryRequirement} onChange={(event) => updatePortalPart(part.id, { deliveryRequirement: event.target.value as PortalPart["deliveryRequirement"] })}>
                          <option value="standard">Standard lead time</option>
                          <option value="expedite">Expedite if possible</option>
                          <option value="date_critical">Date critical</option>
                        </select></label>
                      </div>
                      <div className="stackedFields">
                        <label>Material<select value={part.materialId} onChange={(event) => {
                          const material = assumptions?.material_examples.find((item) => item.id === event.target.value);
                          updatePortalPart(part.id, {
                            materialId: event.target.value,
                            materialRequirement: material?.material_grade || material?.name || part.materialRequirement,
                            stockName: material?.stock_description || material?.name || part.stockName,
                            stockCost: material?.stock_piece_cost_eur ?? part.stockCost
                          });
                        }}>
                          <option value="">Manual material / specified on drawing</option>
                          {(assumptions?.material_examples ?? []).map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                        </select></label>
                        <label>Material note<input value={part.materialRequirement} placeholder="e.g. EN AW-6082 T6, S355, AISI 304" onChange={(event) => updatePortalPart(part.id, { materialId: "", materialRequirement: event.target.value, stockName: event.target.value || part.stockName })} /></label>
                        <div className="miniGrid">
                          <label>Cut length, mm<input type="number" min="1" value={part.cutLengthMm} onChange={(event) => updatePortalPart(part.id, { cutLengthMm: Math.max(1, numericValue(event.target.value, 100)) })} /></label>
                          {portalSelectedMaterial(part)?.stock_shape === "plate" ? (
                            <label>Cut width, mm<input type="number" min="1" value={part.cutWidthMm} onChange={(event) => updatePortalPart(part.id, { cutWidthMm: Math.max(1, numericValue(event.target.value, 100)) })} /></label>
                          ) : null}
                        </div>
                        <label>Surface finish / treatment<input value={part.surfaceFinish} onChange={(event) => updatePortalPart(part.id, { surfaceFinish: event.target.value })} /></label>
                        <label>Notes<textarea value={part.notes} onChange={(event) => updatePortalPart(part.id, { notes: event.target.value })} /></label>
                      </div>
                      <div className="portalReadinessBox">
                        <strong>{issues.length === 0 ? "Ready for review" : "Needs information"}</strong>
                        <span>Internal complexity estimate: {operationLabel(inferredComplexity)}</span>
                        <span>Internal stock pieces required: {portalStockPiecesRequired(part)} (from cut length/width vs. stock dimensions)</span>
                        {issues.length > 0 ? (
                          <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                        ) : <span>No major RFQ gaps detected.</span>}
                        <button
                          type="button"
                          className="linkButton"
                          onClick={() => setExpandedPortalDetails((current) => ({ ...current, [part.id]: !(current[part.id] ?? false) }))}
                        >
                          {expandedPortalDetails[part.id] ? "Hide internal pricing detail" : "Show internal pricing detail"}
                        </button>
                        {expandedPortalDetails[part.id] ? (() => {
                          const factors = portalAdjustmentFactors(part);
                          const toolChecks = portalToolCheckResults(part);
                          const missingTools = toolChecks.filter((check) => check.status === "missing");
                          const repeatSavings = portalRepeatOrderCamSavingsEur(part);
                          const accountingSellPrice = estimate?.accountingSellPriceEur;
                          const targetSellPrice = estimate?.result.sell_price_eur;
                          const accountingGapPercent = accountingSellPrice && targetSellPrice && targetSellPrice > 0
                            ? Math.round(((accountingSellPrice - targetSellPrice) / targetSellPrice) * 100)
                            : null;
                          return (
                            <div className="portalInternalDetail">
                              <div>
                                <strong>Rate mode: Target (assumes {formatPercent(averageTargetUtilization(assumptions))}% shop Utilization scenario)</strong>
                                <span>This preliminary price uses the Target rate, not today's Accounting rate. It is an aspiration, not current capacity.</span>
                              </div>
                              {accountingSellPrice !== undefined && accountingGapPercent !== null ? (
                                <div className={accountingGapPercent > 25 ? "warningHint" : ""}>
                                  <strong>Accounting cross-check: {money.format(accountingSellPrice)}</strong>
                                  <span>{accountingGapPercent}% above the Target price shown to the client, reflecting today's actual Utilization. A large gap means today's real capacity cannot yet support this price without more orders.</span>
                                </div>
                              ) : null}
                              <div>
                                <strong>Adjustment factors applied</strong>
                                <span>Complexity ({factors.complexity}) x{factors.complexityFactor.toFixed(2)}, Tolerance x{factors.toleranceFactor.toFixed(2)}, QC x{factors.qcFactor.toFixed(2)}, Delivery x{factors.deliveryFactor.toFixed(2)} -- combined x{factors.combined.toFixed(2)} (QC x{factors.qcFactor.toFixed(2)} applies to inspection operations only, not included in "combined"). These are heuristic placeholders, not calibrated against actuals.</span>
                              </div>
                              <div>
                                <strong>Tool check: {missingTools.length === 0 ? "all required tools available" : `${missingTools.length} missing`}</strong>
                                {missingTools.length > 0 ? (
                                  <ul>{missingTools.map((check) => <li key={check.requirement.id}>{toolRequirementLabel(check.requirement)}: {money.format(check.costEur)}</li>)}</ul>
                                ) : null}
                              </div>
                              {repeatSavings !== null ? (
                                <div>
                                  <strong>Repeat-order CAM savings estimate: {money.format(repeatSavings)}</strong>
                                  <span>Informational only, based on declared annual volume -- this order still carries full new-part CAM cost above.</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })() : null}
                      </div>
                      <div className="portalResultBox">
                        <span>Indicative unit price</span>
                        <strong>{estimate ? `${money.format(estimate.lowUnitEur)} - ${money.format(estimate.highUnitEur)}` : "..."}</strong>
                        <span>Estimated order total</span>
                        <strong>{estimate ? `${money.format(estimate.lowTotalEur)} - ${money.format(estimate.highTotalEur)}` : "..."}</strong>
                        <small>{estimate ? estimate.confidence : "Not calculated"}</small>
                        <small className="portalDisclaimer">Preliminary estimate only, subject to engineering confirmation. The confirmed price may differ materially from this range once drawing, material, tolerance, tooling, and capacity are reviewed.</small>
                        <button type="button" className="secondaryButton" onClick={() => sendPortalPartToQuoteBuilder(part)}>Send to Quote Builder</button>
                      </div>
                      <button className="iconButton" title="Remove part" onClick={() => removePortalPart(part.id)}><Trash2 size={18} /></button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="scenarioStrip portalTotals">
              <div>
                <span className="scenarioLabel">Parts</span>
                <strong>{portalParts.length}</strong>
                <span className="scenarioHint">Uploaded or manually entered.</span>
              </div>
              <div>
                <span className="scenarioLabel">Estimated total, EUR</span>
                <strong>{Object.values(portalEstimates).length > 0 ? `${money.format(Object.values(portalEstimates).reduce((sum, item) => sum + item.lowTotalEur, 0))} - ${money.format(Object.values(portalEstimates).reduce((sum, item) => sum + item.highTotalEur, 0))}` : "..."}</strong>
                <span className="scenarioHint">Single preliminary range shown to the client.</span>
              </div>
              <div>
                <span className="scenarioLabel">Confidence</span>
                <strong>{Object.values(portalEstimates).some((item) => item.readinessIssues.length > 0) ? "Needs review" : Object.values(portalEstimates).length > 0 ? "Review-ready" : "Not calculated"}</strong>
                <span className="scenarioHint">Final CO requires engineering and material confirmation.</span>
              </div>
            </section>
          </section>
        ) : null}

        {activeView === "resources" && resourceSubView === "values" && assumptions ? (
          <>
            <section className="quoteGrid">
              <div className="panel">
                <div className="sectionHeader"><h2>Commercial Policy</h2></div>
                <div className="fieldGrid">
                  <label>Margin %<input type="number" min="0" max="99" value={formatPercent(assumptions.commercial_policy.default_margin_percent)} onChange={(event) => updateCommercialField("default_margin_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>Risk allowance %<input type="number" min="0" value={formatPercent(assumptions.commercial_policy.risk_allowance_percent)} onChange={(event) => updateCommercialField("risk_allowance_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>Minimum admin cost<input type="number" min="0" value={assumptions.commercial_policy.minimum_order_admin_cost_eur} onChange={(event) => updateCommercialField("minimum_order_admin_cost_eur", numericValue(event.target.value))} /></label>
                </div>
              </div>
              <div className="panel">
                <div className="sectionHeader"><h2>Client Portal Range</h2></div>
                <p className="sectionHelp">Editable, not hardcoded -- widened asymmetrically pending calibration against actuals.</p>
                <div className="fieldGrid">
                  <label>Low factor (x sell price)<input type="number" min="0.01" max="1" step="0.01" value={assumptions.client_portal?.range_low_factor ?? 0.85} onChange={(event) => updateClientPortalField("range_low_factor", Math.max(0.01, numericValue(event.target.value, 0.85)))} /></label>
                  <label>High factor (x sell price)<input type="number" min="1" step="0.01" value={assumptions.client_portal?.range_high_factor ?? 1.35} onChange={(event) => updateClientPortalField("range_high_factor", Math.max(1, numericValue(event.target.value, 1.35)))} /></label>
                  <label>Annual-volume relief %<input type="number" min="0" max="100" value={formatPercent(assumptions.client_portal?.annual_volume_relief_percent ?? 0.92)} onChange={(event) => updateClientPortalField("annual_volume_relief_percent", numericValue(event.target.value, 92) / 100)} /></label>
                </div>
              </div>
              <div className="panel">
                <div className="sectionHeader"><h2>CAM Defaults</h2></div>
                <div className="fieldGrid">
                  <label>Repeat reuse %<input type="number" min="0" max="100" value={formatPercent(assumptions.cam_programming_defaults.repeat_part_reusable_program_percent)} onChange={(event) => updateCamField("repeat_part_reusable_program_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>Prove-out, min<input type="number" min="0" value={assumptions.cam_programming_defaults.default_setup_proveout_minutes} onChange={(event) => updateCamField("default_setup_proveout_minutes", numericValue(event.target.value))} /></label>
                  <label>Simple min<input type="number" min="0" value={assumptions.cam_programming_defaults.simple_programming_minutes} onChange={(event) => updateCamField("simple_programming_minutes", numericValue(event.target.value))} /></label>
                  <label>Medium min<input type="number" min="0" value={assumptions.cam_programming_defaults.medium_programming_minutes} onChange={(event) => updateCamField("medium_programming_minutes", numericValue(event.target.value))} /></label>
                  <label>Complex min<input type="number" min="0" value={assumptions.cam_programming_defaults.complex_programming_minutes} onChange={(event) => updateCamField("complex_programming_minutes", numericValue(event.target.value))} /></label>
                </div>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Overhead Allocation</h2>
                  <p className="sectionHelp">
                    Admin, sales, quality management, and facility costs that sit outside any single machine or direct labor rate.
                    Enter one total; choose how it reaches quotes. Both readouts below are derived from the same total, so switching methods stays comparable.
                  </p>
                </div>
                <button className="primaryButton" onClick={addOverheadItem}><Plus size={16} /> Add Item</button>
              </div>
              <div className="fieldGrid" style={{ marginBottom: 12 }}>
                <label>
                  Allocation method
                  <select
                    value={assumptions.overhead?.allocation_method ?? "per_machine_hour"}
                    onChange={(event) => updateOverheadMethod(event.target.value as OverheadAllocation["allocation_method"])}
                  >
                    <option value="per_machine_hour">Per machine hour (added into machine EUR/h)</option>
                    <option value="percent_of_cost">Percent of production cost (coefficient)</option>
                  </select>
                </label>
                <label>
                  Total monthly overhead
                  <input readOnly value={money.format(totalMonthlyOverheadEur(assumptions))} />
                </label>
                <label>
                  Equivalent EUR/h at target
                  <input readOnly value={money.format(overheadPerMachineHour(assumptions, "target_availability_percent", "target_utilization_percent"))} />
                </label>
                <label>
                  Equivalent % of cost at target
                  <input readOnly value={`${(overheadPercentEquivalent(assumptions, "target_availability_percent", "target_utilization_percent") * 100).toFixed(1)}%`} />
                </label>
              </div>
              <div className="resourceTable">
                <div className="tableHead"><span>Expense</span><span>Monthly EUR</span><span>Quality</span><span></span></div>
                {(assumptions.overhead?.monthly_items ?? []).map((item, index) => (
                  <div className="tableRow" key={item.id}>
                    <input value={item.name} onChange={(event) => updateOverheadItem(index, "name", event.target.value)} />
                    <input type="number" min="0" value={item.monthly_cost_eur} onChange={(event) => updateOverheadItem(index, "monthly_cost_eur", numericValue(event.target.value))} />
                    <input value={item.quality} onChange={(event) => updateOverheadItem(index, "quality", event.target.value)} />
                    <button className="iconButton" onClick={() => removeOverheadItem(index)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Labor Classes</h2>
                  <p className="sectionHelp">Enter labor as direct hourly cost or calculate it from gross monthly salary plus Latvian employer VSAOI.</p>
                </div>
              </div>
              <div className="resourceTable laborTable">
                <div className="tableHead laborHead"><span>Name</span><span>Method</span><span>Direct EUR/h</span><span>Gross/month</span><span>Employer tax %</span><span>Paid h/month</span><span>Derived EUR/h</span><span>Quality</span></div>
                {assumptions.labor_classes.map((labor, index) => (
                  <div className="tableRow laborRow" key={labor.id}>
                    <input value={labor.name} onChange={(event) => updateLabor(index, "name", event.target.value)} />
                    <select value={labor.cost_method ?? "direct_hourly"} onChange={(event) => updateLabor(index, "cost_method", event.target.value)}>
                      <option value="direct_hourly">Direct hourly</option>
                      <option value="gross_monthly">Gross salary</option>
                    </select>
                    <input type="number" min="0" value={labor.employer_cost_per_hour_eur} onChange={(event) => updateLabor(index, "employer_cost_per_hour_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={labor.gross_monthly_salary_eur ?? 0} onChange={(event) => updateLabor(index, "gross_monthly_salary_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" max="100" value={formatPercent(labor.employer_social_contribution_rate ?? assumptions.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359)} onChange={(event) => updateLabor(index, "employer_social_contribution_rate", numericValue(event.target.value) / 100)} />
                    <input type="number" min="1" value={labor.paid_hours_per_month ?? assumptions.payroll_tax_defaults?.paid_hours_per_month ?? 160} onChange={(event) => updateLabor(index, "paid_hours_per_month", Math.max(1, numericValue(event.target.value, 160)))} />
                    <input readOnly value={deriveLaborHourlyCost(labor, assumptions)} />
                    <input value={labor.quality} onChange={(event) => updateLabor(index, "quality", event.target.value)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Machine Rate Calculator</h2>
                  <p className="sectionHelp">Availability is the share of scheduled time the machine is actually up and running; Utilization is how much of available time actually gets loaded with orders. OEE (availability x performance x quality) is shown alongside as a diagnostic only -- performance losses already live in cycle/setup minutes and quality losses in the scrap allowance, so only Availability scales the rate, to avoid double-counting them. Idleness (1 - Utilization) is the empty-order gap. Formula: fixed cost / (planned hours x Utilization x Availability) + variable cost {assumptions.overhead?.allocation_method === "per_machine_hour" ? "+ overhead EUR/h" : ""}.</p>
                </div>
              </div>
              <div className="resourceTable machineRateTable">
                <div className="tableHead machineRateHead">
                  <span>Name</span><span>Fixed cost EUR/month</span><span>Planned h/month</span>
                  <span>Actual Availability %</span><span>Target Availability %</span>
                  <span>Actual OEE % (diagnostic)</span><span>Target OEE % (diagnostic)</span>
                  <span>Actual Utilization %</span><span>Target Utilization %</span>
                  <span>Variable EUR/h</span><span>Target discount %</span>
                  <span>Accounting EUR/h</span><span>Target EUR/h</span><span>Power kW</span>
                </div>
                {assumptions.machine_classes.map((machine, index) => {
                  const actualUtilization = machine.actual_utilization_percent ?? 1;
                  const targetUtilization = machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT;
                  const actualIdle = idlenessPercent(actualUtilization);
                  const targetIdle = idlenessPercent(targetUtilization);
                  const helperOpen = expandedFixedCostHelpers[machine.id] ?? false;
                  return (
                    <div className="tableRow machineRateRow" key={machine.id}>
                      <input value={machine.name} onChange={(event) => updateMachine(index, "name", event.target.value)} />
                      <input type="number" min="0" value={machine.monthly_fixed_cost_eur ?? 0} onChange={(event) => updateMachine(index, "monthly_fixed_cost_eur", numericValue(event.target.value))} />
                      <input type="number" min="1" value={machine.planned_hours_per_month ?? 160} onChange={(event) => updateMachine(index, "planned_hours_per_month", Math.max(1, numericValue(event.target.value, 160)))} />
                      <input type="number" min="1" max="100" value={formatPercent(availabilityValue(machine, "actual_availability_percent"))} onChange={(event) => updateMachine(index, "actual_availability_percent", Math.max(0.01, numericValue(event.target.value, 80) / 100))} />
                      <input type="number" min="1" max="100" value={formatPercent(availabilityValue(machine, "target_availability_percent"))} onChange={(event) => updateMachine(index, "target_availability_percent", Math.max(0.01, numericValue(event.target.value, 90) / 100))} />
                      <input type="number" min="1" max="100" value={formatPercent(machine.actual_oee_percent)} onChange={(event) => updateMachine(index, "actual_oee_percent", Math.max(0.01, numericValue(event.target.value, 1) / 100))} />
                      <input type="number" min="1" max="100" value={formatPercent(machine.target_oee_percent)} onChange={(event) => updateMachine(index, "target_oee_percent", Math.max(0.01, numericValue(event.target.value, 1) / 100))} />
                      <div className="utilizationCell">
                        <input type="number" min="1" max="100" value={formatPercent(actualUtilization)} onChange={(event) => updateMachine(index, "actual_utilization_percent", Math.max(0.01, numericValue(event.target.value, 1) / 100))} />
                        <UtilizationBar utilization={actualUtilization} />
                        <span className={`idlenessHint ${actualIdle === 0 ? "zero" : ""}`}>Idle {formatPercent(actualIdle)}%</span>
                      </div>
                      <div className="utilizationCell">
                        <input type="number" min="1" max="100" value={formatPercent(targetUtilization)} onChange={(event) => updateMachine(index, "target_utilization_percent", Math.max(0.01, numericValue(event.target.value, DEFAULT_TARGET_UTILIZATION_PERCENT * 100) / 100))} />
                        <UtilizationBar utilization={targetUtilization} />
                        <span className={`idlenessHint ${targetIdle === 0 ? "zero" : ""}`}>Idle {formatPercent(targetIdle)}%</span>
                      </div>
                      <input type="number" min="0" value={machine.variable_cost_eur_per_hour ?? 0} onChange={(event) => updateMachine(index, "variable_cost_eur_per_hour", numericValue(event.target.value))} />
                      <input type="number" min="0" max="90" value={formatPercent(machine.target_rate_discount_percent ?? 0)} onChange={(event) => updateMachine(index, "target_rate_discount_percent", Math.min(0.9, numericValue(event.target.value) / 100))} />
                      <input readOnly value={machine.accounting_full_cost_rate_eur_per_hour} />
                      <input readOnly value={machine.target_competitive_rate_eur_per_hour} />
                      <input type="number" min="0" value={machine.loaded_power_kw} onChange={(event) => updateMachine(index, "loaded_power_kw", numericValue(event.target.value))} />
                      <div className="fixedCostToggle">
                        <button
                          type="button"
                          className="linkButton"
                          onClick={() => setExpandedFixedCostHelpers((current) => ({ ...current, [machine.id]: !helperOpen }))}
                        >
                          {helperOpen ? "Hide" : "Estimate fixed cost from purchase price"}
                        </button>
                      </div>
                      {helperOpen ? (
                        <div className="fixedCostHelper">
                          <label>
                            Purchase price EUR
                            <input type="number" min="0" value={machine.purchase_price_eur ?? 0} onChange={(event) => updateMachine(index, "purchase_price_eur", numericValue(event.target.value))} />
                          </label>
                          <label>
                            Useful life, years
                            <input type="number" min="1" value={machine.useful_life_years ?? 10} onChange={(event) => updateMachine(index, "useful_life_years", Math.max(1, numericValue(event.target.value, 10)))} />
                          </label>
                          <label>
                            Salvage %
                            <input type="number" min="0" max="90" value={formatPercent(machine.salvage_percent ?? 0)} onChange={(event) => updateMachine(index, "salvage_percent", Math.min(0.9, numericValue(event.target.value) / 100))} />
                          </label>
                          <label>
                            Other fixed cost EUR/month
                            <input type="number" min="0" value={machine.other_monthly_fixed_cost_eur ?? 0} onChange={(event) => updateMachine(index, "other_monthly_fixed_cost_eur", numericValue(event.target.value))} />
                          </label>
                          <div>
                            <div className="suggestedValue">Suggested: {money.format(suggestedFixedCostFromPurchase(machine))}/mo</div>
                            <button type="button" className="secondaryButton" onClick={() => applySuggestedFixedCost(index)}>Apply</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Material Library</h2>
                  <p className="sectionHelp">Stock pieces used in quote material selection. Costs should represent purchasable stock, not theoretical net part material.</p>
                </div>
                <button className="primaryButton" onClick={addMaterial}><Plus size={16} /> Add Material</button>
              </div>
              <div className="resourceTable materialTable">
                <div className="tableHead materialHead"><span>Name</span><span>Grade</span><span>Stock description</span><span>Cost</span><span>Shape</span><span>Length mm</span><span>Width mm</span><span>Kerf mm</span><span>Supplier</span><span>MOQ</span><span>Scrap rec. %</span><span>Quality</span></div>
                {assumptions.material_examples.map((material, index) => (
                  <div className="tableRow materialRow" key={material.id}>
                    <input value={material.name} onChange={(event) => updateMaterial(index, "name", event.target.value)} />
                    <input value={material.material_grade ?? ""} onChange={(event) => updateMaterial(index, "material_grade", event.target.value)} />
                    <input value={material.stock_description ?? ""} onChange={(event) => updateMaterial(index, "stock_description", event.target.value)} />
                    <input type="number" min="0" value={material.stock_piece_cost_eur} onChange={(event) => updateMaterial(index, "stock_piece_cost_eur", numericValue(event.target.value))} />
                    <select value={material.stock_shape ?? ""} onChange={(event) => updateMaterial(index, "stock_shape", event.target.value)}>
                      <option value="">Not set</option>
                      <option value="round_bar">Round bar</option>
                      <option value="hex_bar">Hex bar</option>
                      <option value="square_bar">Square bar</option>
                      <option value="tube">Tube</option>
                      <option value="plate">Plate</option>
                    </select>
                    <input type="number" min="0" value={material.stock_length_mm ?? 0} onChange={(event) => updateMaterial(index, "stock_length_mm", numericValue(event.target.value))} />
                    <input type="number" min="0" value={material.stock_width_mm ?? 0} onChange={(event) => updateMaterial(index, "stock_width_mm", numericValue(event.target.value))} disabled={material.stock_shape !== "plate"} />
                    <input type="number" min="0" value={material.kerf_mm ?? 0} onChange={(event) => updateMaterial(index, "kerf_mm", numericValue(event.target.value))} disabled={material.stock_shape === "plate"} />
                    <input value={material.supplier ?? ""} onChange={(event) => updateMaterial(index, "supplier", event.target.value)} />
                    <input type="number" min="0" value={material.minimum_order_quantity ?? 1} onChange={(event) => updateMaterial(index, "minimum_order_quantity", numericValue(event.target.value))} />
                    <input type="number" min="0" max="100" value={formatPercent(material.scrap_recovery_percent ?? 0)} onChange={(event) => updateMaterial(index, "scrap_recovery_percent", numericValue(event.target.value) / 100)} />
                    <input value={material.quality} onChange={(event) => updateMaterial(index, "quality", event.target.value)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Tool Inventory</h2>
                  <p className="sectionHelp">Simple cutter/tool library used by quote tool checks. Quantity zero is useful for missing-tool demo cases.</p>
                </div>
                <button className="primaryButton" onClick={addTool}><Plus size={16} /> Add Tool</button>
              </div>
              <div className="resourceTable toolInventoryTable">
                <div className="tableHead toolInventoryHead"><span>Name</span><span>Type</span><span>D mm</span><span>R mm</span><span>Materials</span><span>Qty</span><span>Cost</span><span>Lead days</span><span>Reusable</span><span>Quality</span></div>
                {(assumptions.tool_inventory ?? []).map((tool, index) => (
                  <div className="tableRow toolInventoryRow" key={tool.id}>
                    <input value={tool.name} onChange={(event) => updateTool(index, "name", event.target.value)} />
                    <input value={tool.type} onChange={(event) => updateTool(index, "type", event.target.value)} />
                    <input type="number" min="0" value={tool.diameter_mm} onChange={(event) => updateTool(index, "diameter_mm", numericValue(event.target.value))} />
                    <input type="number" min="0" value={tool.corner_radius_mm} onChange={(event) => updateTool(index, "corner_radius_mm", numericValue(event.target.value))} />
                    <input value={tool.material_groups.join(", ")} onChange={(event) => updateTool(index, "material_groups", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
                    <input type="number" min="0" value={tool.available_quantity} onChange={(event) => updateTool(index, "available_quantity", numericValue(event.target.value))} />
                    <input type="number" min="0" value={tool.replacement_cost_eur} onChange={(event) => updateTool(index, "replacement_cost_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={tool.lead_time_days} onChange={(event) => updateTool(index, "lead_time_days", numericValue(event.target.value))} />
                    <select value={tool.reusable ? "yes" : "no"} onChange={(event) => updateTool(index, "reusable", event.target.value === "yes")}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                    <input value={tool.quality} onChange={(event) => updateTool(index, "quality", event.target.value)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>Operation Templates</h2>
                  <p className="sectionHelp">Defaults used when adding operations to a quote. Tune these as measured setup and cycle history improves.</p>
                </div>
              </div>
              <div className="resourceTable operationTemplateTable">
                <div className="tableHead operationTemplateHead"><span>Operation</span><span>Machine</span><span>Labor</span><span>Setup M min</span><span>Setup L min</span><span>Cycle M min/pc</span><span>Cycle L min/pc</span><span>Tool EUR/part</span><span>Cons. EUR/part</span><span>Out EUR/part</span><span>Out EUR/batch</span><span>Scrap %</span></div>
                {assumptions.operation_templates.map((template, index) => (
                  <div className="tableRow operationTemplateRow" key={template.operation_type}>
                    <span>{operationLabel(template.operation_type)}</span>
                    <select value={template.default_machine_class_id ?? ""} onChange={(event) => updateOperationTemplate(index, "default_machine_class_id", event.target.value || null)}><option value="">No machine</option>{assumptions.machine_classes.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select>
                    <select value={template.default_labor_class_id ?? ""} onChange={(event) => updateOperationTemplate(index, "default_labor_class_id", event.target.value || null)}><option value="">No labor</option>{assumptions.labor_classes.map((labor) => <option key={labor.id} value={labor.id}>{labor.name}</option>)}</select>
                    <input type="number" min="0" value={template.default_setup_machine_minutes ?? 0} onChange={(event) => updateOperationTemplate(index, "default_setup_machine_minutes", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_setup_labor_minutes ?? 0} onChange={(event) => updateOperationTemplate(index, "default_setup_labor_minutes", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_run_machine_minutes_per_part ?? 0} onChange={(event) => updateOperationTemplate(index, "default_run_machine_minutes_per_part", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_run_labor_minutes_per_part ?? 0} onChange={(event) => updateOperationTemplate(index, "default_run_labor_minutes_per_part", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_tooling_cost_per_part_eur ?? 0} onChange={(event) => updateOperationTemplate(index, "default_tooling_cost_per_part_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_consumables_cost_per_part_eur ?? 0} onChange={(event) => updateOperationTemplate(index, "default_consumables_cost_per_part_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_outsourced_cost_per_part_eur ?? 0} onChange={(event) => updateOperationTemplate(index, "default_outsourced_cost_per_part_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={template.default_outsourced_batch_cost_eur ?? 0} onChange={(event) => updateOperationTemplate(index, "default_outsourced_batch_cost_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" max="100" value={formatPercent(template.default_scrap_allowance_percent ?? 0)} onChange={(event) => updateOperationTemplate(index, "default_scrap_allowance_percent", numericValue(event.target.value) / 100)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <h2>Full JSON</h2>
                <div className="buttonRow">
                  <button className="secondaryButton" onClick={applyJsonEditor}>Apply JSON</button>
                  <button className="primaryButton" onClick={saveAssumptions}><Save size={16} /> Save</button>
                </div>
              </div>
              <textarea className="jsonEditor" value={assumptionsText} onChange={(event) => { setAssumptionsText(event.target.value); setAssumptionStatus("JSON edited, not applied"); }} spellCheck={false} />
              <p className="statusText">{assumptionStatus}</p>
            </section>
          </>
        ) : null}

        {activeView === "resources" && resourceSubView === "explanations" ? (
          <section className="explanationGrid">
            <article className="panel explanationCard"><h2>Commercial Policy</h2><p>Commercial policy controls how production cost becomes a selling price. Margin is gross margin on the selling price, not a simple markup on cost. Risk allowance is extra cost added before margin for uncertain quotes. Minimum admin cost protects small orders from ignoring quotation, order handling, and document work.</p></article>
            <article className="panel explanationCard"><h2>CAM Defaults</h2><p>CAM defaults estimate engineering work before machining starts. New parts include programming and prove-out. Repeat parts reuse an existing program, so only a smaller review or adjustment cost should remain. Simple, medium, and complex minutes are starting assumptions and should be replaced with measured history.</p></article>
            <article className="panel explanationCard"><h2>Labor Classes</h2><p>Labor classes define the company cost of one hour of human work. Direct hourly cost is useful when accounting already has a loaded rate. Gross salary mode estimates hourly employer cost from monthly gross salary, employer VSAOI, and paid hours per month.</p><p>For Latvia, the default employer VSAOI is 23.59% for a standard employee insured for all social insurance types. The employee part is not added again because gross salary already represents the employee taxable pay base.</p></article>
            <article className="panel explanationCard"><h2>Material Library</h2><p>Material library entries represent purchasable stock pieces used for quoting. Use supplier stock dimensions and purchase cost, not theoretical net part material. Scrap recovery is optional and should be based on actual resale/reuse value where known.</p></article>
            <article className="panel explanationCard"><h2>Cutoff Calculator</h2><p>Stock comes in fixed dimensions (a 3m bar, a 6m tube, a 1500x3000mm plate), and a part rarely divides evenly into it. The Cutoff Calculator turns a required cut length (and cut width for plate) into how many whole stock units must actually be purchased, so unusable cutoff waste is priced in rather than assumed away. For linear stock (round/hex/square bar, tube), it divides stock length by cut length plus saw kerf. For plate, it is a rough area estimate (order area divided by usable sheet area at a fixed packing efficiency) -- not true 2D nesting with rotation and rectangle packing, so treat plate estimates as a rough band, not an exact cutting plan. Available in the Quote Builder RFQ panel and the Client Portal, both driven by the same Material Library stock dimensions.</p></article>
            <article className="panel explanationCard wideCard"><h2>Client Portal Methodology</h2><p>The client-facing preliminary estimate always prices at the <strong>Target</strong> rate (achievable OEE, a stress-testable Utilization scenario) so the client sees a competitive number, not today's under-loaded Accounting cost. "Show internal pricing detail" on each part reveals what stays hidden from the client: the Accounting cross-check (what the price would be if charged at today's actual Utilization -- a large gap is a reminder that this price assumes the shop wins more orders), the adjustment factors applied for complexity/tolerance/QC/delivery (hand-picked heuristics, not yet calibrated against actuals -- complexity no longer uses uploaded file size in bytes as a signal, since that reflects export settings rather than part complexity; its weight was redistributed across the remaining signals), a real Tool Inventory check for the assumed route including tapping when threads/inserts are requested, and an informational repeat-order CAM savings estimate when declared annual volume suggests future repeat business (this does not change the price of the current, necessarily new-part, order). "Send to Quote Builder" carries the RFQ into a real quote draft for the manual confirmation the portal promises -- before that button existed, a portal RFQ was a dead end once you left the tab.</p></article>
            <article className="panel explanationCard"><h2>Operation Templates</h2><p>Operation templates hold default setup time, cycle time, variable costs, and scrap assumptions used when adding quote operations. The Actuals Feedback action can copy measured production actuals into these defaults, but assumptions still need to be saved in Resources to persist.</p></article>
            <article className="panel explanationCard"><h2>Tool Inventory</h2><p>Tool inventory describes cutters, drills, taps, inserts, fixtures, and gauges that must exist before the part can be produced. If a required tool is missing, the quote should either charge the purchase cost, amortize it over expected future use, or explicitly show that management chose to ignore the cost.</p></article>
            <article className="panel explanationCard"><h2>Machine Classes</h2><p>Machine Rate Calculator shows how machine EUR/h is built. Accounting EUR/h uses actual Availability and actual Utilization. Target EUR/h uses target Availability, target Utilization (95% by default), and optional target discount. The formula is fixed monthly machine cost divided by productive hours (planned hours x Utilization x Availability) plus variable hourly cost, plus overhead EUR/h if that allocation method is selected. OEE is shown alongside as a diagnostic gauge only — it does not enter this formula, because performance losses already live in cycle/setup minutes and quality losses in the scrap allowance; multiplying by full OEE here would double-charge both.</p></article>
            <article className="panel explanationCard"><h2>Actual Availability % vs Actual Utilization %</h2><p>These answer two different questions. Actual Availability is the share of scheduled time the machine is actually up and running (not broken down, changed over, or blocked) during the time it is scheduled to work. Actual Utilization is how much of the available planned time actually gets loaded with orders at all. A machine can have good Availability and still sit idle most of the month if Utilization is low — that is a sales/load problem, not a machine problem. Both should describe a defined recent measurement window, normally the last 3 to 12 months. Actual OEE (availability x performance x quality) is still shown as a diagnostic gauge, but only Availability feeds the rate.</p></article>
            <article className="panel explanationCard"><h2>Target Availability % vs Target Utilization %</h2><p>Target Availability (seed: 90%) is the uptime level management believes is achievable with reduced unplanned downtime — a real availability improvement, not a performance or quality assumption (those live in cycle/setup times and scrap allowance). Target Utilization defaults to 95%: a near-fully-booked commercial ambition with a small buffer below theoretical capacity. Together they model a healthy, competitively loaded machine, not today's reality.</p></article>
            <article className="panel explanationCard"><h2>Idleness</h2><p>Idleness is <code>1 - Utilization</code> — the empty-order gap. It is not derived from OEE. A machine can be 0% idle (fully loaded with orders) and still have mediocre OEE if it runs poorly once loaded; conversely a machine can have excellent OEE and be 60% idle because there simply aren't enough orders. Keeping Idleness tied to Utilization, not OEE, prevents a real demand problem from being mistaken for a shop-floor performance problem.</p></article>
            <article className="panel explanationCard"><h2>Fixed Cost From Purchase Price</h2><p>The "Estimate fixed cost from purchase price" helper on each machine turns purchase price into a monthly figure using straight-line depreciation: <code>(purchase price x (1 - salvage %)) / (useful life years x 12)</code>, plus any other known monthly fixed cost (maintenance contract, floor/rent share, insurance, financing). This makes the previously opaque "Fixed cost EUR/month" box explainable and replaceable with a real number.</p></article>
            <article className="panel explanationCard"><h2>Overhead Allocation</h2><p>Overhead is admin, sales, quality management, and facility cost that sits outside any single machine or direct labor rate — real for a roughly 30-person company with 18-20 on the shop floor, and previously missing from this tool's formula entirely. Enter one total; choose how it reaches quotes: spread as EUR/h across total planned productive hours (folded into each machine's rate), or expressed as a % coefficient on production cost. Both readouts are derived from the same total, so switching methods stays comparable and nothing is double-counted.</p></article>
            <article className="panel explanationCard"><h2>Profitability Calculator</h2><p>A standalone "can we be profitable" check, independent of any single quote. Revenue and cost move independently, so this can actually show a loss: the sell rate EUR/h is fixed once, at target Utilization/Availability and the commercial policy (direct rate + overhead/h, grossed up by risk and margin) -- it is not re-derived from the scenario's own cost, which would make a loss mathematically impossible. Sold hours follow the shop-wide Utilization scenario you stress-test; revenue is sold hours x the fixed sell rate. Cost is the full monthly fixed cost (unchanged by the scenario) plus variable cost over sold hours, plus full monthly overhead (reusing the same Overhead Allocation expense list). The bridge shows gross profit or loss, plus the break-even Utilization that closes the gap.</p></article>
            <article className="panel explanationCard"><h2>Power kW</h2><p>Power should be average loaded consumption when available, ideally measured with a power analyzer during representative machining. If only the nameplate value is known, treat it as a conservative estimate and mark quality accordingly. Nominal installed power often overstates normal cutting consumption.</p></article>
            <article className="panel explanationCard"><h2>Full JSON</h2><p>The full JSON editor exposes every assumption, including values that do not yet have structured fields. Use it carefully: it is powerful, but invalid structure can break calculations or dropdowns. The Save button validates that required top-level sections still exist.</p></article>
            <article className="panel explanationCard wideCard"><h2>Latvian Payroll Rule Reference</h2><p>VID states that the standard mandatory social insurance contribution rate is 34.09%, split into 23.59% paid by the employer and 10.50% by the employee when the worker is insured for all social insurance types. This app uses the employer-side 23.59% as an editable default for gross salary based labor costing.</p><p>Source: https://www.vid.gov.lv/lv/valsts-socialas-apdrosinasanas-obligatas-iemaksas</p></article>
          </section>
        ) : null}

        {activeView === "resources" && resourceSubView === "values" && !assumptions ? <section className="panel"><p>{assumptionStatus}</p></section> : null}

        {activeView === "scenarios" ? (
          <section className="explanationGrid">
            <article className="panel explanationCard">
              <h2>Scenario Comparison</h2>
              <p>The quote screen now calculates target and accounting prices at the same time. The next persistence step will save these scenarios with the quote so old quote decisions remain explainable.</p>
            </article>
            <article className="panel explanationCard">
              <h2>Current Quote</h2>
              <p>Target: {targetResult ? money.format(targetResult.sell_price_eur) : "not calculated"}</p>
              <p>Accounting: {accountingResult ? money.format(accountingResult.sell_price_eur) : "not calculated"}</p>
              <p>Premium: {accountingResult && targetResult ? money.format(priceGap) : "not calculated"}</p>
            </article>
          </section>
        ) : null}

        {activeView === "profitability" && assumptions ? (
          <section className="casePage">
            <section className="panel caseHero">
              <h2>Can We Be Profitable?</h2>
              <p>Independent of any single quote: rough monthly department expenses, a stress-testable shop Utilization scenario, and the current commercial policy (margin, risk allowance) combine into an estimated monthly gross profit or loss. Everything here reuses the Overhead Allocation expense list from Resources and the Target OEE already set per machine — this only asks "what if Utilization reached X%?"</p>
            </section>

            <section className="quoteGrid">
              <div className="panel">
                <div className="sectionHeader"><h2>Department Monthly Expenses</h2></div>
                <p className="sectionHelp">Same list as Resources &gt; Overhead Allocation. Editing here updates it there too.</p>
                <div className="resourceTable">
                  <div className="tableHead"><span>Expense</span><span>Monthly EUR</span><span>Quality</span><span></span></div>
                  {(assumptions.overhead?.monthly_items ?? []).map((item, index) => (
                    <div className="tableRow" key={item.id}>
                      <input value={item.name} onChange={(event) => updateOverheadItem(index, "name", event.target.value)} />
                      <input type="number" min="0" value={item.monthly_cost_eur} onChange={(event) => updateOverheadItem(index, "monthly_cost_eur", numericValue(event.target.value))} />
                      <input value={item.quality} onChange={(event) => updateOverheadItem(index, "quality", event.target.value)} />
                      <button className="iconButton" onClick={() => removeOverheadItem(index)}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <button className="secondaryButton" style={{ marginTop: 10 }} onClick={addOverheadItem}><Plus size={16} /> Add Item</button>
              </div>

              <div className="panel">
                <div className="sectionHeader"><h2>Shop Utilization Scenario</h2></div>
                <p className="sectionHelp">Assumes achievable Target OEE per machine (already set in Resources). This slider is the free variable: "what if we won enough orders to load the shop to X%?"</p>
                <div className="fieldGrid">
                  <label>
                    Utilization scenario %
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formatPercent(profitabilityUtilization)}
                      onChange={(event) => setProfitabilityUtilization(Math.max(0.01, numericValue(event.target.value, 70) / 100))}
                    />
                  </label>
                  <label>
                    Margin % (from Commercial Policy)
                    <input readOnly value={formatPercent(assumptions.commercial_policy.default_margin_percent)} />
                  </label>
                  <label>
                    Risk allowance % (from Commercial Policy)
                    <input readOnly value={formatPercent(assumptions.commercial_policy.risk_allowance_percent)} />
                  </label>
                </div>
                <div className="scenarioButtons">
                  <button className="secondaryButton" onClick={() => setProfitabilityUtilization(averageActualUtilization(assumptions))}>Use current average ({formatPercent(averageActualUtilization(assumptions))}%)</button>
                  <button className="secondaryButton" onClick={() => setProfitabilityUtilization(1)}>Use 100% (fully booked)</button>
                </div>
              </div>
            </section>

            {(() => {
              const directCostMonth = profitabilityDirectCostMonth(assumptions, profitabilityUtilization);
              const overheadMonth = totalMonthlyOverheadEur(assumptions);
              const sellRatePerHour = profitabilityTargetSellRatePerHour(
                assumptions,
                assumptions.commercial_policy.default_margin_percent,
                assumptions.commercial_policy.risk_allowance_percent
              );
              const revenueMonth = profitabilityRevenueMonth(assumptions, profitabilityUtilization, sellRatePerHour);
              const grossProfitMonth = revenueMonth - directCostMonth - overheadMonth;
              const breakEvenUtilization = profitabilityBreakEvenUtilization(assumptions, sellRatePerHour);
              return (
                <section className="panel backbonePanel">
                  <div className="sectionHeader"><h2>Monthly Gross Profit Bridge</h2></div>
                  <p className="sectionHelp">Revenue is sold hours (planned hours x target Availability x the Utilization scenario) at a fixed sell rate priced once at target Utilization/Availability and the commercial policy -- it does not shrink or grow with the scenario's own cost. Cost is the full monthly fixed cost (unchanged by the scenario) plus variable cost over sold hours, plus full monthly overhead. At low scenario Utilization this can and should show a loss.</p>
                  <p className="sectionHelp">
                    {breakEvenUtilization === null
                      ? "Break-even Utilization: none -- the target sell rate does not even cover variable cost at any Utilization."
                      : `Break-even Utilization: ${formatPercent(Math.max(0, Math.min(1, breakEvenUtilization)))}% ${breakEvenUtilization > 1 ? "(above 100% -- this shop cannot break even even fully booked at today's cost structure)" : ""}`}
                  </p>
                  <ProfitBridgeChart
                    revenue={revenueMonth}
                    directCost={directCostMonth}
                    overhead={overheadMonth}
                    grossProfit={grossProfitMonth}
                  />
                </section>
              );
            })()}
          </section>
        ) : null}

        {activeView === "business_case" ? (
          <section className="casePage">
            <section className="panel caseHero">
              <h2>Why The Company Is Forced Into High Prices</h2>
              <p>The central question is not only whether one quote is expensive. The question is which part of the business system pushes the quote upward: empty order books (low Utilization), missing overhead in the cost formula, accounting cost allocation, slow route assumptions, missing tooling, material waste, first-time CAM effort, or weak measured data.</p>
              <p>The diagnosis for this company specifically: machine OEE (performance when a machine has work loaded) is broadly fine. Utilization (how much of available time actually has orders loaded against it) is low. That is a commercial/load problem, not a shop-floor performance problem — and pricing off it as if it were permanent creates a death spiral (see below).</p>
              <p>This tool is built to expose those cost-pressure signals before the company sends an external offer. It does not hide accounting cost. It shows accounting full-cost price beside a market-facing target price so management can see what must be fixed to become competitive.</p>
            </section>

            <section className="panel deathSpiralPanel">
              <h2>The Death Spiral</h2>
              <div className="deathSpiralFlow" aria-label="Death spiral feedback loop">
                <div>Price quoted off low actual Utilization</div>
                <div>Quote looks expensive vs. competitors</div>
                <div>Fewer orders won</div>
                <div>Utilization drops further</div>
                <div>Next quote is priced even higher</div>
              </div>
              <p>Accounting-rate pricing (current, low Utilization) is sound bookkeeping — it recovers today's fixed cost. It is not a safe growth strategy: every order priced this way makes the next order look less competitive, which produces exactly the demand problem it is reacting to. This tool shows the accounting rate so nothing is hidden, but the Target rate — a near-fully-booked shop (95% Utilization) at an achievable OEE — is the number the company should price against and negotiate around.</p>
            </section>

            <section className="caseSignals">
              <div>
                <span className="scenarioLabel">Accounting premium</span>
                <strong>{accountingResult && targetResult ? money.format(priceGap) : "..."}</strong>
                <span className="scenarioHint">Extra quote price created by accounting full-cost assumptions.</span>
              </div>
              <div>
                <span className="scenarioLabel">Premium vs target</span>
                <strong>{accountingResult && targetResult && targetResult.sell_price_eur > 0 ? `${Math.round((priceGap / targetResult.sell_price_eur) * 100)}%` : "..."}</strong>
                <span className="scenarioHint">A quick signal of how far accounting allocation is from competitive planning.</span>
              </div>
              <div>
                <span className="scenarioLabel">Missing tool exposure</span>
                <strong>{money.format(totalMissingToolCost)}</strong>
                <span className="scenarioHint">Tool purchases that must be charged, amortized, or explicitly approved.</span>
              </div>
              <div>
                <span className="scenarioLabel">CAM / engineering</span>
                <strong>{selectedResult ? money.format(selectedResult.engineering_cost_eur) : "..."}</strong>
                <span className="scenarioHint">New parts can be expensive before the machine starts cutting.</span>
              </div>
            </section>

            <section className="panel backbonePanel">
              <h2>Production Cost Backbone</h2>
              <div className="formulaStrip">
                <div><strong>Sellable stock</strong><span>Purchased material piece, cutoffs, scrap recovery</span></div>
                <div><strong>Engineering</strong><span>CAM, programming, prove-out, repeat-part reuse</span></div>
                <div><strong>Route</strong><span>Setup time, cycle time, machine class, labor class, QC</span></div>
                <div><strong>Readiness</strong><span>Tools, fixtures, outsourcing, stock availability</span></div>
                <div><strong>Commercial</strong><span>Risk, admin cost, margin, offer rows</span></div>
              </div>
              <div className="oeeEquation">
                <div>
                  <h3>Machine hourly rate</h3>
                  <p>Machine EUR/h is fixed machine cost divided by productive machine hours, plus variable cost. Productive hours are planned available hours multiplied by Utilization (is there an order loaded at all?) multiplied by OEE (how well does it run once loaded?).</p>
                </div>
                <div className="equationBox">Machine EUR/h = fixed machine cost / (planned hours x Utilization x OEE) + variable cost</div>
                <div>
                  <h3>Why low Utilization hurts price</h3>
                  <p>If the machine is modern and runs well but has too few orders, the same fixed cost is divided over fewer productive hours. The hourly rate rises — not because the machine performs worse, but because it sits idle waiting for work.</p>
                </div>
              </div>
            </section>

            <section className="panel overheadMissingPanel">
              <h2>Overhead Was Missing</h2>
              <p>Until this section existed, the formula assumed only a machine, an operator, and a CAM programmer. It had no line for admin, sales, quality management, or facility overhead — unrealistic for a company with roughly 30 people and only 18-20 on the shop floor. Resources &gt; Overhead Allocation now makes this an explicit, editable cost.</p>
              <p>Re-enabling overhead will raise cost and price back up, even after fixing the Utilization framing. That is expected, not a bug: in the Baltic market, price is the dominant purchasing factor for the large majority of orders (special tolerance, fast delivery, or other premium requirements typically apply to a small minority, well under 10%, of business). If a competitor is genuinely and consistently cheaper on comparable work, the realistic explanations are that they carry less overhead, run more efficiently, are pricing off already-depreciated equipment, or operate at a different scale/batch size — not that cost accounting has a hidden trick. The <strong>Profitability</strong> tab answers the standalone question of whether the company can be profitable at all once overhead is counted.</p>
              <p>What this tool does not do: benchmark against actual competitor prices or market willingness-to-pay. Target price answers "what do we need to charge to cover cost, overhead, and margin at a healthy Utilization" — it is a cost-side floor, not a market-side ceiling. Comparing that floor against real competitor quotes is still a manual, external step.</p>
            </section>

            <section className="panel diagnosticPanel">
              <h2>Cost Pressure Signals</h2>
              <div className="diagnosticTable">
                <div className="diagnosticHead"><span>Signal</span><span>What It Means</span><span>Where The Tool Shows It</span></div>
                <div><span>Accounting premium is large</span><span>Current full-cost allocation is far above target competitive assumptions.</span><span>Quote Summary, Scenarios, Print</span></div>
                <div><span>Actual Utilization is low</span><span>Idle capacity from a thin order book is being loaded into active orders, raising machine EUR/h. Idleness (1 - Utilization) is the empty-order gap.</span><span>Resources Machine Rate Calculator</span></div>
                <div><span>Overhead is uncounted or understated</span><span>Admin, sales, quality, and facility costs are missing from production cost, understating true cost.</span><span>Resources Overhead Allocation, Profitability</span></div>
                <div><span>New part CAM is high</span><span>Engineering work may dominate small batches before production starts.</span><span>STEP and CAM, Engineering Operation</span></div>
                <div><span>Missing tools exist</span><span>The quote is incomplete unless tool cost is charged, amortized, or approved as excluded.</span><span>Tool Check</span></div>
                <div><span>Stock pieces are expensive</span><span>The quote starts from purchasable stock, not theoretical net material. Cutoffs matter.</span><span>RFQ material fields, Resources materials</span></div>
                <div><span>Actuals differ from plan</span><span>Setup/cycle/scrap assumptions are not trusted yet and must be calibrated.</span><span>Actuals Feedback</span></div>
              </div>
            </section>

            <section className="panel caseConclusion">
              <h2>Approval Message</h2>
              <p>The approval value is not that this app can produce one more price. The value is that every high price becomes explainable. If the price is high because Utilization is low, management sees a sales/load problem, not a production problem. If it is high because overhead was missing, management sees the true cost of running the business, not an accounting trick. If it is high because setup or CAM is wrong, production sees a data problem. If it is high because target rates are unrealistic, management sees a market strategy problem. If it is high because tooling or material is missing, the quote can charge it instead of silently losing money.</p>
            </section>
          </section>
        ) : null}

        {activeView === "guide" ? (
          <section className="guidePage costGuide">
            <section className="panel guideIntro">
              <h2>Production Cost Calculation Backbone</h2>
              <p className="sectionHelp">This is the principle behind the whole tool. A sell price is not a single number guessed at the end. It is a chain of cost drivers, and each driver can push the offer above the market.</p>
              <div className="costBackboneFlow" aria-label="Production cost backbone">
                <div><strong>1. Material starts from stock</strong><span>Use the piece the company must buy or take from stock. Do not quote only the theoretical net part material.</span></div>
                <div><strong>2. Engineering prepares production</strong><span>New parts need CAM, programming, setup planning, and prove-out. Repeat parts reuse part of this work.</span></div>
                <div><strong>3. Route consumes capacity</strong><span>Each operation uses setup minutes, cycle minutes, machine rate, labor rate, consumables, tooling, scrap, and QC.</span></div>
                <div><strong>4. Commercial policy converts cost to price</strong><span>Risk, admin cost, and margin are added only after the production cost is visible.</span></div>
              </div>
            </section>

            <section className="panel oeeGuide">
              <h2>OEE vs. Utilization — Two Different Gauges</h2>
              <p><strong>OEE</strong> is the share of scheduled machine time that becomes good productive output — availability, performance, and quality <em>while the machine has work loaded</em>. <strong>Utilization</strong> is a separate question: how much of the available planned time actually gets loaded with orders in the first place. A machine can run beautifully (high OEE) and still sit idle most of the month (low Utilization) because there is not enough demand.</p>
              <p>The diagnosis for this company: Availability is broadly fine. Utilization is low. That means the fix is commercial — win more orders, or price to reflect real capacity — not a shop-floor performance fix. Idleness (<code>1 - Utilization</code>) is the empty-order gap, and it is tracked separately from OEE throughout this tool. Only Availability (not full OEE) feeds the rate formula below — performance losses already live in cycle/setup minutes and quality losses in the scrap allowance, so folding OEE in here would double-charge both.</p>
              <div className="oeeExampleGrid">
                <div><span>Fixed monthly machine cost</span><strong>8,000 EUR</strong></div>
                <div><span>Planned monthly hours</span><strong>160 h</strong></div>
                <div><span>At 90% Availability, 95% Utilization (target)</span><strong>136.8 productive h = 58.48 EUR/h</strong></div>
                <div><span>At 80% Availability, 35% Utilization (actual)</span><strong>44.8 productive h = 178.57 EUR/h</strong></div>
              </div>
              <p>The machine did not get much worse between these two rows — Availability is close. The cost per productive hour roughly tripled because Utilization collapsed, not because performance did. Pricing off the second row as if it were permanent is the trap the Death Spiral panel on the Business Case page describes.</p>
            </section>

            <section className="panel guideCompare">
              <h2>Target Utilization Is The Strategy</h2>
              <p>The Target scenario assumes <strong>95% Utilization</strong> — a near-fully-booked shop, the aspirational commercial load with a small buffer below theoretical capacity — combined with an achievable <strong>Target Availability</strong> (seed: 90%, reflecting reduced unplanned downtime, a genuine uptime improvement rather than a demand assumption). This is the anchor the company should price and negotiate around, because it reflects what a healthy, competitively loaded shop looks like, not today's empty order book.</p>
              <div className="compareColumns">
                <div>
                  <h3>Target Price</h3>
                  <p>Uses target machine rates from Resources: target Availability, 95% target Utilization, and optional target discount. They answer: what price level do we need to compete once the shop is properly loaded?</p>
                </div>
                <div>
                  <h3>Accounting Price</h3>
                  <p>Uses current full-cost machine rates: actual Availability and actual (low) Utilization. They answer: what price do we get if today's empty order book is charged to this one order?</p>
                </div>
                <div>
                  <h3>Accounting Premium</h3>
                  <p>The difference between the two. A high premium is a management signal: either win more orders (raise Utilization), change overhead allocation, correct route assumptions, or accept that the market cannot pay today's under-loaded cost structure.</p>
                </div>
              </div>
            </section>

            <section className="panel highPriceGuide">
              <h2>Typical Reasons A Quote Becomes Too High</h2>
              <div className="reasonList">
                <div><strong>Low Utilization</strong><span>Fixed machine cost is spread over too few productive hours because there is not enough order load, not because the machine performs poorly.</span></div>
                <div><strong>Overhead ignored</strong><span>Admin, sales, quality, and facility costs are missing from the cost formula, understating true cost.</span></div>
                <div><strong>Wrong route time</strong><span>Setup or cycle assumptions are too conservative, outdated, or not measured.</span></div>
                <div><strong>Small batch</strong><span>Setup and CAM do not amortize across enough parts.</span></div>
                <div><strong>New part engineering</strong><span>CAM and prove-out are real labor costs before production starts.</span></div>
                <div><strong>Missing tools</strong><span>Buying a cutter, tap, fixture, or gauge for one order must be charged or approved.</span></div>
                <div><strong>Material reality</strong><span>The company buys sellable stock pieces and may create unusable cutoffs.</span></div>
                <div><strong>Quality requirements</strong><span>Tight tolerance, reports, and FAI add inspection time and risk.</span></div>
                <div><strong>Unclear data quality</strong><span>When assumptions are guesses, the company adds risk or overprices to protect itself.</span></div>
              </div>
            </section>

            <section className="panel guideMap">
              <h2>Where To Look In The Tool</h2>
              <div className="diagnosticTable">
                <div className="diagnosticHead"><span>Question</span><span>Relevant Area</span><span>What To Check</span></div>
                <div><span>Why is the price high?</span><span>Quote Summary and Scenarios</span><span>Target vs accounting price, accounting premium, unit price by quantity.</span></div>
                <div><span>Is the machine rate believable?</span><span>Resources, Machine Rate Calculator</span><span>Fixed monthly cost, planned hours, actual/target Availability, actual/target OEE (diagnostic), actual/target Utilization, Idleness, variable EUR/h, calculated Accounting EUR/h, calculated Target EUR/h.</span></div>
                <div><span>Is overhead counted?</span><span>Resources, Overhead Allocation</span><span>Total monthly overhead, allocation method (per machine hour or percent of cost), equivalent EUR/h and % readouts.</span></div>
                <div><span>Can the company be profitable at all?</span><span>Profitability</span><span>Department expenses, shop Utilization scenario, and monthly gross profit/loss after overhead.</span></div>
                <div><span>Will the market actually pay this price?</span><span>Business Case, "Overhead Was Missing" panel</span><span>Not answered by this tool: Target price is a cost-side floor, not a market benchmark. Compare it against real competitor quotes manually.</span></div>
                <div><span>Is the production route realistic?</span><span>Operations and Actuals Feedback</span><span>Setup time, cycle time, labor time, scrap, plan/fact deviations.</span></div>
                <div><span>Can the part actually be produced?</span><span>Tool Check and Materials</span><span>Required tools, missing tool cost, stock piece availability and cost.</span></div>
                <div><span>Can this connect to existing company systems?</span><span>ERP Connection Demo</span><span>BOM, route, stock, customer, and offer-data handoff path.</span></div>
                <div><span>Can external clients self-serve early estimates?</span><span>Client Portal</span><span>Multi-part STEP plus drawing/spec RFQ intake with one preliminary estimate range and manual confirmation.</span></div>
              </div>
            </section>
          </section>
        ) : null}

        {activeView === "print" ? (
          <>
            <div className="printActions">
              <div className="modeGroup" aria-label="Print document mode">
                <button className={`mode ${printDocumentMode === "customer_offer" ? "active" : ""}`} onClick={() => setPrintDocumentMode("customer_offer")}>Customer Offer</button>
                <button className={`mode ${printDocumentMode === "internal_cost_sheet" ? "active" : ""}`} onClick={() => setPrintDocumentMode("internal_cost_sheet")}>Internal Cost Sheet</button>
              </div>
              <button className="primaryButton" onClick={() => window.print()}>Print / Save PDF</button>
              <button className="secondaryButton" onClick={() => setActiveView("quote")}>Back to Quote</button>
            </div>
            <PrintableQuote
              accountingResult={accountingResult}
              actualOperations={actualOperations}
              assumptions={assumptions}
              customerName={customerName}
              deliveryEstimate={deliveryEstimate}
              printDocumentMode={printDocumentMode}
              partName={partName}
              paymentTerms={paymentTerms}
              quantity={quantity}
              quantityBreakResults={quantityBreakResults}
              quoteNumber={quoteNumber}
              quoteOperations={quoteOperations}
              rfqReference={rfqReference}
              stockName={stockName}
              targetResult={targetResult}
              validityDate={validityDate}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
