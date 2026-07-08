import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { LANGUAGE_STORAGE_KEY, Language, translate } from "./i18n";
import {
  BookOpen,
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
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

type View = "quote" | "client_portal" | "resources" | "market_rates" | "scenarios" | "print" | "business_case" | "guide" | "profitability" | "profile" | "methods";
type RateMode = "accounting_full_cost" | "target_competitive";
// "scenario" is an opt-in third basis (the "Compare" checkbox on Profitability): one uniform
// Utilization applied shop-wide, at each asset's target Availability, for ad-hoc "what if we
// only load to X%" checks. It never drives the Actual/Target columns or the revenue bridge --
// those stay wired to real per-asset actual/target fields either way.
type ProfitabilityCapacityMode = "actual_current" | "target_capacity" | "scenario";

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

type ErpCustomerOfferRecord = {
  part_name: string;
  quantity: number;
  material_unit_cost_eur: number | null;
  created_at: string;
};

function normalizePartName(name: string): string {
  return name.trim().toLowerCase();
}

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

type AssetCapacityRole = "sellable_capacity" | "support_internal";

type CompanyAsset = {
  id: string;
  name: string;
  purchasePriceEur: number;
  usefulLifeYears: number;
  salvagePercent: number;
  otherMonthlyFixedCostEur: number;
  plannedHoursPerMonth: number;
  actualAvailabilityPercent: number;
  targetAvailabilityPercent: number;
  actualUtilizationPercent: number;
  targetUtilizationPercent: number;
  variableCostEurPerHour: number;
  sellRateEurPerHour?: number;
  loadedPowerKw: number;
  capacityRole?: AssetCapacityRole;
  primaryLaborClassId?: string | null;
  quality: string;
};

type CompanyEmployee = {
  id: string;
  position: string;
  processArea: string;
  headcount: number;
  grossMonthlySalaryEur: number;
  employerSocialContributionRate: number;
  paidHoursPerMonth: number;
  directLabor: boolean;
  quality: string;
};

type CompanyProfileMaterial = {
  id: string;
  name: string;
  materialGrade: string;
  stockDescription: string;
  stockShape: StockShape | "";
};

type CompanyProfileTool = {
  id: string;
  name: string;
  type: string;
  materialGroups: string;
};

type CompanyProfileOperation = {
  id: string;
  operationType: string;
  name: string;
  defaultMachineClassId: string | null;
  defaultLaborClassId: string | null;
};

type CompanyProfileState = {
  profileId: string | null;
  companyName: string;
  lowValueInventoryTotalEur: number;
  lowValueInventoryRefreshMonths: number;
  assets: CompanyAsset[];
  employees: CompanyEmployee[];
  overheadItems: OverheadItem[];
  materials: CompanyProfileMaterial[];
  tools: CompanyProfileTool[];
  operations: CompanyProfileOperation[];
};

type CompanyProfile = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  profile_state: CompanyProfileState;
  assumptions_snapshot: Assumptions | null;
};

type QuoteResult = {
  material_cost_eur: number;
  engineering_cost_eur: number;
  operation_cost_eur: number;
  missing_tool_cost_eur: number;
  risk_allowance_eur: number;
  conversion_side_cost_eur: number;
  pass_through_cost_eur: number;
  total_cost_eur: number;
  unit_cost_eur: number;
  margin_percent: number;
  material_markup_percent: number;
  material_markup_eur: number;
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
  billable_hours_ratio?: number;
  cost_method?: "direct_hourly" | "gross_monthly";
  derived_employer_cost_per_hour_eur?: number;
  headcount?: number;
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
  market_sell_rate_eur_per_hour?: number;
  market_rate_class_id?: string;
  target_rate_discount_percent?: number;
  purchase_price_eur?: number;
  useful_life_years?: number;
  salvage_percent?: number;
  other_monthly_fixed_cost_eur?: number;
  capacity_role?: AssetCapacityRole;
  default_labor_class_id?: string | null;
  operator_attendance_share?: number | null;
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
  calibration_sample_count?: number;
  quality?: string;
};

// "won_quote" was removed as a selectable source: backsolving a rate from our own accepted
// quote just returns our own cost-plus price, which proves nothing about what the market
// would pay. Real market grounding comes from outside this tool's own pricing engine:
// lost_quote (a lost bid -- we know what the winner charged), competitor_backsolve (a blind/
// proxy RFQ, a public instant-quote portal, or another direct competitor number), and
// buyer_disclosed (a customer states a benchmark to negotiate against -- real, but always
// biased toward the buyer's interest, so it never upgrades past its own confidence tier no
// matter how many times it is repeated).
type MarketRateSource = "manual_rate_card" | "won_quote" | "lost_quote" | "competitor_backsolve" | "buyer_disclosed" | "cost_plus_floor";

// How strong is this class's market evidence, independent of where it came from (the
// "source" field). A single lost bid and a customer's negotiating-leverage benchmark are
// both real, but neither is as solid as two or more independent numbers agreeing.
type MarketRateConfidence = "unverified" | "single_data_point" | "buyer_disclosed" | "confirmed_multiple";

type MarketRateCardEntry = {
  id: string;
  name: string;
  rateEurPerHour: number;
  source: MarketRateSource;
  confidence: MarketRateConfidence;
  notes: string;
  lastUpdated: string;
};

function marketConfidenceLabel(value: string, lang: Language) {
  const labels: Record<string, string> = {
    unverified: translate("Unverified / placeholder", lang),
    single_data_point: translate("Single data point", lang),
    buyer_disclosed: translate("Buyer-disclosed (soft ceiling)", lang),
    confirmed_multiple: translate("Confirmed (2+ sources)", lang)
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function marketConfidenceClass(value: string) {
  if (value === "confirmed_multiple") return "confirmed";
  if (value === "buyer_disclosed") return "buyerDisclosed";
  if (value === "single_data_point") return "singlePoint";
  return "unverified";
}

function MarketConfidenceInput({ value, onChange, lang }: { value: string; onChange: (value: string) => void; lang: Language }) {
  return (
    <span className="marketConfidenceInput" title={marketConfidenceLabel(value, lang)}>
      <span className={`marketConfidenceDot ${marketConfidenceClass(value)}`} />
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="unverified">{translate("Unverified / placeholder", lang)}</option>
        <option value="single_data_point">{translate("Single data point", lang)}</option>
        <option value="buyer_disclosed">{translate("Buyer-disclosed (soft ceiling)", lang)}</option>
        <option value="confirmed_multiple">{translate("Confirmed (2+ sources)", lang)}</option>
      </select>
    </span>
  );
}

// Field name kept generic (not renamed to workCenterId) to match the backend's untyped string
// column -- within BasketRow.routeHours this id refers to a real work center (MachineClass.id),
// not a shared market-rate pricing class, unlike the single-quote backsolve panel's use of this
// same type further up the file.
type MarketEvidenceRouteRow = {
  id: string;
  marketRateClassId: string;
  hours: number;
};

type BasketRow = {
  id: string;
  source: "pdf_extraction" | "manual";
  pdfFilename: string | null;
  supplier: string | null;
  quoteDate: string | null;
  currency: string | null;
  partName: string;
  quantity: number | null;
  unitPriceEur: number | null;
  lineTotalEur: number | null;
  materialSellEur: number | null;
  materialUnitCostEur: number | null;
  routeHours: MarketEvidenceRouteRow[];
  notes: string;
};

// Server persists snake_case; the UI works in camelCase, matching the rest of this file's
// convention for assumptions/company-profile payloads.
function basketRowFromApi(row: any): BasketRow {
  return {
    id: row.id,
    source: row.source,
    pdfFilename: row.pdf_filename ?? null,
    supplier: row.supplier ?? null,
    quoteDate: row.quote_date ?? null,
    currency: row.currency ?? null,
    partName: row.part_name ?? "",
    quantity: row.quantity ?? null,
    unitPriceEur: row.unit_price_eur ?? null,
    lineTotalEur: row.line_total_eur ?? null,
    materialSellEur: row.material_sell_eur ?? null,
    materialUnitCostEur: row.material_unit_cost_eur ?? null,
    routeHours: (row.route_hours ?? []).map((entry: any, index: number) => ({
      id: `${row.id}_hours_${index}`,
      marketRateClassId: entry.market_rate_class_id,
      hours: entry.hours
    })),
    notes: row.notes ?? ""
  };
}

function basketRowToApiPayload(row: BasketRow) {
  return {
    source: row.source,
    pdf_filename: row.pdfFilename,
    supplier: row.supplier,
    quote_date: row.quoteDate,
    currency: row.currency,
    part_name: row.partName,
    quantity: row.quantity,
    unit_price_eur: row.unitPriceEur,
    line_total_eur: row.lineTotalEur,
    material_sell_eur: row.materialSellEur,
    material_unit_cost_eur: row.materialUnitCostEur,
    route_hours: row.routeHours.map((entry) => ({
      market_rate_class_id: entry.marketRateClassId,
      hours: entry.hours
    })),
    notes: row.notes
  };
}

function basketRowTotalSellEur(row: BasketRow): number | null {
  if (row.lineTotalEur != null) return row.lineTotalEur;
  if (row.unitPriceEur != null && row.quantity != null) return row.unitPriceEur * row.quantity;
  return null;
}

// The competitor's own material cost is never known -- this substitutes our own quote's
// material cost for the same part, marked up by an assumed (user-adjustable) percent, as the
// best available stand-in. Falls back to a directly-entered materialSellEur for rows with no
// ERP cost match (manual rows, or PDF rows whose part name didn't match anything of ours).
function basketRowMaterialSellEur(row: BasketRow, assumedMarkupPercent: number): number | null {
  if (row.materialUnitCostEur != null && row.quantity != null) {
    return Math.round(row.materialUnitCostEur * (1 + assumedMarkupPercent / 100) * row.quantity * 100) / 100;
  }
  return row.materialSellEur;
}

function basketRowIsSolvable(row: BasketRow, assumedMarkupPercent: number): boolean {
  const total = basketRowTotalSellEur(row);
  const materialSellEur = basketRowMaterialSellEur(row, assumedMarkupPercent);
  const hoursSum = row.routeHours.reduce((sum, entry) => sum + Math.max(0, entry.hours || 0), 0);
  return (
    row.quantity != null &&
    row.quantity > 0 &&
    total != null &&
    materialSellEur != null &&
    hoursSum > 0
  );
}

const BASKET_DOMINANCE_CUTOFF = 0.65;

type WorkCenterEvidence = {
  workCenterId: string;
  workCenterName: string;
  status: "found" | "provisional" | "unknown";
  medianRate: number | null;
  minRate: number | null;
  maxRate: number | null;
  evidenceCount: number;
  cardRateEurPerHour: number | null;
};

type BasketRowTrace = {
  rowId: string;
  dominantWorkCenterId: string | null;
  dominantShare: number | null;
  dominantHours: number | null;
  totalSellEur: number | null;
  materialSellEur: number | null;
  impliedRate: number | null;
  excludedReason: "below_cutoff" | "no_route_hours" | "not_solvable" | null;
};

type BasketSolveResult = {
  markupPercentUsed: number;
  workCenters: WorkCenterEvidence[];
  rowTraces: BasketRowTrace[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Per-work-center, per-row direct estimate instead of a joint regression: a row only counts as
// evidence for a work center when that work center clearly dominates its hours (>= 65%), so the
// implied rate is always simple arithmetic -- (competitor sell - our material estimate) / that
// work center's hours -- never a solved unknown that can swing wildly from a barely-determined
// system. Work centers no row ever isolates are reported as having no evidence, not guessed.
function solveBasketByWorkCenter(
  rows: BasketRow[],
  assumedMarkupPercent: number,
  workCenterIds: string[],
  workCenterName: (id: string) => string,
  cardRateForWorkCenter: (id: string) => number | null
): BasketSolveResult {
  const rowTraces: BasketRowTrace[] = [];
  const ratesByWorkCenter = new Map<string, number[]>();

  for (const row of rows) {
    if (!basketRowIsSolvable(row, assumedMarkupPercent)) {
      rowTraces.push({ rowId: row.id, dominantWorkCenterId: null, dominantShare: null, dominantHours: null, totalSellEur: null, materialSellEur: null, impliedRate: null, excludedReason: "not_solvable" });
      continue;
    }
    const total = basketRowTotalSellEur(row)!;
    const materialSellEur = basketRowMaterialSellEur(row, assumedMarkupPercent)!;
    const totalHours = row.routeHours.reduce((sum, entry) => sum + Math.max(0, entry.hours || 0), 0);
    if (totalHours <= 0) {
      rowTraces.push({ rowId: row.id, dominantWorkCenterId: null, dominantShare: null, dominantHours: null, totalSellEur: total, materialSellEur, impliedRate: null, excludedReason: "no_route_hours" });
      continue;
    }
    const dominant = row.routeHours.reduce((best, entry) => (entry.hours > (best?.hours ?? -1) ? entry : best), row.routeHours[0]);
    const share = dominant.hours / totalHours;
    if (share < BASKET_DOMINANCE_CUTOFF) {
      rowTraces.push({ rowId: row.id, dominantWorkCenterId: dominant.marketRateClassId, dominantShare: share, dominantHours: dominant.hours, totalSellEur: total, materialSellEur, impliedRate: null, excludedReason: "below_cutoff" });
      continue;
    }
    const impliedRate = (total - materialSellEur) / dominant.hours;
    rowTraces.push({ rowId: row.id, dominantWorkCenterId: dominant.marketRateClassId, dominantShare: share, dominantHours: dominant.hours, totalSellEur: total, materialSellEur, impliedRate, excludedReason: null });
    const list = ratesByWorkCenter.get(dominant.marketRateClassId) ?? [];
    list.push(impliedRate);
    ratesByWorkCenter.set(dominant.marketRateClassId, list);
  }

  const workCenters: WorkCenterEvidence[] = workCenterIds.map((id) => {
    const rates = ratesByWorkCenter.get(id) ?? [];
    const cardRateEurPerHour = cardRateForWorkCenter(id);
    if (rates.length === 0) {
      return { workCenterId: id, workCenterName: workCenterName(id), status: "unknown", medianRate: null, minRate: null, maxRate: null, evidenceCount: 0, cardRateEurPerHour };
    }
    return {
      workCenterId: id,
      workCenterName: workCenterName(id),
      status: rates.length === 1 ? "provisional" : "found",
      medianRate: median(rates),
      minRate: Math.min(...rates),
      maxRate: Math.max(...rates),
      evidenceCount: rates.length,
      cardRateEurPerHour
    };
  });

  return { markupPercentUsed: assumedMarkupPercent, workCenters, rowTraces };
}

type CalibrationCandidate = {
  operationType: string;
  fieldChanges: Array<{ key: keyof OperationTemplate; label: string; oldValue: number; newValue: number; deviates: boolean }>;
  newSampleCount: number;
  requiresConfirmation: boolean;
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
    material_markup_percent?: number;
  };
  payroll_tax_defaults?: {
    country: string;
    employer_social_contribution_rate: number;
    employee_social_contribution_rate: number;
    standard_total_vsaoi_rate: number;
    paid_hours_per_month: number;
    billable_hours_ratio?: number;
    source_url: string;
    quality: string;
  };
  labor_classes: LaborClass[];
  machine_classes: MachineClass[];
  operation_templates: OperationTemplate[];
  material_examples: MaterialExample[];
  tool_inventory?: ToolInventoryItem[];
  tool_match_tolerance_mm?: number;
  market_rate_card?: MarketRateCardEntry[];
  market_rate_card_profile_id?: string | null;
  market_rate_card_profile_name?: string;
  overhead?: OverheadAllocation;
  profitability_settings?: {
    material_margin_percent_of_revenue: number;
  };
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

function normalizeDisplayDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  return trimmed;
}

function dataStatusLabel(value: string, lang: Language) {
  const labels: Record<string, string> = {
    measured: translate("Measured", lang),
    company_estimate: translate("Company approved", lang),
    industry_estimate: translate("Generic estimate", lang),
    public_proxy: translate("Public proxy", lang),
    portal_preliminary: translate("Preliminary", lang),
    unknown: translate("Unknown", lang)
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function dataStatusClass(value: string) {
  if (value === "measured") return "measured";
  if (value === "company_estimate") return "company";
  if (value === "industry_estimate" || value === "public_proxy") return "generic";
  if (value === "portal_preliminary") return "preliminary";
  return "unknown";
}

function DataStatusInput({ value, lang }: { value: string; onChange: (value: string) => void; lang: Language }) {
  const label = dataStatusLabel(value, lang);
  return (
    <span className="dataStatusInput" title={label} aria-label={`${translate("Data status", lang)}: ${label}`}>
      <span className={`dataStatusDot ${dataStatusClass(value)}`} />
    </span>
  );
}

// An operator's full payroll must be recovered over the hours that are actually sold to
// customers, not over every paid hour -- part of a paid month goes to waiting, training,
// internal work, and gaps between orders. Dividing by paid hours alone quietly under-prices
// labor by that idle share (the same trap the machine rate avoids by dividing fixed cost by
// utilization x availability). billable_hours_ratio is the share of paid hours that ends up
// on customer work; the default lines up with target availability x target utilization.
const DEFAULT_LABOR_BILLABLE_HOURS_RATIO = 0.85;

function laborBillableHoursRatio(labor: LaborClass, assumptions: Assumptions | null) {
  return (
    labor.billable_hours_ratio
    ?? assumptions?.payroll_tax_defaults?.billable_hours_ratio
    ?? DEFAULT_LABOR_BILLABLE_HOURS_RATIO
  );
}

function deriveLaborHourlyCost(labor: LaborClass, assumptions: Assumptions | null) {
  const defaultTaxRate = assumptions?.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359;
  const defaultHours = assumptions?.payroll_tax_defaults?.paid_hours_per_month ?? 160;
  const gross = labor.gross_monthly_salary_eur ?? 0;
  const employerRate = labor.employer_social_contribution_rate ?? defaultTaxRate;
  const paidHours = labor.paid_hours_per_month ?? defaultHours;
  const billableRatio = Math.min(1, Math.max(0.1, laborBillableHoursRatio(labor, assumptions)));

  if (paidHours <= 0) {
    return 0;
  }

  return roundMoney((gross * (1 + employerRate)) / (paidHours * billableRatio));
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

function machineProductiveHours(machine: MachineClass, availabilityField: AvailabilityField, utilizationField: UtilizationField) {
  const plannedHours = machine.planned_hours_per_month ?? 160;
  const availability = Math.max(0.01, availabilityValue(machine, availabilityField));
  const utilization = Math.max(0.01, machine[utilizationField] ?? 1);
  return plannedHours * availability * utilization;
}

function directMachineRateBeforeOverhead(machine: MachineClass, availabilityField: AvailabilityField, utilizationField: UtilizationField) {
  const hours = machineProductiveHours(machine, availabilityField, utilizationField);
  const fixedCost = machine.monthly_fixed_cost_eur ?? 0;
  const variableCost = machine.variable_cost_eur_per_hour ?? 0;
  return fixedCost / Math.max(1, hours) + variableCost;
}

// One shared-recovery model for the whole app: quote machine rates and the Profitability
// tab allocate the same pool (overhead + support-station cost + support/unassigned payroll)
// with the same weight (station machine EUR/h + assigned payroll EUR/h), over sellable
// stations only. Support stations charge no share -- they ARE part of the pool.
function weightedSharedRecoveryPerMachineHour(
  assumptions: Assumptions | null,
  machine: MachineClass,
  availabilityField: AvailabilityField,
  utilizationField: UtilizationField
) {
  if (!assumptions) {
    return 0;
  }
  if (machineCapacityRole(machine) !== "sellable_capacity") {
    return 0;
  }
  const machines = assumptions.machine_classes ?? [];
  const hoursOf = (item: MachineClass) => machineProductiveHours(item, availabilityField, utilizationField);
  const isSellable = (item: MachineClass) => machineCapacityRole(item) === "sellable_capacity";

  const sellableHoursByLabor = new Map<string, number>();
  machines.forEach((item) => {
    if (!isSellable(item) || !item.default_labor_class_id) return;
    sellableHoursByLabor.set(item.default_labor_class_id, (sellableHoursByLabor.get(item.default_labor_class_id) ?? 0) + hoursOf(item));
  });

  // NRE: the CAM/programming labor class is recovered through the quote's engineering line,
  // never through machine rates -- every person has exactly one recovery channel.
  const engineeringLaborId = assumptions.cam_programming_defaults?.programming_labor_class_id ?? null;
  const assignedPayrollRateByLabor = new Map<string, number>();
  let supportOrUnassignedPayroll = 0;
  (assumptions.labor_classes ?? []).forEach((labor) => {
    const payroll = laborMonthlyPayrollCost(labor, assumptions);
    const sellableHours = sellableHoursByLabor.get(labor.id) ?? 0;
    if (sellableHours > 0) {
      assignedPayrollRateByLabor.set(labor.id, payroll / sellableHours);
    } else if (labor.id !== engineeringLaborId) {
      supportOrUnassignedPayroll += payroll;
    }
  });

  const supportMachineCostMonth = machines
    .filter((item) => !isSellable(item))
    .reduce((sum, item) => sum + (item.monthly_fixed_cost_eur ?? 0) + (item.variable_cost_eur_per_hour ?? 0) * hoursOf(item), 0);
  const poolMonth = totalMonthlyOverheadEur(assumptions) + supportMachineCostMonth + supportOrUnassignedPayroll;

  const stationWeight = (item: MachineClass) =>
    directMachineRateBeforeOverhead(item, availabilityField, utilizationField)
    + (item.default_labor_class_id ? assignedPayrollRateByLabor.get(item.default_labor_class_id) ?? 0 : 0);
  const weightedHoursTotal = machines
    .filter(isSellable)
    .reduce((sum, item) => sum + stationWeight(item) * hoursOf(item), 0);
  if (poolMonth <= 0 || weightedHoursTotal <= 0) {
    return 0;
  }
  return roundMoney(poolMonth * (stationWeight(machine) / weightedHoursTotal));
}

function calculatedAccountingMachineRate(machine: MachineClass, assumptions?: Assumptions | null) {
  const utilization = machine.actual_utilization_percent ?? 1;
  const availability = availabilityValue(machine, "actual_availability_percent");
  const overheadPerHour = weightedSharedRecoveryPerMachineHour(assumptions ?? null, machine, "actual_availability_percent", "actual_utilization_percent");
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
  const overheadPerHour = weightedSharedRecoveryPerMachineHour(assumptions ?? null, machine, "target_availability_percent", "target_utilization_percent");
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
// Overhead allocation is pinned to per-machine-hour: the percent-of-cost variant is
// mathematically equivalent but made machine rates look broken next to market EUR/h
// (a ~3 EUR/h direct rate beside a ~55 EUR/h sell rate), so the UI no longer offers it.
// Old data files that still say "percent_of_cost" are coerced on load.
function withRecalculatedAssumptions(assumptions: Assumptions): Assumptions {
  const normalized = assumptions.overhead && assumptions.overhead.allocation_method !== "per_machine_hour"
    ? { ...assumptions, overhead: { ...assumptions.overhead, allocation_method: "per_machine_hour" as const } }
    : assumptions;
  return {
    ...normalized,
    machine_classes: normalized.machine_classes.map((machine) =>
      withCalculatedMachineRates(machine, normalized)
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

function profileSlug(value: string, fallback: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function profileAssetMonthlyFixedCost(asset: CompanyAsset) {
  const purchasePrice = asset.purchasePriceEur || 0;
  const usefulLifeYears = Math.max(0.1, asset.usefulLifeYears || 10);
  const salvagePercent = Math.min(0.95, Math.max(0, asset.salvagePercent || 0));
  return roundMoney((purchasePrice * (1 - salvagePercent)) / (usefulLifeYears * 12) + (asset.otherMonthlyFixedCostEur || 0));
}

function profileEmployeeHourlyCost(employee: CompanyEmployee) {
  const paidHours = Math.max(1, employee.paidHoursPerMonth || 160);
  return roundMoney((employee.grossMonthlySalaryEur * (1 + employee.employerSocialContributionRate)) / paidHours);
}

function lowValueInventoryMonthlyReserve(profile: CompanyProfileState) {
  return roundMoney(profile.lowValueInventoryTotalEur / Math.max(1, profile.lowValueInventoryRefreshMonths));
}

function inferredAssetCapacityRole(id: string, name: string): AssetCapacityRole {
  const value = `${id} ${name}`.toLowerCase();
  if (value.includes("qc") || value.includes("quality") || value.includes("inspection") || value.includes("assembly")) {
    return "support_internal";
  }
  return "sellable_capacity";
}

function assetCapacityRole(asset: Pick<CompanyAsset, "id" | "name" | "capacityRole">): AssetCapacityRole {
  return asset.capacityRole ?? inferredAssetCapacityRole(asset.id, asset.name);
}

function machineCapacityRole(machine: Pick<MachineClass, "id" | "name" | "capacity_role">): AssetCapacityRole {
  return machine.capacity_role ?? inferredAssetCapacityRole(machine.id, machine.name);
}

function inferredAssetLaborClassId(id: string, name: string) {
  const value = `${id} ${name}`.toLowerCase();
  if (value.includes("qc") || value.includes("quality") || value.includes("inspection")) return "quality_inspector";
  if (value.includes("assembly")) return "assembler";
  if (value.includes("cnc")) return "cnc_setup_programmer";
  return "machine_operator";
}

function assetPrimaryLaborClassId(asset: Pick<CompanyAsset, "id" | "name" | "primaryLaborClassId">) {
  return asset.primaryLaborClassId ?? inferredAssetLaborClassId(asset.id, asset.name);
}

// A station operator's wage flows per hour of attendance, not per minute of touching: while
// the spindle turns the operator cannot be sold elsewhere. This is the ERP "crew size" /
// machine-crew ratio: 1 = dedicated operator, 1/3 = one operator tending three machines,
// 0 = unattended. Quoted labor minutes are floored at machine minutes x this share.
function machineAttendanceShare(machine: MachineClass | null | undefined) {
  if (!machine) {
    return 0;
  }
  if (machine.operator_attendance_share !== undefined && machine.operator_attendance_share !== null) {
    return Math.min(1, Math.max(0, machine.operator_attendance_share));
  }
  return machineCapacityRole(machine) === "sellable_capacity" && machine.default_labor_class_id ? 1 : 0;
}

function isSellableCapacityMachine(machine: Pick<MachineClass, "id" | "name" | "capacity_role">) {
  return machineCapacityRole(machine) === "sellable_capacity";
}

function marketSellRateValue(machine: Pick<MachineClass, "market_sell_rate_eur_per_hour">) {
  const rate = machine.market_sell_rate_eur_per_hour ?? 0;
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

const DEFAULT_MARKET_RATE_CARD: MarketRateCardEntry[] = [
  { id: "cnc", name: "CNC machining", rateEurPerHour: 0, source: "manual_rate_card", confidence: "unverified", notes: "Use lost-bid or competitor evidence to replace this placeholder.", lastUpdated: "" },
  { id: "manual", name: "Manual / bench work", rateEurPerHour: 0, source: "manual_rate_card", confidence: "unverified", notes: "General manual station pricing class.", lastUpdated: "" },
  { id: "welding", name: "Welding / fabrication", rateEurPerHour: 0, source: "manual_rate_card", confidence: "unverified", notes: "Separate from generic manual work when quotes support it.", lastUpdated: "" },
  { id: "assembly", name: "Assembly / fitting", rateEurPerHour: 0, source: "manual_rate_card", confidence: "unverified", notes: "Commercial assembly sell rate, not asset cost recovery.", lastUpdated: "" },
  { id: "inspection", name: "Inspection / QC if billable", rateEurPerHour: 0, source: "manual_rate_card", confidence: "unverified", notes: "Use only when inspection is sold separately.", lastUpdated: "" }
];

function marketRateCardEntries(assumptions: Assumptions | null): MarketRateCardEntry[] {
  const saved = assumptions?.market_rate_card;
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map((entry) => ({
      ...entry,
      rateEurPerHour: Number.isFinite(entry.rateEurPerHour) ? entry.rateEurPerHour : 0,
      source: entry.source ?? "manual_rate_card",
      confidence: entry.confidence ?? "unverified",
      notes: entry.notes ?? "",
      lastUpdated: entry.lastUpdated ?? ""
    }));
  }
  return DEFAULT_MARKET_RATE_CARD;
}

function marketRateById(entries: MarketRateCardEntry[]) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

// A second independent real observation (same class, another lost bid/competitor number)
// upgrades a class from "one data point" to "confirmed". Manual/cost-plus entries never earn
// more than "unverified" this way, and a buyer's stated benchmark never earns more than its
// own tier, however often it is repeated -- it stays a soft, buyer-biased ceiling.
function nextMarketConfidence(existing: MarketRateCardEntry, source: MarketRateSource): MarketRateConfidence {
  if (source === "buyer_disclosed") {
    return "buyer_disclosed";
  }
  if (source === "manual_rate_card" || source === "cost_plus_floor") {
    return "unverified";
  }
  if (existing.confidence === "single_data_point" || existing.confidence === "confirmed_multiple") {
    return "confirmed_multiple";
  }
  return "single_data_point";
}

function inferredMarketRateClassId(id: string, name: string) {
  const value = `${id} ${name}`.toLowerCase();
  if (value.includes("weld")) return "welding";
  if (value.includes("assembly") || value.includes("assembl") || value.includes("fitting") || value.includes("packing")) return "assembly";
  if (value.includes("qc") || value.includes("quality") || value.includes("inspection")) return "inspection";
  if (value.includes("cnc") || value.includes("mill") || value.includes("turn")) return "cnc";
  return "manual";
}

function machineMarketRateClassId(machine: Pick<MachineClass, "id" | "name" | "market_rate_class_id">) {
  return machine.market_rate_class_id ?? inferredMarketRateClassId(machine.id, machine.name);
}

function operationWorkCenterHours(operation: QuoteOperation, startedQuantity: number) {
  const machineMinutes = operation.setupMachineMinutes + operation.runMachineMinutesPerPart * startedQuantity;
  const laborMinutes = operation.setupLaborMinutes + operation.runLaborMinutesPerPart * startedQuantity;
  return Math.max(machineMinutes, laborMinutes) / 60;
}

function effectiveScrapPercent(operation: Pick<QuoteOperation, "scrapAllowancePercent">) {
  return Math.min(operation.scrapAllowancePercent, 0.95);
}

function startedQuantitiesForOperations(operations: QuoteOperation[], shippedQuantity: number) {
  const started = new Array<number>(operations.length).fill(shippedQuantity);
  let runningYield = 1;
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    runningYield *= 1 - effectiveScrapPercent(operations[index]);
    started[index] = shippedQuantity / Math.max(runningYield, 0.05);
  }
  return started;
}

function marketRateCardProfileId(assumptions: Assumptions | null) {
  return typeof assumptions?.market_rate_card_profile_id === "string" ? assumptions.market_rate_card_profile_id : null;
}

function marketRateCardProfileName(assumptions: Assumptions | null) {
  return typeof assumptions?.market_rate_card_profile_name === "string" ? assumptions.market_rate_card_profile_name : "";
}

function defaultCompanyAsset(
  id: string,
  name: string,
  loadedPowerKw: number,
  variableCostEurPerHour: number,
  capacityRole: AssetCapacityRole = inferredAssetCapacityRole(id, name)
): CompanyAsset {
  return {
    id,
    name,
    purchasePriceEur: 0,
    usefulLifeYears: 10,
    salvagePercent: 0,
    otherMonthlyFixedCostEur: 0,
    plannedHoursPerMonth: 160,
    actualAvailabilityPercent: 0.8,
    targetAvailabilityPercent: 0.9,
    actualUtilizationPercent: 0.35,
    targetUtilizationPercent: DEFAULT_TARGET_UTILIZATION_PERCENT,
    variableCostEurPerHour,
    sellRateEurPerHour: 0,
    loadedPowerKw,
    capacityRole,
    primaryLaborClassId: inferredAssetLaborClassId(id, name),
    quality: "company_estimate"
  };
}

function defaultCompanyEmployee(
  id: string,
  position: string,
  processArea: string,
  directLabor: boolean,
  employerRate: number,
  paidHours: number
): CompanyEmployee {
  return {
    id,
    position,
    processArea,
    headcount: 1,
    grossMonthlySalaryEur: 0,
    employerSocialContributionRate: employerRate,
    paidHoursPerMonth: paidHours,
    directLabor,
    quality: "company_estimate"
  };
}

function defaultProfileMaterial(
  id: string,
  name: string,
  materialGrade: string,
  stockDescription: string,
  stockShape: CompanyProfileMaterial["stockShape"]
): CompanyProfileMaterial {
  return { id, name, materialGrade, stockDescription, stockShape };
}

function defaultProfileTool(id: string, name: string, type: string, materialGroups = "general"): CompanyProfileTool {
  return { id, name, type, materialGroups };
}

function defaultProfileOperation(
  id: string,
  operationType: string,
  name: string,
  defaultMachineClassId: string | null,
  defaultLaborClassId: string | null
): CompanyProfileOperation {
  return { id, operationType, name, defaultMachineClassId, defaultLaborClassId };
}

function profileMaterials(profile: CompanyProfileState) {
  return profile.materials ?? [];
}

function profileTools(profile: CompanyProfileState) {
  return profile.tools ?? [];
}

function profileOperations(profile: CompanyProfileState) {
  return profile.operations ?? [];
}

function materialFromProfileRow(row: CompanyProfileMaterial, existing?: MaterialExample): MaterialExample {
  return {
    id: profileSlug(row.id || row.name, `material_${Date.now()}`),
    name: row.name,
    unit: existing?.unit ?? "stock_piece",
    stock_piece_cost_eur: existing?.stock_piece_cost_eur ?? 0,
    category: existing?.category ?? "raw_stock",
    material_grade: row.materialGrade,
    stock_description: row.stockDescription,
    supplier: existing?.supplier ?? "",
    minimum_order_quantity: existing?.minimum_order_quantity ?? 1,
    scrap_recovery_percent: existing?.scrap_recovery_percent ?? 0,
    last_updated: existing?.last_updated ?? new Date().toISOString().slice(0, 10),
    quality: existing?.quality ?? "company_estimate",
    stock_shape: row.stockShape || existing?.stock_shape,
    stock_length_mm: existing?.stock_length_mm ?? 0,
    stock_width_mm: existing?.stock_width_mm ?? 0,
    kerf_mm: existing?.kerf_mm ?? 0
  };
}

function toolFromProfileRow(row: CompanyProfileTool, existing?: ToolInventoryItem): ToolInventoryItem {
  return {
    id: profileSlug(row.id || row.name, `tool_${Date.now()}`),
    name: row.name,
    type: row.type,
    diameter_mm: existing?.diameter_mm ?? 0,
    corner_radius_mm: existing?.corner_radius_mm ?? 0,
    material_groups: row.materialGroups.split(",").map((item) => item.trim()).filter(Boolean),
    available_quantity: existing?.available_quantity ?? 0,
    replacement_cost_eur: existing?.replacement_cost_eur ?? 0,
    lead_time_days: existing?.lead_time_days ?? 0,
    reusable: existing?.reusable ?? true,
    quality: existing?.quality ?? "company_estimate"
  };
}

function operationTemplateFromProfileRow(row: CompanyProfileOperation, existing?: OperationTemplate): OperationTemplate {
  return {
    operation_type: profileSlug(row.operationType || row.name, `operation_${Date.now()}`),
    default_machine_class_id: row.defaultMachineClassId,
    default_labor_class_id: row.defaultLaborClassId,
    default_setup_machine_minutes: existing?.default_setup_machine_minutes ?? 0,
    default_setup_labor_minutes: existing?.default_setup_labor_minutes ?? 0,
    default_run_machine_minutes_per_part: existing?.default_run_machine_minutes_per_part ?? 0,
    default_run_labor_minutes_per_part: existing?.default_run_labor_minutes_per_part ?? 0,
    default_tooling_cost_per_part_eur: existing?.default_tooling_cost_per_part_eur ?? 0,
    default_consumables_cost_per_part_eur: existing?.default_consumables_cost_per_part_eur ?? 0,
    default_outsourced_cost_per_part_eur: existing?.default_outsourced_cost_per_part_eur ?? 0,
    default_outsourced_batch_cost_eur: existing?.default_outsourced_batch_cost_eur ?? 0,
    default_scrap_allowance_percent: existing?.default_scrap_allowance_percent ?? 0,
    calibration_sample_count: existing?.calibration_sample_count ?? 0,
    quality: existing?.quality ?? "company_estimate"
  };
}

function createStarterCompanyProfile(assumptions: Assumptions): CompanyProfileState {
  const employerRate = assumptions.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359;
  const paidHours = assumptions.payroll_tax_defaults?.paid_hours_per_month ?? 160;
  return {
    profileId: null,
    companyName: "Generic starter profile",
    lowValueInventoryTotalEur: 0,
    lowValueInventoryRefreshMonths: 24,
    assets: [
      defaultCompanyAsset("starter_manual_station", "General manual station", 2, 1.2),
      defaultCompanyAsset("starter_cnc_work_center", "Generic CNC work center", 12, 4),
      defaultCompanyAsset("starter_inspection_packing", "Inspection / packing area", 1, 0.8, "support_internal")
    ],
    employees: [
      defaultCompanyEmployee("starter_operator", "Production operator", "Shop floor", true, employerRate, paidHours),
      defaultCompanyEmployee("starter_cnc_technician", "CNC technician / programmer", "CNC setup and programming", true, employerRate, paidHours),
      defaultCompanyEmployee("starter_quality_support", "Quality / release support", "Inspection and documentation", false, employerRate, paidHours),
      defaultCompanyEmployee("starter_admin_sales", "Admin / sales / planning", "Office and customer coordination", false, employerRate, paidHours)
    ],
    overheadItems: [
      { id: "starter_facility", name: "Facility and shared utilities", monthly_cost_eur: 0, quality: "company_estimate" },
      { id: "starter_admin", name: "Administration and sales support", monthly_cost_eur: 0, quality: "company_estimate" },
      { id: "starter_quality", name: "Quality system and certification", monthly_cost_eur: 0, quality: "company_estimate" },
      { id: "starter_services", name: "General services and subscriptions", monthly_cost_eur: 0, quality: "company_estimate" }
    ],
    materials: [
      defaultProfileMaterial("starter_steel_stock", "Generic steel stock", "Steel", "Plate, bar, or tube stock", ""),
      defaultProfileMaterial("starter_aluminium_stock", "Generic aluminium stock", "Aluminium", "Plate or bar stock", ""),
      defaultProfileMaterial("starter_purchased_items", "Purchased components", "Mixed", "Fasteners, inserts, and bought-out items", "")
    ],
    tools: [
      defaultProfileTool("starter_cutting_tools", "General cutting tools", "cutting_tool", "steel, aluminium, general"),
      defaultProfileTool("starter_holemaking_tools", "Drills and taps", "holemaking_tool", "general"),
      defaultProfileTool("starter_fixtures_gauges", "Fixtures and measuring tools", "fixture_gauge", "general")
    ],
    operations: [
      defaultProfileOperation("starter_cutting", "saw_cutting", "Cut stock", "starter_manual_station", "starter_operator"),
      defaultProfileOperation("starter_cnc_machining", "milling_3_axis", "CNC machining", "starter_cnc_work_center", "starter_cnc_technician"),
      defaultProfileOperation("starter_drilling", "drilling", "Drilling / holemaking", "starter_cnc_work_center", "starter_operator"),
      defaultProfileOperation("starter_inspection", "manual_inspection", "Inspect and release", "starter_inspection_packing", "starter_operator"),
      defaultProfileOperation("starter_packing", "packing", "Pack for shipment", "starter_inspection_packing", "starter_operator")
    ]
  };
}

function assumptionsFromProfile(profile: CompanyProfileState, assumptions: Assumptions): Assumptions {
  const machineClasses: MachineClass[] = profile.assets.map((asset) => ({
    id: profileSlug(asset.id || asset.name, `asset_${Date.now()}`),
    name: asset.name,
    accounting_full_cost_rate_eur_per_hour: 0,
    target_competitive_rate_eur_per_hour: 0,
    actual_oee_percent: asset.actualAvailabilityPercent,
    target_oee_percent: asset.targetAvailabilityPercent,
    actual_availability_percent: Math.max(0.01, asset.actualAvailabilityPercent),
    target_availability_percent: Math.max(0.01, asset.targetAvailabilityPercent),
    actual_utilization_percent: Math.max(0.01, asset.actualUtilizationPercent),
    target_utilization_percent: Math.max(0.01, asset.targetUtilizationPercent),
    loaded_power_kw: asset.loadedPowerKw,
    monthly_fixed_cost_eur: profileAssetMonthlyFixedCost(asset),
    planned_hours_per_month: Math.max(1, asset.plannedHoursPerMonth),
    variable_cost_eur_per_hour: asset.variableCostEurPerHour,
    market_sell_rate_eur_per_hour: asset.sellRateEurPerHour ?? 0,
    market_rate_class_id: inferredMarketRateClassId(asset.id, asset.name),
    target_rate_discount_percent: 0,
    purchase_price_eur: asset.purchasePriceEur,
    useful_life_years: asset.usefulLifeYears,
    salvage_percent: asset.salvagePercent,
    other_monthly_fixed_cost_eur: asset.otherMonthlyFixedCostEur,
    capacity_role: assetCapacityRole(asset),
    default_labor_class_id: assetPrimaryLaborClassId(asset),
    quality: asset.quality || "company_estimate"
  }));

  const directEmployees = profile.employees.filter((employee) => employee.directLabor);
  const laborClasses: LaborClass[] = directEmployees.map((employee) => ({
    id: profileSlug(employee.id || employee.position, `labor_${Date.now()}`),
    name: employee.headcount > 1 ? `${employee.position} (${employee.headcount}x)` : employee.position,
    employer_cost_per_hour_eur: profileEmployeeHourlyCost(employee),
    gross_monthly_salary_eur: employee.grossMonthlySalaryEur,
    employer_social_contribution_rate: employee.employerSocialContributionRate,
    paid_hours_per_month: employee.paidHoursPerMonth,
    cost_method: "gross_monthly",
    derived_employer_cost_per_hour_eur: profileEmployeeHourlyCost(employee),
    headcount: employee.headcount,
    quality: employee.quality || "company_estimate"
  }));

  const indirectPayrollItems = profile.employees
    .filter((employee) => !employee.directLabor)
    .map((employee) => ({
      id: `indirect_${profileSlug(employee.id || employee.position, "employee")}`,
      name: `Indirect payroll - ${employee.position}`,
      monthly_cost_eur: roundMoney(employee.headcount * employee.grossMonthlySalaryEur * (1 + employee.employerSocialContributionRate)),
      quality: employee.quality || "company_estimate"
    }));
  const lowValueReserve = lowValueInventoryMonthlyReserve(profile);
  const lowValueItem = lowValueReserve > 0
    ? [{ id: "low_value_inventory_reserve", name: "Low-value inventory reserve", monthly_cost_eur: lowValueReserve, quality: "company_estimate" }]
    : [];

  const resolvedMachineClasses = machineClasses.length > 0 ? machineClasses : assumptions.machine_classes;
  const resolvedLaborClasses = laborClasses.length > 0 ? laborClasses : assumptions.labor_classes;
  const machineIds = new Set(resolvedMachineClasses.map((machine) => machine.id));
  const laborIds = new Set(resolvedLaborClasses.map((labor) => labor.id));
  const fallbackMachineId = resolvedMachineClasses[0]?.id ?? null;
  const fallbackLaborId = resolvedLaborClasses[0]?.id ?? null;

  const existingMaterials = new Map(assumptions.material_examples.map((material) => [material.id, material]));
  const materialExamples = profileMaterials(profile).length > 0
    ? profileMaterials(profile).map((row) => materialFromProfileRow(row, existingMaterials.get(profileSlug(row.id || row.name, "material"))))
    : assumptions.material_examples;

  const existingTools = new Map((assumptions.tool_inventory ?? []).map((tool) => [tool.id, tool]));
  const toolInventory = profileTools(profile).length > 0
    ? profileTools(profile).map((row) => toolFromProfileRow(row, existingTools.get(profileSlug(row.id || row.name, "tool"))))
    : assumptions.tool_inventory;

  const existingTemplates = new Map(assumptions.operation_templates.map((template) => [template.operation_type, template]));
  const operationTemplates = profileOperations(profile).length > 0
    ? profileOperations(profile).map((row) => {
      const machineId = row.defaultMachineClassId && machineIds.has(row.defaultMachineClassId) ? row.defaultMachineClassId : fallbackMachineId;
      const laborId = row.defaultLaborClassId && laborIds.has(row.defaultLaborClassId) ? row.defaultLaborClassId : fallbackLaborId;
      return operationTemplateFromProfileRow(
        { ...row, defaultMachineClassId: machineId, defaultLaborClassId: laborId },
        existingTemplates.get(profileSlug(row.operationType || row.name, "operation"))
      );
    })
    : assumptions.operation_templates.map((template) => ({
      ...template,
      default_machine_class_id: template.default_machine_class_id && machineIds.has(template.default_machine_class_id) ? template.default_machine_class_id : fallbackMachineId,
      default_labor_class_id: template.default_labor_class_id && laborIds.has(template.default_labor_class_id) ? template.default_labor_class_id : fallbackLaborId
    }));

  const nextAssumptions = {
    ...assumptions,
    name: profile.companyName || assumptions.name,
    labor_classes: resolvedLaborClasses,
    machine_classes: resolvedMachineClasses,
    material_examples: materialExamples,
    tool_inventory: toolInventory,
    operation_templates: operationTemplates,
    overhead: {
      allocation_method: assumptions.overhead?.allocation_method ?? "per_machine_hour",
      monthly_items: [...profile.overheadItems, ...lowValueItem, ...indirectPayrollItems]
    }
  };

  return withRecalculatedAssumptions(nextAssumptions);
}

function profitabilityCapacityDrivers(
  machine: MachineClass,
  capacityMode: ProfitabilityCapacityMode,
  scenarioUtilization?: number
) {
  const plannedHours = machine.planned_hours_per_month ?? 160;
  const availability = Math.max(
    0.01,
    availabilityValue(
      machine,
      capacityMode === "actual_current" ? "actual_availability_percent" : "target_availability_percent"
    )
  );
  const utilization = Math.max(
    0.01,
    capacityMode === "actual_current"
      ? machine.actual_utilization_percent ?? 1
      : capacityMode === "scenario"
        ? scenarioUtilization ?? DEFAULT_TARGET_UTILIZATION_PERCENT
        : machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT
  );
  return {
    plannedHours,
    availability,
    utilization,
    hours: plannedHours * availability * utilization
  };
}

// Profitability Calculator: "can we be profitable" independent of any single quote.
// Current actual mode is wired directly to per-asset actual Availability/Utilization.
// Target capacity mode is wired directly to per-asset target Availability/Utilization
// (the same fields set on Resources). Scenario mode is the opt-in uniform-Utilization
// what-if, only computed when the Compare checkbox is on.
function profitabilityEffectiveHours(
  machine: MachineClass,
  capacityMode: ProfitabilityCapacityMode = "target_capacity",
  scenarioUtilization?: number
) {
  return profitabilityCapacityDrivers(machine, capacityMode, scenarioUtilization).hours;
}

function profitabilityDirectCostMonth(
  assumptions: Assumptions | null,
  capacityMode: ProfitabilityCapacityMode = "target_capacity",
  scenarioUtilization?: number
) {
  return (assumptions?.machine_classes ?? []).reduce((sum, machine) => {
    const hours = profitabilityEffectiveHours(machine, capacityMode, scenarioUtilization);
    const fixedCost = machine.monthly_fixed_cost_eur ?? 0;
    const variableCost = machine.variable_cost_eur_per_hour ?? 0;
    return sum + fixedCost + variableCost * hours;
  }, 0);
}

function directPayrollMonth(assumptions: Assumptions | null) {
  return (assumptions?.labor_classes ?? []).reduce((sum, labor) => sum + laborMonthlyPayrollCost(labor, assumptions), 0);
}

function laborMonthlyPayrollCost(labor: LaborClass, assumptions: Assumptions | null) {
  const gross = labor.gross_monthly_salary_eur ?? 0;
  const employerRate = labor.employer_social_contribution_rate ?? assumptions?.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359;
  const headcount = labor.headcount ?? 1;
  if (gross <= 0) {
    return 0;
  }
  return headcount * gross * (1 + employerRate);
}

function targetProductiveHoursMonth(assumptions: Assumptions | null) {
  return (assumptions?.machine_classes ?? []).reduce(
    (sum, machine) => isSellableCapacityMachine(machine)
      ? sum + profitabilityEffectiveHours(machine, "target_capacity")
      : sum,
    0
  );
}

function directPayrollPerTargetHour(assumptions: Assumptions | null) {
  return directPayrollMonth(assumptions) / Math.max(1, targetProductiveHoursMonth(assumptions));
}

// Revenue and cost must move independently, or gross profit can never go negative.
// Profitability uses work-center pricing, not one blended shop sell rate for every station.
// Sellable assets create revenue hours. Support/internal assets do not create revenue hours;
// their machine cost is recovered across sellable assets as a support-cost allocation.
function profitabilitySoldHoursMonth(
  assumptions: Assumptions | null,
  capacityMode: ProfitabilityCapacityMode = "target_capacity",
  scenarioUtilization?: number
) {
  return (assumptions?.machine_classes ?? []).reduce(
    (sum, machine) => isSellableCapacityMachine(machine) ? sum + profitabilityEffectiveHours(machine, capacityMode, scenarioUtilization) : sum,
    0
  );
}

function profitabilityProductiveHoursMonth(
  assumptions: Assumptions | null,
  capacityMode: ProfitabilityCapacityMode = "target_capacity",
  scenarioUtilization?: number
) {
  return (assumptions?.machine_classes ?? []).reduce(
    (sum, machine) => sum + profitabilityEffectiveHours(machine, capacityMode, scenarioUtilization),
    0
  );
}

type ProfitabilityMachineBreakdownRow = {
  id: string;
  name: string;
  targetHours: number;
  fixedCostMonth: number;
  variableCostMonth: number;
  directCostMonth: number;
  directRate: number;
  hourShare: number;
  costShare: number;
  capacityRole: AssetCapacityRole;
  defaultLaborClassId: string | null;
  assignedPayrollRate: number;
  sharedAllocatedRate: number;
};

type ProfitabilitySellRateBreakdown = {
  machineRows: ProfitabilityMachineBreakdownRow[];
  sellableRows: ProfitabilityMachineBreakdownRow[];
  supportRows: ProfitabilityMachineBreakdownRow[];
  targetHours: number;
  sellableMachineCostMonth: number;
  supportMachineCostMonth: number;
  machineCostMonth: number;
  sellableMachineRate: number;
  supportMachineRate: number;
  machineRate: number;
  directPayroll: number;
  assignedPayrollMonth: number;
  assignedPayrollRate: number;
  supportPayrollMonth: number;
  supportPayrollRate: number;
  unassignedPayrollMonth: number;
  unassignedPayrollRate: number;
  directPayrollRate: number;
  overheadMonth: number;
  overheadRate: number;
  sharedAllocatedRate: number;
  baseRate: number;
  riskRate: number;
  rateAfterRisk: number;
  marginGrossUp: number;
  sellRate: number;
};

type ProfitabilityRevenueBreakdownRow = {
  id: string;
  name: string;
  plannedHours: number;
  targetAvailability: number;
  scenarioUtilization: number;
  scenarioHours: number;
  ownMachineRate: number;
  assignedPayrollRate: number;
  sharedAllocatedRate: number;
  baseRate: number;
  requiredSellRate: number;
  targetSellRate: number;
  compareScenarioSellRate: number | null;
  marketSellRate: number;
  hasMarketSellRate: boolean;
  sellRate: number;
  revenue: number;
};

function profitabilityMachineBreakdownRows(
  assumptions: Assumptions | null,
  capacityMode: ProfitabilityCapacityMode,
  scenarioUtilization?: number
): ProfitabilityMachineBreakdownRow[] {
  const baseRows = (assumptions?.machine_classes ?? []).map((machine) => {
    const targetHours = profitabilityEffectiveHours(machine, capacityMode, scenarioUtilization);
    const fixedCostMonth = machine.monthly_fixed_cost_eur ?? 0;
    const variableCostMonth = (machine.variable_cost_eur_per_hour ?? 0) * targetHours;
    const directCostMonth = fixedCostMonth + variableCostMonth;
    return {
      id: machine.id,
      name: machine.name,
      targetHours,
      fixedCostMonth,
      variableCostMonth,
      directCostMonth,
      directRate: directCostMonth / Math.max(1, targetHours),
      hourShare: 0,
      costShare: 0,
      capacityRole: machineCapacityRole(machine),
      defaultLaborClassId: machine.default_labor_class_id ?? null,
      assignedPayrollRate: 0,
      sharedAllocatedRate: 0
    };
  });
  const sellableHours = baseRows.filter((row) => row.capacityRole === "sellable_capacity").reduce((sum, row) => sum + row.targetHours, 0);
  const totalCost = baseRows.reduce((sum, row) => sum + row.directCostMonth, 0);
  return baseRows.map((row) => ({
    ...row,
    hourShare: row.capacityRole === "sellable_capacity" && sellableHours > 0 ? row.targetHours / sellableHours : 0,
    costShare: totalCost > 0 ? row.directCostMonth / totalCost : 0
  }));
}

function profitabilitySellRateBreakdown(
  assumptions: Assumptions | null,
  marginPercent: number,
  riskPercent: number,
  capacityMode: ProfitabilityCapacityMode,
  scenarioUtilization?: number
): ProfitabilitySellRateBreakdown {
  const baseMachineRows = profitabilityMachineBreakdownRows(assumptions, capacityMode, scenarioUtilization);
  const baseSellableRows = baseMachineRows.filter((row) => row.capacityRole === "sellable_capacity");
  const baseSupportRows = baseMachineRows.filter((row) => row.capacityRole !== "sellable_capacity");
  const targetHours = baseSellableRows.reduce((sum, row) => sum + row.targetHours, 0);
  const sellableMachineCostMonth = baseSellableRows.reduce((sum, row) => sum + row.directCostMonth, 0);
  const supportMachineCostMonth = baseSupportRows.reduce((sum, row) => sum + row.directCostMonth, 0);
  const machineCostMonth = sellableMachineCostMonth + supportMachineCostMonth;
  const sellableMachineRate = sellableMachineCostMonth / Math.max(1, targetHours);
  const supportMachineRate = supportMachineCostMonth / Math.max(1, targetHours);
  const machineRate = machineCostMonth / Math.max(1, targetHours);

  const sellableHoursByLabor = new Map<string, number>();
  const supportHoursByLabor = new Map<string, number>();
  baseMachineRows.forEach((row) => {
    if (!row.defaultLaborClassId) return;
    const targetMap = row.capacityRole === "sellable_capacity" ? sellableHoursByLabor : supportHoursByLabor;
    targetMap.set(row.defaultLaborClassId, (targetMap.get(row.defaultLaborClassId) ?? 0) + row.targetHours);
  });

  // NRE: the CAM/programming labor class stays out of the shared pool (recovered through
  // the quote's engineering line) but its payroll still counts as monthly cost in the P&L.
  const engineeringLaborId = assumptions?.cam_programming_defaults?.programming_labor_class_id ?? null;
  const assignedPayrollRateByLabor = new Map<string, number>();
  let assignedPayrollMonth = 0;
  let supportPayrollMonth = 0;
  let unassignedPayrollMonth = 0;
  let engineeringPayrollMonth = 0;
  (assumptions?.labor_classes ?? []).forEach((labor) => {
    const payroll = laborMonthlyPayrollCost(labor, assumptions);
    const sellableHours = sellableHoursByLabor.get(labor.id) ?? 0;
    if (sellableHours > 0) {
      assignedPayrollMonth += payroll;
      assignedPayrollRateByLabor.set(labor.id, payroll / sellableHours);
    } else if (labor.id === engineeringLaborId) {
      engineeringPayrollMonth += payroll;
    } else if ((supportHoursByLabor.get(labor.id) ?? 0) > 0) {
      supportPayrollMonth += payroll;
    } else {
      unassignedPayrollMonth += payroll;
    }
  });

  const payrollMappedRows = baseMachineRows.map((row) => ({
    ...row,
    assignedPayrollRate: row.capacityRole === "sellable_capacity" && row.defaultLaborClassId
      ? assignedPayrollRateByLabor.get(row.defaultLaborClassId) ?? 0
      : 0
  }));
  const directPayroll = assignedPayrollMonth + supportPayrollMonth + unassignedPayrollMonth + engineeringPayrollMonth;
  const assignedPayrollRate = assignedPayrollMonth / Math.max(1, targetHours);
  const supportPayrollRate = supportPayrollMonth / Math.max(1, targetHours);
  const unassignedPayrollRate = unassignedPayrollMonth / Math.max(1, targetHours);
  const directPayrollRate = directPayroll / Math.max(1, targetHours);
  const overheadMonth = totalMonthlyOverheadEur(assumptions);
  const overheadRate = overheadMonth / Math.max(1, targetHours);
  const sharedAllocatedRate = supportMachineRate + supportPayrollRate + unassignedPayrollRate + overheadRate;
  // The shared pool (support assets + support/unassigned payroll + overhead) is spread over
  // sellable stations in proportion to each station's own hourly rate (machine EUR/h +
  // assigned payroll EUR/h), not flat per hour: an expensive CNC hour absorbs more of the
  // pool than a cheap manual bench hour. The pool total recovered stays the same either way.
  const sharedPoolMonth = supportMachineCostMonth + supportPayrollMonth + unassignedPayrollMonth + overheadMonth;
  const stationRateWeight = (row: ProfitabilityMachineBreakdownRow) => row.directRate + row.assignedPayrollRate;
  const sharedWeightedHoursTotal = payrollMappedRows.reduce((sum, row) => (
    row.capacityRole === "sellable_capacity"
      ? sum + stationRateWeight(row) * row.targetHours
      : sum
  ), 0);
  const machineRows = payrollMappedRows.map((row) => {
    if (row.capacityRole !== "sellable_capacity" || row.targetHours <= 0) {
      return row;
    }
    return {
      ...row,
      sharedAllocatedRate: sharedWeightedHoursTotal > 0
        ? sharedPoolMonth * (stationRateWeight(row) / sharedWeightedHoursTotal)
        : sharedAllocatedRate
    };
  });
  const sellableRows = machineRows.filter((row) => row.capacityRole === "sellable_capacity");
  const supportRows = machineRows.filter((row) => row.capacityRole !== "sellable_capacity");
  const baseRate = machineRate + directPayrollRate + overheadRate;
  const riskRate = baseRate * riskPercent;
  const rateAfterRisk = baseRate + riskRate;
  const sellRate = rateAfterRisk / Math.max(0.01, 1 - marginPercent);
  const marginGrossUp = sellRate - rateAfterRisk;
  return {
    machineRows,
    sellableRows,
    supportRows,
    targetHours,
    sellableMachineCostMonth,
    supportMachineCostMonth,
    machineCostMonth,
    sellableMachineRate,
    supportMachineRate,
    machineRate,
    directPayroll,
    assignedPayrollMonth,
    assignedPayrollRate,
    supportPayrollMonth,
    supportPayrollRate,
    unassignedPayrollMonth,
    unassignedPayrollRate,
    directPayrollRate,
    overheadMonth,
    overheadRate,
    sharedAllocatedRate,
    baseRate,
    riskRate,
    rateAfterRisk,
    marginGrossUp,
    sellRate
  };
}

// Revenue/hours are always built on today's real Availability/Utilization ("actual_current").
// targetBreakdown supplies a second, independent required-rate figure -- what this station
// would need to charge if it ran at its own target Utilization/Availability from Resources --
// so the two can be compared side by side without either one silently driving the other.
function profitabilityRevenueBreakdownRows(
  assumptions: Assumptions | null,
  breakdown: ProfitabilitySellRateBreakdown,
  targetBreakdown: ProfitabilitySellRateBreakdown,
  marginPercent: number,
  riskPercent: number,
  capacityMode: ProfitabilityCapacityMode,
  compareScenarioBreakdown?: ProfitabilitySellRateBreakdown
): ProfitabilityRevenueBreakdownRow[] {
  const rowById = new Map(breakdown.sellableRows.map((row) => [row.id, row]));
  const targetRowById = new Map(targetBreakdown.sellableRows.map((row) => [row.id, row]));
  const compareRowById = new Map((compareScenarioBreakdown?.sellableRows ?? []).map((row) => [row.id, row]));
  return (assumptions?.machine_classes ?? []).filter(isSellableCapacityMachine).map((machine) => {
    const machineRow = rowById.get(machine.id);
    const targetMachineRow = targetRowById.get(machine.id);
    const capacity = profitabilityCapacityDrivers(machine, capacityMode);
    const ownMachineRate = machineRow?.directRate ?? 0;
    const assignedPayrollRate = machineRow?.assignedPayrollRate ?? 0;
    const sharedAllocatedRate = machineRow?.sharedAllocatedRate ?? breakdown.sharedAllocatedRate;
    const baseRate = ownMachineRate + assignedPayrollRate + sharedAllocatedRate;
    const requiredSellRate = (baseRate * (1 + riskPercent)) / Math.max(0.01, 1 - marginPercent);
    const targetBaseRate = (targetMachineRow?.directRate ?? 0)
      + (targetMachineRow?.assignedPayrollRate ?? 0)
      + (targetMachineRow?.sharedAllocatedRate ?? targetBreakdown.sharedAllocatedRate);
    const targetSellRate = (targetBaseRate * (1 + riskPercent)) / Math.max(0.01, 1 - marginPercent);
    let compareScenarioSellRate: number | null = null;
    if (compareScenarioBreakdown) {
      const compareMachineRow = compareRowById.get(machine.id);
      const compareBaseRate = (compareMachineRow?.directRate ?? 0)
        + (compareMachineRow?.assignedPayrollRate ?? 0)
        + (compareMachineRow?.sharedAllocatedRate ?? compareScenarioBreakdown.sharedAllocatedRate);
      compareScenarioSellRate = (compareBaseRate * (1 + riskPercent)) / Math.max(0.01, 1 - marginPercent);
    }
    const marketSellRate = marketSellRateValue(machine);
    return {
      id: machine.id,
      name: machine.name,
      plannedHours: capacity.plannedHours,
      targetAvailability: capacity.availability,
      scenarioUtilization: capacity.utilization,
      scenarioHours: capacity.hours,
      ownMachineRate,
      assignedPayrollRate,
      sharedAllocatedRate,
      baseRate,
      requiredSellRate,
      compareScenarioSellRate,
      targetSellRate,
      marketSellRate,
      hasMarketSellRate: marketSellRate > 0,
      sellRate: marketSellRate,
      revenue: capacity.hours * marketSellRate
    };
  });
}

// Quotes earn a handling markup on material and bought-out items (commercial policy), but
// hour-based revenue capacity would silently drop that contribution. This optional percent
// adds it back as a share of conversion revenue, so shop-level revenue matches what quotes
// actually charge. Default 0 keeps the conservative hours-only view.
function profitabilityMaterialMarginPercent(assumptions: Assumptions | null) {
  return assumptions?.profitability_settings?.material_margin_percent_of_revenue ?? 0;
}

// A person must be counted once: either as a direct labor class (their payroll is the
// "Direct payroll" bridge column) or inside the overhead expense list (e.g. "Indirect
// payroll" rows from the Company Profile) -- never both, or the monthly cost is overstated.
function payrollDoubleCountWarnings(assumptions: Assumptions | null): string[] {
  const overheadItems = assumptions?.overhead?.monthly_items ?? [];
  const warnings: string[] = [];
  (assumptions?.labor_classes ?? []).forEach((labor) => {
    const laborName = (labor.name ?? "").toLowerCase().replace(/\s*\(\d+\s*x\)\s*/g, " ").trim();
    if (laborName.length < 4) return;
    overheadItems.forEach((item) => {
      const itemName = (item.name ?? "").toLowerCase().replace(/^indirect payroll\s*-\s*/, "").trim();
      if (itemName.length < 4) return;
      if (itemName.includes(laborName) || laborName.includes(itemName)) {
        warnings.push(
          `"${labor.name}" is a direct labor class and a similar row ("${item.name}") sits in the overhead list. `
          + "If this is the same person, their cost is counted twice -- remove one of the two entries."
        );
      }
    });
  });
  return warnings;
}

// Operating profit at one shop-wide, uniform Utilization value (holding target Availability),
// using the same revenue and cost rules as the bridge chart. This is a pure sensitivity sweep
// for the "other load levels" table and the break-even check below -- it does not read any
// single asset's actual or target Utilization field.
function profitabilityOperatingProfitAtUtilization(assumptions: Assumptions | null, utilizationScenario: number) {
  const utilization = Math.max(0.01, utilizationScenario);
  let revenue = 0;
  let variableCost = 0;
  let fixedCostMonth = 0;
  (assumptions?.machine_classes ?? []).forEach((machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    const availability = Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
    const hours = plannedHours * availability * utilization;
    if (isSellableCapacityMachine(machine)) {
      revenue += hours * marketSellRateValue(machine);
    }
    variableCost += hours * (machine.variable_cost_eur_per_hour ?? 0);
    fixedCostMonth += machine.monthly_fixed_cost_eur ?? 0;
  });
  const materialMargin = revenue * profitabilityMaterialMarginPercent(assumptions);
  const cost = fixedCostMonth + variableCost + directPayrollMonth(assumptions) + totalMonthlyOverheadEur(assumptions);
  return revenue + materialMargin - cost;
}

// Machine EUR/h alone must never be eyeballed against Market sell EUR/h -- the market rate
// pays for the operator too. This is the attendance-aware operator share for one machine:
// the assigned labor class's full payroll spread over the target hours of ALL machines that
// share that operator (one person tending three machines costs each machine a third).
// Same allocation logic as Profitability's assigned-payroll rate, so the two pages agree.
function machineOperatorShareRate(machine: MachineClass, assumptions: Assumptions | null) {
  const laborId = machine.default_labor_class_id;
  if (!laborId || !assumptions) {
    return 0;
  }
  const labor = assumptions.labor_classes.find((item) => item.id === laborId);
  if (!labor) {
    return 0;
  }
  const sharedHours = assumptions.machine_classes
    .filter((item) => item.default_labor_class_id === laborId)
    .reduce((sum, item) => sum + profitabilityEffectiveHours(item, "target_capacity"), 0);
  return laborMonthlyPayrollCost(labor, assumptions) / Math.max(1, sharedHours);
}

function profitabilityBreakEvenUtilization(assumptions: Assumptions | null) {
  const machines = assumptions?.machine_classes ?? [];
  let revenueAtFullUtilization = 0;
  let variableCostAtFullUtilization = 0;
  let fixedCostMonth = 0;
  let missingSellRate = false;
  machines.forEach((machine) => {
    const availability = Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
    const hours = (machine.planned_hours_per_month ?? 160) * availability * 1;
    if (isSellableCapacityMachine(machine)) {
      const marketSellRate = marketSellRateValue(machine);
      if (marketSellRate <= 0) {
        missingSellRate = true;
      }
      revenueAtFullUtilization += hours * marketSellRate;
    }
    variableCostAtFullUtilization += hours * (machine.variable_cost_eur_per_hour ?? 0);
    fixedCostMonth += machine.monthly_fixed_cost_eur ?? 0;
  });
  if (missingSellRate) {
    return null;
  }
  revenueAtFullUtilization *= 1 + profitabilityMaterialMarginPercent(assumptions);
  const overheadMonth = totalMonthlyOverheadEur(assumptions);
  const directPayroll = directPayrollMonth(assumptions);
  const denominator = revenueAtFullUtilization - variableCostAtFullUtilization;
  if (denominator <= 0) {
    return null;
  }
  return (fixedCostMonth + directPayroll + overheadMonth) / denominator;
}

function averageActualUtilization(assumptions: Assumptions | null) {
  const machines = (assumptions?.machine_classes ?? []).filter(isSellableCapacityMachine);
  if (machines.length === 0) {
    return 0.5;
  }
  const availableHours = machines.reduce((total, machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    return total + plannedHours * Math.max(0.01, availabilityValue(machine, "actual_availability_percent"));
  }, 0);
  const loadedHours = machines.reduce((total, machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    const availability = Math.max(0.01, availabilityValue(machine, "actual_availability_percent"));
    const utilization = Math.max(0.01, machine.actual_utilization_percent ?? 1);
    return total + plannedHours * availability * utilization;
  }, 0);
  return loadedHours / Math.max(1, availableHours);
}

function averageTargetUtilization(assumptions: Assumptions | null) {
  const machines = (assumptions?.machine_classes ?? []).filter(isSellableCapacityMachine);
  if (machines.length === 0) {
    return DEFAULT_TARGET_UTILIZATION_PERCENT;
  }
  const availableHours = machines.reduce((total, machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    return total + plannedHours * Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
  }, 0);
  const loadedHours = machines.reduce((total, machine) => {
    const plannedHours = machine.planned_hours_per_month ?? 160;
    const availability = Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
    const utilization = Math.max(0.01, machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT);
    return total + plannedHours * availability * utilization;
  }, 0);
  return loadedHours / Math.max(1, availableHours);
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
  machineDirectCost,
  directPayroll,
  overhead,
  operatingProfit,
  revenueLabel,
  resultLabel,
  lang
}: {
  revenue: number;
  machineDirectCost: number;
  directPayroll: number;
  overhead: number;
  operatingProfit: number;
  revenueLabel?: string;
  resultLabel?: string;
  lang: Language;
}) {
  const t = (text: string) => translate(text, lang);
  const revenueLabelText = revenueLabel ?? t("Revenue capacity");
  const chartHeight = 220;
  const afterMachineCost = revenue - machineDirectCost;
  const afterDirectPayroll = afterMachineCost - directPayroll;
  const totals = [0, revenue, afterMachineCost, afterDirectPayroll, operatingProfit];
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
  const machineCostSeg = segment(revenue, afterMachineCost);
  const directPayrollSeg = segment(afterMachineCost, afterDirectPayroll);
  const overheadSeg = segment(afterDirectPayroll, operatingProfit);
  const totalSeg = segment(0, operatingProfit);
  const zeroLinePx = ((scaleMax - 0) / range) * chartHeight;
  const isProfit = operatingProfit > 0;

  return (
    <div className="profitBridge">
      <div className="profitBridgeLegend">
        <span><span className="swatch add" /> {t("Adds")}</span>
        <span><span className="swatch subtract" /> {t("Subtracts")}</span>
        <span><span className="swatch result-good" /> {t("Result (profit)")}</span>
        <span><span className="swatch result-bad" /> {t("Result (loss)")}</span>
      </div>
      <div className="profitBridgeChart" style={{ height: chartHeight }}>
        <div className="profitBridgeZeroLine" style={{ top: zeroLinePx }} />
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar add" style={{ top: revenueSeg.top, height: revenueSeg.height }} />
          <span className="profitBridgeValue" style={{ top: revenueSeg.top - 20 }}>{money.format(revenue)}</span>
          <span className="profitBridgeLabel">{revenueLabelText}</span>
        </div>
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar subtract" style={{ top: machineCostSeg.top, height: machineCostSeg.height }} />
          <span className="profitBridgeValue" style={{ top: machineCostSeg.top - 20 }}>-{money.format(machineDirectCost)}</span>
          <span className="profitBridgeLabel">{t("Machine direct cost")}</span>
        </div>
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar subtract" style={{ top: directPayrollSeg.top, height: directPayrollSeg.height }} />
          <span className="profitBridgeValue" style={{ top: directPayrollSeg.top - 20 }}>-{money.format(directPayroll)}</span>
          <span className="profitBridgeLabel">{t("Direct payroll/mo")}</span>
        </div>
        <div className="profitBridgeColumn">
          <div className="profitBridgeBar subtract" style={{ top: overheadSeg.top, height: overheadSeg.height }} />
          <span className="profitBridgeValue" style={{ top: overheadSeg.top - 20 }}>-{money.format(overhead)}</span>
          <span className="profitBridgeLabel">{t("Overhead")}</span>
        </div>
        <div className="profitBridgeColumn">
          <div className={`profitBridgeBar ${isProfit ? "result-good" : "result-bad"}`} style={{ top: totalSeg.top, height: totalSeg.height }} />
          <span className="profitBridgeValue" style={{ top: totalSeg.top - 20 }}>{money.format(operatingProfit)}</span>
          <span className="profitBridgeLabel">
            {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {resultLabel ?? (isProfit ? t("Operating profit") : t("Operating loss"))}
          </span>
        </div>
      </div>
    </div>
  );
}

function PrintableQuote({
  assumptions,
  customerName,
  deliveryEstimate,
  partName,
  paymentTerms,
  quantity,
  quantityBreakResults,
  quoteNumber,
  quoteOperations,
  rfqReference,
  stockName,
  targetResult,
  validityDate,
  lang
}: {
  assumptions: Assumptions | null;
  customerName: string;
  deliveryEstimate: string;
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
  lang: Language;
}) {
  const generatedAt = new Date().toLocaleString("en-GB");
  const t = (text: string) => translate(text, lang);

  return (
    <section className="printPage">
      <header className="printHeader">
        <div>
          <h1>{quoteNumber || t("Customer Offer")}</h1>
          <p>{partName} | {t("Quantity")} {quantity}</p>
          <p>{customerName || t("No customer entered")}{rfqReference ? ` | ${t("RFQ")} ${rfqReference}` : ""}</p>
        </div>
        <div className="printMeta">
          <span>{t("Generated")} {generatedAt}</span>
          <span>{t("Valid until")} {validityDate || t("not set")}</span>
          <span>{t("Delivery")} {deliveryEstimate || t("not set")}</span>
          <span>{paymentTerms || t("Payment terms not set")}</span>
          <span>{t("Customer Offer")}</span>
          <span>{t("Formula")} {assumptions?.formula_version ?? "costing.v0.2"}</span>
        </div>
      </header>

      <section className="printSummaryGrid">
        <div><span>{t("Material stock")}</span><strong>{stockName}</strong></div>
        <div><span>{t("Target sell price")}</span><strong>{targetResult ? money.format(targetResult.sell_price_eur) : t("Not calculated")}</strong></div>
        <div><span>{t("Target unit price")}</span><strong>{targetResult ? money.format(targetResult.unit_sell_price_eur) : t("Not calculated")}</strong></div>
        <div><span>{t("Missing-tool cost (separate from outsourced)")}</span><strong>{targetResult ? money.format(targetResult.missing_tool_cost_eur) : t("Not calculated")}</strong></div>
      </section>

      <section className="printSection">
        <h2>{t("Quantity Pricing")}</h2>
        <table>
          <thead>
            <tr><th>{t("Qty, pcs")}</th><th>{t("Total price, EUR")}</th><th>{t("Unit price, EUR/pc")}</th></tr>
          </thead>
          <tbody>
            {quantityBreakResults.map((item) => (
              <tr key={item.quantity}>
                <td>{item.quantity}</td>
                <td>{money.format(item.target.sell_price_eur)}</td>
                <td>{money.format(item.target.unit_sell_price_eur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="printSection">
        <h2>{t("Route")}</h2>
        <table>
          <thead><tr><th>{t("Operation")}</th><th>{t("Machine")}</th><th>{t("Labor")}</th><th>{t("Setup, min")}</th><th>{t("Cycle, min/part")}</th></tr></thead>
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

      <section className="printSection">
        <h2>{t("Commercial Notes")}</h2>
        <p>{t("This offer is based on the supplied RFQ information and current assumptions. Internal cost breakdowns and accounting-rate comparison are intentionally excluded.")}</p>
      </section>
    </section>
  );
}

function App() {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null) ?? "en"
  );
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);
  const t = (text: string) => translate(text, language);

  const [activeView, setActiveView] = useState<View>("profile");
  // The quote starts empty on purpose: nothing on the page should look like real data
  // until the user enters it or explicitly loads the demo RFQ / an ERP part / a draft.
  const [partName, setPartName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [rfqReference, setRfqReference] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [quantity, setQuantity] = useState(20);
  const [quantityBreakText, setQuantityBreakText] = useState("");
  const [quantityBreakResults, setQuantityBreakResults] = useState<Array<{ quantity: number; target: QuoteResult; accounting: QuoteResult; materialScaledLinearly?: boolean }>>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockCost, setStockCost] = useState(0);
  const [stockPieces, setStockPieces] = useState(1);
  const [cutLengthMm, setCutLengthMm] = useState(0);
  const [cutWidthMm, setCutWidthMm] = useState(0);
  const [scrapRecovery, setScrapRecovery] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [competitorUnitPriceEur, setCompetitorUnitPriceEur] = useState<number | null>(null);
  const [whatIfMarginPercent, setWhatIfMarginPercent] = useState<number | null>(null);
  const [whatIfUtilizationPercent, setWhatIfUtilizationPercent] = useState<number | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<{ unitPrice: number; marginPercent: number; utilizationPercent: number } | null>(null);
  const [gapWaterfall, setGapWaterfall] = useState<Array<{ step: string; detail: string; price: number; deltaEur: number; deltaPercent: number }> | null>(null);
  const [sensitivityTable, setSensitivityTable] = useState<Array<{ driver: string; minus25: number; minus10: number; base: number; plus10: number; plus25: number }> | null>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState("");
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
  const [profitabilityCompareScenario, setProfitabilityCompareScenario] = useState(false);
  const [profitabilityScenarioUtilization, setProfitabilityScenarioUtilization] = useState(0.7);
  const [selectedTemplateType, setSelectedTemplateType] = useState("milling_3_axis");
  const [quoteOperations, setQuoteOperations] = useState<QuoteOperation[]>([]);
  const [actualOperations, setActualOperations] = useState<ActualOperation[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [assumptionsText, setAssumptionsText] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileState | null>(null);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [profileStatus, setProfileStatus] = useState("Loading company profiles...");
  const [expandedFixedCostHelpers, setExpandedFixedCostHelpers] = useState<Record<string, boolean>>({});
  const [expandedPortalDetails, setExpandedPortalDetails] = useState<Record<string, boolean>>({});
  // Reference-data sections start collapsed so pages read top-to-bottom during a
  // presentation without long scrolls; anything demo-critical stays open by default.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  function isSectionOpen(id: string, defaultOpen = false) {
    return openSections[id] ?? defaultOpen;
  }
  function toggleSection(id: string, defaultOpen = false) {
    setOpenSections((current) => ({ ...current, [id]: !(current[id] ?? defaultOpen) }));
  }
  function sectionToggle(id: string, defaultOpen = false) {
    const open = isSectionOpen(id, defaultOpen);
    return (
      <button className="iconButton sectionToggle" title={open ? "Collapse section" : "Expand section"} onClick={() => toggleSection(id, defaultOpen)}>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
    );
  }
  const [erpOfferMaterialUnitCost, setErpOfferMaterialUnitCost] = useState<Record<string, number>>({});
  const [assumedMaterialMarkupPercent, setAssumedMaterialMarkupPercent] = useState(10);
  const [marketEvidenceSellPrice, setMarketEvidenceSellPrice] = useState(0);
  const [marketEvidenceProductionCost, setMarketEvidenceProductionCost] = useState(0);
  const [marketEvidenceMaterialSell, setMarketEvidenceMaterialSell] = useState(0);
  const [marketEvidenceBoughtOutSell, setMarketEvidenceBoughtOutSell] = useState(0);
  const [marketEvidenceFixedCharges, setMarketEvidenceFixedCharges] = useState(0);
  const [marketEvidenceSolveClassId, setMarketEvidenceSolveClassId] = useState("__blended");
  const [marketEvidenceSource, setMarketEvidenceSource] = useState<MarketRateSource>("lost_quote");
  const [marketEvidenceRows, setMarketEvidenceRows] = useState<MarketEvidenceRouteRow[]>([
    { id: "market_route_row_1", marketRateClassId: "cnc", hours: 1 }
  ]);
  const [basketRows, setBasketRows] = useState<BasketRow[]>([]);
  const [basketStatus, setBasketStatus] = useState("");
  const [basketSolveResult, setBasketSolveResult] = useState<BasketSolveResult | null>(null);
  const [basketPdfFile, setBasketPdfFile] = useState<File | null>(null);
  const [basketExtracting, setBasketExtracting] = useState(false);
  const [assumptionStatus, setAssumptionStatus] = useState("Loading assumptions...");
  const [pendingCalibration, setPendingCalibration] = useState<CalibrationCandidate[] | null>(null);
  const [calibrationConfirmations, setCalibrationConfirmations] = useState<Record<string, boolean>>({});
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
        setCompanyProfile((current) => current ?? createStarterCompanyProfile(data));
        setAssumptionStatus("Assumptions loaded");
        setProveoutMinutes(data.cam_programming_defaults.default_setup_proveout_minutes);
        setProgrammingMinutes(data.cam_programming_defaults.medium_programming_minutes);
        setSelectedTemplateType(data.operation_templates[0]?.operation_type ?? "milling_3_axis");
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

    async function loadBasketRows() {
      try {
        const response = await fetch("/api/market-evidence/basket-rows");
        if (!response.ok) {
          throw new Error(`Basket row list returned ${response.status}`);
        }
        const data = (await response.json()) as any[];
        if (!cancelled) {
          setBasketRows(data.map(basketRowFromApi));
        }
      } catch (error) {
        if (!cancelled) {
          setBasketStatus(error instanceof Error ? error.message : "Failed to load basket rows");
        }
      }
    }

    loadBasketRows();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadErpOfferMaterialUnitCost() {
      try {
        const response = await fetch("/api/erp/customer-offers");
        if (!response.ok) {
          throw new Error(`Customer offer list returned ${response.status}`);
        }
        const data = (await response.json()) as ErpCustomerOfferRecord[];
        if (cancelled) return;
        const costs: Record<string, number> = {};
        for (const offer of data) {
          const key = normalizePartName(offer.part_name || "");
          if (!key || offer.material_unit_cost_eur == null) continue;
          if (costs[key] === undefined) costs[key] = offer.material_unit_cost_eur;
        }
        setErpOfferMaterialUnitCost(costs);
      } catch {
        // Non-critical: basket rows just fall back to manual material entry.
      }
    }

    loadErpOfferMaterialUnitCost();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyProfiles() {
      try {
        const response = await fetch("/api/company-profiles");
        if (response.status === 404) {
          if (!cancelled) {
            setCompanyProfiles([]);
            setProfileStatus("No saved profiles loaded. Restart the backend to enable server-side company profile save/load.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error(`Company profile storage unavailable (${response.status})`);
        }
        const data = (await response.json()) as CompanyProfile[];
        if (!cancelled) {
          setCompanyProfiles(data);
          setProfileStatus(data.length > 0 ? "Company profiles loaded" : "No saved company profiles yet");
        }
      } catch (error) {
        if (!cancelled) {
          setProfileStatus(error instanceof Error ? error.message : "Failed to load company profiles");
        }
      }
    }

    loadCompanyProfiles();
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

  const quoteHasRoute = quoteOperations.length > 0;
  const displayTargetResult = quoteHasRoute ? targetResult : null;
  const displayAccountingResult = quoteHasRoute ? accountingResult : null;
  const activeCostingBasisName = assumptions?.name?.trim() || "Assumptions not loaded";
  const loadedProfileName = companyProfile?.companyName?.trim() || "";
  const loadedProfileNotApplied = Boolean(
    assumptions && loadedProfileName && loadedProfileName !== activeCostingBasisName
  );

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
    minimum_order_admin_cost_eur: 45,
    material_markup_percent: 0.1
  };
  const materialMarkupPercent = commercialPolicy.material_markup_percent ?? 0.1;

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
    const overheadPerHour = weightedSharedRecoveryPerMachineHour(assumptions, machine, availabilityField, utilizationField);
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
    const labor = laborById.get(laborClassId);
    if (!labor) {
      return 0;
    }
    if (labor.cost_method === "gross_monthly") {
      return deriveLaborHourlyCost(labor, assumptions);
    }
    return labor.employer_cost_per_hour_eur ?? 0;
  }

  // Attendance floor: charged labor minutes are never below machine minutes x the station's
  // operator attendance share, so quotes cannot leak operator salary on machine-paced work.
  function attendedLaborMinutes(machineClassId: string | null, machineMinutes: number, laborMinutes: number) {
    const machine = machineClassId ? machineById.get(machineClassId) : null;
    return roundMoney(Math.max(laborMinutes, machineMinutes * machineAttendanceShare(machine)));
  }

  function toolMatchesRequirement(tool: ToolInventoryItem, requirement: ToolRequirement) {
    const tolerance = assumptions?.tool_match_tolerance_mm ?? 0.05;
    const typeMatches = tool.type === requirement.toolType;
    const diameterMatches = requirement.diameterMm === 0 || Math.abs(tool.diameter_mm - requirement.diameterMm) <= tolerance;
    const radiusMatches = requirement.cornerRadiusMm === 0 || Math.abs(tool.corner_radius_mm - requirement.cornerRadiusMm) <= tolerance;
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
    // Missing-tool cost is tracked separately from real outsourced batch cost (item 9) -- it is
    // its own distinguishable cost driver, not folded into "outsourced", even in this quick
    // quoted-vs-actual comparison total.
    const missingToolCost = missingToolBatchCostForOperation(operation);
    // Scrap allowance only covers run cost and per-part variable cost -- setup and the
    // outsourced batch cost are one-off per-batch costs scrap doesn't multiply (mirrors
    // backend/app/costing/calculator.py).
    const scrapAllowance = (run + perPartVariable) * scrapPercent;
    return setup + run + perPartVariable + operation.outsourcedBatchCost + missingToolCost + scrapAllowance;
  }

  function operationConversionCostParts(operation: QuoteOperation, mode: RateMode, startedQuantity: number) {
    const machineHourly = machineRate(operation.machineClassId, mode);
    const laborHourly = laborRate(operation.laborClassId);
    const setupLaborMinutes = attendedLaborMinutes(operation.machineClassId, operation.setupMachineMinutes, operation.setupLaborMinutes);
    const runLaborMinutes = attendedLaborMinutes(operation.machineClassId, operation.runMachineMinutesPerPart, operation.runLaborMinutesPerPart);
    const machineCost = ((operation.setupMachineMinutes + operation.runMachineMinutesPerPart * startedQuantity) / 60) * machineHourly;
    const laborCost = ((setupLaborMinutes + runLaborMinutes * startedQuantity) / 60) * laborHourly;
    const runCost = startedQuantity * ((operation.runMachineMinutesPerPart / 60) * machineHourly + (runLaborMinutes / 60) * laborHourly);
    const scrapCost = runCost * effectiveScrapPercent(operation);
    return { machineCost, laborCost, scrapCost, total: machineCost + laborCost + scrapCost };
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
        setup_labor_minutes: attendedLaborMinutes(operation.machineClassId, operation.setupMachineMinutes, operation.setupLaborMinutes),
        run_machine_minutes_per_part: operation.runMachineMinutesPerPart,
        run_labor_minutes_per_part: attendedLaborMinutes(operation.machineClassId, operation.runMachineMinutesPerPart, operation.runLaborMinutesPerPart),
        tooling_cost_per_part_eur: operation.toolingCostPerPart,
        consumables_cost_per_part_eur: operation.consumablesCostPerPart,
        outsourced_cost_per_part_eur: operation.outsourcedCostPerPart,
        outsourced_batch_cost_eur: operation.outsourcedBatchCost,
        missing_tool_batch_cost_eur: missingToolBatchCostForOperation(operation),
        scrap_allowance_percent: operation.scrapAllowancePercent,
        rate_drivers: rateDriversForOperation(operation.machineClassId, mode),
        assumption_quality: "industry_estimate"
      })),
      commercial_policy: {
        margin_percent: commercialPolicy.default_margin_percent,
        overhead_percent: 0, // overhead is folded into machine rates (weighted shared recovery)
        risk_allowance_percent: commercialPolicy.risk_allowance_percent,
        minimum_order_admin_cost_eur: commercialPolicy.minimum_order_admin_cost_eur,
        material_markup_percent: materialMarkupPercent
      }
    };
  }

  // Generalized version of quotePayloadForMode's rate math for the Scenarios tab (item 7):
  // lets one driver move at a time (utilization, availability, overhead basis) or apply a
  // multiplicative what-if factor (cycle times, material cost, margin), instead of only the
  // two fixed accounting/target presets.
  type ScenarioOverrides = {
    utilizationField?: UtilizationField;
    availabilityField?: AvailabilityField;
    overheadUtilizationField?: UtilizationField;
    overheadAvailabilityField?: AvailabilityField;
    utilizationFactor?: number;
    availabilityFactor?: number;
    cycleTimeFactor?: number;
    materialCostFactor?: number;
    marginFactor?: number;
  };

  function quotePayloadForScenario(overrides: ScenarioOverrides, overrideQuantity = quantity) {
    const utilizationField = overrides.utilizationField ?? "target_utilization_percent";
    const availabilityField = overrides.availabilityField ?? "target_availability_percent";
    const overheadUtilizationField = overrides.overheadUtilizationField ?? utilizationField;
    const overheadAvailabilityField = overrides.overheadAvailabilityField ?? availabilityField;
    const cycleTimeFactor = overrides.cycleTimeFactor ?? 1;
    const materialCostFactor = overrides.materialCostFactor ?? 1;
    const marginFactor = overrides.marginFactor ?? 1;
    const materialForBreak = stockPiecesForQuantity(overrideQuantity);

    function scenarioMachineRate(machineClassId: string | null) {
      if (!machineClassId || !assumptions) {
        return 0;
      }
      const machine = machineById.get(machineClassId);
      if (!machine) {
        return 0;
      }
      const baseUtilization = machine[utilizationField] ?? (utilizationField === "target_utilization_percent" ? DEFAULT_TARGET_UTILIZATION_PERCENT : 1);
      const utilization = Math.max(0.01, baseUtilization * (overrides.utilizationFactor ?? 1));
      const availability = Math.max(0.01, availabilityValue(machine, availabilityField) * (overrides.availabilityFactor ?? 1));
      const overheadPerHour = weightedSharedRecoveryPerMachineHour(assumptions, machine, overheadAvailabilityField, overheadUtilizationField);
      return machineRateFromDrivers(machine, availability, utilization, overheadPerHour);
    }

    return {
      part_name: partName,
      quantity: overrideQuantity,
      precision_level: "operation_based",
      rate_mode: "target_competitive",
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
        stock_piece_cost_eur: roundMoney(stockCost * materialCostFactor),
        stock_pieces_required: materialForBreak.pieces,
        scrap_recovery_eur: scrapRecovery,
        assumption_quality: "company_estimate"
      },
      operations: quoteOperations.map((operation) => ({
        operation_type: operation.operationType,
        name: operation.name,
        machine_hour_rate_eur: scenarioMachineRate(operation.machineClassId),
        labor_hour_rate_eur: laborRate(operation.laborClassId),
        setup_machine_minutes: operation.setupMachineMinutes,
        setup_labor_minutes: attendedLaborMinutes(operation.machineClassId, operation.setupMachineMinutes, operation.setupLaborMinutes),
        run_machine_minutes_per_part: roundMoney(operation.runMachineMinutesPerPart * cycleTimeFactor),
        run_labor_minutes_per_part: attendedLaborMinutes(operation.machineClassId, roundMoney(operation.runMachineMinutesPerPart * cycleTimeFactor), roundMoney(operation.runLaborMinutesPerPart * cycleTimeFactor)),
        tooling_cost_per_part_eur: operation.toolingCostPerPart,
        consumables_cost_per_part_eur: operation.consumablesCostPerPart,
        outsourced_cost_per_part_eur: operation.outsourcedCostPerPart,
        outsourced_batch_cost_eur: operation.outsourcedBatchCost,
        missing_tool_batch_cost_eur: missingToolBatchCostForOperation(operation),
        scrap_allowance_percent: operation.scrapAllowancePercent,
        assumption_quality: "industry_estimate"
      })),
      commercial_policy: {
        margin_percent: Math.min(0.95, Math.max(0, commercialPolicy.default_margin_percent * marginFactor)),
        overhead_percent: 0, // overhead is folded into machine rates (weighted shared recovery)
        risk_allowance_percent: commercialPolicy.risk_allowance_percent,
        minimum_order_admin_cost_eur: commercialPolicy.minimum_order_admin_cost_eur,
        material_markup_percent: materialMarkupPercent
      }
    };
  }

  async function callCalculate(payload: unknown): Promise<QuoteResult> {
    const response = await fetch("/api/quotes/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Calculator returned ${response.status}`);
    }
    return (await response.json()) as QuoteResult;
  }

  // Gap waterfall (item 7): decomposes accounting price - target price into named steps by
  // recalculating with one driver switched at a time, in a fixed order (utilization ->
  // availability -> overhead basis), so the biggest single lever is visible instead of only
  // the two endpoint prices.
  async function runGapWaterfall() {
    if (!assumptions || !displayAccountingResult || !displayTargetResult) {
      setDiagnosticsStatus("Calculate the quote (Target and Accounting) before running diagnostics.");
      return;
    }
    setDiagnosticsStatus("Calculating gap waterfall...");
    try {
      const [afterUtilization, afterAvailability] = await Promise.all([
        callCalculate(
          quotePayloadForScenario({
            utilizationField: "target_utilization_percent",
            availabilityField: "actual_availability_percent",
            overheadUtilizationField: "actual_utilization_percent",
            overheadAvailabilityField: "actual_availability_percent"
          })
        ),
        callCalculate(
          quotePayloadForScenario({
            utilizationField: "target_utilization_percent",
            availabilityField: "target_availability_percent",
            overheadUtilizationField: "actual_utilization_percent",
            overheadAvailabilityField: "actual_availability_percent"
          })
        )
      ]);
      const baseline = displayAccountingResult.unit_sell_price_eur;
      const afterUtil = afterUtilization.unit_sell_price_eur;
      const afterAvail = afterAvailability.unit_sell_price_eur;
      const afterOverhead = displayTargetResult.unit_sell_price_eur;
      const totalGap = baseline - afterOverhead;
      const percentOf = (delta: number) => (totalGap !== 0 ? roundMoney((delta / totalGap) * 100) : 0);
      setGapWaterfall([
        { step: "Current accounting price", detail: "Actual availability and actual utilization.", price: baseline, deltaEur: 0, deltaPercent: 0 },
        { step: "Utilization gap", detail: "Fixed machine cost spread over target loaded hours.", price: afterUtil, deltaEur: roundMoney(afterUtil - baseline), deltaPercent: percentOf(afterUtil - baseline) },
        { step: "Availability gap", detail: "Target uptime reduces the hourly rate.", price: afterAvail, deltaEur: roundMoney(afterAvail - afterUtil), deltaPercent: percentOf(afterAvail - afterUtil) },
        { step: "Overhead recovery", detail: "Same monthly overhead divided by more productive hours.", price: afterOverhead, deltaEur: roundMoney(afterOverhead - afterAvail), deltaPercent: percentOf(afterOverhead - afterAvail) }
      ]);
      setDiagnosticsStatus("Gap waterfall calculated.");
    } catch (error) {
      setDiagnosticsStatus(error instanceof Error ? error.message : "Gap waterfall failed.");
    }
  }

  // Sensitivity table (item 7): unit target price at +-10% and +-25% on utilization,
  // availability, cycle times, material cost, and margin. Reuses the calculate API; the base
  // (0%) column is the already-calculated Target unit price, so this is 4 extra calls per
  // driver, run in parallel.
  const SENSITIVITY_STEPS = [-0.25, -0.1, 0.1, 0.25];

  async function runSensitivityAnalysis() {
    if (!assumptions || !displayTargetResult) {
      setDiagnosticsStatus("Calculate the quote (Target) before running diagnostics.");
      return;
    }
    setDiagnosticsStatus("Calculating sensitivity table...");
    try {
      const drivers: Array<{ key: string; label: string; overridesForFactor: (factor: number) => ScenarioOverrides }> = [
        { key: "utilization", label: "Utilization", overridesForFactor: (factor) => ({ utilizationFactor: 1 + factor }) },
        { key: "availability", label: "Availability", overridesForFactor: (factor) => ({ availabilityFactor: 1 + factor }) },
        { key: "cycle_times", label: "Cycle times", overridesForFactor: (factor) => ({ cycleTimeFactor: 1 + factor }) },
        { key: "material_cost", label: "Material cost", overridesForFactor: (factor) => ({ materialCostFactor: 1 + factor }) },
        { key: "margin", label: "Margin", overridesForFactor: (factor) => ({ marginFactor: 1 + factor }) }
      ];
      const rows = await Promise.all(
        drivers.map(async (driver) => {
          const results = await Promise.all(
            SENSITIVITY_STEPS.map((factor) => callCalculate(quotePayloadForScenario(driver.overridesForFactor(factor))))
          );
          return {
            driver: driver.label,
            minus25: results[0].unit_sell_price_eur,
            minus10: results[1].unit_sell_price_eur,
            base: displayTargetResult.unit_sell_price_eur,
            plus10: results[2].unit_sell_price_eur,
            plus25: results[3].unit_sell_price_eur
          };
        })
      );
      setSensitivityTable(rows);
      setDiagnosticsStatus("Sensitivity table calculated.");
    } catch (error) {
      setDiagnosticsStatus(error instanceof Error ? error.message : "Sensitivity analysis failed.");
    }
  }

  // Competitor price gap (item 7): a purely closed-form back-solve from the already-calculated
  // Target result, no extra API calls. Required margin is exact (holding cost fixed). Required
  // blended EUR/h and required Utilization are approximations that split each operation's
  // machine cost into its utilization-sensitive (fixed-cost-per-hour) and insensitive
  // (variable + overhead-per-hour) components, then solve holding everything else -- including
  // the commercial multiplier (item 6e) -- constant. Labelled clearly as single-driver what-ifs,
  // not a full re-simulation.
  // Combined competitor what-if (demo feedback item 16): the three closed-form suggestions
  // above each move ONE lever in isolation; this recalculates the real quote with a chosen
  // margin AND utilization together, so partial moves on two levers can be tested.
  async function runCombinedWhatIf() {
    if (!assumptions || !displayTargetResult) {
      return;
    }
    const currentMargin = assumptions.commercial_policy.default_margin_percent;
    const desiredMargin = whatIfMarginPercent ?? currentMargin;
    const marginFactor = currentMargin > 0 ? desiredMargin / currentMargin : 1;
    const averageUtil = averageTargetUtilization(assumptions);
    const desiredUtil = whatIfUtilizationPercent ?? averageUtil;
    const utilizationFactor = averageUtil > 0 ? desiredUtil / averageUtil : 1;
    try {
      const result = await callCalculate(quotePayloadForScenario({ marginFactor, utilizationFactor }));
      setWhatIfResult({ unitPrice: result.unit_sell_price_eur, marginPercent: desiredMargin, utilizationPercent: desiredUtil });
    } catch (error) {
      setDiagnosticsStatus(error instanceof Error ? error.message : "Combined what-if failed");
    }
  }

  function competitorGapAnalysis() {
    if (!assumptions || !displayTargetResult || competitorUnitPriceEur === null || competitorUnitPriceEur <= 0) {
      return null;
    }
    const competitorTotalPrice = competitorUnitPriceEur * quantity;
    const gapEur = roundMoney(displayTargetResult.unit_sell_price_eur - competitorUnitPriceEur);
    const gapPercent = competitorUnitPriceEur > 0 ? roundMoney((gapEur / competitorUnitPriceEur) * 100) : 0;

    const requiredMarginPercent = displayTargetResult.total_cost_eur > 0 ? 1 - displayTargetResult.total_cost_eur / competitorTotalPrice : null;
    const feasibleMargin = requiredMarginPercent !== null && requiredMarginPercent >= 0 && requiredMarginPercent < 0.95;

    let machineCost = 0;
    let machineHours = 0;
    let fixedTerm = 0;
    quoteOperations.forEach((operation) => {
      if (!operation.machineClassId) {
        return;
      }
      const machine = machineById.get(operation.machineClassId);
      if (!machine) {
        return;
      }
      const rate = machineRate(operation.machineClassId, "target_competitive");
      const hours = operation.setupMachineMinutes / 60 + quantity * (operation.runMachineMinutesPerPart / 60);
      machineCost += rate * hours;
      machineHours += hours;
      const utilization = Math.max(0.01, machine.target_utilization_percent ?? DEFAULT_TARGET_UTILIZATION_PERCENT);
      const availability = Math.max(0.01, availabilityValue(machine, "target_availability_percent"));
      const plannedHours = machine.planned_hours_per_month ?? 160;
      const fixedComponentPerHour = (machine.monthly_fixed_cost_eur ?? 0) / Math.max(1, plannedHours * utilization * availability);
      fixedTerm += fixedComponentPerHour * hours;
    });
    const nonFixedMachineTerm = machineCost - fixedTerm;
    const subtotalBeforePolicy = displayTargetResult.material_cost_eur + displayTargetResult.engineering_cost_eur + displayTargetResult.operation_cost_eur;
    const nonMachineCost = subtotalBeforePolicy - machineCost;
    const requiredSubtotal = displayTargetResult.commercial_multiplier > 0 ? competitorTotalPrice / displayTargetResult.commercial_multiplier : null;
    const requiredMachineCost = requiredSubtotal !== null ? requiredSubtotal - nonMachineCost : null;

    let requiredBlendedRateEurPerHour: number | null = null;
    if (requiredMachineCost !== null && machineHours > 0 && machineCost > 0) {
      requiredBlendedRateEurPerHour = roundMoney((machineCost / machineHours) * (requiredMachineCost / machineCost));
    }
    const feasibleRate = requiredBlendedRateEurPerHour !== null && requiredBlendedRateEurPerHour > 0;

    let requiredAverageUtilizationPercent: number | null = null;
    if (requiredMachineCost !== null && fixedTerm > 0) {
      const denominator = requiredMachineCost - nonFixedMachineTerm;
      if (denominator > 0) {
        const scale = fixedTerm / denominator;
        requiredAverageUtilizationPercent = Math.min(1, Math.max(0.01, averageTargetUtilization(assumptions) * scale));
      }
    }
    const feasibleUtilization = requiredAverageUtilizationPercent !== null;

    return {
      gapEur,
      gapPercent,
      requiredMarginPercent,
      feasibleMargin,
      requiredBlendedRateEurPerHour,
      feasibleRate,
      requiredAverageUtilizationPercent,
      feasibleUtilization
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
    return ["saw_cutting", "milling_3_axis", "drilling", ...(part.threadOrInsertRequirement === "yes" ? ["tapping"] : [])];
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
          setup_labor_minutes: attendedLaborMinutes(template.default_machine_class_id, roundMoney((template.default_setup_machine_minutes ?? 0) * setupFactor), roundMoney((template.default_setup_labor_minutes ?? 0) * setupFactor)),
          run_machine_minutes_per_part: roundMoney((template.default_run_machine_minutes_per_part ?? 0) * runFactor),
          run_labor_minutes_per_part: attendedLaborMinutes(template.default_machine_class_id, roundMoney((template.default_run_machine_minutes_per_part ?? 0) * runFactor), roundMoney((template.default_run_labor_minutes_per_part ?? 0) * runFactor)),
          tooling_cost_per_part_eur: template.default_tooling_cost_per_part_eur ?? 0,
          consumables_cost_per_part_eur: template.default_consumables_cost_per_part_eur ?? 0,
          outsourced_cost_per_part_eur: 0,
          outsourced_batch_cost_eur: part.surfaceFinish.toLowerCase().includes("anod") || part.surfaceFinish.toLowerCase().includes("coat") ? 45 : 0,
          missing_tool_batch_cost_eur: missingToolBatchCost(toolRequirements),
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
        overhead_percent: 0, // overhead is folded into machine rates (weighted shared recovery)
        risk_allowance_percent: commercialPolicy.risk_allowance_percent + missingInfoRisk + (part.documentationRequirement === "full_fai" ? 0.02 : 0),
        minimum_order_admin_cost_eur: commercialPolicy.minimum_order_admin_cost_eur,
        material_markup_percent: materialMarkupPercent
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
      setTargetResult((current) => current ? null : current);
      setAccountingResult((current) => current ? null : current);
      setQuantityBreakResults((current) => current.length > 0 ? [] : current);
      setApiError(null);
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

  async function refreshCompanyProfiles() {
    const response = await fetch("/api/company-profiles");
    if (!response.ok) {
      throw new Error(`Company profile storage unavailable (${response.status})`);
    }
    const data = (await response.json()) as CompanyProfile[];
    setCompanyProfiles(data);
  }

  function updateCompanyProfile(changes: Partial<CompanyProfileState>) {
    setCompanyProfile((current) => current ? { ...current, ...changes } : current);
    setProfileStatus("Profile edited, not saved");
  }

  function updateProfileAsset(index: number, field: keyof CompanyAsset, value: string | number) {
    if (!companyProfile) return;
    updateCompanyProfile({
      assets: replaceArrayItem(companyProfile.assets, index, {
        ...companyProfile.assets[index],
        [field]: value
      })
    });
  }

  function addProfileAsset() {
    if (!companyProfile) return;
    const nextAsset: CompanyAsset = {
      id: `asset_${Date.now()}`,
      name: "New production asset",
      purchasePriceEur: 0,
      usefulLifeYears: 10,
      salvagePercent: 0,
      otherMonthlyFixedCostEur: 0,
      plannedHoursPerMonth: 160,
      actualAvailabilityPercent: 0.8,
      targetAvailabilityPercent: 0.9,
      actualUtilizationPercent: 0.35,
      targetUtilizationPercent: DEFAULT_TARGET_UTILIZATION_PERCENT,
      variableCostEurPerHour: 0,
      sellRateEurPerHour: 0,
      loadedPowerKw: 0,
      quality: "company_estimate"
    };
    updateCompanyProfile({ assets: [...companyProfile.assets, nextAsset] });
  }

  function removeProfileAsset(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ assets: companyProfile.assets.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateProfileEmployee(index: number, field: keyof CompanyEmployee, value: string | number | boolean) {
    if (!companyProfile) return;
    updateCompanyProfile({
      employees: replaceArrayItem(companyProfile.employees, index, {
        ...companyProfile.employees[index],
        [field]: value
      })
    });
  }

  function addProfileEmployee() {
    if (!companyProfile) return;
    const defaultRate = assumptions?.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359;
    const defaultHours = assumptions?.payroll_tax_defaults?.paid_hours_per_month ?? 160;
    const nextEmployee: CompanyEmployee = {
      id: `employee_${Date.now()}`,
      position: "New position",
      processArea: "Production",
      headcount: 1,
      grossMonthlySalaryEur: 0,
      employerSocialContributionRate: defaultRate,
      paidHoursPerMonth: defaultHours,
      directLabor: true,
      quality: "company_estimate"
    };
    updateCompanyProfile({ employees: [...companyProfile.employees, nextEmployee] });
  }

  function removeProfileEmployee(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ employees: companyProfile.employees.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateProfileOverheadItem(index: number, field: keyof OverheadItem, value: string | number) {
    if (!companyProfile) return;
    updateCompanyProfile({
      overheadItems: replaceArrayItem(companyProfile.overheadItems, index, {
        ...companyProfile.overheadItems[index],
        [field]: value
      })
    });
  }

  function addProfileOverheadItem(name = "New overhead item") {
    if (!companyProfile) return;
    updateCompanyProfile({
      overheadItems: [
        ...companyProfile.overheadItems,
        { id: `profile_overhead_${Date.now()}`, name, monthly_cost_eur: 0, quality: "company_estimate" }
      ]
    });
  }

  function removeProfileOverheadItem(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ overheadItems: companyProfile.overheadItems.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateProfileMaterial(index: number, field: keyof CompanyProfileMaterial, value: string) {
    if (!companyProfile) return;
    const rows = profileMaterials(companyProfile);
    updateCompanyProfile({ materials: replaceArrayItem(rows, index, { ...rows[index], [field]: value }) });
  }

  function addProfileMaterial() {
    if (!companyProfile) return;
    updateCompanyProfile({
      materials: [
        ...profileMaterials(companyProfile),
        defaultProfileMaterial(`profile_material_${Date.now()}`, "New material", "", "", "")
      ]
    });
  }

  function removeProfileMaterial(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ materials: profileMaterials(companyProfile).filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateProfileTool(index: number, field: keyof CompanyProfileTool, value: string) {
    if (!companyProfile) return;
    const rows = profileTools(companyProfile);
    updateCompanyProfile({ tools: replaceArrayItem(rows, index, { ...rows[index], [field]: value }) });
  }

  function addProfileTool() {
    if (!companyProfile) return;
    updateCompanyProfile({
      tools: [
        ...profileTools(companyProfile),
        defaultProfileTool(`profile_tool_${Date.now()}`, "New tool group", "tool", "general")
      ]
    });
  }

  function removeProfileTool(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ tools: profileTools(companyProfile).filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateProfileOperation(index: number, field: keyof CompanyProfileOperation, value: string | null) {
    if (!companyProfile) return;
    const rows = profileOperations(companyProfile);
    updateCompanyProfile({ operations: replaceArrayItem(rows, index, { ...rows[index], [field]: value }) });
  }

  function addProfileOperation() {
    if (!companyProfile) return;
    updateCompanyProfile({
      operations: [
        ...profileOperations(companyProfile),
        defaultProfileOperation(`profile_operation_${Date.now()}`, "new_operation", "New operation", companyProfile.assets[0]?.id ?? null, companyProfile.employees.find((employee) => employee.directLabor)?.id ?? null)
      ]
    });
  }

  function removeProfileOperation(index: number) {
    if (!companyProfile) return;
    updateCompanyProfile({ operations: profileOperations(companyProfile).filter((_, itemIndex) => itemIndex !== index) });
  }

  function applyCompanyProfileToAssumptions() {
    if (!companyProfile || !assumptions) {
      setProfileStatus("Load assumptions before applying a company profile.");
      return;
    }
    const nextAssumptions = assumptionsFromProfile(companyProfile, assumptions);
    const machineIds = new Set(nextAssumptions.machine_classes.map((machine) => machine.id));
    const laborIds = new Set(nextAssumptions.labor_classes.map((labor) => labor.id));
    const fallbackMachineId = nextAssumptions.machine_classes[0]?.id ?? null;
    const fallbackLaborId = nextAssumptions.labor_classes[0]?.id ?? null;
    setQuoteOperations((current) => current.map((operation) => ({
      ...operation,
      machineClassId: operation.machineClassId && machineIds.has(operation.machineClassId) ? operation.machineClassId : fallbackMachineId,
      laborClassId: operation.laborClassId && laborIds.has(operation.laborClassId) ? operation.laborClassId : fallbackLaborId
    })));
    const materialIds = new Set(nextAssumptions.material_examples.map((material) => material.id));
    if (selectedMaterialId && !materialIds.has(selectedMaterialId)) {
      const firstMaterial = nextAssumptions.material_examples[0];
      setSelectedMaterialId(firstMaterial?.id ?? "");
      if (firstMaterial) {
        setStockName(firstMaterial.stock_description || firstMaterial.name);
        setStockCost(firstMaterial.stock_piece_cost_eur);
      }
    }
    setAssumptions(nextAssumptions);
    setAssumptionsText(JSON.stringify(nextAssumptions, null, 2));
    setAssumptionStatus("Company profile applied locally. Save Resources to persist baseline assumptions.");
    setProfileStatus("Profile applied to costing assumptions.");
  }

  async function saveCompanyProfile() {
    if (!companyProfile) {
      setProfileStatus("No company profile is loaded.");
      return;
    }
    try {
      const response = await fetch("/api/company-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyProfile.companyName || "Company profile",
          profile_state: companyProfile,
          assumptions_snapshot: assumptions
        })
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Profile storage API not found. Restart the backend, then save again." : `Profile save returned ${response.status}`);
      }
      const saved = (await response.json()) as CompanyProfile;
      setCompanyProfile(saved.profile_state);
      await refreshCompanyProfiles();
      setProfileStatus(`Saved ${saved.name}`);
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Company profile save failed");
    }
  }

  async function loadCompanyProfile(profileId: string) {
    if (!profileId) {
      setCompanyProfile(assumptions ? createStarterCompanyProfile(assumptions) : null);
      setProfileStatus("Started a new generic starter profile");
      return;
    }
    try {
      const response = await fetch(`/api/company-profiles/${profileId}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Profile storage API not found. Restart the backend, then load again." : `Profile load returned ${response.status}`);
      }
      const profile = (await response.json()) as CompanyProfile;
      setCompanyProfile(profile.profile_state);
      setProfileStatus(profile.assumptions_snapshot?.market_rate_card ? `Loaded ${profile.name}; Market Rates can load this profile's saved rate card.` : `Loaded ${profile.name}`);
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Company profile load failed");
    }
  }

  async function deleteCompanyProfile() {
    if (!companyProfile?.profileId) {
      setProfileStatus("Load a saved profile before deleting.");
      return;
    }
    try {
      const response = await fetch(`/api/company-profiles/${companyProfile.profileId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Profile storage API not found. Restart the backend, then delete again." : `Profile delete returned ${response.status}`);
      }
      await refreshCompanyProfiles();
      setCompanyProfile(assumptions ? createStarterCompanyProfile(assumptions) : null);
      setProfileStatus("Company profile deleted; started a new generic starter profile");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Company profile delete failed");
    }
  }

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

  function updateMarketRateEntry(index: number, field: keyof MarketRateCardEntry, value: string | number) {
    if (!assumptions) return;
    const entries = marketRateCardEntries(assumptions);
    const nextEntry = {
      ...entries[index],
      [field]: value
    };
    updateAssumptions({
      ...assumptions,
      market_rate_card: replaceArrayItem(entries, index, nextEntry)
    });
  }

  function addMarketRateEntry() {
    if (!assumptions) return;
    const entries = marketRateCardEntries(assumptions);
    const nextEntry: MarketRateCardEntry = {
      id: `market_class_${Date.now()}`,
      name: "New pricing class",
      rateEurPerHour: 0,
      source: "manual_rate_card",
      confidence: "unverified",
      notes: "",
      lastUpdated: new Date().toISOString().slice(0, 10)
    };
    updateAssumptions({ ...assumptions, market_rate_card: [...entries, nextEntry] });
  }

  function removeMarketRateEntry(index: number) {
    if (!assumptions) return;
    const entries = marketRateCardEntries(assumptions);
    updateAssumptions({ ...assumptions, market_rate_card: entries.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateMarketEvidenceRow(index: number, field: keyof MarketEvidenceRouteRow, value: string | number) {
    setMarketEvidenceRows((current) => replaceArrayItem(current, index, {
      ...current[index],
      [field]: value
    }));
  }

  function addMarketEvidenceRow() {
    const firstClass = marketRateCardEntries(assumptions)[0]?.id ?? "cnc";
    setMarketEvidenceRows((current) => [
      ...current,
      { id: `market_route_row_${Date.now()}`, marketRateClassId: firstClass, hours: 0 }
    ]);
  }

  function removeMarketEvidenceRow(index: number) {
    setMarketEvidenceRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function applyImpliedMarketRateToCard(impliedRate: number | null) {
    if (!assumptions || impliedRate === null || !Number.isFinite(impliedRate) || impliedRate <= 0) {
      setAssumptionStatus("No positive implied rate to apply. Check sell price, deductions, and route hours.");
      return;
    }
    if (marketEvidenceSolveClassId === "__blended") {
      setAssumptionStatus("Blended route is a diagnostic. Choose one pricing class, or use the demo button to copy the blended rate to route classes.");
      return;
    }
    const entries = marketRateCardEntries(assumptions);
    const index = entries.findIndex((entry) => entry.id === marketEvidenceSolveClassId);
    if (index < 0) return;
    const nextEntry: MarketRateCardEntry = {
      ...entries[index],
      rateEurPerHour: roundMoney(impliedRate),
      source: marketEvidenceSource,
      confidence: nextMarketConfidence(entries[index], marketEvidenceSource),
      lastUpdated: new Date().toISOString().slice(0, 10)
    };
    updateAssumptions({
      ...assumptions,
      market_rate_card: replaceArrayItem(entries, index, nextEntry)
    });
    setAssumptionStatus(`Applied ${money.format(impliedRate)}/h to ${nextEntry.name}.`);
  }

  function applyBlendedRateToRouteClasses(impliedRate: number | null) {
    if (!assumptions || impliedRate === null || !Number.isFinite(impliedRate) || impliedRate <= 0) {
      setAssumptionStatus("No positive blended rate to apply. Check sell price, deductions, and route hours.");
      return;
    }
    const usedClassIds = Array.from(new Set(marketEvidenceRows.filter((row) => row.hours > 0).map((row) => row.marketRateClassId)));
    if (usedClassIds.length === 0) {
      setAssumptionStatus("Add at least one route row before applying a blended rate.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const entries = marketRateCardEntries(assumptions).map((entry) => usedClassIds.includes(entry.id) ? {
      ...entry,
      rateEurPerHour: roundMoney(impliedRate),
      source: marketEvidenceSource,
      confidence: nextMarketConfidence(entry, marketEvidenceSource),
      lastUpdated: today,
      notes: entry.notes || "Blended route rate copied for quick workflow test; replace with class-specific evidence."
    } : entry);
    updateAssumptions({
      ...assumptions,
      market_rate_card: entries
    });
    setAssumptionStatus(`Copied blended ${money.format(impliedRate)}/h to ${usedClassIds.length} route pricing class${usedClassIds.length === 1 ? "" : "es"}. Bind the card to the loaded profile before applying to Profitability.`);
  }

  function addBasketRow(draft?: Partial<BasketRow>) {
    const firstWorkCenter = assumptions?.machine_classes[0]?.id ?? "";
    const localId = `basket_draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setBasketRows((current) => [
      ...current,
      {
        id: localId,
        source: "manual",
        pdfFilename: null,
        supplier: null,
        quoteDate: null,
        currency: null,
        partName: "",
        quantity: null,
        unitPriceEur: null,
        lineTotalEur: null,
        materialSellEur: null,
        materialUnitCostEur: null,
        routeHours: [{ id: `${localId}_hours_0`, marketRateClassId: firstWorkCenter, hours: 0 }],
        notes: "",
        ...draft
      }
    ]);
  }

  function updateBasketRow(index: number, field: keyof BasketRow, value: unknown) {
    setBasketRows((current) => {
      const updatedRow: BasketRow = { ...current[index], [field]: value };
      if (field === "partName" || field === "quantity") {
        const cost = erpOfferMaterialUnitCost[normalizePartName(updatedRow.partName)];
        if (cost !== undefined) {
          updatedRow.materialUnitCostEur = cost;
        }
      }
      return replaceArrayItem(current, index, updatedRow);
    });
  }

  function addBasketRowHourEntry(rowIndex: number) {
    const firstWorkCenter = assumptions?.machine_classes[0]?.id ?? "";
    setBasketRows((current) => replaceArrayItem(current, rowIndex, {
      ...current[rowIndex],
      routeHours: [
        ...current[rowIndex].routeHours,
        { id: `${current[rowIndex].id}_hours_${Date.now()}`, marketRateClassId: firstWorkCenter, hours: 0 }
      ]
    }));
  }

  function updateBasketRowHourEntry(rowIndex: number, hourIndex: number, field: keyof MarketEvidenceRouteRow, value: string | number) {
    setBasketRows((current) => {
      const row = current[rowIndex];
      const nextHours = replaceArrayItem(row.routeHours, hourIndex, { ...row.routeHours[hourIndex], [field]: value });
      return replaceArrayItem(current, rowIndex, { ...row, routeHours: nextHours });
    });
  }

  function removeBasketRowHourEntry(rowIndex: number, hourIndex: number) {
    setBasketRows((current) => {
      const row = current[rowIndex];
      return replaceArrayItem(current, rowIndex, {
        ...row,
        routeHours: row.routeHours.filter((_, i) => i !== hourIndex)
      });
    });
  }

  async function saveBasketRow(index: number) {
    const row = basketRows[index];
    try {
      const isNew = row.id.startsWith("basket_draft_");
      const response = await fetch(
        isNew ? "/api/market-evidence/basket-rows" : `/api/market-evidence/basket-rows/${row.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basketRowToApiPayload(row))
        }
      );
      if (!response.ok) {
        throw new Error(`Basket row save returned ${response.status}`);
      }
      const saved = basketRowFromApi(await response.json());
      setBasketRows((current) => replaceArrayItem(current, index, saved));
      setBasketStatus(`Saved ${saved.partName || "row"}.`);
    } catch (error) {
      setBasketStatus(error instanceof Error ? error.message : "Basket row save failed");
    }
  }

  async function deleteBasketRow(index: number) {
    const row = basketRows[index];
    try {
      if (!row.id.startsWith("basket_draft_")) {
        const response = await fetch(`/api/market-evidence/basket-rows/${row.id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(`Basket row delete returned ${response.status}`);
        }
      }
      setBasketRows((current) => current.filter((_, i) => i !== index));
      setBasketSolveResult(null);
      setBasketStatus("Row removed.");
    } catch (error) {
      setBasketStatus(error instanceof Error ? error.message : "Basket row delete failed");
    }
  }

  // Grouped by the actual work center (machine), not the shared pricing-class label -- a
  // "CNC" class can span a lathe, a mill, and a press brake, and those are different machines
  // with potentially different real rates, so evidence has to stay resolved at that level.
  async function routeHoursFromErpPart(partId: string, quantity: number): Promise<MarketEvidenceRouteRow[]> {
    const response = await fetch(`/api/erp/parts/${partId}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { route: ErpRouteOperation[] };
    const hoursByWorkCenter = new Map<string, number>();
    for (const operation of data.route) {
      const workCenterId = operation.machine_class_id ?? `unassigned_${operation.operation_type}`;
      const setupMinutes = attendedLaborMinutes(operation.machine_class_id, operation.setup_machine_minutes, operation.setup_labor_minutes);
      const runMinutes = attendedLaborMinutes(operation.machine_class_id, operation.run_machine_minutes_per_part, operation.run_labor_minutes_per_part);
      const totalHours = (setupMinutes + runMinutes * quantity) / 60;
      hoursByWorkCenter.set(workCenterId, (hoursByWorkCenter.get(workCenterId) ?? 0) + totalHours);
    }
    return Array.from(hoursByWorkCenter.entries()).map(([workCenterId, hours], index) => ({
      id: `erp_route_${partId}_${index}`,
      marketRateClassId: workCenterId,
      hours: Math.round(hours * 100) / 100
    }));
  }

  async function extractBasketPdf() {
    if (!basketPdfFile) {
      setBasketStatus("Choose a PDF first.");
      return;
    }
    setBasketExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", basketPdfFile);
      const response = await fetch("/api/market-evidence/extract-quote", { method: "POST", body: formData });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(detail?.detail ?? `Quote extraction returned ${response.status}`);
      }
      const extraction = await response.json() as {
        supplier: string | null;
        quote_date: string | null;
        currency: string | null;
        batch_charge_eur: number | null;
        line_items: { part_name: string | null; quantity: number | null; unit_price: number | null; line_total: number | null }[];
      };
      const items = extraction.line_items.length > 0 ? extraction.line_items : [{ part_name: null, quantity: null, unit_price: null, line_total: null }];
      let materialMatchedCount = 0;
      let routeMatchedCount = 0;
      for (const item of items) {
        const cost = item.part_name ? erpOfferMaterialUnitCost[normalizePartName(item.part_name)] : undefined;
        const materialUnitCostEur = cost !== undefined ? cost : null;
        if (materialUnitCostEur != null) materialMatchedCount += 1;

        const matchedPart = item.part_name
          ? erpParts.find((part) => normalizePartName(part.name) === normalizePartName(item.part_name!))
          : undefined;
        let routeHours: MarketEvidenceRouteRow[] | undefined;
        if (matchedPart && item.quantity != null) {
          try {
            const fetchedHours = await routeHoursFromErpPart(matchedPart.id, item.quantity);
            if (fetchedHours.length > 0) {
              routeHours = fetchedHours;
              routeMatchedCount += 1;
            }
          } catch {
            // Non-critical: row falls back to manual route hours entry.
          }
        }

        addBasketRow({
          source: "pdf_extraction",
          pdfFilename: basketPdfFile.name,
          supplier: extraction.supplier,
          quoteDate: extraction.quote_date,
          currency: extraction.currency,
          partName: item.part_name ?? "",
          quantity: item.quantity,
          unitPriceEur: item.unit_price,
          lineTotalEur: item.line_total,
          materialUnitCostEur,
          ...(routeHours ? { routeHours } : {})
        });
      }
      const materialNote = materialMatchedCount > 0
        ? ` Material sell auto-filled for ${materialMatchedCount} of ${items.length} row${items.length === 1 ? "" : "s"}.`
        : "";
      const routeNote = routeMatchedCount > 0
        ? ` Route hours pulled from our own operations for ${routeMatchedCount} of ${items.length} row${items.length === 1 ? "" : "s"}.`
        : "";
      const reviewNote = routeMatchedCount === items.length && materialMatchedCount === items.length
        ? " Ready to solve."
        : " Review any remaining rows before solving.";
      setBasketStatus(`Extracted ${items.length} line item${items.length === 1 ? "" : "s"} from ${basketPdfFile.name}.${materialNote}${routeNote}${reviewNote}`);
      setBasketPdfFile(null);
    } catch (error) {
      setBasketStatus(error instanceof Error ? error.message : "Quote extraction failed");
    } finally {
      setBasketExtracting(false);
    }
  }

  function solveBasket() {
    if (!assumptions) return;
    const workCenterIds = assumptions.machine_classes.map((machine) => machine.id);
    const rates = marketRateById(marketRateCardEntries(assumptions));
    const result = solveBasketByWorkCenter(
      basketRows,
      assumedMaterialMarkupPercent,
      workCenterIds,
      (id) => machineById.get(id)?.name ?? id,
      (id) => {
        const machine = machineById.get(id);
        if (!machine) return null;
        return rates.get(machineMarketRateClassId(machine))?.rateEurPerHour ?? null;
      }
    );
    setBasketSolveResult(result);
    const foundCount = result.workCenters.filter((wc) => wc.status !== "unknown").length;
    setBasketStatus(
      foundCount > 0
        ? `Found evidence for ${foundCount} of ${result.workCenters.length} work centers.`
        : "No work center had a clean, single-machine-dominant quote yet -- add more rows or check route hours."
    );
  }

  function applyBasketRatesToCard() {
    if (!assumptions || !basketSolveResult) {
      setAssumptionStatus("Solve the basket before applying rates to the card.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    // Several work centers can share one pricing-class card row (e.g. lathe + mill + press
    // brake all under "CNC machining"); average the found/provisional medians of whichever
    // work centers in that class actually have evidence, skip classes with none.
    const ratesByClassId = new Map<string, number[]>();
    for (const wc of basketSolveResult.workCenters) {
      if (wc.status === "unknown" || wc.medianRate == null) continue;
      const machine = machineById.get(wc.workCenterId);
      if (!machine) continue;
      const classId = machineMarketRateClassId(machine);
      const list = ratesByClassId.get(classId) ?? [];
      list.push(wc.medianRate);
      ratesByClassId.set(classId, list);
    }
    const entries = marketRateCardEntries(assumptions).map((entry) => {
      const rates = ratesByClassId.get(entry.id);
      if (!rates || rates.length === 0) return entry;
      const averaged = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      if (!Number.isFinite(averaged) || averaged <= 0) return entry;
      return {
        ...entry,
        rateEurPerHour: roundMoney(averaged),
        source: "competitor_backsolve" as MarketRateSource,
        confidence: nextMarketConfidence(entry, "competitor_backsolve"),
        lastUpdated: today
      };
    });
    updateAssumptions({ ...assumptions, market_rate_card: entries });
    setAssumptionStatus(`Applied solved rates to ${ratesByClassId.size} pricing class${ratesByClassId.size === 1 ? "" : "es"} from basket evidence. Save Rate Card to persist.`);
  }

  function bindMarketRateCardToLoadedProfile() {
    if (!assumptions || !companyProfile?.profileId) {
      setAssumptionStatus("Load a saved Company Profile before binding a market rate card.");
      return;
    }
    updateAssumptions({
      ...assumptions,
      market_rate_card: marketRateCardEntries(assumptions),
      market_rate_card_profile_id: companyProfile.profileId,
      market_rate_card_profile_name: companyProfile.companyName
    });
    setAssumptionStatus(`Market rate card bound to ${companyProfile.companyName}. Save the rate card and profile snapshot to persist.`);
  }

  function loadMarketRateCardFromLoadedProfile() {
    if (!assumptions || !companyProfile?.profileId) {
      setAssumptionStatus("Load a saved Company Profile before loading a profile-bound rate card.");
      return;
    }
    const savedProfile = companyProfiles.find((profile) => profile.id === companyProfile.profileId);
    const snapshot = savedProfile?.assumptions_snapshot;
    const savedCard = snapshot?.market_rate_card;
    if (!Array.isArray(savedCard) || savedCard.length === 0) {
      setAssumptionStatus("The loaded profile has no saved market rate card snapshot yet. Save the rate card, then save the profile.");
      return;
    }
    updateAssumptions({
      ...assumptions,
      market_rate_card: savedCard,
      market_rate_card_profile_id: snapshot?.market_rate_card_profile_id ?? companyProfile.profileId,
      market_rate_card_profile_name: snapshot?.market_rate_card_profile_name ?? companyProfile.companyName
    });
    setAssumptionStatus(`Loaded market rate card snapshot from ${companyProfile.companyName}.`);
  }

  function rateCardMatchesLoadedProfile() {
    if (!companyProfile?.profileId) return false;
    return marketRateCardProfileId(assumptions) === companyProfile.profileId;
  }

  // Per-row variant of applyMarketRateCardToProfitability: pushes the card rate to ONE
  // asset only, so a single corrected class can be applied without overwriting every
  // other asset's sell rate. Same profile-compatibility guard as the bulk apply.
  function applyMarketRateToSingleAsset(machineId: string) {
    if (!assumptions) return;
    if (!rateCardMatchesLoadedProfile()) {
      setAssumptionStatus("Rate card is not bound to the currently loaded saved Company Profile. Bind or load the profile's card before applying rates.");
      return;
    }
    const entries = marketRateCardEntries(assumptions);
    const rates = marketRateById(entries);
    const target = assumptions.machine_classes.find((machine) => machine.id === machineId);
    if (!target) return;
    const classId = machineMarketRateClassId(target);
    const rate = rates.get(classId)?.rateEurPerHour ?? 0;
    updateAssumptions({
      ...assumptions,
      machine_classes: assumptions.machine_classes.map((machine) =>
        machine.id === machineId
          ? { ...machine, market_rate_class_id: classId, market_sell_rate_eur_per_hour: isSellableCapacityMachine(machine) ? rate : 0 }
          : machine
      )
    });
    setAssumptionStatus(`Applied ${money.format(rate)}/h (${rates.get(classId)?.name ?? classId}) to ${target.name} only. Other assets unchanged.`);
  }

  function applyMarketRateCardToProfitability() {
    if (!assumptions) return;
    if (!rateCardMatchesLoadedProfile()) {
      setAssumptionStatus("Rate card is not bound to the currently loaded saved Company Profile. Bind or load the profile's card before applying to Profitability.");
      return;
    }
    const entries = marketRateCardEntries(assumptions);
    const rates = marketRateById(entries);
    const machineClasses = assumptions.machine_classes.map((machine) => {
      const classId = machineMarketRateClassId(machine);
      const rate = rates.get(classId)?.rateEurPerHour ?? 0;
      return {
        ...machine,
        market_rate_class_id: classId,
        market_sell_rate_eur_per_hour: isSellableCapacityMachine(machine) ? rate : 0
      };
    });
    updateAssumptions({
      ...assumptions,
      machine_classes: machineClasses,
      market_rate_card: entries,
      market_rate_card_profile_id: companyProfile?.profileId ?? null,
      market_rate_card_profile_name: companyProfile?.companyName ?? ""
    });
    if (companyProfile) {
      setCompanyProfile((current) => current ? {
        ...current,
        assets: current.assets.map((asset) => {
          const machineId = profileSlug(asset.id || asset.name, asset.id || "asset");
          const matchingMachine = machineClasses.find((machine) => machine.id === machineId);
          if (matchingMachine) {
            return { ...asset, sellRateEurPerHour: matchingMachine.market_sell_rate_eur_per_hour ?? 0 };
          }
          const fallbackClassId = inferredMarketRateClassId(asset.id, asset.name);
          return { ...asset, sellRateEurPerHour: assetCapacityRole(asset) === "sellable_capacity" ? rates.get(fallbackClassId)?.rateEurPerHour ?? 0 : 0 };
        })
      } : current);
      setProfileStatus("Market rates synced to loaded profile assets; save the profile if you want to persist them there too.");
    }
  }

  function applySuggestedFixedCost(index: number) {
    if (!assumptions) return;
    const machine = assumptions.machine_classes[index];
    updateMachine(index, "monthly_fixed_cost_eur", suggestedFixedCostFromPurchase(machine));
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
    if (!displayTargetResult) {
      setErpStatus("Calculate a quote before sending a Customer Offer payload");
      return;
    }
    try {
      const materialSellEur = displayTargetResult.material_cost_eur + displayTargetResult.material_markup_eur;
      const materialUnitSellEur = quantity > 0 ? materialSellEur / quantity : null;
      const materialUnitCostEur = quantity > 0 ? displayTargetResult.material_cost_eur / quantity : null;
      const response = await fetch("/api/erp/customer-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: quoteNumber,
          customer_name: customerName,
          rfq_reference: rfqReference,
          part_name: partName,
          quantity,
          target_sell_price_eur: displayTargetResult.sell_price_eur,
          target_unit_sell_price_eur: displayTargetResult.unit_sell_price_eur,
          accounting_sell_price_eur: displayAccountingResult?.sell_price_eur ?? null,
          accounting_unit_sell_price_eur: displayAccountingResult?.unit_sell_price_eur ?? null,
          material_sell_eur: materialSellEur,
          material_unit_sell_eur: materialUnitSellEur,
          material_unit_cost_eur: materialUnitCostEur,
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
      if (materialUnitCostEur != null) {
        const key = normalizePartName(partName);
        if (key) setErpOfferMaterialUnitCost((current) => ({ ...current, [key]: materialUnitCostEur }));
      }
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

  const CALIBRATION_MAX_SAMPLE_COUNT = 20;
  const CALIBRATION_DEVIATION_MULTIPLE = 3;
  const CALIBRATION_FIELDS: Array<{ key: keyof OperationTemplate; label: string; selector: (actual: ActualOperation) => number }> = [
    { key: "default_setup_machine_minutes", label: "Setup machine, min", selector: (actual) => actual.actualSetupMachineMinutes },
    { key: "default_setup_labor_minutes", label: "Setup labor, min", selector: (actual) => actual.actualSetupLaborMinutes },
    { key: "default_run_machine_minutes_per_part", label: "Run machine, min/part", selector: (actual) => actual.actualRunMachineMinutesPerPart },
    { key: "default_run_labor_minutes_per_part", label: "Run labor, min/part", selector: (actual) => actual.actualRunLaborMinutesPerPart },
    { key: "default_scrap_allowance_percent", label: "Scrap allowance %", selector: (actual) => actual.actualScrapPercent }
  ];

  // Running weighted mean, not a flat average across unrelated jobs: new = (old*n + mean(actuals)*k)
  // / (n+k), n capped at CALIBRATION_MAX_SAMPLE_COUNT so the template stays adaptive rather than
  // freezing on old data forever. Calibration is per operation TYPE across whatever parts used it
  // in this session, not per part family -- one odd job on a shared operation type still nudges the
  // shared default, just proportionally less as the sample count grows.
  function computeCalibrationCandidates(): CalibrationCandidate[] {
    if (!assumptions) {
      return [];
    }
    return assumptions.operation_templates
      .map((template): CalibrationCandidate | null => {
        const matchingOperations = quoteOperations.filter((operation) => operation.operationType === template.operation_type);
        const matchingActuals = matchingOperations
          .map((operation) => actualOperations.find((actual) => actual.operationId === operation.id))
          .filter((actual): actual is ActualOperation => Boolean(actual));
        if (matchingActuals.length === 0) {
          return null;
        }
        const k = matchingActuals.length;
        const n = Math.min(template.calibration_sample_count ?? 0, CALIBRATION_MAX_SAMPLE_COUNT);
        const fieldChanges = CALIBRATION_FIELDS.map(({ key, label, selector }) => {
          const meanActual = matchingActuals.reduce((sum, actual) => sum + selector(actual), 0) / k;
          const oldValue = (template[key] as number | undefined) ?? 0;
          const newValue = roundMoney((oldValue * n + meanActual * k) / Math.max(1, n + k));
          const deviates = oldValue > 0 && (newValue >= oldValue * CALIBRATION_DEVIATION_MULTIPLE || newValue <= oldValue / CALIBRATION_DEVIATION_MULTIPLE);
          return { key, label, oldValue, newValue, deviates };
        });
        return {
          operationType: template.operation_type,
          fieldChanges,
          newSampleCount: Math.min(n + k, CALIBRATION_MAX_SAMPLE_COUNT),
          requiresConfirmation: fieldChanges.some((change) => change.deviates)
        };
      })
      .filter((candidate): candidate is CalibrationCandidate => candidate !== null);
  }

  function applyActualsToTemplates() {
    const candidates = computeCalibrationCandidates();
    if (candidates.length === 0) {
      setAssumptionStatus("No matching actuals recorded for any operation template.");
      return;
    }
    setPendingCalibration(candidates);
    setCalibrationConfirmations({});
  }

  function confirmCalibration() {
    if (!assumptions || !pendingCalibration) {
      return;
    }
    const blocked = pendingCalibration.filter((candidate) => candidate.requiresConfirmation && !calibrationConfirmations[candidate.operationType]);
    if (blocked.length > 0) {
      setAssumptionStatus(`Confirm the large deviation checkbox for: ${blocked.map((item) => operationLabel(item.operationType)).join(", ")}.`);
      return;
    }
    const changesByType = new Map(pendingCalibration.map((candidate) => [candidate.operationType, candidate]));
    const nextTemplates = assumptions.operation_templates.map((template) => {
      const candidate = changesByType.get(template.operation_type);
      if (!candidate) {
        return template;
      }
      const updates: Partial<OperationTemplate> = { calibration_sample_count: candidate.newSampleCount, quality: "company_estimate" };
      candidate.fieldChanges.forEach((change) => {
        (updates as Record<string, number>)[change.key] = change.newValue;
      });
      return { ...template, ...updates };
    });

    updateAssumptions({ ...assumptions, operation_templates: nextTemplates });
    setAssumptionStatus("Actuals applied to operation templates as a running weighted mean. Save Resources to persist.");
    setPendingCalibration(null);
    setCalibrationConfirmations({});
  }

  function cancelCalibration() {
    setPendingCalibration(null);
    setCalibrationConfirmations({});
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
    setValidityDate("15.08.2026");
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
    // No QC/inspection line: the company profile treats QC as support capacity whose cost
    // is recovered through the sellable stations, so a quote route must not book it directly.
    const route = ["saw_cutting", "milling_3_axis", "drilling", "tapping", "engraving"];
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
      erpSource,
      competitorUnitPriceEur
    };
  }

  function restoreQuoteState(state: Record<string, unknown>) {
    setDraftId(typeof state.draftId === "string" ? state.draftId : null);
    if (typeof state.partName === "string") setPartName(state.partName);
    if (typeof state.customerName === "string") setCustomerName(state.customerName);
    if (typeof state.rfqReference === "string") setRfqReference(state.rfqReference);
    if (typeof state.quoteNumber === "string") setQuoteNumber(state.quoteNumber);
    if (typeof state.validityDate === "string") setValidityDate(normalizeDisplayDate(state.validityDate));
    if (typeof state.deliveryEstimate === "string") setDeliveryEstimate(state.deliveryEstimate);
    if (typeof state.paymentTerms === "string") setPaymentTerms(state.paymentTerms);
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
    setCompetitorUnitPriceEur(typeof state.competitorUnitPriceEur === "number" ? state.competitorUnitPriceEur : null);
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
          target_result: displayTargetResult,
          accounting_result: displayAccountingResult,
          quantity_break_results: quoteHasRoute ? quantityBreakResults : [],
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

  async function saveMarketRateCard() {
    if (!assumptions) return;
    try {
      if (!companyProfile?.profileId) {
        setAssumptionStatus("Load a saved Company Profile before saving a market rate card.");
        return;
      }
      const payloadToSave = {
        ...assumptions,
        market_rate_card: marketRateCardEntries(assumptions),
        market_rate_card_profile_id: companyProfile.profileId,
        market_rate_card_profile_name: companyProfile.companyName
      };
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
      setAssumptionStatus("Saved market rate card to baseline_assumptions.lv.json");
    } catch (error) {
      setAssumptionStatus(error instanceof Error ? error.message : "Market rate card save failed");
    }
  }

  const priceGap = displayAccountingResult && displayTargetResult
    ? displayAccountingResult.sell_price_eur - displayTargetResult.sell_price_eur
    : 0;

  const operationStartedQuantities = startedQuantitiesForOperations(quoteOperations, quantity);
  const routeMarketRows = (() => {
    if (!assumptions) return [];
    const rows = new Map<string, {
      machine: MachineClass;
      machineIndex: number;
      hours: number;
      machineCost: number;
      laborCost: number;
      scrapCost: number;
      requiredSellValue: number;
    }>();
    const marginDivisor = Math.max(0.01, 1 - commercialPolicy.default_margin_percent);
    quoteOperations.forEach((operation, index) => {
      if (!operation.machineClassId) return;
      const machineIndex = assumptions.machine_classes.findIndex((machine) => machine.id === operation.machineClassId);
      if (machineIndex < 0) return;
      const machine = assumptions.machine_classes[machineIndex];
      const startedQuantity = operationStartedQuantities[index] ?? quantity;
      const hours = operationWorkCenterHours(operation, startedQuantity);
      const costParts = operationConversionCostParts(operation, "target_competitive", startedQuantity);
      const requiredSellValue = (costParts.total * (1 + commercialPolicy.risk_allowance_percent)) / marginDivisor;
      const current = rows.get(machine.id)
        ?? { machine, machineIndex, hours: 0, machineCost: 0, laborCost: 0, scrapCost: 0, requiredSellValue: 0 };
      rows.set(machine.id, {
        ...current,
        hours: current.hours + hours,
        machineCost: current.machineCost + costParts.machineCost,
        laborCost: current.laborCost + costParts.laborCost,
        scrapCost: current.scrapCost + costParts.scrapCost,
        requiredSellValue: current.requiredSellValue + requiredSellValue
      });
    });
    return Array.from(rows.values()).map((row) => ({
      ...row,
      hours: roundMoney(row.hours),
      isSupportStation: machineCapacityRole(row.machine) !== "sellable_capacity",
      quoteRequiredRate: row.hours > 0 ? roundMoney(row.requiredSellValue / row.hours) : 0
    }));
  })();
  const routeMarketHours = routeMarketRows.reduce((sum, row) => sum + row.hours, 0);
  const routeWeightedRequiredRate = routeMarketRows.reduce(
    (sum, row) => sum + row.hours * row.quoteRequiredRate,
    0
  ) / Math.max(1, routeMarketHours);
  // The saved-vs-required gap is only meaningful over stations that actually have saved
  // market evidence; averaging zeros in would fake a market rate below the required one.
  const routeSavedRateRows = routeMarketRows.filter((row) => marketSellRateValue(row.machine) > 0);
  const routeSavedRateHours = routeSavedRateRows.reduce((sum, row) => sum + row.hours, 0);
  const routeWeightedMarketRate = routeSavedRateRows.reduce(
    (sum, row) => sum + row.hours * marketSellRateValue(row.machine),
    0
  ) / Math.max(1, routeSavedRateHours);
  const routeWeightedRateGap = routeSavedRateRows.reduce(
    (sum, row) => sum + row.hours * (marketSellRateValue(row.machine) - row.quoteRequiredRate),
    0
  ) / Math.max(1, routeSavedRateHours);
  // Header comparison must be apples-to-apples: the required average next to the market
  // average covers the same stations (those with a market rate), not e.g. a QC support row.
  const routeComparableRequiredRate = routeSavedRateRows.reduce(
    (sum, row) => sum + row.hours * row.quoteRequiredRate,
    0
  ) / Math.max(1, routeSavedRateHours);
  const formatRateGap = (gap: number) => `${gap >= 0 ? "+" : "-"}${money.format(Math.abs(gap))}/h`;
  const selectedResult = rateMode === "accounting_full_cost" ? displayAccountingResult : displayTargetResult;

  const currentToolChecks = toolCheckResults();
  const missingToolChecks = currentToolChecks.filter((item) => item.status === "missing");
  const totalMissingToolCost = roundMoney(missingToolChecks.reduce((sum, item) => sum + item.quoteCostEur, 0));

  return (
    <main className={`appShell lang-${language}`}>
      <aside className="sidebar">
        <div className="brand">
          <Factory size={24} />
          <span>ProdCost</span>
        </div>
        <nav className="nav">
          <button
            className={`navItem ${activeView === "profile" ? "active" : ""}`}
            title={t("Company profile")}
            onClick={() => setActiveView("profile")}
          >
            <Building2 size={18} />
            <span>{t("Profile")}</span>
          </button>
          <button
            className={`navItem ${activeView === "resources" ? "active" : ""}`}
            title={t("Resources")}
            onClick={() => setActiveView("resources")}
          >
            <LibraryBig size={18} />
            <span>{t("Resources")}</span>
          </button>
          <button
            className={`navItem ${activeView === "quote" ? "active" : ""}`}
            title={t("Quote builder")}
            onClick={() => setActiveView("quote")}
          >
            <Calculator size={18} />
            <span>{t("Quote")}</span>
          </button>
          <button
            className={`navItem ${activeView === "market_rates" ? "active" : ""}`}
            title={t("Market rate builder")}
            onClick={() => setActiveView("market_rates")}
          >
            <Gauge size={18} />
            <span>{t("Market Rates")}</span>
          </button>
          <button
            className={`navItem ${activeView === "scenarios" ? "active" : ""}`}
            title={t("Scenarios")}
            onClick={() => setActiveView("scenarios")}
          >
            <SplitSquareVertical size={18} />
            <span>{t("Scenarios")}</span>
          </button>
          <button
            className={`navItem ${activeView === "profitability" ? "active" : ""}`}
            title={t("Can we be profitable?")}
            onClick={() => setActiveView("profitability")}
          >
            <TrendingUp size={18} />
            <span>{t("Profitability")}</span>
          </button>
          <button
            className={`navItem ${activeView === "business_case" ? "active" : ""}`}
            title={t("Business case")}
            onClick={() => setActiveView("business_case")}
          >
            <Gauge size={18} />
            <span>{t("Case")}</span>
          </button>
          <button
            className={`navItem ${activeView === "guide" ? "active" : ""}`}
            title={t("Principles and terminology guide")}
            onClick={() => setActiveView("guide")}
          >
            <BookOpen size={18} />
            <span>{t("Guide")}</span>
          </button>
          <button
            className={`navItem ${activeView === "methods" ? "active" : ""}`}
            title={t("Costing methods: the one this tool uses and the alternatives")}
            onClick={() => setActiveView("methods")}
          >
            <LibraryBig size={18} />
            <span>{t("Methods")}</span>
          </button>
          <button
            className={`navItem clientNavItem ${activeView === "client_portal" ? "active" : ""}`}
            title={t("Client RFQ portal")}
            onClick={() => setActiveView("client_portal")}
          >
            <Upload size={18} />
            <span>{t("Client")}</span>
          </button>
          <button
            className={`navItem clientNavItem ${activeView === "print" ? "active" : ""}`}
            title={t("Printable quote")}
            onClick={() => setActiveView("print")}
          >
            <Save size={18} />
            <span>{t("Print")}</span>
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{t(activeView === "resources" ? "Assumptions" : activeView === "profile" ? "Company Profile" : activeView === "market_rates" ? "Market Rates" : activeView === "client_portal" ? "Client Portal" : activeView === "scenarios" ? "Scenarios" : activeView === "print" ? "Printable Quote" : activeView === "business_case" ? "Business Case" : activeView === "guide" ? "Principles Guide" : activeView === "methods" ? "Costing Methods" : activeView === "profitability" ? "Profitability" : "Quote Builder")}</h1>
            <p>{t("Operation-based CNC cost estimate with editable Latvian starter assumptions.")}</p>
          </div>
          <div className="modeGroup languageToggle">
            <button className={`mode ${language === "en" ? "active" : ""}`} onClick={() => setLanguage("en")}>EN</button>
            <button className={`mode ${language === "lv" ? "active" : ""}`} onClick={() => setLanguage("lv")}>LV</button>
          </div>
        </header>

        {activeView === "quote" ? (
          <>
            <section className={`costingBasisStrip ${loadedProfileNotApplied ? "warning" : ""}`}>
              <div>
                <span>{t("Quote costing basis")}</span>
                <strong>{activeCostingBasisName}</strong>
                <p>
                  {loadedProfileNotApplied
                    ? `Loaded Profile is ${loadedProfileName}, but it has not been applied to costing yet. Quote calculations are still using ${activeCostingBasisName}.`
                    : t("This is the active company assumptions set used for Quote calculations.")}
                </p>
              </div>
              <div className="costingBasisActions">
                {loadedProfileNotApplied ? (
                  <button className="primaryButton" onClick={applyCompanyProfileToAssumptions}>{t("Apply Loaded Profile")}</button>
                ) : (
                  <button className="secondaryButton" onClick={() => setActiveView("profile")}>{t("Open Profile")}</button>
                )}
              </div>
            </section>

            <section className="panel erpPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("ERP Connection Demo")}</h2>
                  <p className="sectionHelp">{t("Import BOM, route, material, and customer context from a sample ERP adapter. Use the demo RFQ only when you want a complete sample quote.")}</p>
                </div>
                <div className="buttonRow"><Database size={18} />{sectionToggle("erp_demo", true)}</div>
              </div>
              {isSectionOpen("erp_demo", true) ? (
              <>
              <div className="erpControls">
                <label>{t("ERP part")}<select value={selectedErpPartId} onChange={(event) => setSelectedErpPartId(event.target.value)}>
                  <option value="">{t("Select ERP part")}</option>
                  {erpParts.map((part) => (
                    <option key={part.id} value={part.id}>{part.part_number} rev {part.revision} - {part.name} ({part.customer_name})</option>
                  ))}
                </select></label>
                <button className="primaryButton" onClick={importErpRfq}><Database size={16} /> {t("Import ERP Data")}</button>
                <button className="secondaryButton" onClick={sendCustomerOfferToErp}><Send size={16} /> {t("Send Offer Data to ERP")}</button>
                <button className="secondaryButton" onClick={loadDemoRfq}><Calculator size={16} /> {t("Load Demo RFQ")}</button>
              </div>
              <div className="erpStatusGrid">
                <p className="statusText">{erpStatus}</p>
                <p className="statusText">{erpSource ? `Source: ${erpSource.partNumber} rev ${erpSource.revision}, imported ${new Date(erpSource.importedAt).toLocaleString("en-GB")}` : t("Source: manual quote or demo RFQ")}</p>
                {lastErpOffer ? <p className="statusText">Last ERP CO: {lastErpOffer.id} ({lastErpOffer.status})</p> : null}
              </div>
              </>
              ) : null}
            </section>

            <section className="panel draftPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Quote Drafts")}</h2>
                  <p className="sectionHelp">{t("Save the current quote to reopen it later, or export/print it. A saved draft keeps the route, both prices, and a snapshot of the assumptions used.")}</p>
                </div>
                <div className="buttonRow draftControls">
                  {isSectionOpen("quote_drafts") ? (
                    <>
                      <select value={draftId ?? ""} onChange={(event) => loadQuoteDraft(event.target.value)}>
                        <option value="">{t("Select draft")}</option>
                        {drafts.map((draft) => (
                          <option key={draft.id} value={draft.id}>{draft.name}</option>
                        ))}
                      </select>
                      <button className="primaryButton" onClick={saveQuoteDraft}><Save size={16} /> {t("Save Draft")}</button>
                      <button className="secondaryButton" onClick={() => exportQuoteDraft("json")}>{t("Export JSON")}</button>
                      <button className="secondaryButton" onClick={() => exportQuoteDraft("csv")}>{t("Export CSV")}</button>
                      <button className="secondaryButton" onClick={() => setActiveView("print")}>{t("Print")}</button>
                      <button className="iconButton" title={t("Delete selected draft")} onClick={deleteQuoteDraft}><Trash2 size={18} /></button>
                    </>
                  ) : null}
                  {sectionToggle("quote_drafts")}
                </div>
              </div>
              {isSectionOpen("quote_drafts") ? <p className="statusText">{draftStatus}</p> : null}
            </section>

            <section className="resourceIntroGrid quoteIntroGrid">
              <div className="panel inputPanel">
                <div className="sectionHeader">
                  <h2>{t("RFQ")}</h2>
                  <Gauge size={18} />
                </div>
                <p className="sectionHelp">{t("The customer request being priced: who is asking, which part, how many pieces, and what raw material it starts from. Everything below builds on these inputs.")}</p>
                <div className="fieldGrid">
                  <label>{t("Part")}<input value={partName} onChange={(event) => setPartName(event.target.value)} /></label>
                  <label>{t("Customer")}<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
                  <label>{t("RFQ/reference")}<input value={rfqReference} onChange={(event) => setRfqReference(event.target.value)} /></label>
                  <label>{t("Quote number")}<input value={quoteNumber} onChange={(event) => setQuoteNumber(event.target.value)} /></label>
                  <label>{t("Validity date")}<input value={validityDate} inputMode="numeric" placeholder="dd.mm.yyyy" onChange={(event) => setValidityDate(event.target.value)} /></label>
                  <label>{t("Delivery estimate")}<input value={deliveryEstimate} onChange={(event) => setDeliveryEstimate(event.target.value)} /></label>
                  <label>{t("Payment terms")}<input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></label>
                  <label>{t("Quantity, pcs")}<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, numericValue(event.target.value, 1)))} /></label>
                  <label>{t("Quantity breaks, pcs")}<input value={quantityBreakText} onChange={(event) => setQuantityBreakText(event.target.value)} /></label>
                  <label>{t("Material library")}<select value={selectedMaterialId} onChange={(event) => selectMaterial(event.target.value)}><option value="">{t("Manual material")}</option>{(assumptions?.material_examples ?? []).map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label>
                  <label>{t("Stock piece")}<input value={stockName} onChange={(event) => { setSelectedMaterialId(""); setStockName(event.target.value); }} /></label>
                  <label>{t("Stock cost, EUR/piece")}<input type="number" min="0" value={stockCost} onChange={(event) => { setSelectedMaterialId(""); setStockCost(numericValue(event.target.value)); }} /></label>
                  <label>{t("Stock pieces, pcs")}<input type="number" min="0.01" step="0.01" value={stockPieces} onChange={(event) => setStockPieces(Math.max(0.01, numericValue(event.target.value, 1)))} /></label>
                  <label>{t("Scrap recovery, EUR")}<input type="number" min="0" value={scrapRecovery} onChange={(event) => setScrapRecovery(numericValue(event.target.value))} /></label>
                </div>
                {(() => {
                  const selectedMaterial = assumptions?.material_examples.find((material) => material.id === selectedMaterialId);
                  const shape = selectedMaterial?.stock_shape ?? "";
                  const isPlate = shape === "plate";
                  const isLinear = shape === "round_bar" || shape === "hex_bar" || shape === "square_bar" || shape === "tube";
                  const hasDimensions = Boolean(selectedMaterial?.stock_length_mm) && (!isPlate || Boolean(selectedMaterial?.stock_width_mm));
                  const isPerPieceBlank = Boolean(selectedMaterial) && !hasDimensions;
                  const kerfMm = selectedMaterial?.kerf_mm ?? 0;
                  const suggested = selectedMaterial
                    ? isPerPieceBlank
                      ? quantity
                      : stockPiecesRequiredForMaterial(selectedMaterial, cutLengthMm, isPlate ? cutWidthMm : 0, quantity)
                    : null;
                  const blanksPerUnit = isLinear && hasDimensions && cutLengthMm > 0
                    ? piecesPerLinearStockUnit(selectedMaterial?.stock_length_mm ?? 0, kerfMm, cutLengthMm)
                    : null;
                  const materialUsedShare = suggested !== null && suggested > 0 && cutLengthMm > 0 && hasDimensions
                    ? isPlate
                      ? (cutLengthMm * Math.max(1, cutWidthMm) * quantity) / (suggested * (selectedMaterial?.stock_length_mm ?? 1) * (selectedMaterial?.stock_width_mm ?? 1))
                      : (cutLengthMm * quantity) / (suggested * (selectedMaterial?.stock_length_mm ?? 1))
                    : null;
                  const stockFormatLabel = !selectedMaterial
                    ? null
                    : isPerPieceBlank
                      ? t("Per-piece blank (casting, forging, or pre-cut purchase) -- no cutting division needed")
                      : isPlate
                        ? `Plate ${selectedMaterial.stock_length_mm} x ${selectedMaterial.stock_width_mm} mm`
                        : `${shape.replace("_", " ")} ${selectedMaterial.stock_length_mm} mm${kerfMm > 0 ? `, saw kerf ${kerfMm} mm per cut` : ""}`;
                  return (
                    <div className="cutoffHelperBlock">
                      <p className="sectionHelp"><strong>{t("Cutoff Calculator.")}</strong> {t("Raw stock comes in fixed sizes and a part rarely divides into it evenly -- the unusable remainder is a real cost. Enter the blank size one part needs; the calculator converts it into whole stock pieces to buy.")} {stockFormatLabel ? <>{t("Selected stock:")} <strong>{stockFormatLabel}</strong>.</> : t("Select a Material library item with stock dimensions to enable it.")}</p>
                      <div className="fixedCostHelper cutoffHelper">
                        {!isPerPieceBlank ? (
                          <label>
                            {isPlate ? t("Blank length, mm") : t("Cut length per part, mm")}
                            <input type="number" min="1" value={cutLengthMm} onChange={(event) => setCutLengthMm(Math.max(1, numericValue(event.target.value, 100)))} />
                          </label>
                        ) : null}
                        {isPlate ? (
                          <label>
                            {t("Blank width, mm")}
                            <input type="number" min="1" value={cutWidthMm} onChange={(event) => setCutWidthMm(Math.max(1, numericValue(event.target.value, 100)))} />
                          </label>
                        ) : null}
                        <div>
                          <div className="suggestedValue">
                            {selectedMaterial
                              ? suggested !== null
                                ? isPerPieceBlank
                                  ? `One blank per part: ${suggested} stock piece(s) for ${quantity} pcs`
                                  : `Suggested: ${suggested} stock piece(s) for ${quantity} pcs`
                                    + (blanksPerUnit !== null ? ` (${blanksPerUnit} blank${blanksPerUnit === 1 ? "" : "s"} per stock unit)` : "")
                                    + (materialUsedShare !== null ? `, ~${Math.round(Math.min(1, materialUsedShare) * 100)}% of purchased material used` : "")
                                : t("Enter the blank size above to calculate")
                              : t("Select a Material library item to enable the cutoff calculator")}
                          </div>
                          <button
                            type="button"
                            className="secondaryButton"
                            disabled={suggested === null}
                            onClick={() => { if (suggested !== null) setStockPieces(suggested); }}
                          >
                            {t("Apply")}
                          </button>
                        </div>
                      </div>
                      {isPlate ? <p className="sectionHelp">{t("Plate is a rough area estimate at 82% nesting efficiency -- an honest approximation, not true 2D nesting software.")}</p> : null}
                    </div>
                  );
                })()}
              </div>

              <div className="panel resultPanel">
                <div className="sectionHeader wide summaryHeader">
                  <h2>{t("Quote Summary")}</h2>
                  <div className="modeGroup compactMode" aria-label={t("Rate mode")}>
                    <button className={`mode ${rateMode === "target_competitive" ? "active" : ""}`} onClick={() => setRateMode("target_competitive")}>{t("Target")}</button>
                    <button className={`mode ${rateMode === "accounting_full_cost" ? "active" : ""}`} onClick={() => setRateMode("accounting_full_cost")}>{t("Accounting")}</button>
                  </div>
                </div>
                {apiError ? <p className="errorText">{apiError}</p> : null}
                <dl className="summary">
                  <div><dt>{t("Production cost, EUR")}</dt><dd>{selectedResult ? money.format(selectedResult.total_cost_eur) : "..."}</dd></div>
                  <div><dt>{t("Engineering/CAM operation, EUR")}</dt><dd>{selectedResult ? money.format(selectedResult.engineering_cost_eur) : "..."}</dd></div>
                  <div><dt>{t("Own work (margin applies), EUR")}</dt><dd>{selectedResult ? money.format(selectedResult.conversion_side_cost_eur ?? 0) : "..."}</dd></div>
                  <div><dt>{t("Material/bought-out pass-through, EUR")}</dt><dd>{selectedResult ? `${money.format(selectedResult.pass_through_cost_eur ?? 0)} + ${money.format(selectedResult.material_markup_eur ?? 0)} handling markup` : "..."}</dd></div>
                  <div><dt>{t("Sell price, EUR")}</dt><dd>{selectedResult ? money.format(selectedResult.sell_price_eur) : "..."}</dd></div>
                  <div><dt>{t("Unit price, EUR/pc")}</dt><dd>{selectedResult ? money.format(selectedResult.unit_sell_price_eur) : "..."}</dd></div>
                  <div><dt>{t("Machine rate source")}</dt><dd>{rateMode === "accounting_full_cost" ? t("Accounting cost rates from Resources") : t("Target cost rates from Resources")}</dd></div>
                  <div><dt>{t("Commercial multiplier")}</dt><dd>{selectedResult ? `×${selectedResult.commercial_multiplier.toFixed(2)} (sell price / raw cost subtotal)` : "..."}</dd></div>
                </dl>
                <div className="scenarioStrip quoteSummaryScenarioStrip">
                  <div>
                    <span className="scenarioLabel">{t("Target price, EUR")}</span>
                    <strong>{displayTargetResult ? money.format(displayTargetResult.sell_price_eur) : "..."}</strong>
                    <span className="scenarioHint">{t("Cost-plus target price from Resources rates.")}</span>
                  </div>
                  <div>
                    <span className="scenarioLabel">{t("Accounting price, EUR")}</span>
                    <strong>{displayAccountingResult ? money.format(displayAccountingResult.sell_price_eur) : "..."}</strong>
                    <span className="scenarioHint">{t("Current full-cost-rate price.")}</span>
                  </div>
                  <div>
                    <span className="scenarioLabel">{t("Accounting premium, EUR")}</span>
                    <strong>{displayAccountingResult && displayTargetResult ? money.format(priceGap) : "..."}</strong>
                    <span className="scenarioHint">{t("Accounting minus target.")}</span>
                  </div>
                </div>

                <div className="quoteMarketRateCard">
                  <div className="quoteMarketRateHeader">
                    <div>
                      <strong>{t("Route rate check")}</strong>
                    </div>
                    <div className="quoteMarketRateActions">
                      <em>
                        {routeMarketRows.length === 0
                          ? t("No route machines")
                          : routeSavedRateRows.length === 0
                            ? `${money.format(routeWeightedRequiredRate)}/h cost-plus | no market rates entered`
                            : (
                              <>
                                {money.format(routeWeightedMarketRate)}/h market | {money.format(routeComparableRequiredRate)}/h cost-plus | market − cost-plus:{" "}
                                <span
                                  className={routeWeightedRateGap >= 0 ? "rateGood" : "rateBad"}
                                  title={routeWeightedRateGap >= 0
                                    ? "Market pays at or above this quote's cost-plus floor -- there is room in the price."
                                    : "This quote's cost-plus floor is above what the market pays for these stations -- the quote is priced above the market rate."}
                                >
                                  {formatRateGap(routeWeightedRateGap)}
                                </span>
                              </>
                            )}
                      </em>
                      <button type="button" className="secondaryButton" onClick={() => setActiveView("market_rates")}>{t("Edit Market Rates")}</button>
                    </div>
                  </div>
                  {routeMarketRows.length > 0 ? (
                    <div className="quoteMarketRateRows">
                      <div className="quoteMarketRateRow quoteMarketRateHeadRow">
                        <span>{t("Station")}</span>
                        <span title={t("Rate entered per station on the Market Rates page.")}>{t("Market EUR/h")}</span>
                        <span title={`This quote's cost-plus rate for the station's routed time: (machine target rate incl. overhead share × machine h + labor rate × labor h + scrap allowance) × (1 + risk ${formatPercent(commercialPolicy.risk_allowance_percent)}%) ÷ (1 − margin ${formatPercent(commercialPolicy.default_margin_percent)}%), divided by the station's route hours. Hover a value for the numbers.`}>{t("Cost-plus EUR/h")}</span>
                        <span title={t("Market minus cost-plus: positive (green) means the market pays above this quote's floor; negative (red) means this quote is priced above what the market pays.")}>{t("Market − Cost-plus")}</span>
                      </div>
                      {routeMarketRows.map((row) => {
                        const marketRate = marketSellRateValue(row.machine);
                        const rateGap = marketRate > 0 ? marketRate - row.quoteRequiredRate : null;
                        const conversionCost = row.machineCost + row.laborCost + row.scrapCost;
                        const costPlusFormulaTitle = `Machine ${money.format(row.machineCost)} + labor ${money.format(row.laborCost)} + scrap ${money.format(row.scrapCost)} = ${money.format(conversionCost)} conversion cost; × ${(1 + commercialPolicy.risk_allowance_percent).toFixed(2)} risk ÷ ${(1 - commercialPolicy.default_margin_percent).toFixed(2)} margin = ${money.format(row.requiredSellValue)}; ÷ ${row.hours.toFixed(1)} station h = ${money.format(row.quoteRequiredRate)}/h. Machine rate already includes the station's weighted overhead share.`;
                        return (
                          <div className="quoteMarketRateRow" key={row.machine.id}>
                            <span>
                              {row.machine.name}
                              {row.isSupportStation ? <em className="supportStationTag" title={t("Support capacity: this station does not sell hours, so no market rate is expected. Cost-plus still shows what this quote charges for its routed time.")}>{t("support")}</em> : null}
                              <small>{row.hours.toFixed(1)} route h</small>
                            </span>
                            <strong title={row.isSupportStation
                              ? t("Support stations are not sold by the hour, so they have no market rate.")
                              : t("Market sell rate entered for this station on the Market Rates page.")}>
                              {marketRate > 0 ? `${money.format(marketRate)}/h` : row.isSupportStation ? t("Support") : t("Not set")}
                            </strong>
                            <em title={costPlusFormulaTitle}>{money.format(row.quoteRequiredRate)}/h</em>
                            <strong
                              className={`rateGapCell ${rateGap === null ? "rateMissing" : rateGap >= 0 ? "rateGood" : "rateBad"}`}
                              title={rateGap === null
                                ? row.isSupportStation
                                  ? t("Support station: no market rate applies, so there is no difference to show.")
                                  : t("No market rate entered for this station, so no difference can be shown.")
                                : rateGap >= 0
                                  ? t("Market rate is at or above this quote's cost-plus rate.")
                                  : t("Market rate is below this quote's cost-plus rate: this station's hours sell under the cost-plus floor.")}
                            >
                              {rateGap === null ? "--" : formatRateGap(rateGap)}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>{t("Add at least one route operation with a machine to show market sell-rate references.")}</p>
                  )}
                </div>

                <p className="sectionHelp">{t("Target and Accounting are cost-plus prices from Resources rates. The route check compares the market rates entered on the Market Rates page with this quote's cost-plus rate per station; it does not replace the quote price.")}</p>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Quantity Breaks")}</h2>
                  <p className="sectionHelp">{t("Unit prices show how setup and CAM costs amortize across batch sizes. Material quantity is recomputed per break, not frozen at the main quantity. Rows marked * have no cutoff data for the selected material, so their stock pieces were scaled proportionally instead of cutoff-optimized.")}</p>
                </div>
              </div>
              <div className="operationTable">
                <div className="tableHead quantityBreakHead"><span>{t("Qty, pcs")}</span><span>{t("Target total, EUR")}</span><span>{t("Target unit, EUR/pc")}</span><span>{t("Accounting total, EUR")}</span><span>{t("Accounting unit, EUR/pc")}</span><span>{t("Premium, EUR/pc")}</span></div>
                {quantityBreakResults.map((item) => (
                  <div className="tableRow quantityBreakRow" key={item.quantity}>
                    <span>{item.quantity}{item.materialScaledLinearly ? <em className="scaledNote" title={t("No cutoff data for this material: stock pieces were scaled linearly from the main quantity, not cutoff-optimized.")}>*</em> : null}</span>
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
                  <h2>{t("STEP and CAM")}</h2>
                  <Upload size={18} />
                </div>
                <p className="sectionHelp">{t('A new part needs a machining program (CAM) and a prove-out before production can start -- real engineering hours that belong in the price. "Prove-out" is the supervised first run on the machine: verifying the program, offsets, and fixturing, and measuring the first article until a good part comes off. A repeat part reuses most of that work and is cheaper. The 3D file is stored for reference only; its geometry is not parsed automatically.')}</p>
                <div className="uploadBox">
                  <input id="cad-file" type="file" accept=".step,.stp" onChange={(event) => setCadFile(event.target.files?.[0] ?? null)} />
                  <label className="uploadLabel" htmlFor="cad-file">{cadFile ? cadFile.name : t("Select .step or .stp file")}</label>
                </div>
                <label className="checkRow">
                  <input type="checkbox" checked={isNewPart} onChange={(event) => setIsNewPart(event.target.checked)} />
                  <span>{t("New part, CAM program required")}</span>
                </label>
                <div className="fieldGrid compact">
                  <label>
                    {t("Complexity")}
                    <select value={camComplexity} onChange={(event) => {
                      const next = event.target.value;
                      setCamComplexity(next);
                      if (assumptions) {
                        const key = `${next}_programming_minutes` as keyof Assumptions["cam_programming_defaults"];
                        const minutes = assumptions.cam_programming_defaults[key];
                        if (typeof minutes === "number") setProgrammingMinutes(minutes);
                      }
                    }}>
                      <option value="simple">{t("Simple")}</option>
                      <option value="medium">{t("Medium")}</option>
                      <option value="complex">{t("Complex")}</option>
                    </select>
                  </label>
                  <label>{t("CAM rate, EUR/h")}<input type="number" min="0" value={programmingRate} onChange={(event) => setProgrammingRate(numericValue(event.target.value))} /></label>
                  <label>{t("Programming, min")}<input type="number" min="0" value={programmingMinutes} onChange={(event) => setProgrammingMinutes(numericValue(event.target.value))} /></label>
                  <label>{t("Prove-out, min")}<input type="number" min="0" value={proveoutMinutes} onChange={(event) => setProveoutMinutes(numericValue(event.target.value))} /></label>
                </div>
              </div>

              <div className="panel">
                <div className="sectionHeader"><h2>{t("Assumptions")}</h2></div>
                <ul className="noteList">
                  <li>{isNewPart ? t("Full CAM cost is included.") : `${t("Existing CAM program reuse reduces CAM cost by")} ${formatPercent(reusableProgramPercent)}%.`}</li>
                  <li>{t("STEP geometry is stored as metadata; geometry parsing is a later estimator layer.")}</li>
                  <li>{rateMode === "target_competitive" ? t("Target machine rates are used for quote pricing.") : t("Accounting full-cost machine rates are used for quote pricing.")}</li>
                  <li>{missingToolChecks.length > 0 ? `${t("Missing tools add")} ${money.format(totalMissingToolCost)} ${t("as operation batch cost.")}` : t("Required tools are available or no tool requirements are set.")}</li>
                  {selectedResult?.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            </section>

            <section className="operations camOperationPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Engineering Operation")}</h2>
                  <p className="sectionHelp">{t("CAM/programming is shown as a route step because it consumes skilled labor before production starts. Repeat parts keep the same row but apply reusable-program reduction.")}</p>
                </div>
              </div>
              <div className="operationTable">
                <div className="tableHead camOperationHead"><span>{t("Operation")}</span><span>{t("Basis")}</span><span>{t("Gross min")}</span><span>{t("Reusable reduction")}</span><span>{t("Cost, EUR")}</span></div>
                <div className="tableRow camOperationRow">
                  <span>{isNewPart ? t("New-part CAM/programming") : t("Repeat-part CAM review")}</span>
                  <span>{t(camComplexity === "simple" ? "Simple" : camComplexity === "medium" ? "Medium" : "Complex")} {t("complexity at")} {money.format(programmingRate)}/h</span>
                  <span>{programmingMinutes + proveoutMinutes}</span>
                  <span>{formatPercent(reusableProgramPercent)}%</span>
                  <span>{displayTargetResult ? money.format(displayTargetResult.engineering_cost_eur) : "..."}</span>
                </div>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Operations")}</h2>
                  <p className="sectionHelp">{t("The production route: each step the part goes through, with its machine and labor time. Rates are pulled from the selected machine and labor classes. Labor minutes mean minutes a person is actually occupied by this step -- if one operator runs three machines at once, enter roughly a third of the machine time per operation, and for hands-on work (deburring, assembly) labor time can exceed machine time. Entering full labor time next to full machine time for the same person double-charges that hour. An attendance floor protects the other direction: charged labor minutes are never below machine minutes × the station's operator attendance share (1 for a dedicated operator), so under-entered labor cannot leak operator salary out of the price.")}</p>
                </div>
                <div className="buttonRow addOperationControls">
                  <select value={selectedTemplateType} onChange={(event) => setSelectedTemplateType(event.target.value)}>
                    {(assumptions?.operation_templates ?? []).map((template) => (
                      <option key={template.operation_type} value={template.operation_type}>{operationLabel(template.operation_type)}</option>
                    ))}
                  </select>
                  <button className="primaryButton" onClick={addOperation}><Plus size={16} /> {t("Add")}</button>
                </div>
              </div>

              <div className="operationEditor">
                <div className="operationEditorHead">
                  <span>{t("Operation")}</span><span>{t("Resources")}</span><span>{t("Setup, min")}</span><span>{t("Cycle, min/part")}</span><span>{t("Variable, EUR")}</span><span>{t("Scrap, %")}</span><span></span>
                </div>
                {quoteOperations.map((operation, index) => {
                  const selectedMachineRate = machineRate(operation.machineClassId, rateMode);
                  const selectedLaborRate = laborRate(operation.laborClassId);
                  return (
                    <div className="operationEditorRow" key={operation.id}>
                      <div className="stackedFields">
                        <label>{t("Template")}<select value={operation.operationType} onChange={(event) => changeOperationTemplate(index, event.target.value)}>{(assumptions?.operation_templates ?? []).map((template) => <option key={template.operation_type} value={template.operation_type}>{operationLabel(template.operation_type)}</option>)}</select></label>
                        <label>{t("Name")}<input value={operation.name} onChange={(event) => updateQuoteOperation(index, { name: event.target.value })} /></label>
                      </div>
                      <div className="stackedFields">
                        <label>{t("Machine")}<select value={operation.machineClassId ?? ""} onChange={(event) => updateQuoteOperation(index, { machineClassId: event.target.value || null })}><option value="">{t("No machine")}</option>{(assumptions?.machine_classes ?? []).map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
                        <label>{t("Labor")}<select value={operation.laborClassId ?? ""} onChange={(event) => updateQuoteOperation(index, { laborClassId: event.target.value || null })}><option value="">{t("No labor")}</option>{(assumptions?.labor_classes ?? []).map((labor) => <option key={labor.id} value={labor.id}>{labor.name}</option>)}</select></label>
                        <span className="rateHint">{money.format(selectedMachineRate)}/h {rateMode === "accounting_full_cost" ? t("accounting") : t("target")} {t("machine cost rate,")} {money.format(selectedLaborRate)}/h {t("labor")}</span>
                      </div>
                      <div className="miniGrid">
                        <label>{t("Machine, min")}<input type="number" min="0" value={operation.setupMachineMinutes} onChange={(event) => updateQuoteOperation(index, { setupMachineMinutes: numericValue(event.target.value) })} /></label>
                        <label>{t("Labor, min")}<input type="number" min="0" value={operation.setupLaborMinutes} onChange={(event) => updateQuoteOperation(index, { setupLaborMinutes: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>{t("Machine, min/part")}<input type="number" min="0" value={operation.runMachineMinutesPerPart} onChange={(event) => updateQuoteOperation(index, { runMachineMinutesPerPart: numericValue(event.target.value) })} /></label>
                        <label>{t("Labor, min/part")}<input type="number" min="0" value={operation.runLaborMinutesPerPart} onChange={(event) => updateQuoteOperation(index, { runLaborMinutesPerPart: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>{t("Tool, EUR/part")}<input type="number" min="0" value={operation.toolingCostPerPart} onChange={(event) => updateQuoteOperation(index, { toolingCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>{t("Cons., EUR/part")}<input type="number" min="0" value={operation.consumablesCostPerPart} onChange={(event) => updateQuoteOperation(index, { consumablesCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>{t("Out, EUR/part")}<input type="number" min="0" value={operation.outsourcedCostPerPart} onChange={(event) => updateQuoteOperation(index, { outsourcedCostPerPart: numericValue(event.target.value) })} /></label>
                        <label>{t("Out, EUR/batch")}<input type="number" min="0" value={operation.outsourcedBatchCost} onChange={(event) => updateQuoteOperation(index, { outsourcedBatchCost: numericValue(event.target.value) })} /></label>
                      </div>
                      <label>{t("Scrap, %")}<input type="number" min="0" max="100" value={formatPercent(operation.scrapAllowancePercent)} onChange={(event) => updateQuoteOperation(index, { scrapAllowancePercent: numericValue(event.target.value) / 100 })} /></label>
                      <button className="iconButton" title={t("Remove operation")} onClick={() => removeOperation(index)}><Trash2 size={18} /></button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Tool Check")}</h2>
                  <p className="sectionHelp">{t("Required tools are matched against Resources tool inventory. Missing tool charges are added as operation batch cost.")}</p>
                </div>
                <strong>{missingToolChecks.length > 0 ? money.format(totalMissingToolCost) : t("All available")}</strong>
              </div>
              <div className="toolCheckTable">
                <div className="tableHead toolCheckHead"><span>{t("Operation")}</span><span>{t("Requirement")}</span><span>{t("Status")}</span><span>{t("Charge mode")}</span><span>{t("Quote cost")}</span></div>
                {currentToolChecks.length === 0 ? (
                  <div className="tableRow toolCheckRow"><span>{t("No tool requirements set for this route.")}</span><span></span><span></span><span></span><span></span></div>
                ) : currentToolChecks.map((item) => (
                  <div className={`tableRow toolCheckRow ${item.status === "missing" ? "missingTool" : ""}`} key={`${item.operation.id}-${item.requirement.id}`}>
                    <span>{item.operation.name}</span>
                    <span>{toolRequirementLabel(item.requirement)}</span>
                    <span>{item.status === "available" ? `${t("Available:")} ${item.matchedTool?.name}` : t("Missing / not enough quantity")}</span>
                    <div className="miniGrid">
                      <select value={item.requirement.chargeMode} onChange={(event) => updateToolRequirement(item.operation.id, item.requirement.id, { chargeMode: event.target.value as ToolChargeMode })}>
                        <option value="charge_full">{t("Charge full")}</option>
                        <option value="amortize">{t("Amortize")}</option>
                        <option value="included">{t("Ignore/include")}</option>
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
                <div className="sectionHeader wide"><h2>{t("Cost Breakdown")}</h2></div>
                <p className="sectionHelp">{t("Every euro of the production cost, line by line: material, engineering, then each route operation. If a price looks high, this table shows which line is responsible.")}</p>
                <div className="operationTable">
                  <div className="tableHead breakdownHead"><span>{t("Line")}</span><span>{t("Total")}</span><span>{t("Unit")}</span></div>
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
                  <h2>{t("Actuals Feedback")}</h2>
                  <p className="sectionHelp">{t("After production, compare real setup/cycle times against what was quoted, and feed the difference back into the operation templates so the next quote starts from measured reality. In a live installation these numbers would flow in from the ERP's operation confirmations automatically; this manual table is the demo stand-in for that connection. Collapsed by default -- open it when presenting the calibration loop.")}</p>
                </div>
                <div className="buttonRow">
                  {isSectionOpen("actuals_feedback") ? <button className="secondaryButton" onClick={applyActualsToTemplates}>{t("Apply to Templates")}</button> : null}
                  {sectionToggle("actuals_feedback")}
                </div>
              </div>
              {isSectionOpen("actuals_feedback") ? (
              <>
              <div className="actualsTable">
                <div className="tableHead actualsHead"><span>{t("Operation")}</span><span>{t("Actual setup, min")}</span><span>{t("Actual cycle, min/part")}</span><span>{t("Scrap, %")}</span><span>{t("Quoted, EUR")}</span><span>{t("Actual, EUR")}</span><span>{t("Variance, EUR")}</span><span>{t("Notes")}</span></div>
                {quoteOperations.map((operation) => {
                  const actual = ensureActualForOperation(operation);
                  const quotedCost = operationCost(operation, rateMode);
                  const actualCost = operationCost(operation, rateMode, actual);
                  return (
                    <div className="tableRow actualsRow" key={operation.id}>
                      <span>{operation.name}</span>
                      <div className="miniGrid">
                        <label>{t("Machine")}<input type="number" min="0" value={actual.actualSetupMachineMinutes} onChange={(event) => updateActualOperation(operation.id, { actualSetupMachineMinutes: numericValue(event.target.value) })} /></label>
                        <label>{t("Labor")}<input type="number" min="0" value={actual.actualSetupLaborMinutes} onChange={(event) => updateActualOperation(operation.id, { actualSetupLaborMinutes: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="miniGrid">
                        <label>{t("Machine")}<input type="number" min="0" value={actual.actualRunMachineMinutesPerPart} onChange={(event) => updateActualOperation(operation.id, { actualRunMachineMinutesPerPart: numericValue(event.target.value) })} /></label>
                        <label>{t("Labor")}<input type="number" min="0" value={actual.actualRunLaborMinutesPerPart} onChange={(event) => updateActualOperation(operation.id, { actualRunLaborMinutesPerPart: numericValue(event.target.value) })} /></label>
                      </div>
                      <div className="actualsSingleField"><span aria-hidden="true"></span><input type="number" min="0" max="100" value={formatPercent(actual.actualScrapPercent)} onChange={(event) => updateActualOperation(operation.id, { actualScrapPercent: numericValue(event.target.value) / 100 })} /></div>
                      <span className="actualsAlignedValue">{money.format(quotedCost)}</span>
                      <span className="actualsAlignedValue">{money.format(actualCost)}</span>
                      <span className="actualsAlignedValue">{money.format(actualCost - quotedCost)}</span>
                      <input className="actualsAlignedInput" value={actual.notes} onChange={(event) => updateActualOperation(operation.id, { notes: event.target.value })} />
                    </div>
                  );
                })}
              </div>
              {pendingCalibration && pendingCalibration.length > 0 ? (
                <div className="panel calibrationReview">
                  <div className="sectionHeader"><h2>{t("Confirm Calibration")}</h2></div>
                  <p className="sectionHelp">{t("Calibration is per operation type, not per part family: this updates the shared template for every part that uses this operation type. Applied as a running weighted mean (old value weighted by its sample count, capped at")} {CALIBRATION_MAX_SAMPLE_COUNT}{t("), not a flat overwrite -- one odd job can no longer swing the default outright.")}</p>
                  {pendingCalibration.map((candidate) => (
                    <div className="calibrationCard" key={candidate.operationType}>
                      <strong>{operationLabel(candidate.operationType)} {t("(sample count")} {candidate.newSampleCount})</strong>
                      <div className="calibrationFieldGrid">
                        {candidate.fieldChanges.map((change) => (
                          <span key={change.key} className={change.deviates ? "calibrationDeviates" : ""}>
                            {change.label}: {change.oldValue} -&gt; {change.newValue}{change.deviates ? t(" (>=3x deviation)") : ""}
                          </span>
                        ))}
                      </div>
                      {candidate.requiresConfirmation ? (
                        <label className="calibrationConfirm">
                          <input
                            type="checkbox"
                            checked={calibrationConfirmations[candidate.operationType] ?? false}
                            onChange={(event) => setCalibrationConfirmations((current) => ({ ...current, [candidate.operationType]: event.target.checked }))}
                          />
                          {t("I confirm this large deviation from the current template is correct.")}
                        </label>
                      ) : null}
                    </div>
                  ))}
                  <div className="buttonRow">
                    <button className="primaryButton" onClick={confirmCalibration}>{t("Confirm & Apply")}</button>
                    <button className="secondaryButton" onClick={cancelCalibration}>{t("Cancel")}</button>
                  </div>
                </div>
              ) : null}
              </>
              ) : null}
            </section>
          </>
        ) : null}

        {activeView === "client_portal" ? (
          <section className="clientPortal">
            <section className="panel portalHeaderPanel">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Client RFQ Intake")}</h2>
                  <p className="sectionHelp">{t("Customer-facing demo: clients upload STEP models and drawings/specifications, define order requirements, and receive one preliminary estimate before manual confirmation.")}</p>
                </div>
                <button className="primaryButton" onClick={calculatePortalEstimates}><Calculator size={16} /> {t("Calculate Preliminary Estimate")}</button>
              </div>
              <div className="portalNotice">
                <strong>{t("STEP alone is not enough for a reliable manufacturing price.")}</strong>
                <span>{t("We also need drawing/specification data for tolerances, material, threads, surface finish, heat treatment, inspection reports, and delivery expectations. Missing information widens the estimate range and lowers confidence.")}</span>
              </div>
              <div className="fieldGrid compact">
                <label>{t("Customer/company")}<input value={portalCustomerName} onChange={(event) => setPortalCustomerName(event.target.value)} /></label>
                <label>{t("Contact/email")}<input value={portalContact} onChange={(event) => setPortalContact(event.target.value)} /></label>
                <label>{t("Upload STEP files")}<input type="file" multiple accept=".step,.stp" onChange={(event) => addPortalFiles(event.target.files)} /></label>
                <label>{t("RFQ status")}<input readOnly value={t("Preliminary estimate, manual confirmation required")} /></label>
              </div>
              <div className="buttonRow portalButtons">
                <button className="secondaryButton" onClick={addBlankPortalPart}><Plus size={16} /> {t("Add Part Manually")}</button>
              </div>
              <p className="statusText">{portalStatus}</p>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("RFQ Parts")}</h2>
                  <p className="sectionHelp">{t("The client sees requirements and one preliminary estimate. Internal target/accounting rates, stock-piece quantity, and complexity assumptions stay hidden.")}</p>
                </div>
              </div>
              <div className="portalPartTable">
                <div className="tableHead portalPartHead"><span>{t("Files and quantity")}</span><span>{t("Manufacturing requirements")}</span><span>{t("Material and finish")}</span><span>{t("Readiness")}</span><span>{t("Preliminary estimate")}</span><span></span></div>
                {portalParts.map((part) => {
                  const estimate = portalEstimates[part.id];
                  const issues = estimate?.readinessIssues ?? portalReadinessIssues(part);
                  const inferredComplexity = inferredPortalComplexity(part);
                  return (
                    <div className="tableRow portalPartRow" key={part.id}>
                      <div className="stackedFields">
                        <label>{t("Part name")}<input value={part.partName} onChange={(event) => updatePortalPart(part.id, { partName: event.target.value })} /></label>
                        <label>{t("STEP model")}<input value={part.fileName || t("Missing STEP model")} readOnly /></label>
                        <label>{t("Drawing/spec file")}<input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) updatePortalPart(part.id, { drawingFileName: file.name, drawingSizeBytes: file.size });
                        }} /></label>
                        {part.drawingFileName ? <span className="rateHint">{t("Drawing/spec:")} {part.drawingFileName}</span> : <span className="rateHint warningHint">{t("Drawing/spec missing")}</span>}
                        <div className="miniGrid">
                          <label>{t("Order qty, pcs")}<input type="number" min="1" value={part.quantity} onChange={(event) => updatePortalPart(part.id, { quantity: Math.max(1, numericValue(event.target.value, 1)) })} /></label>
                          <label>{t("Annual qty, pcs")}<input type="number" min="0" value={part.annualVolume} onChange={(event) => updatePortalPart(part.id, { annualVolume: Math.max(0, numericValue(event.target.value, 0)) })} /></label>
                        </div>
                      </div>
                      <div className="stackedFields">
                        <label>{t("Tolerance requirement")}<select value={part.toleranceRequirement} onChange={(event) => updatePortalPart(part.id, { toleranceRequirement: event.target.value as PortalPart["toleranceRequirement"] })}>
                          <option value="standard">{t("General standard tolerances")}</option>
                          <option value="drawing">{t("According to drawing")}</option>
                          <option value="custom">{t("Custom / tight tolerances")}</option>
                        </select></label>
                        <label>{t("Inspection/documentation")}<select value={part.documentationRequirement} onChange={(event) => updatePortalPart(part.id, { documentationRequirement: event.target.value as PortalPart["documentationRequirement"] })}>
                          <option value="standard">{t("Standard inspection")}</option>
                          <option value="dimensional_report">{t("Dimensional report")}</option>
                          <option value="full_fai">{t("Full FAI / first article")}</option>
                        </select></label>
                        <label>{t("Threads/inserts")}<select value={part.threadOrInsertRequirement} onChange={(event) => updatePortalPart(part.id, { threadOrInsertRequirement: event.target.value as PortalPart["threadOrInsertRequirement"] })}>
                          <option value="unknown">{t("Unknown / see drawing")}</option>
                          <option value="none">{t("No")}</option>
                          <option value="yes">{t("Yes")}</option>
                        </select></label>
                        <label>{t("Delivery need")}<select value={part.deliveryRequirement} onChange={(event) => updatePortalPart(part.id, { deliveryRequirement: event.target.value as PortalPart["deliveryRequirement"] })}>
                          <option value="standard">{t("Standard lead time")}</option>
                          <option value="expedite">{t("Expedite if possible")}</option>
                          <option value="date_critical">{t("Date critical")}</option>
                        </select></label>
                      </div>
                      <div className="stackedFields">
                        <label>{t("Material")}<select value={part.materialId} onChange={(event) => {
                          const material = assumptions?.material_examples.find((item) => item.id === event.target.value);
                          updatePortalPart(part.id, {
                            materialId: event.target.value,
                            materialRequirement: material?.material_grade || material?.name || part.materialRequirement,
                            stockName: material?.stock_description || material?.name || part.stockName,
                            stockCost: material?.stock_piece_cost_eur ?? part.stockCost
                          });
                        }}>
                          <option value="">{t("Manual material / specified on drawing")}</option>
                          {(assumptions?.material_examples ?? []).map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                        </select></label>
                        <label>Material note<input value={part.materialRequirement} placeholder={t("e.g. EN AW-6082 T6, S355, AISI 304")} onChange={(event) => updatePortalPart(part.id, { materialId: "", materialRequirement: event.target.value, stockName: event.target.value || part.stockName })} /></label>
                        <div className="miniGrid">
                          <label>{t("Cut length, mm")}<input type="number" min="1" value={part.cutLengthMm} onChange={(event) => updatePortalPart(part.id, { cutLengthMm: Math.max(1, numericValue(event.target.value, 100)) })} /></label>
                          {portalSelectedMaterial(part)?.stock_shape === "plate" ? (
                            <label>{t("Cut width, mm")}<input type="number" min="1" value={part.cutWidthMm} onChange={(event) => updatePortalPart(part.id, { cutWidthMm: Math.max(1, numericValue(event.target.value, 100)) })} /></label>
                          ) : null}
                        </div>
                        <label>{t("Surface finish / treatment")}<input value={part.surfaceFinish} onChange={(event) => updatePortalPart(part.id, { surfaceFinish: event.target.value })} /></label>
                        <label>{t("Notes")}<textarea value={part.notes} onChange={(event) => updatePortalPart(part.id, { notes: event.target.value })} /></label>
                      </div>
                      <div className="portalReadinessBox">
                        <strong>{issues.length === 0 ? t("Ready for review") : t("Needs information")}</strong>
                        <span>{t("Internal complexity estimate:")} {operationLabel(inferredComplexity)}</span>
                        <span>{t("Internal stock pieces required:")} {portalStockPiecesRequired(part)} {t("(from cut length/width vs. stock dimensions)")}</span>
                        {issues.length > 0 ? (
                          <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                        ) : <span>{t("No major RFQ gaps detected.")}</span>}
                        <button
                          type="button"
                          className="linkButton"
                          onClick={() => setExpandedPortalDetails((current) => ({ ...current, [part.id]: !(current[part.id] ?? false) }))}
                        >
                          {expandedPortalDetails[part.id] ? t("Hide internal pricing detail") : t("Show internal pricing detail")}
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
                                <strong>{t("Rate mode: Target (assumes")} {formatPercent(averageTargetUtilization(assumptions))}% {t("shop Utilization scenario)")}</strong>
                                <span>{t("This preliminary price uses the Target rate, not today's Accounting rate. It is an aspiration, not current capacity.")}</span>
                              </div>
                              {accountingSellPrice !== undefined && accountingGapPercent !== null ? (
                                <div className={accountingGapPercent > 25 ? "warningHint" : ""}>
                                  <strong>{t("Accounting cross-check:")} {money.format(accountingSellPrice)}</strong>
                                  <span>{accountingGapPercent}% {t("above the Target price shown to the client, reflecting today's actual Utilization. A large gap means today's real capacity cannot yet support this price without more orders.")}</span>
                                </div>
                              ) : null}
                              <div>
                                <strong>{t("Adjustment factors applied")}</strong>
                                <span>{t("Complexity")} ({factors.complexity}) x{factors.complexityFactor.toFixed(2)}, {t("Tolerance")} x{factors.toleranceFactor.toFixed(2)}, {t("QC")} x{factors.qcFactor.toFixed(2)}, {t("Delivery")} x{factors.deliveryFactor.toFixed(2)} -- {t("combined")} x{factors.combined.toFixed(2)} ({t('QC x{qc} applies to inspection operations only, not included in "combined".').replace("{qc}", factors.qcFactor.toFixed(2))}) {t("These are heuristic placeholders, not calibrated against actuals.")}</span>
                              </div>
                              <div>
                                <strong>{t("Tool check:")} {missingTools.length === 0 ? t("all required tools available") : `${missingTools.length} ${t("missing")}`}</strong>
                                {missingTools.length > 0 ? (
                                  <ul>{missingTools.map((check) => <li key={check.requirement.id}>{toolRequirementLabel(check.requirement)}: {money.format(check.costEur)}</li>)}</ul>
                                ) : null}
                              </div>
                              {repeatSavings !== null ? (
                                <div>
                                  <strong>{t("Repeat-order CAM savings estimate:")} {money.format(repeatSavings)}</strong>
                                  <span>{t("Informational only, based on declared annual volume -- this order still carries full new-part CAM cost above.")}</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })() : null}
                      </div>
                      <div className="portalResultBox">
                        <span>{t("Indicative unit price")}</span>
                        <strong>{estimate ? `${money.format(estimate.lowUnitEur)} - ${money.format(estimate.highUnitEur)}` : "..."}</strong>
                        <span>{t("Estimated order total")}</span>
                        <strong>{estimate ? `${money.format(estimate.lowTotalEur)} - ${money.format(estimate.highTotalEur)}` : "..."}</strong>
                        <small>{estimate ? estimate.confidence : t("Not calculated")}</small>
                        <small className="portalDisclaimer">{t("Preliminary estimate only, subject to engineering confirmation. The confirmed price may differ materially from this range once drawing, material, tolerance, tooling, and capacity are reviewed.")}</small>
                        <button type="button" className="secondaryButton" onClick={() => sendPortalPartToQuoteBuilder(part)}>{t("Send to Quote Builder")}</button>
                      </div>
                      <button className="iconButton" title={t("Remove part")} onClick={() => removePortalPart(part.id)}><Trash2 size={18} /></button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="scenarioStrip portalTotals">
              <div>
                <span className="scenarioLabel">{t("Parts")}</span>
                <strong>{portalParts.length}</strong>
                <span className="scenarioHint">{t("Uploaded or manually entered.")}</span>
              </div>
              <div>
                <span className="scenarioLabel">{t("Estimated total, EUR")}</span>
                <strong>{Object.values(portalEstimates).length > 0 ? `${money.format(Object.values(portalEstimates).reduce((sum, item) => sum + item.lowTotalEur, 0))} - ${money.format(Object.values(portalEstimates).reduce((sum, item) => sum + item.highTotalEur, 0))}` : "..."}</strong>
                <span className="scenarioHint">{t("Single preliminary range shown to the client.")}</span>
              </div>
              <div>
                <span className="scenarioLabel">{t("Confidence")}</span>
                <strong>{Object.values(portalEstimates).some((item) => item.readinessIssues.length > 0) ? t("Needs review") : Object.values(portalEstimates).length > 0 ? t("Review-ready") : t("Not calculated")}</strong>
                <span className="scenarioHint">{t("Final CO requires engineering and material confirmation.")}</span>
              </div>
            </section>
          </section>
        ) : null}

        {activeView === "profile" ? (
          <section className="profilePage">
            {companyProfile ? (() => {
              const directEmployees = companyProfile.employees.filter((employee) => employee.directLabor);
              const indirectEmployees = companyProfile.employees.filter((employee) => !employee.directLabor);
              const assetFixedCost = companyProfile.assets.reduce((sum, asset) => sum + profileAssetMonthlyFixedCost(asset), 0);
              const directPayroll = directEmployees.reduce((sum, employee) => sum + employee.headcount * employee.grossMonthlySalaryEur * (1 + employee.employerSocialContributionRate), 0);
              const indirectPayroll = indirectEmployees.reduce((sum, employee) => sum + employee.headcount * employee.grossMonthlySalaryEur * (1 + employee.employerSocialContributionRate), 0);
              const enteredOverhead = companyProfile.overheadItems.reduce((sum, item) => sum + item.monthly_cost_eur, 0);
              const lowValueReserve = lowValueInventoryMonthlyReserve(companyProfile);
              const totalProfileOverhead = enteredOverhead + lowValueReserve + indirectPayroll;
              return (
                <>
                  <section className="panel profileHero">
                    <div>
                      <h2>{t("Build Company Cost Profile")}</h2>
                      <p className="sectionHelp">{t("Assemble the company-level cost base that feeds real quotes: production assets, low-value inventory reserve, process-specific employees, indirect payroll, facility, utilities, insurance, and other overhead. Indirect payroll is calculated from employee rows marked Overhead; low-value inventory is entered below as total value plus replacement cycle. Applying this profile updates the same assumptions used by Quote, Scenarios, Resources, and Profitability.")}</p>
                    </div>
                    <div className="profileActions">
                      <select value={companyProfile.profileId ?? ""} onChange={(event) => loadCompanyProfile(event.target.value)}>
                        <option value="">{t("Generic starter profile (unsaved)")}</option>
                        {companyProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                      </select>
                      <button className="primaryButton" onClick={saveCompanyProfile}><Save size={16} /> {t("Save Profile")}</button>
                      <button className="secondaryButton" onClick={applyCompanyProfileToAssumptions}>{t("Apply to Costing")}</button>
                      <button className="iconButton" title={t("Delete selected profile")} onClick={deleteCompanyProfile}><Trash2 size={18} /></button>
                    </div>
                    <p className="statusText">{profileStatus}</p>
                  </section>

                  <section className="profileSummaryStrip">
                    <div><span className="scenarioLabel">{t("Asset fixed cost/mo")}</span><strong>{money.format(assetFixedCost)}</strong><span className="scenarioHint">{t("Depreciation plus known fixed asset costs.")}</span></div>
                    <div><span className="scenarioLabel">{t("Direct payroll/mo")}</span><strong>{money.format(directPayroll)}</strong><span className="scenarioHint">{t("Becomes labor classes for route costing.")}</span></div>
                    <div><span className="scenarioLabel">{t("Overhead/mo")}</span><strong>{money.format(totalProfileOverhead)}</strong><span className="scenarioHint">{t("Entered overhead + overhead payroll + inventory reserve.")}</span></div>
                    <div><span className="scenarioLabel">{t("Profile output")}</span><strong>{companyProfile.assets.length} {t("assets")} / {directEmployees.length} {t("labor positions")} / {profileMaterials(companyProfile).length} {t("materials")}</strong><span className="scenarioHint">{t("Applied into Resources assumptions.")}</span></div>
                  </section>

                  <section className="panel">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Company Identity and Inventory Reserve")}</h2>
                        <p className="sectionHelp">{t("Enter low-value inventory here: fixtures, gauges, small tools, benches, carts, hand tools, and other shop items that support production but are not tied to one order. The tool spreads the total value over the replacement cycle and adds the monthly reserve to overhead.")}</p>
                      </div>
                    </div>
                    <div className="fieldGrid">
                      <label>{t("Profile/company name")}<input value={companyProfile.companyName} onChange={(event) => updateCompanyProfile({ companyName: event.target.value })} /></label>
                      <label>{t("Total low-value inventory value, EUR")}<input type="number" min="0" value={companyProfile.lowValueInventoryTotalEur} onChange={(event) => updateCompanyProfile({ lowValueInventoryTotalEur: numericValue(event.target.value) })} /></label>
                      <label>{t("Refresh/replacement cycle, months")}<input type="number" min="1" value={companyProfile.lowValueInventoryRefreshMonths} onChange={(event) => updateCompanyProfile({ lowValueInventoryRefreshMonths: Math.max(1, numericValue(event.target.value, 24)) })} /></label>
                      <label>{t("Monthly overhead reserve")}<input readOnly value={money.format(lowValueReserve)} /></label>
                    </div>
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Production Assets")}</h2>
                        <p className="sectionHelp">{t("Each asset becomes a machine class. Fixed cost is derived from purchase price, useful life, salvage %, and known recurring asset cost. Capacity inputs drive Accounting vs Target EUR/h; Market sell EUR/h is the explicit commercial rate used by Profitability revenue.")}</p>
                        <p className="sectionHelp"><strong>{t("How to enter machines bought years ago:")}</strong> {t("this is an economic cost model, not a bookkeeping ledger, so enter each asset as it stands today — its current replacement or resale value as \"purchase price\" and its remaining useful years as \"useful life\", not the original invoice from 2015. A machine that is fully written off in accounting is not free: it still wears, and one day it must be replaced — give it a modest current value over a short remaining life (or its estimated annual maintenance-plus-replacement reserve as recurring cost). Pricing off zero-cost old machines is how a shop wins orders today and cannot afford the replacement tomorrow.")}</p>
                      </div>
                      <button className="primaryButton" onClick={addProfileAsset}><Plus size={16} /> {t("Add Asset")}</button>
                    </div>
                    <div className="profileAssetTables">
                      <div className="profileAssetTableBlock">
                        <h3>{t("Asset Cost and Commercial Role")}</h3>
                        <div className="resourceTable profileAssetTable profileAssetCostTable">
                          <div className="tableHead profileAssetCostHead"><span>{t("Asset")}</span><span>{t("Capacity role")}</span><span>{t("Payroll role")}</span><span>{t("Purchase EUR")}</span><span>{t("Life")}</span><span>{t("Salvage %")}</span><span>{t("Other fixed/mo")}</span><span>{t("Fixed/mo")}</span><span>{t("Variable EUR/h")}</span><span>{t("Market sell EUR/h")}</span><span></span></div>
                          {companyProfile.assets.map((asset, index) => (
                            <div className="tableRow profileAssetCostRow" key={asset.id}>
                              <input value={asset.name} onChange={(event) => updateProfileAsset(index, "name", event.target.value)} />
                              <select value={assetCapacityRole(asset)} onChange={(event) => updateProfileAsset(index, "capacityRole", event.target.value as AssetCapacityRole)}>
                                <option value="sellable_capacity">{t("Sellable capacity")}</option>
                                <option value="support_internal">{t("Support / internal flow")}</option>
                              </select>
                              <select value={assetPrimaryLaborClassId(asset)} onChange={(event) => updateProfileAsset(index, "primaryLaborClassId", event.target.value)}>
                                {companyProfile.employees.filter((employee) => employee.directLabor).map((employee) => <option key={employee.id} value={employee.id}>{employee.position}</option>)}
                              </select>
                              <input type="number" min="0" value={asset.purchasePriceEur} onChange={(event) => updateProfileAsset(index, "purchasePriceEur", numericValue(event.target.value))} />
                              <input type="number" min="1" value={asset.usefulLifeYears} onChange={(event) => updateProfileAsset(index, "usefulLifeYears", Math.max(1, numericValue(event.target.value, 10)))} />
                              <input type="number" min="0" max="95" value={formatPercent(asset.salvagePercent)} onChange={(event) => updateProfileAsset(index, "salvagePercent", Math.min(0.95, numericValue(event.target.value) / 100))} />
                              <input type="number" min="0" value={asset.otherMonthlyFixedCostEur} onChange={(event) => updateProfileAsset(index, "otherMonthlyFixedCostEur", numericValue(event.target.value))} />
                              <input readOnly value={profileAssetMonthlyFixedCost(asset)} />
                              <input type="number" min="0" value={asset.variableCostEurPerHour} onChange={(event) => updateProfileAsset(index, "variableCostEurPerHour", numericValue(event.target.value))} />
                              <input type="number" min="0" value={asset.sellRateEurPerHour ?? 0} onChange={(event) => updateProfileAsset(index, "sellRateEurPerHour", numericValue(event.target.value))} />
                              <button className="iconButton" onClick={() => removeProfileAsset(index)}><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="profileAssetTableBlock">
                        <h3>{t("Capacity Planning")}</h3>
                        <div className="resourceTable profileAssetTable profileAssetCapacityTable">
                          <div className="tableHead profileAssetCapacityHead"><span>{t("Asset")}</span><span>{t("Hours/mo")}</span><span>{t("Actual availability %")}</span><span>{t("Actual utilization %")}</span><span>{t("Target availability %")}</span><span>{t("Target utilization %")}</span><span>{t("Loaded kW")}</span></div>
                          {companyProfile.assets.map((asset, index) => (
                            <div className="tableRow profileAssetCapacityRow" key={`${asset.id}-capacity`}>
                              <span className="profileAssetNameCell">{asset.name}</span>
                              <input type="number" min="1" value={asset.plannedHoursPerMonth} onChange={(event) => updateProfileAsset(index, "plannedHoursPerMonth", Math.max(1, numericValue(event.target.value, 160)))} />
                              <input type="number" min="1" max="100" value={formatPercent(asset.actualAvailabilityPercent)} onChange={(event) => updateProfileAsset(index, "actualAvailabilityPercent", Math.max(0.01, numericValue(event.target.value, 80) / 100))} />
                              <input type="number" min="1" max="100" value={formatPercent(asset.actualUtilizationPercent)} onChange={(event) => updateProfileAsset(index, "actualUtilizationPercent", Math.max(0.01, numericValue(event.target.value, 35) / 100))} />
                              <input type="number" min="1" max="100" value={formatPercent(asset.targetAvailabilityPercent)} onChange={(event) => updateProfileAsset(index, "targetAvailabilityPercent", Math.max(0.01, numericValue(event.target.value, 90) / 100))} />
                              <input type="number" min="1" max="100" value={formatPercent(asset.targetUtilizationPercent)} onChange={(event) => updateProfileAsset(index, "targetUtilizationPercent", Math.max(0.01, numericValue(event.target.value, 95) / 100))} />
                              <input type="number" min="0" value={asset.loadedPowerKw} onChange={(event) => updateProfileAsset(index, "loadedPowerKw", numericValue(event.target.value))} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Employees and Process Positions")}</h2>
                        <p className="sectionHelp">{t("Set a row to Direct labor when it works on quote operations. Set it to Overhead for purchasing, warehouse, planning, sales/quoting, admin, maintenance, management, and non-shopfloor quality. Indirect payroll = headcount x gross monthly salary x (1 + employer tax), so it stays 0 until those overhead rows have salary/headcount values.")}</p>
                      </div>
                      <button className="primaryButton" onClick={addProfileEmployee}><Plus size={16} /> {t("Add Position")}</button>
                    </div>
                    <div className="resourceTable profileEmployeeTable">
                      <div className="tableHead profileEmployeeHead"><span>{t("Position")}</span><span>{t("Process")}</span><span>{t("Headcount")}</span><span>{t("Gross/mo")}</span><span>{t("Employer tax %")}</span><span>{t("Paid h/mo")}</span><span>{t("Cost type")}</span><span>{t("Calculated cost")}</span><span></span></div>
                      {companyProfile.employees.map((employee, index) => (
                        <div className="tableRow profileEmployeeRow" key={employee.id}>
                          <input value={employee.position} onChange={(event) => updateProfileEmployee(index, "position", event.target.value)} />
                          <input value={employee.processArea} onChange={(event) => updateProfileEmployee(index, "processArea", event.target.value)} />
                          <input type="number" min="0" step="1" value={employee.headcount} onChange={(event) => updateProfileEmployee(index, "headcount", Math.max(0, Math.round(numericValue(event.target.value, 1))))} />
                          <input type="number" min="0" value={employee.grossMonthlySalaryEur} onChange={(event) => updateProfileEmployee(index, "grossMonthlySalaryEur", numericValue(event.target.value))} />
                          <input type="number" min="0" max="100" value={formatPercent(employee.employerSocialContributionRate)} onChange={(event) => updateProfileEmployee(index, "employerSocialContributionRate", numericValue(event.target.value) / 100)} />
                          <input type="number" min="1" value={employee.paidHoursPerMonth} onChange={(event) => updateProfileEmployee(index, "paidHoursPerMonth", Math.max(1, numericValue(event.target.value, 160)))} />
                          <select value={employee.directLabor ? "direct" : "overhead"} onChange={(event) => updateProfileEmployee(index, "directLabor", event.target.value === "direct")}>
                            <option value="direct">{t("Direct labor")}</option>
                            <option value="overhead">{t("Overhead")}</option>
                          </select>
                          <input readOnly value={employee.directLabor ? `${money.format(profileEmployeeHourlyCost(employee))}/h` : money.format(employee.headcount * employee.grossMonthlySalaryEur * (1 + employee.employerSocialContributionRate))} />
                          <button className="iconButton" onClick={() => removeProfileEmployee(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Facility, Utilities, Insurance, and Overhead")}</h2>
                        <p className="sectionHelp">{t("These items flow into the same overhead allocation used by Resources. Add facility rent, electricity not already in machine variable rates, insurance, accounting, sales, quality management, and other company-level costs.")}</p>
                      </div>
                      <div className="buttonRow"><button className="primaryButton" onClick={() => addProfileOverheadItem()}><Plus size={16} /> {t("Add Overhead Item")}</button></div>
                    </div>
                    <div className="resourceTable profileOverheadTable overheadTable">
                      <div className="tableHead"><span>{t("Expense")}</span><span>{t("Monthly EUR")}</span><span>{t("Data status")}</span><span></span></div>
                      {companyProfile.overheadItems.map((item, index) => (
                        <div className="tableRow" key={item.id}>
                          <input value={item.name} onChange={(event) => updateProfileOverheadItem(index, "name", event.target.value)} />
                          <input type="number" min="0" value={item.monthly_cost_eur} onChange={(event) => updateProfileOverheadItem(index, "monthly_cost_eur", numericValue(event.target.value))} />
                          <DataStatusInput value={item.quality} onChange={(value) => updateProfileOverheadItem(index, "quality", value)} lang={language} />
                          <button className="iconButton" onClick={() => removeProfileOverheadItem(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="profileOverheadBreakdown">
                      <span>{t("Entered overhead:")} {money.format(enteredOverhead)}</span>
                      <span>{t("Indirect payroll:")} {money.format(indirectPayroll)} {t("(Overhead rows x gross salary x employer tax)")}</span>
                      <span>{t("Low-value inventory reserve:")} {money.format(lowValueReserve)} {t("(inventory value / replacement months)")}</span>
                      <strong>{t("Total overhead applied:")} {money.format(totalProfileOverhead)}</strong>
                    </div>
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Profile Material Scope")}</h2>
                        <p className="sectionHelp">{t("These rows define which materials exist in this company profile. Applying the profile creates matching Material Library rows; Resources is still where stock cost, dimensions, supplier, MOQ, and scrap recovery are completed.")}</p>
                      </div>
                      <div className="buttonRow">
                        {isSectionOpen("profile_materials") ? <button className="primaryButton" onClick={addProfileMaterial}><Plus size={16} /> {t("Add Material")}</button> : null}
                        {sectionToggle("profile_materials")}
                      </div>
                    </div>
                    {isSectionOpen("profile_materials") ? (
                    <div className="resourceTable profileMaterialScopeTable">
                      <div className="tableHead profileMaterialScopeHead"><span>{t("Material name")}</span><span>{t("Grade")}</span><span>{t("Stock description")}</span><span>{t("Shape")}</span><span></span></div>
                      {profileMaterials(companyProfile).map((material, index) => (
                        <div className="tableRow profileMaterialScopeRow" key={material.id}>
                          <input value={material.name} onChange={(event) => updateProfileMaterial(index, "name", event.target.value)} />
                          <input value={material.materialGrade} onChange={(event) => updateProfileMaterial(index, "materialGrade", event.target.value)} />
                          <input value={material.stockDescription} onChange={(event) => updateProfileMaterial(index, "stockDescription", event.target.value)} />
                          <select value={material.stockShape} onChange={(event) => updateProfileMaterial(index, "stockShape", event.target.value)}>
                            <option value="">{t("Not set")}</option>
                            <option value="round_bar">{t("Round bar")}</option>
                            <option value="hex_bar">{t("Hex bar")}</option>
                            <option value="square_bar">{t("Square bar")}</option>
                            <option value="tube">{t("Tube")}</option>
                            <option value="plate">{t("Plate")}</option>
                          </select>
                          <button className="iconButton" onClick={() => removeProfileMaterial(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    ) : null}
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Profile Tool Scope")}</h2>
                        <p className="sectionHelp">{t("These rows define the tool groups relevant for this profile. Applying the profile creates matching Tool Inventory rows; Resources is where diameter, radius, quantity, cost, lead time, and reuse settings are completed.")}</p>
                      </div>
                      <div className="buttonRow">
                        {isSectionOpen("profile_tools") ? <button className="primaryButton" onClick={addProfileTool}><Plus size={16} /> {t("Add Tool Group")}</button> : null}
                        {sectionToggle("profile_tools")}
                      </div>
                    </div>
                    {isSectionOpen("profile_tools") ? (
                    <div className="resourceTable profileToolScopeTable">
                      <div className="tableHead profileToolScopeHead"><span>{t("Tool group")}</span><span>{t("Type")}</span><span>{t("Material groups")}</span><span></span></div>
                      {profileTools(companyProfile).map((tool, index) => (
                        <div className="tableRow profileToolScopeRow" key={tool.id}>
                          <input value={tool.name} onChange={(event) => updateProfileTool(index, "name", event.target.value)} />
                          <input value={tool.type} onChange={(event) => updateProfileTool(index, "type", event.target.value)} />
                          <input value={tool.materialGroups} onChange={(event) => updateProfileTool(index, "materialGroups", event.target.value)} />
                          <button className="iconButton" onClick={() => removeProfileTool(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    ) : null}
                  </section>

                  <section className="operations">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Profile Operation Scope")}</h2>
                        <p className="sectionHelp">{t("These rows define the operation templates this profile uses. Applying the profile creates matching Operation Template rows; Resources is where setup, cycle, tooling, consumables, outsourcing, and scrap assumptions are completed.")}</p>
                      </div>
                      <div className="buttonRow">
                        {isSectionOpen("profile_operations") ? <button className="primaryButton" onClick={addProfileOperation}><Plus size={16} /> {t("Add Operation")}</button> : null}
                        {sectionToggle("profile_operations")}
                      </div>
                    </div>
                    {isSectionOpen("profile_operations") ? (
                    <div className="resourceTable profileOperationScopeTable">
                      <div className="tableHead profileOperationScopeHead"><span>{t("Operation type")}</span><span>{t("Display name")}</span><span>{t("Default asset")}</span><span>{t("Default labor")}</span><span></span></div>
                      {profileOperations(companyProfile).map((operation, index) => (
                        <div className="tableRow profileOperationScopeRow" key={operation.id}>
                          <input value={operation.operationType} onChange={(event) => updateProfileOperation(index, "operationType", event.target.value)} />
                          <input value={operation.name} onChange={(event) => updateProfileOperation(index, "name", event.target.value)} />
                          <select value={operation.defaultMachineClassId ?? ""} onChange={(event) => updateProfileOperation(index, "defaultMachineClassId", event.target.value || null)}>
                            <option value="">{t("No asset")}</option>
                            {companyProfile.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                          </select>
                          <select value={operation.defaultLaborClassId ?? ""} onChange={(event) => updateProfileOperation(index, "defaultLaborClassId", event.target.value || null)}>
                            <option value="">{t("No labor")}</option>
                            {companyProfile.employees.filter((employee) => employee.directLabor).map((employee) => <option key={employee.id} value={employee.id}>{employee.position}</option>)}
                          </select>
                          <button className="iconButton" onClick={() => removeProfileOperation(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    ) : null}
                  </section>
                </>
              );
            })() : (
              <section className="panel"><p>{profileStatus}</p></section>
            )}
          </section>
        ) : null}

        {activeView === "resources" && assumptions ? (
          <div className="resourcesPage">
            <section className="resourceIntroGrid">
              <div className="panel">
                <div className="sectionHeader"><h2>{t("Commercial Policy")}</h2></div>
                <p className="sectionHelp">{t("How cost becomes a price. Margin and risk apply to the shop's own work (machining, labor, engineering, overhead). Material and bought-out items are re-sold with the smaller handling markup instead -- customers rarely accept full profit margin on raw steel.")}</p>
                <div className="fieldGrid">
                  <label>{t("Margin %")}<input type="number" min="0" max="99" value={formatPercent(assumptions.commercial_policy.default_margin_percent)} onChange={(event) => updateCommercialField("default_margin_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>{t("Risk allowance %")}<input type="number" min="0" value={formatPercent(assumptions.commercial_policy.risk_allowance_percent)} onChange={(event) => updateCommercialField("risk_allowance_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>{t("Minimum admin cost")}<input type="number" min="0" value={assumptions.commercial_policy.minimum_order_admin_cost_eur} onChange={(event) => updateCommercialField("minimum_order_admin_cost_eur", numericValue(event.target.value))} /></label>
                  <label>{t("Material/bought-out markup %")}<input type="number" min="0" max="100" value={formatPercent(assumptions.commercial_policy.material_markup_percent ?? 0.1)} onChange={(event) => updateCommercialField("material_markup_percent", numericValue(event.target.value) / 100)} /></label>
                </div>
              </div>
              <div className="panel">
                <div className="sectionHeader"><h2>{t("Client Portal Range")}</h2></div>
                <p className="sectionHelp">{t("Editable, not hardcoded -- widened asymmetrically pending calibration against actuals.")}</p>
                <div className="fieldGrid">
                  <label>{t("Low factor (x sell price)")}<input type="number" min="0.01" max="1" step="0.01" value={assumptions.client_portal?.range_low_factor ?? 0.85} onChange={(event) => updateClientPortalField("range_low_factor", Math.max(0.01, numericValue(event.target.value, 0.85)))} /></label>
                  <label>{t("High factor (x sell price)")}<input type="number" min="1" step="0.01" value={assumptions.client_portal?.range_high_factor ?? 1.35} onChange={(event) => updateClientPortalField("range_high_factor", Math.max(1, numericValue(event.target.value, 1.35)))} /></label>
                  <label>{t("Annual-volume relief %")}<input type="number" min="0" max="100" value={formatPercent(assumptions.client_portal?.annual_volume_relief_percent ?? 0.92)} onChange={(event) => updateClientPortalField("annual_volume_relief_percent", numericValue(event.target.value, 92) / 100)} /></label>
                </div>
              </div>
              <div className="panel">
                <div className="sectionHeader"><h2>{t("CAM Defaults")}</h2></div>
                <div className="fieldGrid">
                  <label>{t("Repeat reuse %")}<input type="number" min="0" max="100" value={formatPercent(assumptions.cam_programming_defaults.repeat_part_reusable_program_percent)} onChange={(event) => updateCamField("repeat_part_reusable_program_percent", numericValue(event.target.value) / 100)} /></label>
                  <label>{t("Prove-out, min")}<input type="number" min="0" value={assumptions.cam_programming_defaults.default_setup_proveout_minutes} onChange={(event) => updateCamField("default_setup_proveout_minutes", numericValue(event.target.value))} /></label>
                  <label>{t("Simple min")}<input type="number" min="0" value={assumptions.cam_programming_defaults.simple_programming_minutes} onChange={(event) => updateCamField("simple_programming_minutes", numericValue(event.target.value))} /></label>
                  <label>{t("Medium min")}<input type="number" min="0" value={assumptions.cam_programming_defaults.medium_programming_minutes} onChange={(event) => updateCamField("medium_programming_minutes", numericValue(event.target.value))} /></label>
                  <label>{t("Complex min")}<input type="number" min="0" value={assumptions.cam_programming_defaults.complex_programming_minutes} onChange={(event) => updateCamField("complex_programming_minutes", numericValue(event.target.value))} /></label>
                </div>
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Overhead Allocation")}</h2>
                  <p className="sectionHelp">
                    {t("Admin, sales, quality management, and facility costs that sit outside any single machine or direct labor rate.")}
                    {" "}
                    {t("Enter one monthly total below; it is spread over the shop's planned productive hours and folded into every machine's EUR/h in the Machine Rate Calculator, so every quoted hour automatically carries its fair share of running the company.")}
                  </p>
                </div>
                <button className="primaryButton" onClick={addOverheadItem}><Plus size={16} /> {t("Add Item")}</button>
              </div>
              <div className="fieldGrid" style={{ marginBottom: 12 }}>
                <label>
                  {t("Total monthly overhead")}
                  <input readOnly value={money.format(totalMonthlyOverheadEur(assumptions))} />
                </label>
                <label>
                  {t("Overhead EUR/h, flat shop average (machine rates fold in a weighted share per station, not this flat figure)")}
                  <input readOnly value={money.format(overheadPerMachineHour(assumptions, "target_availability_percent", "target_utilization_percent"))} />
                </label>
              </div>
              <div className="resourceTable overheadTable">
                <div className="tableHead"><span>{t("Expense")}</span><span>{t("Monthly EUR")}</span><span>{t("Data status")}</span><span></span></div>
                {(assumptions.overhead?.monthly_items ?? []).map((item, index) => (
                  <div className="tableRow" key={item.id}>
                    <input value={item.name} onChange={(event) => updateOverheadItem(index, "name", event.target.value)} />
                    <input type="number" min="0" value={item.monthly_cost_eur} onChange={(event) => updateOverheadItem(index, "monthly_cost_eur", numericValue(event.target.value))} />
                    <DataStatusInput value={item.quality} onChange={(value) => updateOverheadItem(index, "quality", value)} lang={language} />
                    <button className="iconButton" onClick={() => removeOverheadItem(index)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Labor Classes")}</h2>
                  <p className="sectionHelp">{t("What one hour of each person really costs the company. Enter labor as direct hourly cost or calculate it from gross monthly salary plus Latvian employer VSAOI. \"Billable share %\" is the share of paid hours that actually ends up on customer work -- the rest is waiting, training, and internal jobs. Salary is divided only over billable hours, otherwise every quote silently under-prices labor by the idle share.")}</p>
                </div>
              </div>
              <div className="resourceTable laborTable">
                <div className="tableHead laborHead"><span>{t("Name")}</span><span>{t("Method")}</span><span>{t("Direct EUR/h")}</span><span>{t("Gross/month")}</span><span>{t("Employer tax %")}</span><span>{t("Paid h/month")}</span><span>{t("Billable share %")}</span><span>{t("Derived EUR/h")}</span><span>{t("Data status")}</span></div>
                {assumptions.labor_classes.map((labor, index) => (
                  <div className="tableRow laborRow" key={labor.id}>
                    <input value={labor.name} onChange={(event) => updateLabor(index, "name", event.target.value)} />
                    <select value={labor.cost_method ?? "direct_hourly"} onChange={(event) => updateLabor(index, "cost_method", event.target.value)}>
                      <option value="direct_hourly">{t("Direct hourly")}</option>
                      <option value="gross_monthly">{t("Gross salary")}</option>
                    </select>
                    <input type="number" min="0" value={labor.employer_cost_per_hour_eur} onChange={(event) => updateLabor(index, "employer_cost_per_hour_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" value={labor.gross_monthly_salary_eur ?? 0} onChange={(event) => updateLabor(index, "gross_monthly_salary_eur", numericValue(event.target.value))} />
                    <input type="number" min="0" max="100" value={formatPercent(labor.employer_social_contribution_rate ?? assumptions.payroll_tax_defaults?.employer_social_contribution_rate ?? 0.2359)} onChange={(event) => updateLabor(index, "employer_social_contribution_rate", numericValue(event.target.value) / 100)} />
                    <input type="number" min="1" value={labor.paid_hours_per_month ?? assumptions.payroll_tax_defaults?.paid_hours_per_month ?? 160} onChange={(event) => updateLabor(index, "paid_hours_per_month", Math.max(1, numericValue(event.target.value, 160)))} />
                    <input type="number" min="10" max="100" value={formatPercent(laborBillableHoursRatio(labor, assumptions))} onChange={(event) => updateLabor(index, "billable_hours_ratio", Math.min(1, Math.max(0.1, numericValue(event.target.value, 85) / 100)))} />
                    <input readOnly value={deriveLaborHourlyCost(labor, assumptions)} />
                    <DataStatusInput value={labor.quality} onChange={(value) => updateLabor(index, "quality", value)} lang={language} />
                  </div>
                ))}
              </div>
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Machine Rate Calculator")}</h2>
                  <p className="sectionHelp">{t("Availability is the share of scheduled time the machine is actually up and running; Utilization is how much of available time actually gets loaded with orders at all. Idleness (1 - Utilization) is the empty-order gap. Formula: fixed cost / (planned hours x Utilization x Availability) + variable cost + overhead EUR/h. \"Variable EUR/h\" is what one running hour adds on top of the fixed cost: machine electricity (from Power kW x price), coolant, compressed air, and routine wear items -- it belongs here and not in the overhead bills, because it should be paid only by the parts that actually run on this machine; building electricity (lights, heating, offices) stays in Overhead Allocation. Market sell EUR/h is user-entered and feeds Profitability revenue. Never compare it against the machine-only rate: a sold hour also pays the operator, so the honest comparison column is \"Target + labour EUR/h\" -- the target rate plus this machine's share of its assigned labour payroll. Which labour class belongs to which asset is set in Profile > Production Assets (\"Payroll role\" column); the share per machine hour then follows from that class's headcount and how many machines share the role (one operator tending three machines costs each machine a third). OEE stays in the data model as a shop-floor diagnostic (see the Guide tab) but is not shown here: only Availability scales the rate -- performance losses already live in cycle minutes and quality losses in scrap, so charging full OEE would count them twice.")}</p>
                </div>
              </div>
              <div className="resourceTable machineRateTable">
                <div className="tableHead machineRateHead">
                  <span>{t("Name")}</span><span>{t("Fixed cost EUR/month")}</span><span>{t("Planned h/month")}</span>
                  <span>{t("Actual Availability % (machine)")}</span><span>{t("Target Availability % (machine)")}</span>
                  <span>{t("Actual Utilization % (machine)")}</span><span>{t("Target Utilization % (machine)")}</span>
                  <span>{t("Variable EUR/h")}</span><span>{t("Target discount %")}</span>
                  <span>{t("Accounting EUR/h")}</span><span>{t("Target EUR/h")}</span><span>{t("Target + labour EUR/h")}</span><span>{t("Market sell EUR/h")}</span><span>{t("Power kW")}</span>
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
                      <div className="utilizationCell">
                        <input type="number" min="1" max="100" value={formatPercent(actualUtilization)} onChange={(event) => updateMachine(index, "actual_utilization_percent", Math.max(0.01, numericValue(event.target.value, 1) / 100))} />
                        <UtilizationBar utilization={actualUtilization} />
                        <span className={`idlenessHint ${actualIdle === 0 ? "zero" : ""}`}>{t("Idle")} {formatPercent(actualIdle)}%</span>
                      </div>
                      <div className="utilizationCell">
                        <input type="number" min="1" max="100" value={formatPercent(targetUtilization)} onChange={(event) => updateMachine(index, "target_utilization_percent", Math.max(0.01, numericValue(event.target.value, DEFAULT_TARGET_UTILIZATION_PERCENT * 100) / 100))} />
                        <UtilizationBar utilization={targetUtilization} />
                        <span className={`idlenessHint ${targetIdle === 0 ? "zero" : ""}`}>{t("Idle")} {formatPercent(targetIdle)}%</span>
                      </div>
                      <input type="number" min="0" value={machine.variable_cost_eur_per_hour ?? 0} onChange={(event) => updateMachine(index, "variable_cost_eur_per_hour", numericValue(event.target.value))} />
                      <input type="number" min="0" max="90" value={formatPercent(machine.target_rate_discount_percent ?? 0)} onChange={(event) => updateMachine(index, "target_rate_discount_percent", Math.min(0.9, numericValue(event.target.value) / 100))} />
                      <input readOnly value={machine.accounting_full_cost_rate_eur_per_hour} />
                      <input readOnly value={machine.target_competitive_rate_eur_per_hour} />
                      <input readOnly title={`Target EUR/h plus this machine's share of its labour: ${assumptions.labor_classes.find((labor) => labor.id === machine.default_labor_class_id)?.name ?? "no labour class assigned (set the Payroll role in Profile > Production Assets)"}, payroll spread over all machines sharing that role. This is the number to compare against Market sell EUR/h.`} value={roundMoney(machine.target_competitive_rate_eur_per_hour + machineOperatorShareRate(machine, assumptions))} />
                      <input type="number" min="0" value={machine.market_sell_rate_eur_per_hour ?? 0} onChange={(event) => updateMachine(index, "market_sell_rate_eur_per_hour", numericValue(event.target.value))} />
                      <input type="number" min="0" value={machine.loaded_power_kw} onChange={(event) => updateMachine(index, "loaded_power_kw", numericValue(event.target.value))} />
                      <div className="fixedCostToggle">
                        <button
                          type="button"
                          className="linkButton"
                          onClick={() => setExpandedFixedCostHelpers((current) => ({ ...current, [machine.id]: !helperOpen }))}
                        >
                          {helperOpen ? t("Hide") : t("Estimate fixed cost from purchase price")}
                        </button>
                      </div>
                      {helperOpen ? (
                        <div className="fixedCostHelper">
                          <label>
                            {t("Purchase price EUR")}
                            <input type="number" min="0" value={machine.purchase_price_eur ?? 0} onChange={(event) => updateMachine(index, "purchase_price_eur", numericValue(event.target.value))} />
                          </label>
                          <label>
                            {t("Useful life, years")}
                            <input type="number" min="1" value={machine.useful_life_years ?? 10} onChange={(event) => updateMachine(index, "useful_life_years", Math.max(1, numericValue(event.target.value, 10)))} />
                          </label>
                          <label>
                            {t("Salvage %")}
                            <input type="number" min="0" max="90" value={formatPercent(machine.salvage_percent ?? 0)} onChange={(event) => updateMachine(index, "salvage_percent", Math.min(0.9, numericValue(event.target.value) / 100))} />
                          </label>
                          <label>
                            {t("Other fixed cost EUR/month")}
                            <input type="number" min="0" value={machine.other_monthly_fixed_cost_eur ?? 0} onChange={(event) => updateMachine(index, "other_monthly_fixed_cost_eur", numericValue(event.target.value))} />
                          </label>
                          <div>
                            <div className="suggestedValue">{t("Suggested:")} {money.format(suggestedFixedCostFromPurchase(machine))}/mo</div>
                            <button type="button" className="secondaryButton" onClick={() => applySuggestedFixedCost(index)}>{t("Apply")}</button>
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
                  <h2>{t("Material Library")}</h2>
                  <p className="sectionHelp">{t("Stock pieces used in quote material selection. Costs should represent purchasable stock, not theoretical net part material.")}</p>
                </div>
                <div className="buttonRow">
                  {isSectionOpen("material_library") ? <button className="primaryButton" onClick={addMaterial}><Plus size={16} /> {t("Add Material")}</button> : null}
                  {sectionToggle("material_library")}
                </div>
              </div>
              {isSectionOpen("material_library") ? (
              <div className="resourceTable materialTable">
                <div className="tableHead materialHead"><span>{t("Name")}</span><span>{t("Grade")}</span><span>{t("Stock description")}</span><span>{t("Cost, EUR")}</span><span>{t("Shape")}</span><span>{t("Length mm")}</span><span>{t("Width mm")}</span><span>{t("Supplier")}</span><span>{t("MOQ")}</span><span>{t("Scrap rec. %")}</span></div>
                {assumptions.material_examples.map((material, index) => (
                  <div className="tableRow materialRow" key={material.id}>
                    <input value={material.name} onChange={(event) => updateMaterial(index, "name", event.target.value)} />
                    <input value={material.material_grade ?? ""} onChange={(event) => updateMaterial(index, "material_grade", event.target.value)} />
                    <input value={material.stock_description ?? ""} onChange={(event) => updateMaterial(index, "stock_description", event.target.value)} />
                    <input type="number" min="0" value={material.stock_piece_cost_eur} onChange={(event) => updateMaterial(index, "stock_piece_cost_eur", numericValue(event.target.value))} />
                    <select value={material.stock_shape ?? ""} onChange={(event) => updateMaterial(index, "stock_shape", event.target.value)}>
                      <option value="">{t("Not set")}</option>
                      <option value="round_bar">{t("Round bar")}</option>
                      <option value="hex_bar">{t("Hex bar")}</option>
                      <option value="square_bar">{t("Square bar")}</option>
                      <option value="tube">{t("Tube")}</option>
                      <option value="plate">{t("Plate")}</option>
                    </select>
                    <input type="number" min="0" value={material.stock_length_mm ?? 0} onChange={(event) => updateMaterial(index, "stock_length_mm", numericValue(event.target.value))} />
                    <input type="number" min="0" value={material.stock_width_mm ?? 0} onChange={(event) => updateMaterial(index, "stock_width_mm", numericValue(event.target.value))} disabled={material.stock_shape !== "plate"} />
                    <input value={material.supplier ?? ""} onChange={(event) => updateMaterial(index, "supplier", event.target.value)} />
                    <input type="number" min="0" value={material.minimum_order_quantity ?? 1} onChange={(event) => updateMaterial(index, "minimum_order_quantity", numericValue(event.target.value))} />
                    <input type="number" min="0" max="100" value={formatPercent(material.scrap_recovery_percent ?? 0)} onChange={(event) => updateMaterial(index, "scrap_recovery_percent", numericValue(event.target.value) / 100)} />
                  </div>
                ))}
              </div>
              ) : null}
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Tool Inventory")}</h2>
                  <p className="sectionHelp">{t("Simple cutter/tool library used by quote tool checks. Quantity zero is useful for missing-tool demo cases.")}</p>
                </div>
                <label className="toolToleranceField">
                  {t("Diameter/radius match tolerance, mm")}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={assumptions.tool_match_tolerance_mm ?? 0.05}
                    onChange={(event) => updateAssumptions({ ...assumptions, tool_match_tolerance_mm: Math.max(0, numericValue(event.target.value, 0.05)) })}
                  />
                </label>
                <div className="buttonRow">
                  {isSectionOpen("tool_inventory") ? <button className="primaryButton" onClick={addTool}><Plus size={16} /> {t("Add Tool")}</button> : null}
                  {sectionToggle("tool_inventory")}
                </div>
              </div>
              {isSectionOpen("tool_inventory") ? (
              <div className="resourceTable toolInventoryTable">
                <div className="tableHead toolInventoryHead"><span>{t("Name")}</span><span>{t("Type")}</span><span>{t("D mm")}</span><span>{t("R mm")}</span><span>{t("Materials")}</span><span>{t("Qty")}</span><span>{t("Cost")}</span><span>{t("Lead days")}</span><span>{t("Reusable")}</span><span>{t("Data status")}</span></div>
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
                      <option value="yes">{t("Yes")}</option>
                      <option value="no">{t("No")}</option>
                    </select>
                    <DataStatusInput value={tool.quality} onChange={(value) => updateTool(index, "quality", value)} lang={language} />
                  </div>
                ))}
              </div>
              ) : null}
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Operation Templates")}</h2>
                  <p className="sectionHelp">{t("Defaults used when adding operations to a quote. Tune these as measured setup and cycle history improves.")}</p>
                </div>
                {sectionToggle("operation_templates")}
              </div>
              {isSectionOpen("operation_templates") ? (
              <div className="resourceTable operationTemplateTable">
                <div className="tableHead operationTemplateHead"><span>{t("Operation")}</span><span>{t("Machine")}</span><span>{t("Labor")}</span><span>{t("Setup M min")}</span><span>{t("Setup L min")}</span><span>{t("Cycle M min/pc")}</span><span>{t("Cycle L min/pc")}</span><span>{t("Tool EUR/part")}</span><span>{t("Cons. EUR/part")}</span><span>{t("Out EUR/part")}</span><span>{t("Out EUR/batch")}</span><span>{t("Scrap %")}</span></div>
                {assumptions.operation_templates.map((template, index) => (
                  <div className="tableRow operationTemplateRow" key={template.operation_type}>
                    <span>{operationLabel(template.operation_type)}</span>
                    <select value={template.default_machine_class_id ?? ""} onChange={(event) => updateOperationTemplate(index, "default_machine_class_id", event.target.value || null)}><option value="">{t("No machine")}</option>{assumptions.machine_classes.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select>
                    <select value={template.default_labor_class_id ?? ""} onChange={(event) => updateOperationTemplate(index, "default_labor_class_id", event.target.value || null)}><option value="">{t("No labor")}</option>{assumptions.labor_classes.map((labor) => <option key={labor.id} value={labor.id}>{labor.name}</option>)}</select>
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
              ) : null}
            </section>

            <section className="operations">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Full JSON")}</h2>
                  <p className="sectionHelp">{t("Power-user access to every assumption, including fields without structured inputs above. Collapsed by default -- during a presentation there is no reason to open it.")}</p>
                </div>
                <div className="buttonRow">
                  {isSectionOpen("full_json") ? <button className="secondaryButton" onClick={applyJsonEditor}>{t("Apply JSON")}</button> : null}
                  <button className="primaryButton" onClick={saveAssumptions}><Save size={16} /> {t("Save")}</button>
                  {sectionToggle("full_json")}
                </div>
              </div>
              {isSectionOpen("full_json") ? (
                <textarea className="jsonEditor" value={assumptionsText} onChange={(event) => { setAssumptionsText(event.target.value); setAssumptionStatus("JSON edited, not applied"); }} spellCheck={false} />
              ) : null}
              <p className="statusText">{assumptionStatus}</p>
            </section>
          </div>
        ) : null}

        {activeView === "resources" && !assumptions ? <section className="panel"><p>{assumptionStatus}</p></section> : null}

        {activeView === "market_rates" && assumptions ? (
          <section className="marketRatePage casePage">
            {(() => {
              const entries = marketRateCardEntries(assumptions);
              const rates = marketRateById(entries);
              const conversionRevenue = marketEvidenceSellPrice - marketEvidenceMaterialSell - marketEvidenceBoughtOutSell - marketEvidenceFixedCharges;
              const totalRouteHours = marketEvidenceRows.reduce((sum, row) => sum + Math.max(0, row.hours), 0);
              const cardRouteRevenue = marketEvidenceRows.reduce((sum, row) => sum + Math.max(0, row.hours) * (rates.get(row.marketRateClassId)?.rateEurPerHour ?? 0), 0);
              const solvedHours = marketEvidenceSolveClassId === "__blended"
                ? totalRouteHours
                : marketEvidenceRows.filter((row) => row.marketRateClassId === marketEvidenceSolveClassId).reduce((sum, row) => sum + Math.max(0, row.hours), 0);
              const knownRevenueForSolver = marketEvidenceSolveClassId === "__blended"
                ? 0
                : marketEvidenceRows
                  .filter((row) => row.marketRateClassId !== marketEvidenceSolveClassId)
                  .reduce((sum, row) => sum + Math.max(0, row.hours) * (rates.get(row.marketRateClassId)?.rateEurPerHour ?? 0), 0);
              const impliedRate = solvedHours > 0 ? (conversionRevenue - knownRevenueForSolver) / solvedHours : null;
              const grossProfitAtSellPrice = marketEvidenceSellPrice - marketEvidenceProductionCost;
              const grossMarginAtSellPrice = marketEvidenceSellPrice > 0 ? grossProfitAtSellPrice / marketEvidenceSellPrice : null;
              const targetMargin = assumptions.commercial_policy.default_margin_percent;
              const requiredSellAtTargetMargin = marketEvidenceProductionCost > 0 ? marketEvidenceProductionCost / Math.max(0.01, 1 - targetMargin) : 0;
              const selectedSolveClassName = marketEvidenceSolveClassId === "__blended"
                ? t("Blended route")
                : entries.find((entry) => entry.id === marketEvidenceSolveClassId)?.name ?? t("Selected class");
              const loadedProfileName = companyProfile?.companyName ?? t("No profile loaded");
              const loadedProfileId = companyProfile?.profileId ?? null;
              const boundProfileId = marketRateCardProfileId(assumptions);
              const boundProfileName = marketRateCardProfileName(assumptions) || t("Not bound");
              const cardMatchesLoadedProfile = Boolean(loadedProfileId && boundProfileId === loadedProfileId);
              const cardHasBinding = Boolean(boundProfileId);
              return (
                <>
                  <section className="panel caseHero marketRateHero">
                    <h2>{t("Market Rates — Competitive Ceiling, Not a Target")}</h2>
                    <p>{t("Required and Target EUR/h on the Profitability page already tell you what you need to charge -- your own cost, risk, and margin. This page answers a different question: is anyone actually willing to pay that? It exists to hold rates sourced from")} <strong>{t("outside")}</strong> {t("this tool's own pricing engine -- a lost bid, a competitor's price, a market benchmark -- never a number backsolved from our own accepted quotes, since that would just hand back our own cost-plus price and prove nothing about the market. Once a rate is credible, apply it to Profitability, where it is shown next to Required/Target EUR/h as the realism cutoff, not the number that decides the price.")}</p>
                  </section>

                  <section className="panel marketRatePanel">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Market Rate Card")}</h2>
                        <p className="sectionHelp">{t("These are external sell rates by work-center family, sourced from outside our own quotes -- not derived from asset value or our own cost-plus price. Use the source and confidence fields to separate real lost-bid/competitor evidence from manual placeholders; \"Cost-plus floor only\" openly marks a class with no market evidence yet, rather than inventing one.")}</p>
                      </div>
                      <div className="buttonRow marketRateActions">
                        <button className="secondaryButton" onClick={addMarketRateEntry}><Plus size={16} /> {t("Add Class")}</button>
                        <button className="secondaryButton" onClick={loadMarketRateCardFromLoadedProfile}>{t("Load Card from Profile")}</button>
                        <button className="secondaryButton" onClick={bindMarketRateCardToLoadedProfile}>{t("Bind to Loaded Profile")}</button>
                        <button className="secondaryButton" onClick={saveMarketRateCard}><Save size={16} /> {t("Save Rate Card")}</button>
                        <button className="primaryButton" onClick={applyMarketRateCardToProfitability}>{t("Apply to Profitability")}</button>
                      </div>
                    </div>
                    <div className={`marketBindingStrip ${cardMatchesLoadedProfile ? "compatible" : "blocked"}`}>
                      <div><span>{t("Loaded profile")}</span><strong>{loadedProfileName}</strong></div>
                      <div><span>{t("Rate card bound to")}</span><strong>{boundProfileName}</strong></div>
                      <div><span>{t("Compatibility")}</span><strong>{cardMatchesLoadedProfile ? t("Compatible") : cardHasBinding ? t("Wrong profile") : t("Not bound")}</strong></div>
                    </div>
                    {!cardMatchesLoadedProfile ? (
                      <p className="profitabilityWarning">{t("Load a saved Company Profile, then load or bind its rate card before applying rates to Profitability. This prevents a CNC/manual/assembly rate card from one company profile being applied to another asset base.")}</p>
                    ) : null}
                    <p className="statusText">{assumptionStatus}</p>
                    <div className="resourceTable marketRateCardTable">
                      <div className="tableHead marketRateCardHead"><span>{t("Pricing class")}</span><span>{t("Market EUR/h")}</span><span>{t("Source")}</span><span>{t("Confidence")}</span><span>{t("Last updated")}</span><span>{t("Notes")}</span><span></span></div>
                      {entries.map((entry, index) => (
                        <div className="tableRow marketRateCardRow" key={entry.id}>
                          <input value={entry.name} onChange={(event) => updateMarketRateEntry(index, "name", event.target.value)} />
                          <input type="number" min="0" value={entry.rateEurPerHour} onChange={(event) => updateMarketRateEntry(index, "rateEurPerHour", numericValue(event.target.value))} />
                          <select value={entry.source} onChange={(event) => updateMarketRateEntry(index, "source", event.target.value)}>
                            <option value="manual_rate_card">{t("Manual / industry benchmark")}</option>
                            <option value="lost_quote">{t("Lost-bid backsolve")}</option>
                            <option value="competitor_backsolve">{t("Competitor backsolve")}</option>
                            <option value="buyer_disclosed">{t("Buyer-disclosed benchmark")}</option>
                            <option value="cost_plus_floor">{t("Cost-plus floor only (no evidence yet)")}</option>
                          </select>
                          <MarketConfidenceInput value={entry.confidence} onChange={(value) => updateMarketRateEntry(index, "confidence", value)} lang={language} />
                          <input value={entry.lastUpdated} placeholder="YYYY-MM-DD" onChange={(event) => updateMarketRateEntry(index, "lastUpdated", event.target.value)} />
                          <input value={entry.notes} onChange={(event) => updateMarketRateEntry(index, "notes", event.target.value)} />
                          <button className="iconButton" onClick={() => removeMarketRateEntry(index)}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="quoteGrid marketEvidenceGrid">
                    <div className="panel marketRatePanel">
                      <div className="sectionHeader wide">
                        <div>
                          <h2>{t("Competitor / Lost-Bid Evidence Backsolve")}</h2>
                          <p className="sectionHelp">{t("Enter a price we did NOT set ourselves. Real ways to get one: a lost bid (ask the customer informally what price/lead time won -- most will tell you); a blind or proxy RFQ sent through a broker or an arm's-length intermediary; a public instant-quote portal price for comparable work (Xometry, Protolabs, and similar); or a benchmark a multi-sourcing customer discloses to negotiate against (real, but always biased toward the buyer -- treat it as a soft ceiling, not a hard number). Remove material, bought-out, and fixed charges to isolate conversion revenue, then solve the route EUR/h. Route hours are entered by hand below -- there is no shortcut that pulls in this quote's own price, because that would just backsolve our own cost-plus rate and call it evidence.")}</p>
                        </div>
                      </div>
                      <div className="fieldGrid">
                        <label>{t("Competitor / lost-bid sell price, EUR")}<input type="number" min="0" value={marketEvidenceSellPrice} onChange={(event) => setMarketEvidenceSellPrice(numericValue(event.target.value))} /></label>
                        <label>{t("Our production cost for the same part, EUR")}<input type="number" min="0" value={marketEvidenceProductionCost} onChange={(event) => setMarketEvidenceProductionCost(numericValue(event.target.value))} /></label>
                        <label>{t("Material sell amount, EUR")}<input type="number" min="0" value={marketEvidenceMaterialSell} onChange={(event) => setMarketEvidenceMaterialSell(numericValue(event.target.value))} /></label>
                        <label>{t("Bought-out / outsourced sell amount, EUR")}<input type="number" min="0" value={marketEvidenceBoughtOutSell} onChange={(event) => setMarketEvidenceBoughtOutSell(numericValue(event.target.value))} /></label>
                        <label>{t("Engineering / admin / batch charges, EUR")}<input type="number" min="0" value={marketEvidenceFixedCharges} onChange={(event) => setMarketEvidenceFixedCharges(numericValue(event.target.value))} /></label>
                        <label>{t("Evidence source")}<select value={marketEvidenceSource} onChange={(event) => setMarketEvidenceSource(event.target.value as MarketRateSource)}>
                          <option value="lost_quote">{t("Lost bid (we know what the winner charged)")}</option>
                          <option value="competitor_backsolve">{t("Competitor price (blind RFQ, proxy, or instant-quote portal)")}</option>
                          <option value="buyer_disclosed">{t("Buyer-disclosed benchmark (soft ceiling)")}</option>
                          <option value="manual_rate_card">{t("Manual / industry benchmark")}</option>
                          <option value="cost_plus_floor">{t("Cost-plus floor only (no evidence yet)")}</option>
                        </select></label>
                        <label>{t("Solve residual for")}<select value={marketEvidenceSolveClassId} onChange={(event) => setMarketEvidenceSolveClassId(event.target.value)}>
                          <option value="__blended">{t("Blended route")}</option>
                          {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                        </select></label>
                      </div>
                      <div className="marketFormulaGrid">
                        <div><span>{t("Conversion revenue")}</span><strong>{money.format(conversionRevenue)}</strong><em>{t("Sell price minus material, bought-out, engineering/admin, and batch charges -- the slice that paid for shop hours. Intermediate value: it feeds implied EUR/h and the rate-card check in Decision Logic below")}</em></div>
                        <div><span>{t("Route hours")}</span><strong>{roundMoney(totalRouteHours)} h</strong><em>{t("Use work-center occupancy hours, not machine + labor double-counted")}</em></div>
                        <div><span>{selectedSolveClassName} {t("implied EUR/h")}</span><strong>{impliedRate !== null ? `${money.format(impliedRate)}/h` : t("No hours")}</strong><em>{t("Residual revenue divided by selected route hours")}</em></div>
                        <div><span>{t("Margin at sell price")}</span><strong>{grossMarginAtSellPrice !== null ? `${formatPercent(grossMarginAtSellPrice)}%` : t("No sell price")}</strong><em>{money.format(grossProfitAtSellPrice)} {t("gross profit vs entered production cost")}</em></div>
                        <div><span>{t("Required sell at target margin")}</span><strong>{marketEvidenceProductionCost > 0 ? money.format(requiredSellAtTargetMargin) : t("No cost")}</strong><em>{t("Cost / (1 -")} {formatPercent(targetMargin)}% {t("margin)")}</em></div>
                        <div><span>{t("Current card route revenue")}</span><strong>{money.format(cardRouteRevenue)}</strong><em>{t("The same route hours priced by the current rate card. Compare only against Conversion revenue (same basis) -- never against Required sell, which is a full price including material")}</em></div>
                      </div>
                      <div className="buttonRow marketActionRow">
                        <button className="secondaryButton" onClick={addMarketEvidenceRow}><Plus size={16} /> {t("Add Route Row")}</button>
                        <button className="secondaryButton" onClick={() => applyBlendedRateToRouteClasses(impliedRate)}>{t("Use Blended Rate for Route Classes")}</button>
                        <button className="primaryButton" onClick={() => applyImpliedMarketRateToCard(impliedRate)}>{t("Apply Implied Rate to Class")}</button>
                      </div>
                      <div className="resourceTable marketRouteTable">
                        <div className="tableHead marketRouteHead"><span>{t("Pricing class")}</span><span>{t("Route h")}</span><span>{t("Card EUR/h")}</span><span>{t("Route revenue")}</span><span></span></div>
                        {marketEvidenceRows.map((row, index) => {
                          const entry = rates.get(row.marketRateClassId);
                          const rate = entry?.rateEurPerHour ?? 0;
                          return (
                            <div className="tableRow marketRouteRow" key={row.id}>
                              <select value={row.marketRateClassId} onChange={(event) => updateMarketEvidenceRow(index, "marketRateClassId", event.target.value)}>
                                {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                              </select>
                              <input type="number" min="0" value={row.hours} onChange={(event) => updateMarketEvidenceRow(index, "hours", numericValue(event.target.value))} />
                              <span>{money.format(rate)}/h</span>
                              <span>{money.format(Math.max(0, row.hours) * rate)}</span>
                              <button className="iconButton" onClick={() => removeMarketEvidenceRow(index)}><Trash2 size={16} /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="panel marketRatePanel">
                      <div className="sectionHeader wide">
                        <div>
                          <h2>{t("Decision Logic")}</h2>
                          <p className="sectionHelp">{t("The correct route is not to force cost-plus into the market rate. Use this diagnostic to decide whether a job is profitable, needs negotiation, or should be rejected.")}</p>
                        </div>
                      </div>
                      <div className="marketDecisionStack">
                        <div>
                          <span>{t("Market evidence price")}</span>
                          <strong>{money.format(marketEvidenceSellPrice)}</strong>
                        </div>
                        <div>
                          <span>{t("Cost-plus required price (what we would need to charge at")} {formatPercent(targetMargin)}% {t("margin)")}</span>
                          <strong>{marketEvidenceProductionCost > 0 ? <><em className="decisionFormula">{money.format(marketEvidenceProductionCost)} {t("cost / (1 −")} {formatPercent(targetMargin)}%) = </em>{money.format(requiredSellAtTargetMargin)}</> : t("No cost")}</strong>
                        </div>
                        <div className={marketEvidenceProductionCost > 0 && marketEvidenceSellPrice - requiredSellAtTargetMargin >= 0 ? "decisionGood" : undefined}>
                          <span>{t("Gap to target margin (market minus required)")}</span>
                          <strong>{marketEvidenceProductionCost > 0 ? <><em className="decisionFormula">{money.format(marketEvidenceSellPrice)} − {money.format(requiredSellAtTargetMargin)} = </em>{money.format(marketEvidenceSellPrice - requiredSellAtTargetMargin)}</> : t("No cost")}</strong>
                        </div>
                        <div className={grossProfitAtSellPrice >= 0 ? "decisionGood" : "decisionBad"}>
                          <span>{t("Gross profit at market price (market minus production cost)")}</span>
                          <strong><em className="decisionFormula">{money.format(marketEvidenceSellPrice)} − {money.format(marketEvidenceProductionCost)} = </em>{money.format(grossProfitAtSellPrice)}</strong>
                        </div>
                        {totalRouteHours > 0 ? (
                          <div className={conversionRevenue - cardRouteRevenue >= 0 ? "decisionGood" : "decisionBad"}>
                            <span>{t("Rate card check (evidence conversion revenue minus card route revenue, same hours)")}</span>
                            <strong>
                              <em className="decisionFormula">{money.format(conversionRevenue)} − {money.format(cardRouteRevenue)} = </em>
                              {money.format(conversionRevenue - cardRouteRevenue)}
                              <em className="decisionFormula"> ({conversionRevenue - cardRouteRevenue >= 0 ? "+" : "−"}{money.format(Math.abs(conversionRevenue - cardRouteRevenue) / totalRouteHours)}/h {t("over")} {roundMoney(totalRouteHours)} h)</em>
                            </strong>
                          </div>
                        ) : null}
                      </div>
                      <p className="sectionHelp marketDecisionText">
                        {t("Rate card check: positive means this real order paid")} <strong>{t("more")}</strong> {t("per route hour than the current rate card assumes -- the card is conservative. Negative means the customer paid")} <strong>{t("less")}</strong> {t("per hour than the card claims the market pays -- the card is optimistic for this kind of work, and Profitability revenue built on it is overstated. Consistently negative checks across several orders mean the card rates should come down (or this work should not be taken at these prices).")}
                      </p>
                      <p className="sectionHelp marketDecisionText">
                        {t("If market price is below the cost-plus required price but still covers variable cost and contributes to overhead, it may be a spare-capacity decision. If it is below true production cost, it is a loss unless there is a strategic reason to accept it.")}
                      </p>
                    </div>
                  </section>

                  <section className="panel marketRatePanel">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Basket Evidence Solver")}</h2>
                        <p className="sectionHelp">{t("The single-quote check above assumes every other rate on your card is already correct -- it can't build a card from nothing. This panel works differently: upload a competitor's quote for a part you already produce, and the tool reads the real hours from your own operations, broken down by work center (the actual machine that did the work). That matters because your card's shared \"CNC\" label can hide a lathe, a mill, and a press brake charging very different rates.")}</p>
                        <p className="sectionHelp">{t("A quote only counts as evidence for a work center when that work center did most of the job -- at least")} {Math.round(BASKET_DOMINANCE_CUTOFF * 100)}%{t(" of the hours. When it does, the math is simple: what the competitor charged, minus your material cost, divided by that work center's hours. Nothing is solved or guessed: a work center with no quote clearly dominated by it is marked as having no evidence yet, not given a made-up number.")}</p>
                        <p className="marketBasketLimitations">
                          {t("Worth knowing before you rely on this:")} {t("one quote is a hint, not proof -- wait for a second one to agree before trusting a rate. Quotes where no single work center clearly did most of the job don't tell you anything and are simply left out; that's normal, not a bug. And the material cost used here is always your own estimate, marked up by the percentage below -- not what the competitor actually paid -- so adjust it if you think they buy material differently than you do.")}
                        </p>
                      </div>
                    </div>
                    <div className="fieldGrid">
                      <label>{t("Upload competitor quote PDF")}
                        <input type="file" accept=".pdf" onChange={(event) => setBasketPdfFile(event.target.files?.[0] ?? null)} />
                      </label>
                      <div className="buttonRow">
                        <button className="secondaryButton" disabled={!basketPdfFile || basketExtracting} onClick={extractBasketPdf}>
                          {basketExtracting ? t("Extracting...") : t("Extract Line Items")}
                        </button>
                        <button className="secondaryButton" onClick={() => addBasketRow()}><Plus size={16} /> {t("Add Row Manually")}</button>
                      </div>
                    </div>
                    {basketStatus ? <p className="statusText">{basketStatus}</p> : null}
                    <div className="resourceTable marketBasketTable">
                      <div className="tableHead marketBasketHead">
                        <span>{t("Part")}</span><span>{t("Qty")}</span><span>{t("Sell price (total)")}</span>
                        <span className="marketBasketMarkupHead">
                          <span>{t("Material sell (total)")}</span>
                          <span className="marketBasketMarkupStepper">
                            <span className="marketBasketMarkupLabel">{t("Assumed competitor material markup")}</span>
                            <span className="stepperControl">
                              <button type="button" className="iconButton" disabled={assumedMaterialMarkupPercent <= 0} onClick={() => setAssumedMaterialMarkupPercent((value) => Math.max(0, value - 5))}>−</button>
                              <span className="stepperValue">{assumedMaterialMarkupPercent}%</span>
                              <button type="button" className="iconButton" disabled={assumedMaterialMarkupPercent >= 25} onClick={() => setAssumedMaterialMarkupPercent((value) => Math.min(25, value + 5))}>+</button>
                            </span>
                          </span>
                        </span>
                        <span>{t("Route hours (by work center)")}</span><span>{t("Solvable")}</span><span></span>
                      </div>
                      {basketRows.map((row, rowIndex) => {
                        const solvable = basketRowIsSolvable(row, assumedMaterialMarkupPercent);
                        const materialSellEur = basketRowMaterialSellEur(row, assumedMaterialMarkupPercent);
                        return (
                          <div className="tableRow marketBasketRow" key={row.id}>
                            <div className="marketBasketRowMain">
                              <input placeholder={t("Part name")} value={row.partName} onChange={(event) => updateBasketRow(rowIndex, "partName", event.target.value)} />
                              {row.source === "pdf_extraction" ? <span className="sectionHelp">{t("from")} {row.pdfFilename}{row.supplier ? ` (${row.supplier})` : ""}</span> : null}
                            </div>
                            <input type="number" min="0" placeholder={t("Qty")} value={row.quantity ?? ""} onChange={(event) => updateBasketRow(rowIndex, "quantity", numericValue(event.target.value))} />
                            <input type="number" min="0" placeholder={t("Sell EUR")} value={row.lineTotalEur ?? (row.unitPriceEur != null && row.quantity != null ? row.unitPriceEur * row.quantity : "")} onChange={(event) => updateBasketRow(rowIndex, "lineTotalEur", numericValue(event.target.value))} />
                            <input
                              type="number"
                              min="0"
                              placeholder={t("Material EUR")}
                              value={materialSellEur ?? ""}
                              onChange={(event) => updateBasketRow(rowIndex, "materialSellEur", numericValue(event.target.value))}
                            />
                            <div className="marketBasketHoursCell">
                              {row.routeHours.map((hourEntry, hourIndex) => (
                                <div className="marketBasketHourRow" key={hourEntry.id}>
                                  <select value={hourEntry.marketRateClassId} onChange={(event) => updateBasketRowHourEntry(rowIndex, hourIndex, "marketRateClassId", event.target.value)}>
                                    {assumptions.machine_classes.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
                                  </select>
                                  <input type="number" min="0" value={hourEntry.hours} onChange={(event) => updateBasketRowHourEntry(rowIndex, hourIndex, "hours", numericValue(event.target.value))} />
                                  <button className="iconButton" onClick={() => removeBasketRowHourEntry(rowIndex, hourIndex)}><Trash2 size={14} /></button>
                                </div>
                              ))}
                              <button className="secondaryButton" onClick={() => addBasketRowHourEntry(rowIndex)}>+ {t("work center")}</button>
                            </div>
                            <span className={`marketBasketSolvable ${solvable ? "decisionGood" : "decisionBad"}`}>
                              {solvable ? t("Yes") : t("Incomplete")}
                            </span>
                            <div className="buttonRow marketBasketRowActions">
                              <button className="secondaryButton" onClick={() => saveBasketRow(rowIndex)}>{t("Save")}</button>
                              <button className="iconButton" onClick={() => deleteBasketRow(rowIndex)}><Trash2 size={16} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="buttonRow marketActionRow">
                      <button className="primaryButton" onClick={solveBasket}>{t("Solve Basket")}</button>
                      <button className="primaryButton" disabled={!basketSolveResult} onClick={applyBasketRatesToCard}>{t("Apply Solved Rates to Card")}</button>
                    </div>
                    {basketSolveResult ? (
                      <>
                        <div className="marketBasketEvidenceGrid">
                          {basketSolveResult.workCenters.map((wc) => (
                            <div key={wc.workCenterId} className={`marketBasketEvidenceCard ${wc.status}`}>
                              <span className="wc">{wc.workCenterName}</span>
                              {wc.status === "unknown" ? (
                                <span className="value">{t("Not enough evidence yet")}</span>
                              ) : (
                                <>
                                  <span className="value">{money.format(wc.medianRate!)}/h</span>
                                  {wc.status === "provisional" ? (
                                    <span className="range">{t("Only 1 quote isolates it -- treat as provisional")}</span>
                                  ) : (
                                    <span className="range">{t("Range across quotes:")} {money.format(wc.minRate!)} - {money.format(wc.maxRate!)}/h</span>
                                  )}
                                  {wc.cardRateEurPerHour != null ? <span className="cardVs">{t("Card currently:")} {money.format(wc.cardRateEurPerHour)}/h</span> : null}
                                </>
                              )}
                              <span className="evidenceCount">
                                {wc.evidenceCount === 0
                                  ? t("0 quotes isolate this work center")
                                  : `${wc.evidenceCount} ${wc.evidenceCount === 1 ? t("competitor quote isolates this work center") : t("competitor quotes isolate this work center")}`}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="resourceTable marketBasketTraceTable">
                          <div className="tableHead marketBasketTraceHead">
                            <span>{t("Competitor quote line")}</span>
                            <span className="numCol">{t("Qty")}</span>
                            <span className="numCol">{t("Price/part")}</span>
                            <span>{t("Dominant work center")}</span>
                            <span className="shareCol numCol">{t("Share of hours")}</span>
                            <span className="numCol">{t("Sell − material")}</span>
                            <span className="numCol">{t("Hours")}</span>
                            <span className="numCol">{t("Implied €/h")}</span>
                          </div>
                          {basketSolveResult.rowTraces.map((trace) => {
                            const row = basketRows.find((candidate) => candidate.id === trace.rowId);
                            if (!row) return null;
                            const qty = row.quantity;
                            const total = basketRowTotalSellEur(row);
                            const pricePerPart = total != null && qty ? total / qty : null;
                            const workCenterName = trace.dominantWorkCenterId ? (machineById.get(trace.dominantWorkCenterId)?.name ?? trace.dominantWorkCenterId) : null;
                            return (
                              <div className="tableRow marketBasketTraceRow" key={trace.rowId}>
                                <span>{row.partName || t("(unnamed row)")}</span>
                                <span className="numCol">{qty ?? "—"}</span>
                                <span className="numCol">{pricePerPart != null ? money.format(pricePerPart) : "—"}</span>
                                <span>{workCenterName ?? "—"}</span>
                                <span className="shareCol numCol">{trace.dominantShare != null ? `${Math.round(trace.dominantShare * 100)}%` : "—"}</span>
                                {trace.excludedReason ? (
                                  <span className="marketBasketExcludedReason" style={{ gridColumn: "span 3" }}>
                                    {trace.excludedReason === "not_solvable" ? t("row incomplete -- missing quantity, sell price, material estimate, or route hours") : null}
                                    {trace.excludedReason === "no_route_hours" ? t("no route hours entered for this row") : null}
                                    {trace.excludedReason === "below_cutoff" ? t("too mixed -- no work center reaches the cutoff") : null}
                                  </span>
                                ) : (
                                  <>
                                    <span className="numCol">{trace.totalSellEur != null && trace.materialSellEur != null ? money.format(trace.totalSellEur - trace.materialSellEur) : "—"}</span>
                                    <span className="numCol">{trace.dominantHours != null ? `${trace.dominantHours.toFixed(2)} h` : "—"}</span>
                                    <span className="numCol">{trace.impliedRate != null ? `${money.format(trace.impliedRate)}/h` : "—"}</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </section>

                  <section className="panel marketRatePanel">
                    <div className="sectionHeader wide">
                      <div>
                        <h2>{t("Asset Mapping to Profitability")}</h2>
                        <p className="sectionHelp">{t("Map every machine asset to a pricing class, then apply the card. Sellable assets receive their class EUR/h; support/internal assets receive 0 and remain recovered through the cost base. Applying also updates the currently loaded Company Profile asset sell rates; save the profile if that should persist there too. This is the number Profitability shows next to Required/Target EUR/h -- the reality check on whether the market will actually pay what the cost model says we need.")}</p>
                        <p className="sectionHelp">{t("Data flows one way:")} <strong>{t("evidence → rate card → assets → Profitability")}</strong>. {t("The buttons here only copy card rates onto assets -- they never change the card itself. If the Rate card check above is red, fix the card first (\"Apply Implied Rate to Class\" in the Backsolve section), then push the corrected card to assets here.")}</p>
                      </div>
                      <button className="primaryButton" onClick={applyMarketRateCardToProfitability}>{t("Apply Rate Card to Assets")}</button>
                    </div>
                    <div className="resourceTable marketMappingTable">
                      <div className="tableHead marketMappingHead"><span>{t("Asset")}</span><span>{t("Capacity role")}</span><span>{t("Pricing class")}</span><span>{t("Card EUR/h")}</span><span>{t("Current Profitability EUR/h")}</span><span></span></div>
                      {assumptions.machine_classes.map((machine, index) => {
                        const classId = machineMarketRateClassId(machine);
                        const entry = rates.get(classId);
                        return (
                          <div className="tableRow marketMappingRow" key={machine.id}>
                            <span>{machine.name}</span>
                            <span>{isSellableCapacityMachine(machine) ? t("Sellable") : t("Support")}</span>
                            <select value={classId} onChange={(event) => updateMachine(index, "market_rate_class_id", event.target.value)}>
                              {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                            </select>
                            <span>{money.format(entry?.rateEurPerHour ?? 0)}/h</span>
                            <span>{isSellableCapacityMachine(machine) ? `${money.format(machine.market_sell_rate_eur_per_hour ?? 0)}/h` : t("Support cost pool")}</span>
                            <button className="secondaryButton" title={t("Apply this asset's card rate only, leaving all other assets unchanged")} onClick={() => applyMarketRateToSingleAsset(machine.id)}>{t("Apply row")}</button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </>
              );
            })()}
          </section>
        ) : null}

        {activeView === "market_rates" && !assumptions ? <section className="panel"><p>{assumptionStatus}</p></section> : null}

        {activeView === "scenarios" ? (
          <section className="scenariosPage">
            <section className="panel scenarioIntro">
              <h2>{t("Scenario Comparison")}</h2>
              <p>{t("This tab answers one practical question: if the price is too high or too low, which business driver explains it? Use the waterfall to see how utilization, availability, and overhead move the price. Use sensitivity to see how strongly the price reacts when one input moves up or down.")}</p>
            </section>

            <section className="panel">
              <div className="sectionHeader wide">
                <div>
                  <h2>{t("Gap Waterfall and Sensitivity")}</h2>
                  <p className="scenarioHelpLarge">{t("Waterfall moves the quote from today's accounting view toward the target pricing view. The first two steps are business actions: fill machines with orders and reduce unplanned downtime. The overhead row is the automatic effect of spreading the same monthly overhead over more productive hours. Sensitivity shows how the target unit price reacts when one driver changes.")}</p>
                </div>
                <div className="buttonRow">
                  <button className="secondaryButton" onClick={runGapWaterfall}>{t("Run Gap Waterfall")}</button>
                  <button className="secondaryButton" onClick={runSensitivityAnalysis}>{t("Run Sensitivity Table")}</button>
                </div>
              </div>
              {diagnosticsStatus ? <p className="statusText">{diagnosticsStatus}</p> : null}

              {gapWaterfall ? (
                <div className="operationTable">
                  <div className="tableHead gapWaterfallHead"><span>{t("Step")}</span><span>{t("Unit price")}</span><span>{t("Change from previous")}</span><span>{t("Share of accounting premium")}</span></div>
                  {gapWaterfall.map((row) => (
                    <div className="tableRow gapWaterfallRow" key={row.step}>
                      <span className="gapWaterfallStep"><strong>{row.step}</strong><em>{row.detail}</em></span>
                      <span>{money.format(row.price)}</span>
                      <span>{row.deltaEur === 0 ? "-" : money.format(row.deltaEur)}</span>
                      <span>{row.deltaEur === 0 ? "-" : `${row.deltaPercent.toFixed(0)}%`}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {sensitivityTable ? (
                <div className="operationTable" style={{ marginTop: 16 }}>
                  <div className="tableHead sensitivityHead"><span>{t("Driver")}</span><span>{t("25% lower")}</span><span>{t("10% lower")}</span><span>{t("Current")}</span><span>{t("10% higher")}</span><span>{t("25% higher")}</span></div>
                  {sensitivityTable.map((row) => (
                    <div className="tableRow sensitivityRow" key={row.driver}>
                      <span>{row.driver}</span>
                      <span>{money.format(row.minus25)}</span>
                      <span>{money.format(row.minus10)}</span>
                      <span><strong>{money.format(row.base)}</strong></span>
                      <span>{money.format(row.plus10)}</span>
                      <span>{money.format(row.plus25)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="sectionHeader"><h2>{t("Competitor Price Check")}</h2></div>
              <p className="scenarioHelpLarge">{t("Enter a competitor unit price to see whether your target price has room to move. Green means your target is cheaper than the competitor. Red means your target is more expensive and needs attention.")}</p>
              <div className="fieldGrid">
                <label>
                  {t("Competitor unit price, EUR/pc")}
                  <input
                    type="number"
                    min="0"
                    value={competitorUnitPriceEur ?? ""}
                    onChange={(event) => setCompetitorUnitPriceEur(event.target.value === "" ? null : Math.max(0, numericValue(event.target.value)))}
                  />
                </label>
              </div>
              {(() => {
                const gap = competitorGapAnalysis();
                if (!gap) {
                  return <p className="sectionHelp">{t("Enter a competitor unit price after the Target quote is calculated to see whether your price is safely below the market or needs attention.")}</p>;
                }
                const targetUnitPrice = displayTargetResult?.unit_sell_price_eur ?? 0;
                const priceRoomEur = roundMoney((competitorUnitPriceEur ?? 0) - targetUnitPrice);
                const priceRoomPercent = targetUnitPrice > 0 ? roundMoney((Math.abs(priceRoomEur) / targetUnitPrice) * 100) : 0;
                const isCheaperThanCompetitor = priceRoomEur >= 0;
                return (
                  <dl className="summary competitorSummary">
                    <div className={isCheaperThanCompetitor ? "marketGood" : "marketBad"}>
                      <dt>{isCheaperThanCompetitor ? t("Your target price is below competitor") : t("Your target price is above competitor")}</dt>
                      <dd>{money.format(Math.abs(priceRoomEur))} {t("per part")} ({priceRoomPercent.toFixed(0)}%)</dd>
                    </div>
                    <div>
                      <dt>{t("Margin possible at competitor price")}</dt>
                      <dd>{gap.feasibleMargin && gap.requiredMarginPercent !== null ? `${formatPercent(gap.requiredMarginPercent)}%` : t("Competitor price is below your cost")}</dd>
                    </div>
                    <p className="competitorExplanation">{t("If you sold at the competitor price and your costs stayed unchanged, this is the gross margin you would earn. When the competitor price increases, this margin increases because the selling price is higher.")}</p>
                    <div>
                      <dt>{t("Average machine rate allowed by competitor price")}</dt>
                      <dd>{gap.feasibleRate && gap.requiredBlendedRateEurPerHour !== null ? money.format(gap.requiredBlendedRateEurPerHour) : t("Not enough price to cover machine cost")}</dd>
                    </div>
                    <p className="competitorExplanation">{t("This estimates the blended machine EUR/h that would fit inside the competitor price if machine rate were the only thing adjusted.")}</p>
                    <div>
                      <dt>{t("Shop utilization needed at competitor price")}</dt>
                      <dd>{gap.feasibleUtilization && gap.requiredAverageUtilizationPercent !== null ? `${formatPercent(gap.requiredAverageUtilizationPercent)}%` : t("Not reachable through utilization alone")}</dd>
                    </div>
                    <p className="competitorExplanation">{t("This estimates what average utilization would be needed if utilization were the only lever changed. A higher competitor price usually means the required utilization can be lower.")}</p>
                  </dl>
                );
              })()}
              {displayTargetResult && assumptions ? (
                <div className="combinedWhatIf">
                  <h3>{t("Combined what-if: move two levers at once")}</h3>
                  <p className="sectionHelp">{t("The three suggestions above each change one lever in isolation. Here you can test a realistic partial move on both: set a margin and a shop utilization, and the quote is genuinely recalculated with both applied (utilization scales every machine's target level proportionally -- an approximation for mixed shops).")}</p>
                  <div className="fieldGrid">
                    <label>
                      {t("What-if margin %")}
                      <input type="number" min="0" max="90" value={whatIfMarginPercent !== null ? formatPercent(whatIfMarginPercent) : formatPercent(assumptions.commercial_policy.default_margin_percent)} onChange={(event) => setWhatIfMarginPercent(Math.min(0.9, Math.max(0, numericValue(event.target.value, 25) / 100)))} />
                    </label>
                    <label>
                      {t("What-if average utilization %")}
                      <input type="number" min="1" max="100" value={whatIfUtilizationPercent !== null ? formatPercent(whatIfUtilizationPercent) : formatPercent(averageTargetUtilization(assumptions))} onChange={(event) => setWhatIfUtilizationPercent(Math.min(1, Math.max(0.01, numericValue(event.target.value, 95) / 100)))} />
                    </label>
                    <label>
                      &nbsp;
                      <button className="secondaryButton" onClick={runCombinedWhatIf}>{t("Recalculate with both levers")}</button>
                    </label>
                  </div>
                  {whatIfResult ? (
                    <p className={`sectionHelp ${competitorUnitPriceEur !== null && whatIfResult.unitPrice <= competitorUnitPriceEur ? "decisionGood" : ""}`}>
                      {t("At")} {formatPercent(whatIfResult.marginPercent)}% {t("margin and")} {formatPercent(whatIfResult.utilizationPercent)}% {t("utilization the unit price becomes")} <strong>{money.format(whatIfResult.unitPrice)}</strong>
                      {competitorUnitPriceEur !== null && competitorUnitPriceEur > 0
                        ? whatIfResult.unitPrice <= competitorUnitPriceEur
                          ? ` -- ${t("at or below the competitor's")} ${money.format(competitorUnitPriceEur)}.`
                          : ` -- ${t("still")} ${money.format(roundMoney(whatIfResult.unitPrice - competitorUnitPriceEur))} ${t("above the competitor's")} ${money.format(competitorUnitPriceEur)}.`
                        : "."}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </section>
        ) : null}

        {activeView === "profitability" && assumptions ? (
          <section className="casePage">
            <section className="panel caseHero">
              <h2>{t("Can We Be Profitable?")}</h2>
              <p>{t("Independent of any single quote, this page asks one question: if the shop's hours were loaded to a chosen level and sold at today's market rates, would the month end in profit or loss? It combines the monthly expense list (same one as Resources > Overhead Allocation), full payroll, machine costs, and per-asset market sell rates. The result is an")} <strong>{t("operating profit")}</strong>: {t("it is before bank interest and corporate income tax, and machine cost includes depreciation rather than loan payments -- so it answers \"does the business model work\", not \"what lands on the bank account this month\".")}</p>
            </section>

            <section className="quoteGrid">
              <div className="panel">
                <div className="sectionHeader"><h2>{t("Department Monthly Expenses")}</h2></div>
                <p className="sectionHelp">{t("Same list as Resources > Overhead Allocation. Editing here updates it there too.")}</p>
                <div className="resourceTable overheadTable">
                  <div className="tableHead"><span>{t("Expense")}</span><span>{t("Monthly EUR")}</span><span>{t("Data status")}</span><span></span></div>
                  {(assumptions.overhead?.monthly_items ?? []).map((item, index) => (
                    <div className="tableRow" key={item.id}>
                      <input value={item.name} onChange={(event) => updateOverheadItem(index, "name", event.target.value)} />
                      <input type="number" min="0" value={item.monthly_cost_eur} onChange={(event) => updateOverheadItem(index, "monthly_cost_eur", numericValue(event.target.value))} />
                      <DataStatusInput value={item.quality} onChange={(value) => updateOverheadItem(index, "quality", value)} lang={language} />
                      <button className="iconButton" onClick={() => removeOverheadItem(index)}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
                <button className="secondaryButton" style={{ marginTop: 10 }} onClick={addOverheadItem}><Plus size={16} /> {t("Add Item")}</button>
              </div>

              <div className="panel">
                <div className="sectionHeader"><h2>{t("Capacity Basis")}</h2></div>
                <p className="sectionHelp">{t("Revenue, cost, and the operating-profit bridge below are always built on today's real asset load: each asset's actual Availability and Utilization from Profile/Resources, so changing those fields updates this bridge directly. The Revenue capacity table further down also shows a Target EUR/h per station -- the same calculation run on each station's own target Utilization/Availability from Resources, for comparison only.")}</p>
                <div className="fieldGrid capacityBasisGrid">
                  <label>
                    {t("Current weighted utilization %")}
                    <input readOnly type="number" value={formatPercent(averageActualUtilization(assumptions))} />
                  </label>
                  <label>
                    {t("Margin % (from Commercial Policy)")}
                    <input readOnly value={formatPercent(assumptions.commercial_policy.default_margin_percent)} />
                  </label>
                  <label>
                    {t("Risk allowance % (from Commercial Policy)")}
                    <input readOnly value={formatPercent(assumptions.commercial_policy.risk_allowance_percent)} />
                  </label>
                  <label>
                    {t("Material margin, % of revenue")}
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={formatPercent(profitabilityMaterialMarginPercent(assumptions))}
                      onChange={(event) => updateAssumptions({
                        ...assumptions,
                        profitability_settings: { material_margin_percent_of_revenue: Math.min(0.5, Math.max(0, numericValue(event.target.value, 0) / 100)) }
                      })}
                    />
                  </label>
                </div>
                <p className="sectionHelp">{t("Hour-based revenue alone ignores the small handling markup quotes add on material and bought-out items. If that markup is real income for the shop, enter it here as a percent of revenue; leave 0 for the conservative hours-only view.")}</p>
                <label className="compareScenarioToggle">
                  <input type="checkbox" checked={profitabilityCompareScenario} onChange={(event) => setProfitabilityCompareScenario(event.target.checked)} />
                  {t("Compare against a uniform shop-wide Utilization scenario")}
                </label>
                {profitabilityCompareScenario ? (
                  <>
                    <p className="sectionHelp">{t("Ad-hoc what-if only: applies one Utilization value to every asset's target Availability, for a quick \"what if we only load to X% shop-wide\" check. It adds a Scenario EUR/h column below and never changes Actual/Target EUR/h or the revenue bridge above.")}</p>
                    <div className="fieldGrid capacityBasisGrid">
                      <label>
                        {t("Utilization scenario %")}
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={formatPercent(profitabilityScenarioUtilization)}
                          onChange={(event) => setProfitabilityScenarioUtilization(Math.max(0.01, numericValue(event.target.value, 70) / 100))}
                        />
                      </label>
                    </div>
                    <div className="scenarioButtons">
                      <button className="secondaryButton" onClick={() => setProfitabilityScenarioUtilization(averageActualUtilization(assumptions))}>{t("Use current weighted load")} ({formatPercent(averageActualUtilization(assumptions))}%)</button>
                      <button className="secondaryButton" onClick={() => setProfitabilityScenarioUtilization(1)}>{t("Use 100% (fully booked)")}</button>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            {(() => {
              const capacityMode: ProfitabilityCapacityMode = "actual_current";
              const machineDirectCostMonth = profitabilityDirectCostMonth(assumptions, capacityMode);
              const sellRateBreakdown = profitabilitySellRateBreakdown(
                assumptions,
                assumptions.commercial_policy.default_margin_percent,
                assumptions.commercial_policy.risk_allowance_percent,
                capacityMode
              );
              const targetSellRateBreakdown = profitabilitySellRateBreakdown(
                assumptions,
                assumptions.commercial_policy.default_margin_percent,
                assumptions.commercial_policy.risk_allowance_percent,
                "target_capacity"
              );
              const compareScenarioSellRateBreakdown = profitabilityCompareScenario
                ? profitabilitySellRateBreakdown(
                  assumptions,
                  assumptions.commercial_policy.default_margin_percent,
                  assumptions.commercial_policy.risk_allowance_percent,
                  "scenario",
                  profitabilityScenarioUtilization
                )
                : undefined;
              const directPayroll = sellRateBreakdown.directPayroll;
              const overheadMonth = sellRateBreakdown.overheadMonth;
              const targetHoursMonth = sellRateBreakdown.targetHours;
              const productiveHoursMonth = profitabilityProductiveHoursMonth(assumptions, capacityMode);
              const scenarioSoldHours = profitabilitySoldHoursMonth(assumptions, capacityMode);
              const revenueRows = profitabilityRevenueBreakdownRows(
                assumptions,
                sellRateBreakdown,
                targetSellRateBreakdown,
                assumptions.commercial_policy.default_margin_percent,
                assumptions.commercial_policy.risk_allowance_percent,
                capacityMode,
                compareScenarioSellRateBreakdown
              );
              const revenueMonth = revenueRows.reduce((sum, row) => sum + row.revenue, 0);
              const requiredRevenueMonth = revenueRows.reduce((sum, row) => sum + row.scenarioHours * row.requiredSellRate, 0);
              const targetRevenueMonth = revenueRows.reduce((sum, row) => sum + row.scenarioHours * row.targetSellRate, 0);
              const pricedSoldHours = revenueRows.reduce((sum, row) => sum + (row.hasMarketSellRate ? row.scenarioHours : 0), 0);
              const pricedRowCount = revenueRows.filter((row) => row.hasMarketSellRate).length;
              const missingSellRateCount = revenueRows.length - pricedRowCount;
              const hasCompleteSellRates = revenueRows.length > 0 && missingSellRateCount === 0;
              const weightedAverageSellRate = revenueMonth / Math.max(1, pricedSoldHours);
              const weightedAverageRequiredRate = requiredRevenueMonth / Math.max(1, scenarioSoldHours);
              const weightedAverageTargetRate = targetRevenueMonth / Math.max(1, scenarioSoldHours);
              const compareScenarioRevenueMonth = profitabilityCompareScenario
                ? revenueRows.reduce((sum, row) => sum + row.scenarioHours * (row.compareScenarioSellRate ?? 0), 0)
                : 0;
              const weightedAverageCompareScenarioRate = compareScenarioRevenueMonth / Math.max(1, scenarioSoldHours);
              const materialMarginMonth = revenueMonth * profitabilityMaterialMarginPercent(assumptions);
              const operatingProfitMonth = revenueMonth + materialMarginMonth - machineDirectCostMonth - directPayroll - overheadMonth;
              const breakEvenUtilization = hasCompleteSellRates ? profitabilityBreakEvenUtilization(assumptions) : null;
              const breakEvenLabel = missingSellRateCount > 0
                ? "Enter market sell EUR/h for every sellable asset before treating this as a profitability answer."
                : breakEvenUtilization === null
                  ? "None: the market sell rate does not cover variable cost at any Utilization."
                  : `${formatPercent(Math.max(0, Math.min(1, breakEvenUtilization)))}% ${breakEvenUtilization > 1 ? "(above 100% -- this shop cannot break even even fully booked at today's cost structure)" : ""}`;
              const doubleCountWarnings = payrollDoubleCountWarnings(assumptions);
              const sensitivityUtilizations = [0.5, 0.65, 0.8, 0.85, 0.95, 1];
              return (
                <section className="panel backbonePanel">
                  <div className="sectionHeader"><h2>{t("Monthly Operating Profit Bridge")}</h2></div>
                  <p className="sectionHelp">{t("Reads left to right: what the market would pay for the loaded hours, minus machine costs, minus payroll, minus overhead -- what remains is the month's operating result. Revenue is built station by station from explicit market sell rates; the cost-derived rate is shown only as the required cost-plus floor, never counted as revenue. QC/support assets do not sell hours; their cost is recovered through the sellable stations. \"Operating\" means before bank interest and income tax.")}</p>
                  {doubleCountWarnings.map((warning) => (
                    <p className="profitabilityWarning" key={warning}>{warning}</p>
                  ))}
                  <dl className="summary profitabilityInputs">
                    <div><dt>{t("Current productive hours/mo")}</dt><dd>{Math.round(productiveHoursMonth)} h</dd></div>
                    <div><dt>{t("Current sold hours/mo")}</dt><dd>{Math.round(scenarioSoldHours)} h</dd></div>
                    <div><dt>{t("Actual cost-plus avg (weighted)")}</dt><dd>{money.format(weightedAverageRequiredRate)}/h</dd></div>
                    <div><dt>{t("Market sell-rate coverage")}</dt><dd>{pricedRowCount}/{revenueRows.length} {t("assets")}</dd></div>
                    <div><dt>{t("Weighted market sell rate")}</dt><dd>{pricedSoldHours > 0 ? `${money.format(weightedAverageSellRate)}/h` : t("Not set")}</dd></div>
                    <div><dt>{t("Direct payroll/mo")}</dt><dd>{money.format(directPayroll)}</dd></div>
                  </dl>
                  <div className="profitFormulaGrid">
                    <div><span>{t("1. Sellable machine average")}</span><strong>{money.format(sellRateBreakdown.sellableMachineRate)}/h</strong><em>{t("Only sellable assets: fixed + running cost / sellable basis hours")}</em></div>
                    <div><span>{t("2. Support asset recovery")}</span><strong>{money.format(sellRateBreakdown.supportMachineRate)}/h</strong><em>{money.format(sellRateBreakdown.supportMachineCostMonth)} {t("support machine cost")} / {Math.round(targetHoursMonth)} {t("sellable basis h")}</em></div>
                    <div><span>{t("3. Assigned payroll avg")}</span><strong>{money.format(sellRateBreakdown.assignedPayrollRate)}/h</strong><em>{money.format(sellRateBreakdown.assignedPayrollMonth)} {t("assigned to sellable station payroll roles")}</em></div>
                    <div><span>{t("4. Overhead recovery")}</span><strong>{money.format(sellRateBreakdown.overheadRate)}/h</strong><em>{money.format(sellRateBreakdown.overheadMonth)} / {Math.round(targetHoursMonth)} {t("sellable basis h")}</em></div>
                    <div><span>{t("5. Shared recovery layer")}</span><strong>{money.format(sellRateBreakdown.sharedAllocatedRate)}/h</strong><em>{t("support assets + support/unassigned payroll + overhead (engineering/CAM payroll excluded -- recovered via the quote's NRE line) -- shop average; allocated per station in proportion to its machine + payroll EUR/h, see table below")}</em></div>
                    <div><span>{t("6. Required cost-plus uplift")}</span><strong>{formatPercent(assumptions.commercial_policy.risk_allowance_percent)}% {t("risk")}, {formatPercent(assumptions.commercial_policy.default_margin_percent)}% {t("margin")}</strong><em>{t("Diagnostic floor only; revenue uses explicit market sell rates")}</em></div>
                  </div>
                  {missingSellRateCount > 0 ? (
                    <p className="profitabilityWarning">{t("Revenue capacity is incomplete:")} {missingSellRateCount} {missingSellRateCount === 1 ? t("sellable asset has") : t("sellable assets have")} {t("no market sell EUR/h. The required cost-plus rate is a floor, not proof that customers will pay it.")}</p>
                  ) : null}
                  <div className="breakEvenCallout">
                    <span>{t("Break-even Utilization")}</span>
                    <strong>{breakEvenLabel}</strong>
                    <p>{t("This assumes load is spread evenly across all stations. A real order book fills one bottleneck machine first while others wait, so the achievable shop-wide average is usually lower than this number suggests.")}</p>
                  </div>
                  <div className="profitabilityTableBlock">
                    <h3>{t("Revenue capacity build-up")}</h3>
                    <p className="sectionHelp">{t("This table is the first bridge column as a sum of sellable-capacity asset rows only. Actual EUR/h is today's cost-plus floor: machine cost, assigned payroll, shared recovery, risk, and margin at each asset's actual Availability/Utilization -- it can run high while a station sits under-loaded. Target EUR/h is the same formula at each asset's own target Availability/Utilization from Resources -- the floor once that station reaches its designed load, and the number to compare against Market. Shared recovery/h is allocated in proportion to each station's own machine EUR/h + payroll EUR/h, so an expensive CNC hour carries more of the shared pool than a cheap manual bench hour; the pool total recovered is unchanged. Market sell EUR/h is the explicit rate used for revenue.")}</p>
                    <div className={`diagnosticTable profitabilityRevenueTable ${profitabilityCompareScenario ? "hasCompareScenario" : ""}`}>
                      <div className="tableHead profitabilityRevenueHead"><span>{t("Asset")}</span><span>{t("Actual h/mo")}</span><span>{t("Machine EUR/h")}</span><span>{t("Payroll EUR/h")}</span><span>{t("Shared recovery/h")}</span><span>{t("Base EUR/h")}</span><span>{t("Actual EUR/h")}</span><span>{t("Target EUR/h")}</span>{profitabilityCompareScenario ? <span>{t("Scenario EUR/h")}</span> : null}<span>{t("Market sell EUR/h")}</span><span>{t("Revenue/mo")}</span></div>
                      {revenueRows.map((row) => {
                        const marketRateClass = !row.hasMarketSellRate
                          ? "rateMissing"
                          : row.marketSellRate >= row.targetSellRate
                            ? "rateGood"
                            : row.marketSellRate < row.baseRate
                              ? "rateBad"
                              : "rateWarning";
                        const marketRateTitle = !row.hasMarketSellRate
                          ? t("No market sell rate set.")
                          : row.marketSellRate >= row.targetSellRate
                            ? t("Market rate meets or exceeds the required rate at target Utilization/Availability.")
                            : row.marketSellRate < row.baseRate
                              ? t("Market rate is below base cost recovery before risk and margin.")
                              : t("Market rate covers base cost but misses the required risk and margin target once the station reaches its target Utilization/Availability.");
                        return (
                        <div className="tableRow profitabilityRevenueRow" key={row.id}>
                          <span>{row.name}</span>
                          <span>{Math.round(row.scenarioHours)} h</span>
                          <span>{money.format(row.ownMachineRate)}/h</span>
                          <span>{money.format(row.assignedPayrollRate)}/h</span>
                          <span>{money.format(row.sharedAllocatedRate)}/h</span>
                          <span>{money.format(row.baseRate)}/h</span>
                          <span>{money.format(row.requiredSellRate)}/h</span>
                          <span>{money.format(row.targetSellRate)}/h</span>
                          {profitabilityCompareScenario ? <span>{row.compareScenarioSellRate !== null ? `${money.format(row.compareScenarioSellRate)}/h` : "--"}</span> : null}
                          <span className={marketRateClass} title={marketRateTitle}>{row.hasMarketSellRate ? `${money.format(row.marketSellRate)}/h` : t("Not set")}</span>
                          <span>{row.hasMarketSellRate ? money.format(row.revenue) : "--"}</span>
                        </div>
                        );
                      })}
                      <div className="tableRow profitabilityRevenueRow profitabilityTotalRow">
                        <span title={t("Rate columns below are hour-weighted averages across sellable stations.")}>{hasCompleteSellRates ? t("Total (hour-weighted avg)") : t("Known priced revenue (hour-weighted avg)")}</span>
                        <span>{Math.round(scenarioSoldHours)} h</span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span title={t("Hour-weighted average across sellable stations.")}>{money.format(weightedAverageRequiredRate)}/h</span>
                        <span title={t("Hour-weighted average across sellable stations.")}>{money.format(weightedAverageTargetRate)}/h</span>
                        {profitabilityCompareScenario ? <span title={t("Hour-weighted average across sellable stations.")}>{money.format(weightedAverageCompareScenarioRate)}/h</span> : null}
                        <span title={t("Hour-weighted average across sellable stations.")}>{hasCompleteSellRates ? `${money.format(weightedAverageSellRate)}/h` : `${pricedRowCount}/${revenueRows.length} ${t("set")}`}</span>
                        <span>{hasCompleteSellRates ? money.format(revenueMonth) : `${money.format(revenueMonth)} ${t("known")}`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="profitabilityTableBlock">
                    <h3>{t("Sellable station pricing basis")}</h3>
                    <p className="sectionHelp">{t("Variable running cost/mo means the asset cost that rises when it runs: power, compressed air, coolant, routine wear items, and similar per-hour machine costs. Own direct EUR/h is each station's fixed plus running cost divided by its target hours. This is the part that makes manual and CNC stations price differently.")}</p>
                    <div className="diagnosticTable profitabilityMachineTable">
                      <div className="tableHead profitabilityMachineHead"><span>{t("Asset")}</span><span>{t("Role")}</span><span>{t("Basis h/mo")}</span><span>{t("Fixed/mo")}</span><span>{t("Variable run cost/mo")}</span><span>{t("Own direct EUR/h")}</span><span>{t("Cost share")}</span></div>
                      {sellRateBreakdown.sellableRows.map((row) => (
                        <div className="tableRow profitabilityMachineRow" key={row.id}>
                          <span>{row.name}</span>
                          <span>{t("Sellable")}</span>
                          <span>{Math.round(row.targetHours)} h</span>
                          <span>{money.format(row.fixedCostMonth)}</span>
                          <span>{money.format(row.variableCostMonth)}</span>
                          <span>{money.format(row.directRate)}/h</span>
                          <span>{formatPercent(row.costShare)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {sellRateBreakdown.supportRows.length > 0 ? (
                    <div className="profitabilityTableBlock">
                      <h3>{t("Support/internal asset cost pool")}</h3>
                      <p className="sectionHelp">{t("These assets are necessary for production control or internal flow but do not sell hours by themselves. They stay out of revenue capacity and are recovered as")} {money.format(sellRateBreakdown.supportMachineRate)}/h {t("machine support plus")} {money.format(sellRateBreakdown.supportPayrollRate + sellRateBreakdown.unassignedPayrollRate)}/h {t("support or unassigned payroll across sellable basis hours.")}</p>
                      <div className="diagnosticTable profitabilityMachineTable supportCostTable">
                        <div className="tableHead profitabilityMachineHead"><span>{t("Asset")}</span><span>{t("Role")}</span><span>{t("Basis h/mo")}</span><span>{t("Fixed/mo")}</span><span>{t("Variable run cost/mo")}</span><span>{t("Own direct EUR/h")}</span><span>{t("Cost share")}</span></div>
                        {sellRateBreakdown.supportRows.map((row) => (
                          <div className="tableRow profitabilityMachineRow" key={row.id}>
                            <span>{row.name}</span>
                            <span>{t("Support")}</span>
                            <span>{Math.round(row.targetHours)} h</span>
                            <span>{money.format(row.fixedCostMonth)}</span>
                            <span>{money.format(row.variableCostMonth)}</span>
                            <span>{money.format(row.directRate)}/h</span>
                            <span>{formatPercent(row.costShare)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {hasCompleteSellRates ? (
                    <div className="profitabilityTableBlock">
                      <h3>{t("What the result looks like at other load levels")}</h3>
                      <p className="sectionHelp">{t("The same revenue and cost rules at fixed Utilization levels, so one scenario number is never mistaken for the whole picture. Cost-accounting practice treats roughly 80-85% as a realistic \"normally busy\" level for planning; 95-100% is a near-perfect order book.")}</p>
                      <div className="diagnosticTable">
                        <div className="tableHead sensitivityHead"><span>{t("Shop Utilization")}</span><span>{t("Operating result / month")}</span></div>
                        {sensitivityUtilizations.map((utilization) => {
                          const profitAt = profitabilityOperatingProfitAtUtilization(assumptions, utilization);
                          return (
                            <div className="tableRow sensitivityRow" key={utilization}>
                              <span>{formatPercent(utilization)}%{Math.abs(utilization - averageActualUtilization(assumptions)) < 0.005 ? ` ${t("(current actual avg)")}` : ""}</span>
                              <span className={profitAt >= 0 ? "decisionGood" : "decisionBad"}>{money.format(profitAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <ProfitBridgeChart
                    revenue={revenueMonth + materialMarginMonth}
                    machineDirectCost={machineDirectCostMonth}
                    directPayroll={directPayroll}
                    overhead={overheadMonth}
                    operatingProfit={operatingProfitMonth}
                    revenueLabel={hasCompleteSellRates ? (materialMarginMonth > 0 ? t("Market revenue + material margin") : t("Market revenue capacity")) : t("Known priced revenue")}
                    resultLabel={hasCompleteSellRates ? undefined : t("Incomplete result")}
                    lang={language}
                  />
                </section>
              );
            })()}
          </section>
        ) : null}

        {activeView === "methods" ? (
          <section className="casePage">
            <section className="panel caseHero">
              <h2>{t("How Can a Product's Cost Be Calculated? More Than One Honest Answer")}</h2>
              <p>{t("There is no single \"correct\" production cost. Accounting practice knows several established methods, and each answers a different business question. Asking \"what must we charge to survive long-term?\" gives one number; \"should we accept this cheap order while machines sit idle?\" gives another; \"which order earns the most on our busiest machine?\" gives a third. All three answers can be right at the same time. A price decision goes wrong when a number built for one question is used to answer a different one.")}</p>
              <p><strong>{t("What this tool uses:")}</strong> {t("the Quote page is")} <em>{t("full costing with machine-hour rates at normal capacity")}</em> {t("(the standard method in European metalworking, and the logic behind IAS 2 inventory rules), and the Profitability page is a classic")} <em>{t("cost-volume-profit")}</em> {t("check on top of it. The other methods below are not implemented as separate calculators, but knowing them explains what the numbers can and cannot say.")}</p>
            </section>

            <section className="panel guideReferenceGrid">
              <h2>{t("The Methods")}</h2>
              <div className="guideGrid">
                <article className="guideCard">
                  <strong>{t("Full costing at normal capacity — used by this tool")}</strong>
                  <p><em>{t("What it is:")}</em> {t("every machine gets an hourly rate that covers its purchase, upkeep, energy, and a fair share of overhead, spread over the hours a normally busy shop would sell. A product's cost is material plus the hours it consumes at those rates. In German-speaking metalworking this is the standard \"machine hour rate\" method.")}</p>
                  <p><em>{t("Good at:")}</em> {t("long-run pricing floors, explaining exactly where a price comes from, proving whether overhead is covered. Every euro of monthly cost lands somewhere, so nothing is silently lost.")}</p>
                  <p><em>{t("Best when:")}</em> {t("quoting external work that must sustain the whole company over time — which is exactly this project's situation. Weak spot: the \"normally busy\" assumption is a choice, and picking it too optimistic under-recovers cost, too pessimistic prices the shop out of the market (the death spiral on the Case page).")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Contribution (variable) costing")}</strong>
                  <p><em>{t("What it is:")}</em> {t("only the costs that truly appear because an order runs — material, energy, tooling, outsourced work — count as the order's cost. Everything fixed (rent, salaries, depreciation) sits in one pool that all orders together must cover. The difference between price and variable cost is the order's \"contribution\".")}</p>
                  <p><em>{t("Good at:")}</em> {t("deciding whether to accept a low-priced order when machines are idle: any price above variable cost contributes something toward the fixed pool, which beats an idle machine contributing nothing.")}</p>
                  <p><em>{t("Best when:")}</em> {t("capacity is empty and the choice is \"this order or nothing\". Dangerous as a general pricing habit — if every order is priced near variable cost, the fixed pool is never covered and the year ends in loss.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Time-Driven Activity-Based Costing (TDABC)")}</strong>
                  <p><em>{t("What it is:")}</em> {t("a refinement of full costing: measure what one hour of each resource costs to supply, and how many minutes of each resource a product really uses, using a realistic (\"practical\") capacity of roughly 80-85% of theoretical. Kaplan's modern replacement for older, heavier ABC systems.")}</p>
                  <p><em>{t("Good at:")}</em> {t("exposing which products quietly eat disproportionate setup, inspection, or admin effort; being honest about idle capacity by pricing off achievable hours instead of the calendar.")}</p>
                  <p><em>{t("Best when:")}</em> {t("product mix is varied and small-batch work hides behind averages. This tool's rate math is essentially TDABC in structure — the main debate is only which capacity percentage to call \"normal\".")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Throughput accounting (bottleneck thinking)")}</strong>
                  <p><em>{t("What it is:")}</em> {t("in the short run, only material is treated as the product's cost; everything else is a fixed monthly expense. What matters is throughput (price minus material)")} <em>{t("per hour of the bottleneck machine")}</em> {t("— the one station that limits the whole shop.")}</p>
                  <p><em>{t("Good at:")}</em> {t("ranking orders when the shop is nearly full: two orders with the same margin percent can differ several times over in how much profit they generate per bottleneck hour.")}</p>
                  <p><em>{t("Best when:")}</em> {t("demand exceeds capacity and one machine visibly constrains everything. Less useful for a shop whose problem is an empty order book — there, contribution thinking applies first.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Target costing (market-back)")}</strong>
                  <p><em>{t("What it is:")}</em> {t("the reverse direction. Start from the price the market will actually pay, subtract the profit the company needs, and what remains is the")} <em>{t("allowable cost")}</em>{t(". Then work on the product and process until real cost fits inside it.")}</p>
                  <p><em>{t("Good at:")}</em> {t("forcing honesty when the market, not the shop, sets the price — which is the reality for most subcontract machining. It converts \"our price is too high\" into a concrete cost-reduction target.")}</p>
                  <p><em>{t("Best when:")}</em> {t("competitor prices are known. The Market Rates and Scenarios pages are this method's first half: they measure what the market pays per hour and show the gap to the cost-plus floor.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Standard costing with variance follow-up")}</strong>
                  <p><em>{t("What it is:")}</em> {t("set a planned (\"standard\") time and cost for each operation, then systematically compare actual results against the plan and investigate the differences instead of quietly absorbing them.")}</p>
                  <p><em>{t("Good at:")}</em> {t("keeping estimates honest over time. A quote model is only as good as its cycle times; without a feedback loop the same optimistic minutes get quoted forever.")}</p>
                  <p><em>{t("Best when:")}</em> {t("parts repeat and actuals can be captured. The Actuals Feedback / calibration loop on the Quote page is a lightweight version of this method.")}</p>
                </article>
              </div>
            </section>

            <section className="panel caseHero">
              <h2>{t("The Three Numbers Every Quote Decision Needs")}</h2>
              <p>{t("The methods above collapse into three practical reference points for any order.")} <strong>{t("1) The cash floor")}</strong> {t("(contribution view): below the variable cost of running the order, the company pays to work — never quote below it knowingly.")} <strong>{t("2) The survival floor")}</strong> {t("(full-cost view): the price at a normally busy load that covers machines, people, overhead, and margin — the Target price on the Quote page.")} <strong>{t("3) The market price")}</strong> {t("(target-costing view): what customers actually pay — the Market Rates evidence. A healthy business quotes near number 3, keeps it above number 2 on average, and drops to the space between 1 and 2 only deliberately, to fill idle hours, never as a habit.")}</p>
            </section>
          </section>
        ) : null}

        {activeView === "business_case" ? (
          <section className="casePage">
            <section className="panel caseHero">
              <h2>{t("How To Use This Tool")}</h2>
              <p>{t("This project is a simulator for the common unknowns in manufacturing: what a product costs, what price covers the chosen margin and risk, whether that price looks realistic against the market, what market sell EUR/h should be used for stations, and whether the business can be profitable under those rates.")}</p>
              <p>{t("It is not meant to be a monthly bookkeeping report. Real revenue and invoices are evidence for calibration, but the Profitability page is mainly for testing profit/loss conditions under chosen market rates, cost structure, and capacity assumptions.")}</p>
            </section>

            <section className="caseSignals">
              <div>
                <span className="scenarioLabel">{t("Target quote")}</span>
                <strong>{displayTargetResult ? money.format(displayTargetResult.sell_price_eur) : "..."}</strong>
                <span className="scenarioHint">{t("Cost-side price using the target planning assumptions.")}</span>
              </div>
              <div>
                <span className="scenarioLabel">{t("Accounting quote")}</span>
                <strong>{displayAccountingResult ? money.format(displayAccountingResult.sell_price_eur) : "..."}</strong>
                <span className="scenarioHint">{t("Price if current actual capacity load is charged to the order.")}</span>
              </div>
              <div>
                <span className="scenarioLabel">{t("Accounting premium")}</span>
                <strong>{displayAccountingResult && displayTargetResult ? money.format(priceGap) : "..."}</strong>
                <span className="scenarioHint">{t("Signal that utilization, availability, overhead, or route assumptions need attention.")}</span>
              </div>
              <div>
                <span className="scenarioLabel">{t("Missing tool exposure")}</span>
                <strong>{money.format(totalMissingToolCost)}</strong>
                <span className="scenarioHint">{t("Tool purchases that must be charged, amortized, or explicitly excluded.")}</span>
              </div>
            </section>

            <section className="panel backbonePanel">
              <h2>{t("Working Flow")}</h2>
              <div className="caseFlowSteps">
                <div><strong>{t("1. Build the profile")}</strong><span>{t("Enter assets, direct labor, overhead, material scope, tool scope, and operation scope. Resources is only trustworthy when this data is complete enough for the simulation.")}</span></div>
                <div><strong>{t("2. Price the quote")}</strong><span>{t("Quote Builder turns material, CAM, route time, tooling, consumables, risk, and margin into production cost and target sell price.")}</span></div>
                <div><strong>{t("3. Check market pressure")}</strong><span>{t("Scenarios compares the target price with competitor or customer evidence. Batch size must match the comparison because unit price changes with setup and programming spread.")}</span></div>
                <div><strong>{t("4. Backsolve market rates")}</strong><span>{t("Market Rates uses real accepted, lost, or competitor prices. Remove material, bought-out, and fixed charges, then allocate the remaining conversion revenue across route hours.")}</span></div>
                <div><strong>{t("5. Simulate profitability")}</strong><span>{t("Profitability uses explicit market sell EUR/h, direct machine cost, direct payroll, and overhead to test whether the company can make money at those market conditions.")}</span></div>
                <div><strong>{t("6. Decide what to fix")}</strong><span>{t("If the result is weak, act on the driver: price negotiation, route time measurement, utilization improvement, overhead reduction, asset role changes, material buying, or tooling policy.")}</span></div>
              </div>
            </section>

            <section className="panel diagnosticPanel">
              <h2>{t("Rules That Keep The Result Honest")}</h2>
              <div className="diagnosticTable">
                <div className="diagnosticHead"><span>{t("Rule")}</span><span>{t("Meaning")}</span><span>{t("Where It Applies")}</span></div>
                <div><span>{t("Production cost is not market price")}</span><span>{t("Cost-plus tells the minimum required price for the chosen margin. It does not prove customers will pay it.")}</span><span>{t("Quote Builder, Scenarios")}</span></div>
                <div><span>{t("Competitor evidence needs same batch logic")}</span><span>{t("A price for 5 pieces cannot calibrate a 100-piece batch without normalizing setup, CAM, and fixed charges.")}</span><span>{t("Scenarios, Market Rates")}</span></div>
                <div><span>{t("Market EUR/h comes from many quotes")}</span><span>{t("One quote can anchor a class, but the credible rate card should come from repeated evidence, starting with simple routes.")}</span><span>{t("Market Rates")}</span></div>
                <div><span>{t("Route hours are work-center occupancy")}</span><span>{t("Do not double-count machine and labor hours for the same operation unless they occupy separate sellable work centers.")}</span><span>{t("Market Rates")}</span></div>
                <div><span>{t("Assemblies need component discipline")}</span><span>{t("For a welded assembly, cost the component operations and the final welding/assembly route, then backsolve the sold assembly price across the route that created it.")}</span><span>{t("Quote Builder, Market Rates")}</span></div>
                <div><span>{t("Profitability is a simulation trigger")}</span><span>{t("The page should show whether the chosen cost structure and market sell rates can work, then point management to the driver that must change.")}</span><span>{t("Profitability")}</span></div>
              </div>
            </section>

            <section className="panel backbonePanel">
              <h2>{t("Page Map")}</h2>
              <div className="casePageMap">
                <div><strong>{t("Profile")}</strong><span>{t("Company structure: assets, people, overhead, operation scope, material scope, tool scope.")}</span></div>
                <div><strong>{t("Resources")}</strong><span>{t("Detailed editable assumptions created from the profile: rates, materials, tools, overhead allocation, operation templates.")}</span></div>
                <div><strong>{t("Quote Builder")}</strong><span>{t("One product or assembly quote: cost, target price, route, quantity breaks, and offer payload.")}</span></div>
                <div><strong>{t("Scenarios")}</strong><span>{t("Why price moves: utilization, availability, overhead policy, margin, material, cycle time, competitor check.")}</span></div>
                <div><strong>{t("Market Rates")}</strong><span>{t("Evidence-based conversion-rate card used to populate market sell EUR/h by station class.")}</span></div>
                <div><strong>{t("Profitability")}</strong><span>{t("Profit/loss simulation under explicit market sell rates, current actual capacity, or a target-capacity scenario.")}</span></div>
                <div><strong>{t("Methods")}</strong><span>{t("Plain-language reference: the costing method this tool uses and the recognized alternatives, with when each one is the right lens.")}</span></div>
              </div>
            </section>
          </section>
        ) : null}

        {activeView === "guide" ? (
          <section className="guidePage costGuide">
            <section className="panel guideIntro">
              <h2>{t("Production Cost Calculation Backbone")}</h2>
              <p className="sectionHelp">{t("This is the principle behind the whole tool. A sell price is not a single number guessed at the end. It is a chain of cost drivers, and each driver can push the offer above the market.")}</p>
              <div className="costBackboneFlow" aria-label={t("Production cost backbone")}>
                <div><strong>{t("1. Material starts from stock")}</strong><span>{t("Use the piece the company must buy or take from stock. Do not quote only the theoretical net part material.")}</span></div>
                <div><strong>{t("2. Engineering prepares production")}</strong><span>{t("New parts need CAM, programming, setup planning, and prove-out. Repeat parts reuse part of this work.")}</span></div>
                <div><strong>{t("3. Route consumes capacity")}</strong><span>{t("Each operation uses setup minutes, cycle minutes, machine rate, labor rate, consumables, tooling, scrap, and QC.")}</span></div>
                <div><strong>{t("4. Commercial policy converts cost to price")}</strong><span>{t("Risk, admin cost, and margin are added only after the production cost is visible.")}</span></div>
              </div>
            </section>

            <section className="panel oeeGuide">
              <h2>{t("OEE vs. Utilization — Two Different Gauges")}</h2>
              <p><strong>{t("OEE")}</strong> {t("is the share of scheduled machine time that becomes good productive output — availability, performance, and quality")} <em>{t("while the machine has work loaded")}</em>. <strong>{t("Utilization")}</strong> {t("is a separate question: how much of the available planned time actually gets loaded with orders in the first place. A machine can run beautifully (high OEE) and still sit idle most of the month (low Utilization) because there is not enough demand.")}</p>
              <p>{t("Availability and Utilization are editable company inputs, not fixed constants. Actual values describe the current business; target values describe the planning scenario management wants to test. Idleness (")}<code>1 - Utilization</code>{t(") is the empty-order gap, and it is tracked separately from OEE throughout this tool. Only Availability (not full OEE) feeds the rate formula below — performance losses already live in cycle/setup minutes and quality losses in the scrap allowance, so folding OEE in here would double-charge both.")}</p>
              <div className="oeeExampleGrid">
                <div><span>{t("Fixed monthly machine cost")}</span><strong>8,000 EUR</strong></div>
                <div><span>{t("Planned monthly hours")}</span><strong>160 h</strong></div>
                <div><span>{t("Target scenario")}</span><strong>{t("planned hours x target availability x target utilization")}</strong></div>
                <div><span>{t("Actual scenario")}</span><strong>{t("planned hours x actual availability x actual utilization")}</strong></div>
              </div>
              <p>{t("The exact percentages should come from the Company Profile or Resources page. If actual utilization is much lower than target utilization, fixed cost is spread over fewer productive hours and the accounting hourly rate rises. That is why the Case page treats utilization as a business/load assumption, not only a machine performance number.")}</p>
            </section>

            <section className="panel guideCompare">
              <h2>{t("Target Capacity Is A Planning Input")}</h2>
              <p>{t("The Target scenario uses the target availability and target utilization entered for each asset in the Company Profile or Resources. These values are not universal defaults; they are management assumptions about what a healthier, better-loaded shop could realistically achieve. The goal is to compare today's accounting view with a chosen planning scenario, not to force every company into one fixed availability or utilization number.")}</p>
              <div className="compareColumns">
                <div>
                  <h3>{t("Target Price")}</h3>
                  <p>{t("Uses target machine rates from Profile/Resources: target availability, target utilization, and optional target discount. They answer: what price level do we need under the planning scenario management chose?")}</p>
                </div>
                <div>
                  <h3>{t("Accounting Price")}</h3>
                  <p>{t("Uses current full-cost machine rates: actual availability and actual utilization. They answer: what price do we get if today's real capacity load is charged to this one order?")}</p>
                </div>
                <div>
                  <h3>{t("Accounting Premium")}</h3>
                  <p>{t("The difference between the two. A high premium is a management signal: either improve order load, adjust the target assumptions, change overhead allocation, correct route assumptions, or accept that the market cannot pay today's cost structure.")}</p>
                </div>
              </div>
            </section>

            <section className="panel highPriceGuide">
              <h2>{t("Typical Reasons A Quote Becomes Too High")}</h2>
              <div className="reasonList">
                <div><strong>{t("Low Utilization")}</strong><span>{t("Fixed machine cost is spread over too few productive hours because there is not enough order load, not because the machine performs poorly.")}</span></div>
                <div><strong>{t("Overhead ignored")}</strong><span>{t("Admin, sales, quality, and facility costs are missing from the cost formula, understating true cost.")}</span></div>
                <div><strong>{t("Wrong route time")}</strong><span>{t("Setup or cycle assumptions are too conservative, outdated, or not measured.")}</span></div>
                <div><strong>{t("Small batch")}</strong><span>{t("Setup and CAM do not amortize across enough parts.")}</span></div>
                <div><strong>{t("New part engineering")}</strong><span>{t("CAM and prove-out are real labor costs before production starts.")}</span></div>
                <div><strong>{t("Missing tools")}</strong><span>{t("Buying a cutter, tap, fixture, or gauge for one order must be charged or approved.")}</span></div>
                <div><strong>{t("Material reality")}</strong><span>{t("The company buys sellable stock pieces and may create unusable cutoffs.")}</span></div>
                <div><strong>{t("Quality requirements")}</strong><span>{t("Tight tolerance, reports, and FAI add inspection time and risk.")}</span></div>
                <div><strong>{t("Unclear data quality")}</strong><span>{t("When assumptions are guesses, the company adds risk or overprices to protect itself.")}</span></div>
              </div>
            </section>

            <section className="panel guideReferenceGrid">
              <h2>{t("Resources Reference")}</h2>
              <div className="guideGrid">
                <article className="guideCard">
                  <strong>{t("Commercial Policy")}</strong>
                  <p>{t("Margin is gross margin on sell price, not markup on cost, and it applies to the shop's own work only. Material and bought-out items are re-sold with a smaller handling markup instead of the full margin. Risk allowance is added to own work before margin. Minimum admin cost protects small orders from ignoring quotation and document work.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("CAM Defaults")}</strong>
                  <p>{t("New parts carry programming and prove-out. Repeat parts reuse part of that effort. These minutes are starter assumptions and should be replaced with measured history.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Machine Rates")}</strong>
                  <p>{t("Accounting EUR/h uses actual Availability and actual Utilization. Target EUR/h uses target Availability and target Utilization. OEE stays diagnostic and does not directly scale the rate.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Overhead Allocation")}</strong>
                  <p>{t("Admin, sales, quality, and facility cost is entered as one monthly total, spread over the shop's planned productive hours, and folded into every machine's EUR/h -- so each quoted hour carries its share of running the company.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Tool Inventory")}</strong>
                  <p>{t("Required tools are matched against inventory with an editable tolerance. Missing tools can be charged, amortized, or explicitly left out with management approval.")}</p>
                </article>
                <article className="guideCard">
                  <strong>{t("Full JSON")}</strong>
                  <p>{t("The JSON editor exposes every assumption, including fields without structured inputs. Invalid structure can break calculations or selectors, so use it deliberately.")}</p>
                </article>
              </div>
            </section>

            <section className="panel guideMap">
              <h2>{t("Where To Look In The Tool")}</h2>
              <div className="diagnosticTable">
                <div className="diagnosticHead"><span>{t("Question")}</span><span>{t("Relevant Area")}</span><span>{t("What To Check")}</span></div>
                <div><span>{t("Why is the price high?")}</span><span>{t("Quote Summary and Scenarios")}</span><span>{t("Target vs accounting price, accounting premium, unit price by quantity.")}</span></div>
                <div><span>{t("Is the machine rate believable?")}</span><span>{t("Resources, Machine Rate Calculator")}</span><span>{t("Fixed monthly cost, planned hours, actual/target Availability, actual/target Utilization, Idleness, variable EUR/h, Accounting EUR/h, Target EUR/h, and Target + labour EUR/h.")}</span></div>
                <div><span>{t("Is overhead counted?")}</span><span>{t("Resources, Overhead Allocation")}</span><span>{t("Total monthly overhead and the EUR/h recovery folded into machine rates.")}</span></div>
                <div><span>{t("Can the company be profitable at all?")}</span><span>{t("Profitability")}</span><span>{t("Department expenses, current actual vs target-scenario capacity, market sell rates, and monthly operating profit/loss.")}</span></div>
                <div><span>{t("Will the market actually pay this price?")}</span><span>{t("Scenarios and Market Rates")}</span><span>{t("Target price is a cost-side floor, not a market benchmark. Compare against real competitor quotes, then use evidence to calibrate market sell EUR/h.")}</span></div>
                <div><span>{t("Is the production route realistic?")}</span><span>{t("Operations and Actuals Feedback")}</span><span>{t("Setup time, cycle time, labor time, scrap, plan/fact deviations.")}</span></div>
                <div><span>{t("Can the part actually be produced?")}</span><span>{t("Tool Check and Materials")}</span><span>{t("Required tools, missing tool cost, stock piece availability and cost.")}</span></div>
                <div><span>{t("Can this connect to existing company systems?")}</span><span>{t("ERP Connection Demo")}</span><span>{t("BOM, route, stock, customer, and offer-data handoff path.")}</span></div>
                <div><span>{t("Can external clients self-serve early estimates?")}</span><span>{t("Client Portal")}</span><span>{t("Multi-part STEP plus drawing/spec RFQ intake with one preliminary estimate range and manual confirmation.")}</span></div>
              </div>
            </section>
          </section>
        ) : null}

        {activeView === "print" ? (
          <>
            <div className="printActions">
              <button className="primaryButton" onClick={() => window.print()}>{t("Print / Save PDF")}</button>
              <button className="secondaryButton" onClick={() => setActiveView("quote")}>{t("Back to Quote")}</button>
            </div>
            <PrintableQuote
              assumptions={assumptions}
              customerName={customerName}
              deliveryEstimate={deliveryEstimate}
              partName={partName}
              paymentTerms={paymentTerms}
              quantity={quantity}
              quantityBreakResults={quantityBreakResults}
              quoteNumber={quoteNumber}
              quoteOperations={quoteOperations}
              rfqReference={rfqReference}
              stockName={stockName}
              targetResult={displayTargetResult}
              validityDate={validityDate}
              lang={language}
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
