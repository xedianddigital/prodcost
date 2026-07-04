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

Scrap is modeled as **sequential yield across the route**, not a single flat multiplier. To
ship `Q` good parts, the quantity that must be *started* into operation `i` is:

```text
started_quantity_i = Q / Π(1 - scrap_j)   for every operation j from i to the last operation
```

Each operation's run cost (machine + labor) is computed against its own started quantity, not
the final shipped quantity — an upstream operation must produce enough extra parts to absorb
every downstream operation's scrap. Material stock pieces are sized off the first operation's
started quantity (rounded up), since that is the number of blanks actually consumed. Setup cost
and `outsourced_batch_cost` are paid once per batch and are not scaled by started quantity.
Per-operation scrap is capped at 95% internally to keep started quantity finite; a quote that
declares 95%+ scrap on an operation gets a warning rather than a divide-by-zero.

On top of the yield-driven quantity, `scrap_allowance_percent` is also a **monetary buffer** —
extra cost for rework, inspection, and disposal that isn't fully captured just by running more
units. That buffer applies only to run machine/labor cost and per-part variable cost (tooling,
consumables, outsourced per part); it does not apply to setup or `outsourced_batch_cost`,
since those are one-off per-batch costs that scrap doesn't multiply:

```text
scrap_allowance = (run_machine_cost + run_labor_cost + variable_cost) * scrap_allowance_percent
operation_cost = setup_cost + run_cost + variable_cost + outsourced_batch_cost + scrap_allowance
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

- `Availability`: the share of scheduled time the machine is actually up and running (not broken down, changed over, or otherwise blocked), *once it has work loaded*.
- `Utilization`: how much of the available planned time actually gets loaded with orders in the first place. `Idleness = 1 - Utilization` is the empty-order gap, and is tracked from Utilization, never from Availability or OEE.

Only Availability enters the rate formula below. `OEE` (availability x performance x quality) is still tracked and shown as a diagnostic gauge (per-machine dashboards, Case signals), but it does not scale EUR/h. Performance losses already live in each operation's cycle/setup minutes (measured actuals feed those, per the calibration loop), and quality losses already live in the per-part scrap allowance. Multiplying the rate by full OEE on top of that would charge both losses twice: once as slower minutes or scrapped parts, once again as a higher EUR/h.

```text
machine_eur_per_hour =
  fixed_cost_eur_per_month / (planned_hours_per_month x utilization x availability)
  + variable_cost_eur_per_hour
  + overhead_eur_per_hour (if the per-machine-hour overhead allocation method is selected)
```

The model supports at least two rates per machine:

- `accounting_full_cost_rate`: uses actual Availability and actual (typically low) Utilization.
- `target_competitive_rate`: uses target Availability (an achievable uptime improvement from reduced unplanned downtime, seed 90%) and target Utilization, defaulted to 95% and editable per machine, and should be compared with market pricing.

Target Utilization defaults to 95%, not 100%. Standard cost accounting (e.g. IAS 2 / ASC 330 "normal capacity" rules for overhead absorption) deliberately avoids pricing off theoretical full capacity, because it creates a mirror-image risk to the death spiral: if the company prices as though it will be fully booked and only reaches a lower real Utilization, fixed cost is under-recovered at the quoted price. 95% is a near-fully-booked commercial ambition with a small buffer below theoretical capacity — not a ceiling, always editable per machine, never hardcoded to a single value.

This distinction matters because pricing off low actual Utilization as if it were permanent creates a death spiral: high price -> fewer orders -> Utilization drops further -> price rises again. The accounting rate is shown for transparency, not as a growth-safe price floor.

## Overhead Allocation

Admin, sales, quality management, and facility cost sit outside any single machine or direct labor rate. A single editable total (`overhead.monthly_items`) can reach quotes through one of two methods, both derived from the same total so they stay comparable:

- `per_machine_hour` (default): `overhead_eur_per_hour = total_monthly_overhead / total_planned_productive_hours_across_machines`, folded directly into each machine's EUR/h.
- `percent_of_cost`: the same EUR/h figure expressed as an equivalent coefficient on production cost (`overhead_eur_per_hour / blended_direct_machine_rate`), applied through `commercial_policy.overhead_percent` against the **conversion cost base only**.

Only one method should be active in a given quote — applying both would double-count overhead.

The `percent_of_cost` base is **conversion cost**: each operation's setup + run machine/labor
cost (post-scrap) plus engineering (CAM) cost. It explicitly **excludes** material, tooling/
consumables/outsourced-per-part, and outsourced batch cost — those are pass-through costs that
don't consume the shop's own conversion capacity. Applying overhead to the whole subtotal
(including material and outsourced work) would make a material-heavy quote and a machining-heavy
quote of the same total cost diverge sharply between the two allocation methods, even though
both methods are meant to be derived from the same total and stay comparable.

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

