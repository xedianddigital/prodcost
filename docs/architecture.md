# Architecture

## Product Boundary

ProdCost is a quote-costing tool for metalworking manufacturers with CNC milling and turning capacity. It is not an ERP, MES, or CAM replacement. The first useful version should calculate a defensible quote from limited available data and make every assumption visible.

## Main Concepts

- `Quote`: customer request, part, quantity, revision, selected precision level, margin policy, and calculation snapshot.
- `Material`: purchasable stock input, not theoretical net part mass. This includes unusable cutoffs and scrap recovery if known.
- `Operation`: one manufacturing step in the route, such as sawing, turning, milling, drilling, tapping, engraving, deburring, inspection, packing, or outsourced finishing.
- `Resource`: machine, work center, labor class, tooling policy, or vendor rate used by an operation.
- `Assumption Set`: editable baseline values used when proven company data does not exist.
- `Calculation Snapshot`: the frozen rates and formulas used when a quote is calculated.

## Precision Levels

### Level 1: Fast Estimate

Use when the RFQ is incomplete.

Inputs:

- quantity
- stock material piece cost
- broad process route
- rough setup and cycle time
- margin

Output:

- material cost
- conversion cost
- quote price range
- assumptions list

### Level 2: Operation-Based Quote

Use when the route is known.

Inputs:

- ordered operations
- setup time per operation
- cycle time per part
- machine and labor rates
- tooling or consumable cost per part
- outsourced operation costs

Output:

- line-by-line cost breakdown
- unit cost and total quote price
- setup amortization by quantity

### Level 3: Resource-Accurate Quote

Use when internal cost data is available.

Inputs:

- machine-specific depreciation (optionally derived from purchase price, useful life, and salvage %), maintenance, energy, floor, and planned hours
- labor classes and employer costs
- tooling wear or fixture reuse assumptions
- target OEE and actual OEE (performance when loaded), target Utilization and actual Utilization (whether time is loaded with orders at all)
- total monthly overhead (admin, sales, quality management, facility) and allocation method

Output:

- accounting full-cost rate (actual OEE x actual Utilization)
- target competitive rate (target OEE x target Utilization, default 95%)
- Scenarios tab: gap waterfall (decomposes accounting-vs-target price by Utilization, Availability, overhead basis), sensitivity table (+-10%/+-25% on Utilization, Availability, cycle times, material cost, margin), and a competitor-price input with closed-form single-driver what-ifs
- standalone shop-wide profitability estimate (Profitability Calculator), independent of any single quote

### Level 4: Actuals Feedback

Use after production data exists.

Inputs:

- actual setup time
- actual cycle time
- scrap/rework
- actual tool usage
- operator notes

Output:

- quote variance
- reusable calibrated assumptions
- operation benchmark library

## Backend

The backend should keep the deterministic cost engine separate from the API layer.

```text
backend/app/
  api/             HTTP endpoints
  costing/         pure calculation model and formulas
  persistence/     database models and repositories
  seeds/           importers for assumption sets
```

The cost engine must be testable without a database or web server.

## Frontend

The frontend should optimize for quote entry speed and assumption transparency.

Initial screens:

- quote builder
- assumptions/resources library with JSON-backed editing, including material stock examples, operation timing templates, and overhead allocation
- calculation breakdown
- scenario comparison
- profitability calculator (standalone monthly gross profit/loss estimate, independent of any single quote)

Avoid burying assumptions. Every fallback value should be visible in the quote result.

## Persistence Model

Recommended tables once persistence is added:

- companies
- users
- assumption_sets
- machines
- labor_classes
- material_prices
- quote_requests
- quote_parts
- quote_material_lines
- quote_operations
- quote_calculations
- quote_calculation_lines
- quote_drafts
- actuals_feedback

For MVP, assumptions are persisted directly to `data/baseline_assumptions.lv.json` through the API. Quote drafts are persisted to `data/quote_drafts.json`. Later both should move to versioned database-backed records.

