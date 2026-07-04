# Costing Model

## Formula Version

Initial formula version: `costing.v0.1`

The formula version should be stored with every calculated quote. If formulas change later, historical quotes remain explainable.

## Quote Cost Structure

```text
total_cost =
  material_cost
  + engineering_costs
  + operation_costs
  + overhead_cost
  + risk_allowance

sell_price =
  total_cost / (1 - margin_percent)
```

Margin is treated as a target gross margin on selling price, not as markup on cost.

## Material Cost

The tool starts from a sellable/purchasable stock piece, not theoretical net material.

```text
material_cost =
  stock_piece_cost * stock_pieces_required
  - scrap_recovery_value
```

Examples:

- sawed bar length bought from supplier
- full bar required for batch
- plate rectangle or billet
- tube or profile

The quote can later capture part mass and scrap mass, but those are calibration inputs, not required MVP inputs.

## Cutoff Calculator (Stock Pieces Required)

`stock_pieces_required` should not default to 1 or be a guess — stock comes in fixed dimensions and a part rarely divides evenly into it, so unusable cutoff waste is a real cost. The calculator turns a required cut length (and cut width for plate) into whole stock units needed:

```text
# Linear stock (round bar, hex bar, square bar, tube): 1D cutting-stock division
pieces_per_stock_unit = floor((stock_length_mm + kerf_mm) / (cut_length_mm + kerf_mm))
stock_pieces_required  = ceil(quantity / pieces_per_stock_unit)

# Plate/sheet: rough area estimate, not true 2D nesting (no rectangle packing/rotation)
usable_stock_area      = stock_length_mm * stock_width_mm * packing_efficiency   # default 0.82
stock_pieces_required  = ceil((blank_length_mm * blank_width_mm * quantity) / usable_stock_area)
```

`kerf_mm` is material lost to the saw blade on every cut and must be subtracted, or the calculator understates cutoff waste. Plate estimates are explicitly approximate — real nesting (rotation, mixed part shapes on one sheet) requires nesting software this tool does not attempt to replace. Available in both the Quote Builder (RFQ panel, Cutoff Calculator helper) and the Client Portal (per-part cut length/width fields), driven by the same Material Library stock dimensions (`stock_shape`, `stock_length_mm`, `stock_width_mm`, `kerf_mm`).

## Operation Cost

Each operation can include setup, run time, tooling, consumables, scrap allowance, and outsourced cost.

```text
setup_cost =
  setup_machine_hours * machine_hour_rate
  + setup_labor_hours * labor_hour_rate

run_cost =
  quantity
  * (
      run_machine_hours_per_part * machine_hour_rate
      + run_labor_hours_per_part * labor_hour_rate
      + tooling_cost_per_part
      + consumables_cost_per_part
      + outsourced_cost_per_part
    )

operation_cost =
  setup_cost
  + run_cost
  + outsourced_batch_cost
```

Scrap can be handled at two levels:

- material-level extra stock pieces
- operation-level scrap allowance percentage

For the first implementation, operation scrap allowance is applied to the operation subtotal:

```text
operation_cost_with_scrap =
  operation_cost * (1 + scrap_allowance_percent)
```

## CAD/CAM Estimate Cost

STEP file upload should be used as an estimation aid, not as an automatic truth source.
The MVP stores STEP metadata and uses explicit complexity inputs for CAM programming and
prove-out cost.

```text
cam_cost =
  ((programming_minutes + setup_proveout_minutes)
  * (1 - reusable_program_percent)
  / 60)
  * programming_labor_hour_rate
```

The quote must distinguish:

- new part: CAM program is required and full programming/prove-out cost is included
- repeat part: existing CAM program is reused and only a reduced review/prove-out cost is included

Later geometry parsing can improve estimates from the uploaded STEP file by extracting:

- bounding box
- volume and surface area
- hole and pocket candidates
- visible setup orientation candidates
- toleranced/annotated features if model-based definition is available

Cycle time should still be calibrated against actual production history. Raw STEP geometry
cannot reliably determine feeds, speeds, fixturing, tool access, tolerance class, surface
finish, or operator strategy without company-specific rules.

## Machine Rates

Machine EUR/h is driven by two independent gauges, not one:

- `OEE`: how well a machine performs *once it has work loaded* (availability x performance x quality).
- `Utilization`: how much of the available planned time actually gets loaded with orders in the first place. `Idleness = 1 - Utilization` is the empty-order gap, and is tracked from Utilization, never from OEE.

```text
machine_eur_per_hour =
  fixed_cost_eur_per_month / (planned_hours_per_month x utilization x oee)
  + variable_cost_eur_per_hour
  + overhead_eur_per_hour (if the per-machine-hour overhead allocation method is selected)
```

The model supports at least two rates per machine:

- `accounting_full_cost_rate`: uses actual OEE and actual (typically low) Utilization.
- `target_competitive_rate`: uses target OEE (an achievable performance improvement from optimized batch/setup, ~80-85%) and target Utilization, defaulted to 70% and editable per machine, and should be compared with market pricing.

Target Utilization defaults to 70%, not 100%. Standard cost accounting (e.g. IAS 2 / ASC 330 "normal capacity" rules for overhead absorption) deliberately avoids pricing off theoretical full capacity, because it creates a mirror-image risk to the death spiral: if the company prices as though it will be fully booked and only reaches a lower real Utilization, fixed cost is under-recovered at the quoted price. 70% is a starting point, not a ceiling — it should be raised as the company's real order book improves, and is always editable, never hardcoded to a single value.

This distinction matters because pricing off low actual Utilization as if it were permanent creates a death spiral: high price -> fewer orders -> Utilization drops further -> price rises again. The accounting rate is shown for transparency, not as a growth-safe price floor.

## Overhead Allocation

Admin, sales, quality management, and facility cost sit outside any single machine or direct labor rate. A single editable total (`overhead.monthly_items`) can reach quotes through one of two methods, both derived from the same total so they stay comparable:

- `per_machine_hour` (default): `overhead_eur_per_hour = total_monthly_overhead / total_planned_productive_hours_across_machines`, folded directly into each machine's EUR/h.
- `percent_of_cost`: the same EUR/h figure expressed as an equivalent coefficient on production cost (`overhead_eur_per_hour / blended_direct_machine_rate`), applied through the existing `commercial_policy.overhead_percent` coefficient.

Only one method should be active in a given quote — applying both would double-count overhead.

## What This Model Does Not Do

Target price is a cost-side floor: what the company needs to charge to cover production cost, overhead, and margin at a chosen Utilization. It is not a market-side benchmark. The model has no feature for entering or comparing actual competitor prices or customer willingness-to-pay — that comparison remains a manual, external step for management. In a price-driven market, closing that gap matters as much as getting the cost side right.

## Common Operations

Initial operation taxonomy:

- `saw_cutting`
- `turning`
- `milling_3_axis`
- `milling_5_axis`
- `drilling`
- `tapping`
- `boring`
- `threading`
- `engraving`
- `deburring`
- `washing`
- `manual_inspection`
- `cmm_inspection`
- `bending`
- `welding`
- `packing`
- `outsourced_surface_treatment`

## Output Contract

Every calculation should return:

- formula version
- quantity
- material cost
- operation costs
- overhead cost
- risk allowance
- total cost
- unit cost
- margin percent
- sell price
- unit sell price
- assumptions used
- warnings

