# ProdCost — Full Presentation Guidebook

*A tab-by-tab speaking script for walking someone through the entire tool, in depth. Written to be read aloud or adapted into slides. Every number, field name, and formula below matches the current code exactly (`frontend/src/main.tsx`, `backend/app/costing/calculator.py`, `backend/app/costing/rates.py`, `data/baseline_assumptions.lv.json`) — this is not a marketing gloss, it's the mechanism.*

---

## 0. Opening — Why This Tool Exists

Let me start with the problem, not the software.

A Latvian CNC metalworking shop has real machines, real people, and real orders — and it has been losing money for years while quoting prices that are, by their own account, 3 to 4 times higher than competitors in the same region. That gap is the entire reason this tool exists. The founding question is not "what should we charge for this one part?" It's: **which part of the business system is pushing every quote upward — empty order books, missing overhead, bad cost allocation, slow route assumptions, missing tooling, wasted material, first-time engineering effort, or genuinely expensive production?**

A single price can't answer that question. A tool that shows its work, driver by driver, can. That's the design principle behind every tab you're about to see: nothing is a black-box number. Every price is the end of a visible chain, and every link in that chain is editable, inspectable, and — where the data doesn't exist yet — honestly labeled as an estimate.

The tool is a two-part system:

- **Frontend** — a single-page React/TypeScript app (`frontend/src/main.tsx`, ~4,300 lines, one big component tree) that holds all the quote-building state, renders eight tabs, and talks to the backend only for the one calculation that has to be authoritative: turning a route and a set of assumptions into a price.
- **Backend** — a FastAPI service (`backend/app/`) whose only real job is `POST /api/quotes/calculate`: a deterministic, pure-Python costing engine (`app/costing/calculator.py`, mirrored rate math in `app/costing/rates.py`) that the frontend cannot silently disagree with, because it verifies its own numbers against the backend within 1% and warns if they drift.

Everything else — assumptions storage, quote drafts, a mock ERP, a client-facing RFQ portal — exists to make that one calculation trustworthy, reusable, and explainable to three different audiences: the person building the quote, the client receiving it, and the manager deciding whether the company can survive on the prices it's able to charge.

The sidebar tabs, in order: **Quote, Profile, Resources, Market Rates, Scenarios, Print, Profitability, Case, Guide, Methods, Client.** The Methods tab is a plain-language reference comparing the costing method this tool uses (full costing at normal capacity) with the recognized alternatives — contribution costing, TDABC, throughput accounting, target costing, standard costing — and when each is the right lens. Let's go through the core tabs one at a time.

---

## 1. Quote Builder (`Quote` tab)

This is the workbench. Everything else in the app either feeds this tab or consumes what it produces.

### 1.1 Demo Flow, ERP Connection, and Quote Drafts

At the top there are three utility panels before you ever touch a route:

- **Demo Flow** — a `Load Demo RFQ` button that populates an entire realistic quote in one click: a CNC aluminium sensor bracket, quantity 50, a six-operation route (saw cutting → 3-axis milling → drilling → tapping → engraving → manual inspection), quantity breaks at 10/25/50/100/250, and a set of Actuals Feedback rows with small measured deviations already filled in (so you can immediately see the calibration workflow, not just an empty form). This exists purely so the tool is demoable in one click for an approval conversation.
- **ERP Connection Demo** — a mock integration. You pick an ERP part from a dropdown (`GET /api/erp/parts`), click **Import ERP Data**, and the app pulls BOM, route, material, and customer context from a fake ERP dataset (`data/mock_erp/*.json`) via `GET /api/erp/parts/{id}` and `POST /api/erp/import-rfq`. Once you've built a quote, **Send Offer Data to ERP** posts the calculated Customer Offer numbers back out (`POST /api/erp/customer-offer`), which is stored (atomically, lock-guarded — more on that under Resources) and listed via `GET /api/erp/customer-offers`. This is the credible path to "this isn't a toy, it plugs into what you already have."
- **Quote Drafts** — save, load, export (JSON or CSV), print, or delete a quote (`POST/GET/DELETE /api/quote-drafts`). A saved draft stores the *entire* editable quote state, both the Target and Accounting calculation results, the quantity-break results, and a full snapshot of the assumptions that were active at save time — so a quote from six months ago stays explainable even after the baseline assumptions have since changed.

### 1.2 The RFQ Panel

This is where the quote's raw inputs live: Part, Customer, RFQ/reference, Quote number, Validity date, Delivery estimate, Payment terms, Quantity, and a free-text **Quantity breaks** field (comma-separated numbers, e.g. `10, 25, 50, 100, 250`) that drives the quantity-break table further down.

Then material. You either pick a **Material library** item (pulling in the seeded stock catalogue from Resources) or type a manual stock name and cost. Either way you set **Stock pieces** and **Scrap recovery** (a EUR credit for resold/reused scrap).

Underneath that sits the **Cutoff Calculator** — this is one of the more quietly important pieces of the tool. Stock doesn't come in the exact length a part needs; it comes in fixed lengths (a 3m round bar, a 1500×3000mm plate), and parts don't divide evenly into it. If you select a library material with stock dimensions, you enter a **cut length** (and **cut width** if the material is a plate) and the calculator tells you exactly how many stock pieces you need to *actually buy*, then a one-click **Apply** button writes that number into Stock pieces. Two different formulas, by shape:

```text
Linear stock (round/hex/square bar, tube):
  pieces_per_unit = floor((stock_length_mm + kerf_mm) / (cut_length_mm + kerf_mm))
  stock_pieces_required = ceil(quantity / pieces_per_unit)

Plate:
  usable_area = stock_length_mm * stock_width_mm * 0.82   (packing efficiency, not true nesting)
  stock_pieces_required = ceil((cut_length_mm * cut_width_mm * quantity) / usable_area)
```

The plate formula is deliberately labeled as a rough band, not an exact cutting plan — it's an area estimate with a fixed packing-efficiency factor, not real 2D rectangle-packing/rotation nesting. That's an honest limitation, not a hidden one; it's called out in the Resources explanation card for the Cutoff Calculator.

### 1.3 Quote Summary and the Scenario Strip

Every quote is calculated **twice, simultaneously** — once at the **Target** rate, once at the **Accounting** rate — via two parallel `POST /api/quotes/calculate` calls (`quotePayloadForMode("target_competitive")` and `quotePayloadForMode("accounting_full_cost")`). A toggle switches which one the Quote Summary panel displays, but both numbers are always visible in the **Scenario Strip** right below it: Target price, Accounting price, and the **Accounting premium** (Accounting minus Target) — the single number that answers "how much is today's idle capacity costing this specific quote?"

The Quote Summary itself shows: Production cost, Engineering/CAM cost, Sell price, Unit price, and — this is a newer addition — the **Commercial multiplier**: `sell_price / subtotal_before_policy`, labeled "×N (overhead, risk, margin, min-order admin)". This exists because a raw sell price hides how much of it is production cost versus commercial policy stacked on top. If your multiplier is ×3, that's worth a conversation regardless of whether the underlying production number is correct.

### 1.4 Quantity Breaks

For every quantity in the comma-separated break list, the app recalculates *the full quote* at that quantity — not just scaling the unit price, but re-running setup amortization, CAM reuse, and (critically) **re-deriving the material requirement**. This used to be a real bug: a 250-piece break was being priced with the 50-piece break's material quantity, frozen. It's fixed now — `stockPiecesForQuantity(breakQuantity)` recomputes stock pieces per break, either through the real cutoff calculator (if a library material with dimensions is selected) or by proportional scaling (`ceil(stockPieces / quantity * breakQuantity)`, minimum 1) when there's no cutoff data. When it falls back to proportional scaling, the table shows an inline **"(material scaled linearly)"** note next to that row's quantity, so nobody mistakes a rough scale-up for a cutoff-optimized number.

The table columns: Qty, Target total, Target unit, Accounting total, Accounting unit, and Premium (the accounting-minus-target unit gap) — so the accounting-premium story is visible at every batch size, not just the headline quantity.

### 1.5 STEP and CAM

You can attach a `.step`/`.stp` file (stored as metadata only — geometry is not parsed yet, and the tool says so explicitly in the Assumptions notes list). A checkbox marks whether this is a **new part** (full CAM programming and prove-out cost applies) or a **repeat part** (an existing program is reused, so only a reduced review/prove-out cost remains — the reduction percentage comes from `cam_programming_defaults.repeat_part_reusable_program_percent`, seeded at 85%).

Complexity (Simple/Medium/Complex) auto-fills the programming-minutes field from `cam_programming_defaults` (45/90/180 minutes respectively in the seed data), but it's editable — this is a *starting assumption*, not a locked rule.

The CAM cost formula, mirrored exactly on the backend:

```text
gross_minutes = programming_minutes + proveout_minutes
billable_minutes = gross_minutes * (1 - reusable_program_percent)
engineering_cost = (billable_minutes / 60) * programming_labor_hour_rate_eur
```

This shows up as its own line item in the **Engineering Operation** panel just below (basis, gross minutes, reusable reduction %, cost) — treated as a route step, because it consumes real skilled labor time before the machine ever starts cutting.

### 1.6 Operations — the Route

This is the heart of the quote. You pick an operation template from a dropdown (seeded from Resources → Operation Templates: saw cutting, turning, milling 3-axis, milling 5-axis, drilling, tapping, engraving, welding, bending, manual inspection...) and click **Add**. Each operation row is fully editable: which Machine class and Labor class it uses (which resolves live to a EUR/h rate shown right there as a hint), Setup minutes (machine and labor separately), Cycle/run minutes per part (machine and labor separately), per-part Tooling/Consumables/Outsourced cost, per-batch Outsourced cost, and a Scrap % (per-operation).

Here's where the cost-formula precision really matters, because this got a deep rework (`costing.v0.2`). Two things changed:

**Scrap allowance no longer touches setup or batch costs.** It used to multiply the *whole* operation subtotal by `(1 + scrap%)`, which meant a one-time setup cost or a flat outsourced-batch fee was getting inflated by scrap — nonsensical, since scrap is a per-part phenomenon that happens during the run, not during setup. Now:

```text
scrap_allowance = (run_machine_cost + run_labor_cost + variable_cost) * scrap_allowance_percent
operation_cost  = setup_cost + run_cost + variable_cost + outsourced_batch_cost
                  + missing_tool_batch_cost + scrap_allowance
```

**Cumulative sequential yield across the whole route.** If you need to *ship* 50 good parts and your milling operation has 5% scrap, you don't start milling with 50 parts — you need enough blanks entering the route to survive every downstream operation's scrap and still deliver 50 good ones at the very end. The backend computes, for every operation `i` in the route (in order), a **started quantity**:

```text
started_quantity[i] = target_quantity / Π(1 - scrap_j)   for every operation j from i to the last one
```

Run cost for each operation is computed against *its own* started quantity, not the final shipped quantity — so an early operation with downstream scrap ahead of it correctly costs more per shipped part than a late operation does. This number is exposed per-operation in the Cost Breakdown detail (`started_quantity`), and per-operation scrap is capped at 95% internally so a bad input can't create a divide-by-zero or an infinite blank count.

### 1.7 Tool Check

Every operation you add is seeded with a **Required Tools** list from `defaultToolRequirementsForOperation()` — real tool specs, not a placeholder: type, diameter, corner radius, material suitability. For example, 3-axis milling gets a Ø10mm R1 aluminium end mill plus a Ø6mm R0.5 finishing end mill; tapping gets an M5 machine tap. These are fully editable per quote, not locked to the template.

Each requirement is checked against the Tool Inventory (Resources) by **type match**, **diameter within tolerance** (default ±0.05mm, editable in Resources), **corner radius within the same tolerance**, and **material-group compatibility**. If a matching tool with enough available quantity exists, status is "Available" and it costs nothing. If not, status is "Missing," and you choose a **charge mode**: charge the full replacement cost to this quote, **amortize** it over an editable future-quantity, or explicitly mark it "included/ignored" (a deliberate management call to eat the cost, visible rather than silently absorbed).

Missing-tool cost is tracked as its own field all the way through — `missing_tool_batch_cost_eur` on the operation, summed into a top-level `missing_tool_cost_eur` on the quote result — specifically so it's never confused with real subcontracted work in the Cost Breakdown, in CSV/JSON exports, or on the internal print sheet. That used to be folded silently into "outsourced batch cost"; it isn't anymore.

Honesty note, stated directly in the Resources explanation card: tool dimensions come from the operator editing this requirement list, **not** from parsed part geometry — that's future work once STEP parsing lands.

### 1.8 Cost Breakdown

A flat list of every cost line the backend returned for the currently selected rate mode: Material, Engineering (if applicable), and one line per operation, each with total and unit cost. This is the literal `lines` array from the `QuoteResult` — nothing summarized, nothing hidden.

### 1.9 Actuals Feedback and the Calibration Loop

After production, you record what actually happened per operation: actual setup minutes, actual cycle minutes, actual scrap %, and free-text notes. The table shows Quoted cost vs Actual cost vs Variance side by side (both computed by the same `operationCost()` formula, just fed quoted vs actual inputs), so plan-vs-fact drift is visible operation by operation.

**Apply to Templates** is where measured reality is allowed to change future quotes — but carefully. This used to be a real bug: it averaged actuals across every part that happened to share an operation type in the *current session* and overwrote the shared template outright, meaning one unusual job could swing the default for every future quote of that operation type. Now it's a **running weighted mean**:

```text
new_value = (old_value * n + mean(actuals) * k) / (n + k)
```

— where `n` is the template's `calibration_sample_count` (capped at 20, so the template never fully "freezes" and stays adaptive to real drift), and `k` is the number of actuals just recorded. Before anything is written, you get a review card per affected operation type showing old → new for every field, with the new sample count; if any single field would move **3× or more**, that operation type requires an explicit confirmation checkbox before the **Confirm & Apply** button will proceed. You can also **Cancel** and walk away with nothing changed. Calibration is per *operation type*, not per part family — a milling operation on a small aluminium bracket and the same operation type on a large steel plate currently share one calibrated default; part-family-aware normalization is flagged as future work, not silently assumed away.

---

## 2. Client Portal (`Client` tab)

This tab answers a different question than the Quote Builder: **can an external client get a credible price without an engineer sitting down with them first?** It's a self-serve RFQ intake that produces one preliminary estimate *range*, with everything internal deliberately hidden, and a real bridge into the Quote Builder once someone needs to actually confirm it.

### 2.1 Intake

Customer/contact fields, multi-file STEP upload (each file becomes a new part row automatically), or **Add Part Manually** for a client without a model yet. There's an upfront notice: *"STEP alone is not enough for a reliable manufacturing price"* — the portal deliberately also asks for a drawing/spec file, because tolerances, material, threads, surface finish, and inspection requirements can't be inferred from a bare STEP model.

### 2.2 Per-Part Requirements

For every part: order quantity and annual volume; **Tolerance requirement** (standard / per-drawing / custom-tight); **Inspection/documentation** (standard / dimensional report / full FAI); **Threads/inserts** (unknown / none / yes); **Delivery need** (standard / expedite / date-critical); a Material dropdown pulling from the same Material Library as the Quote Builder (which also auto-fills stock description and cost); cut length/width for the Cutoff Calculator (width only shown for plate stock); surface finish; free-text notes.

### 2.3 Readiness and the Hidden Internal Math

Each part shows a **readiness** verdict — missing drawing, unspecified material, unconfirmed thread requirements, no library stock item selected (so cutoffs can't be calculated and a conservative single-piece assumption is used instead) all show up as flagged issues.

Internally — invisible to the client unless "Show internal pricing detail" is toggled — a **complexity score** is inferred per part:

```text
score = 0
+ 0.56 if a drawing/spec file was uploaded
+ 2.25 if tolerance is "custom"      (or +1.13 if "per drawing")
+ 1.69 if documentation is "full FAI" (or +0.84 if "dimensional report")
+ 0.84 if surface finish mentions anodizing/coating
+ 0.84 if threads/inserts are requested
+ 0.84 if delivery is not standard

complex if score >= 3.25, medium if score >= 1.25, else simple
```

Worth noting explicitly, because it was a deliberate fix: this score used to include uploaded **file size in bytes** as a complexity signal. It doesn't anymore — file size reflects STEP export settings and tessellation density, not part complexity, so it was noise. Its removed weight was redistributed proportionally across the remaining signals (a ×1.125 scale-up) rather than just deleted, so classification for typical inputs lands close to where it did before, for the inputs that weren't relying on file size specifically.

From that complexity class and the other requirement fields, four multiplicative **adjustment factors** are built: Complexity (0.75× simple / 1× medium / 1.6× complex), Tolerance (1× / 1.25× / 1.55×), QC (1× / 1.2× / 1.45×), Delivery (1× / 1.12× / 1.2×). A **combined** factor multiplies Complexity × Tolerance × Delivery and is applied to setup/cycle minutes for every route operation *except* manual inspection, which instead uses the QC factor alone — inspection time should scale with inspection rigor, not with milling complexity. All of this is labeled, in the internal detail panel and in the Resources documentation, as "hand-picked heuristics, not yet calibrated against actuals."

The assumed route is built per part: saw cutting → 3-axis milling → drilling → (tapping, only if threads/inserts = yes) → manual inspection — and it runs through the *exact same* Tool Check logic as the Quote Builder (`portalToolCheckResults`), so a missing tap or end mill shows up here too, with real cost, not a flat guess.

### 2.4 Pricing, the Range, and the Disclaimer

The client-facing price always uses the **Target** rate (never Accounting) — the portal is meant to show what the shop should be able to charge once properly loaded, not today's idle-capacity cost. Internally, if you open the detail panel, you also see the **Accounting cross-check** price and the percentage gap versus Target, with a warning styling if that gap exceeds 25% — a large gap is a direct signal that "this price assumes the shop wins more orders."

The client only ever sees a **range**, not a point estimate:

```text
low_total  = target_sell_price * range_low_factor    (seed: 0.85)
high_total = target_sell_price * range_high_factor   (seed: 1.35)
```

Both factors are editable assumptions in Resources (`client_portal.range_low_factor` / `range_high_factor`), not hardcoded — and deliberately asymmetric: the high side is widened further above 1.0 than the low side is pulled below it, because pending real calibration against actuals, an underquote that has to be corrected upward is cheaper for the business than an overquote that silently loses the order. Every estimate box carries the same disclaimer, verbatim: *"Preliminary estimate only, subject to engineering confirmation. The confirmed price may differ materially from this range once drawing, material, tolerance, tooling, and capacity are reviewed."*

A separate, informational-only **repeat-order CAM savings estimate** appears when declared annual volume is at least twice the order quantity — it shows what CAM cost *could* look like on a future repeat order once the program is reused, but explicitly does not change the price of the current (necessarily new-part) order.

**Send to Quote Builder** is the bridge that used to not exist — a portal RFQ was a dead end the moment you left the tab. Now it builds a real `QuoteOperation[]` route (with real tool requirements), populates the Quote Builder's entire RFQ state, switches you to the Quote tab, and clears any active draft ID so it can't silently overwrite an unrelated saved quote. That's what turns the portal's promise of "manual confirmation required" into an actual, followable workflow.

---

## 3. Resources tab

This is the assumptions warehouse — every number every other tab depends on lives here, split into two sub-tabs: **Values** (the editable data) and **Explanations** (the terminology and reasoning, written for someone who didn't build the tool).

### 3.1 Values

**Commercial Policy** — Margin % (gross margin *on the sell price*, not a markup on cost — a common and costly confusion), Risk allowance % (grossed up before margin, for uncertain quotes), Minimum order admin cost (protects small orders from having quotation/handling/paperwork cost ignored).

**Client Portal Range** — the two range factors and the annual-volume relief % described above, editable here rather than buried in code.

**CAM Defaults** — repeat-part reuse %, prove-out minutes, and simple/medium/complex programming-minute defaults.

**Overhead Allocation** — this section didn't always exist; until it was added, the cost formula assumed only a machine, an operator, and a CAM programmer, with no line at all for admin, sales, quality management, or facility cost — unrealistic for a ~30-person company with 18–20 people on the shop floor. You enter one editable total (a list of named monthly expense items — Admin & general management, Sales & quoting, Quality/QC management, Facility/utilities/insurance in the seed data, summing to €18,000/month) and choose **how** it reaches quotes:

- **Per machine hour** — spread across total planned productive hours across all machines and folded directly into every machine's own EUR/h rate.
- **Percent of cost** — the same total expressed as an equivalent coefficient and applied via `commercial_policy.overhead_percent` — but critically, only against **conversion cost** (each operation's setup + run machine/labor cost, post-scrap, plus engineering), *not* against material, tooling/consumables, or outsourced pass-through cost. That distinction matters: applying overhead to the whole subtotal would make a material-heavy quote and a machining-heavy quote of identical total cost diverge sharply between the two allocation methods, even though both are supposed to be derived from the same total and stay comparable.

Only one method is ever active per quote — the app zeroes out the redundant path automatically so overhead is never double-counted.

**Labor Classes** — enter labor cost directly (a company-known loaded hourly rate) or derive it from gross monthly salary:

```text
derived_eur_per_hour = (gross_monthly_salary * (1 + employer_social_contribution_rate)) / paid_hours_per_month
```

For Latvia, the seeded employer contribution rate is 23.59% (VID's stated employer share of the 34.09% total mandatory VSAOI rate when a worker is insured for all social insurance types — the employee's own 10.5% share is not added again, since gross salary already represents the employee's taxable pay base).

**Machine Rate Calculator** — this is where the biggest structural fix in the whole project lives, so it's worth walking through carefully. Machine EUR/h used to be driven by **OEE** (Overall Equipment Effectiveness — availability × performance × quality) in the rate denominator. That was double-counting: cycle and setup *times* already carry performance losses (a slower real cycle time already costs more, because it consumes more billed machine-hours), and the per-part **scrap allowance** already carries quality losses. Multiplying the hourly *rate* by full OEE on top of that charged both losses a second time — once as slower minutes or scrapped parts, once again as a higher EUR/h.

The fix: only **Availability** (the share of scheduled time the machine is actually up and running, not broken down/changed over/blocked) belongs in the rate denominator.

```text
machine_eur_per_hour = fixed_cost_eur_per_month / (planned_hours_per_month * utilization * availability)
                        + variable_cost_eur_per_hour
                        + overhead_eur_per_hour   (only if the per-machine-hour method is active)
```

OEE is still tracked and shown — as a **diagnostic gauge only**, labeled "(diagnostic)" in the table headers — because it's a genuinely useful shop-floor signal, just not one that belongs in the pricing formula anymore.

Two rates are calculated per machine, always live (never hand-entered): **Accounting** (actual Availability × actual Utilization — "what does today's real, often under-loaded capacity cost?") and **Target** (target Availability × target Utilization, seeded at 90% and **95%** respectively, times an optional per-machine target discount — "what should we charge once the shop is properly loaded?"). Target Utilization defaults to 95%, not 100% — a deliberate standard-cost-accounting choice (echoing IAS 2 / ASC 330 "normal capacity" rules): pricing as if the shop will be perfectly, permanently fully booked risks under-recovering fixed cost the moment real bookings land even slightly below that ceiling — the mirror image of the death spiral this tool is built to expose. 95% is a near-fully-booked commercial *ambition* with a small buffer below theoretical capacity, not a hard ceiling, and it's editable per machine, never hardcoded to a single global value in the sense of being unreachable.

Idleness (`1 - Utilization`) is shown alongside each utilization value as a visual bar plus a percentage — the "empty order gap" — and it is derived **only** from Utilization, never from Availability or OEE, on purpose: a machine can be 0% idle and still have mediocre OEE if it runs poorly once loaded; a machine can have excellent OEE and sit 60% idle because there simply aren't enough orders. Conflating those two would let a real demand problem get mistaken for a shop-floor performance problem, or vice versa.

A "Estimate fixed cost from purchase price" helper turns an opaque manual "Fixed cost EUR/month" box into something explainable: straight-line depreciation from purchase price, useful life, and salvage percent, plus any other known recurring cost (maintenance, floor/rent share, insurance, financing):

```text
suggested_fixed_cost = (purchase_price * (1 - salvage_percent)) / (useful_life_years * 12) + other_monthly_fixed_cost
```

**Material Library** — name, grade, stock description, cost, shape (round/hex/square bar, tube, plate — feeding the Cutoff Calculator), stock length/width, saw kerf, supplier, minimum order quantity, scrap recovery %, and a data-quality tag.

**Tool Inventory** — the cutter/tool library the Tool Check matches against, plus the shared **diameter/radius match tolerance** field (default 0.05mm) that governs how strict that matching is everywhere in the app. Setting a tool's available quantity to zero is explicitly useful as a missing-tool demo case.

**Operation Templates** — the defaults every new quote operation is seeded from: default machine and labor class, setup/cycle minutes, per-part and per-batch costs, scrap %, and (invisible in the table but tracked) the `calibration_sample_count` the Actuals Feedback running-mean calculation uses.

A **Full JSON editor** exists underneath all of this, exposing every assumption field including ones without a dedicated UI control yet — powerful, and explicitly flagged as such: invalid structure can break calculations, and Save validates that the required top-level sections still exist before it's allowed to persist.

### 3.2 Explanations

A grid of plain-language cards covering every concept above — Commercial Policy, CAM Defaults, Labor Classes, Material Library, the Cutoff Calculator, Client Portal Methodology, Operation Templates (with the calibration running-mean explained), Tool Inventory (with the STEP-parsing honesty note), Machine Classes, Actual/Target Availability vs Actual/Target Utilization, Idleness, Fixed Cost From Purchase Price, Overhead Allocation, the Profitability Calculator, Power kW guidance, the Full JSON editor's risk, and a Latvian payroll rule reference citing the VID source for the 23.59% employer contribution default. This sub-tab exists so a new user — or a manager reviewing the tool before approving its numbers — never has to guess what a field means or why a default was chosen.

---

## 4. Scenarios tab

If the Quote Builder shows *the* price and the Business Case explains *why* prices are structurally high, the Scenarios tab exists to answer the tool's founding question directly: **which single driver is responsible for how much of the gap?** This tab didn't do much before — it showed the same Target/Accounting numbers already visible elsewhere. Now it does three genuinely new things.

### 4.1 Gap Waterfall

One button — **Run Gap Waterfall** — recalculates the current quote with exactly one driver switched from its Accounting value to its Target value at a time, in a fixed, deliberate order: **Utilization → Availability → overhead basis**. Four rows result:

1. Accounting price (actual Utilization, actual Availability) — the baseline.
2. Switch to target Utilization only (Availability and overhead basis still at actual) — shows the EUR and % contribution of the order-book problem alone.
3. + switch to target Availability — shows the (typically much smaller) contribution of uptime improvement.
4. + switch the overhead basis to target hours — which lands exactly on the Target price — shows the contribution of overhead recovering across a fuller shop rather than a thin one.

Each row shows the resulting unit price, the EUR delta from the previous row, and that delta as a percentage of the *total* accounting-to-target gap — so instead of one lump "accounting premium" number, you get an itemized receipt of exactly where that premium comes from. In practice, for the seed data, Utilization is by far the largest single lever — which directly confirms the tool's own diagnosis stated on the Business Case page.

This required a real backend capability, not just frontend arithmetic: `quotePayloadForScenario()` builds a quote payload that can mix and match utilization/availability/overhead-basis fields independently of the two fixed presets, and every step is a genuine `POST /api/quotes/calculate` round trip — not an approximation.

### 4.2 Sensitivity Table

**Run Sensitivity Table** recalculates the Target unit price at **−25%, −10%, base, +10%, +25%** on five independent drivers: Utilization, Availability, Cycle times, Material cost, and Margin. That's 20 extra calculate calls, run in parallel and only on demand — deliberately not run automatically on every keystroke, since this is a diagnostic action, not a live preview. The result is a direct, visual answer to "if we could move exactly one lever by a realistic amount, how much would the price actually move?" — which is a very different, more actionable question than "the price is too high."

### 4.3 Competitor Price Gap

A single input field — **Competitor/market unit price, EUR** — persisted with the saved quote draft, so a competitive benchmark doesn't get lost between sessions. This is explicitly a **user-supplied** number; the tool does not scrape or benchmark market prices automatically, and says so.

From that one number, three closed-form "single-driver what-if" answers are back-solved from the *current* Target quote, with no extra API calls:

- **Required margin alone** — an *exact* back-solve, holding cost fixed: `required_margin = 1 - (total_cost / competitor_total_price)`.
- **Required blended EUR/h alone** — an approximation that splits the quote's own machine cost into its utilization-sensitive (fixed-cost-per-hour) and insensitive (variable + overhead-per-hour) components, then asks what uniform rate scaling would close the gap while holding the commercial multiplier constant.
- **Required Utilization alone** — the same cost-structure split, solved for the utilization scale factor instead.

Each is explicitly labeled "single-driver what-if" — not a full re-simulation — and each can report **"Not achievable"** if closing the gap through that one lever alone isn't mathematically possible (for example, if the competitor's price is below the shop's variable cost, no utilization improvement will ever get there, and the tool says so rather than showing a nonsensical number).

---

## 5. Profitability tab

Every other tab prices *one quote*. This tab asks a completely different, arguably more urgent question: **independent of any single order, can this company be profitable at all?**

### 5.1 The Setup

It reuses the exact same Overhead Allocation expense list from Resources (editing it here updates it there too — one source of truth) and lets you stress-test a single free variable: a shop-wide **Utilization scenario** slider, with one-click shortcuts to "Use current average" (computed live from every machine's actual utilization) or "Use 100% (fully booked)" as an extreme upper bound.

### 5.2 Why This Used to Be Broken, and How It's Fixed

This tab used to be structurally incapable of showing a loss — which is a serious problem for a "can we be profitable" check. The bug: **revenue was derived from the scenario's own cost**, roughly `revenue = cost * (1 + margin_markup)`, so gross profit was mathematically guaranteed to be non-negative at any margin greater than zero, at *any* Utilization. A tool meant to expose a real risk was structurally incapable of ever showing that risk.

The fix makes revenue and cost move **independently**:

- **Price is fixed once**, at the shop's commercial policy — a blended target sell rate EUR/h, priced at target Utilization and target Availability, grossed up by risk allowance and margin:

```text
sell_rate_per_hour = (blended_target_direct_rate + overhead_per_hour_at_target) * (1 + risk%) / (1 - margin%)
```

- **Sold hours follow the *scenario*** — `planned_hours × target_availability × utilization_scenario` per machine, summed across the shop. This is the one thing that's allowed to move as you drag the slider.
- **Revenue** = sold hours × the fixed sell rate. It does not shrink or grow based on how the scenario itself changes cost.
- **Cost** = the *full* monthly fixed cost (unchanged by the scenario — a machine's lease doesn't get cheaper because it's idle) + variable cost over sold hours + the *full* monthly overhead (also unchanged). Nothing here is derived from revenue.

Because revenue and cost are now genuinely independent, the bridge chart can — and, with the seed data at a realistic ~35–50% actual utilization, does — show a real **loss** (roughly −€10,400/month at the current ~39% average). Push the slider to 95% and it flips to a real **profit** (roughly +€12,000/month). A closed-form **break-even Utilization** is also displayed, solved directly from the same linear revenue/cost relationship (65% for the seed data) — or reported as "none" if the target sell rate doesn't even cover variable cost at any Utilization, which would mean no amount of order volume alone fixes the underlying cost structure.

### 5.3 The Bridge Chart

A waterfall: Revenue capacity (adds) → Machine direct cost (subtracts) → Direct payroll (subtracts) → Overhead (subtracts) → the final result, colored green for profit or red for loss, with a trend icon to match. The result is labeled **operating profit/loss** — before bank interest and corporate income tax, with depreciation (not loan payments) inside machine fixed cost — so it answers "does the business model work", not "what lands on the bank account". If the last bar is red, the company is not profitable at the chosen Utilization, full stop, and the chart won't dress that up. Below it, a fixed-level sensitivity table (50/65/80/85/95/100% Utilization) keeps one slider position from being mistaken for the whole picture, and the break-even figure carries an even-load caveat: a real order book fills the bottleneck machine first, so the achievable shop average is lower than a uniform slider suggests.

---

## 6. Business Case tab

This is the pitch. Where the Guide tab teaches the mechanics, this tab makes the argument — this is the page you'd actually put in front of a skeptical manager.

**The hero section** restates the founding question plainly: is machine performance (OEE) actually the problem, or is it low Utilization — an empty order book? The stated diagnosis for this specific company: OEE is broadly fine. Utilization is low. That's a commercial/sales problem, not a shop-floor problem, and pricing as if low Utilization were permanent creates exactly the trap the next section describes.

**The Death Spiral** — a five-step feedback loop rendered as a visual flow: price quoted off low actual Utilization → quote looks expensive vs. competitors → fewer orders won → Utilization drops further → next quote is priced even higher. The point made explicitly underneath: Accounting-rate pricing is sound bookkeeping (it recovers today's real fixed cost) but it is **not a safe growth strategy**, because every order priced that way makes the next order look less competitive — manufacturing the exact demand shortfall it's reacting to. The Target rate — a near-fully-booked shop at 95% Utilization and an achievable Availability — is presented as the number the company should actually price and negotiate around.

**Cost Pressure Signals strip** — four live stat cards pulled straight from the current quote: Accounting premium (EUR), Premium vs Target (%), Missing tool exposure (EUR), CAM/engineering cost (EUR).

**Production Cost Backbone** — the same four-step chain the Guide tab teaches (stock → engineering → route → commercial policy), plus the machine-rate equation box (`fixed cost / (planned hours × Utilization × Availability) + variable cost`) and a short explanation of exactly *why* low Utilization hurts price: the machine doesn't perform worse, it just sits idle waiting for work, and the same fixed cost gets divided over fewer productive hours.

**Overhead Was Missing** — an honest history: until this section of the tool existed, the formula only knew about a machine, an operator, and a CAM programmer — no line at all for admin, sales, quality, or facility cost, which is unrealistic for a ~30-person company. Re-enabling overhead *will* raise the calculated price back up even after Utilization is fixed — and the tool states plainly that this is expected, not a bug: in the Baltic market, price is the dominant purchasing factor for the large majority of orders; if a competitor is genuinely, consistently cheaper on comparable work, the realistic explanations are lower overhead, better efficiency, already-depreciated equipment, or different scale — not a hidden trick in cost accounting. This section also states clearly what the tool does **not** do: it doesn't benchmark real competitor prices or customer willingness-to-pay automatically. Target price is a cost-side *floor* (what you need to charge to cover cost, overhead, and margin at a healthy Utilization), not a market-side ceiling — comparing that floor to real competitor quotes is the Scenarios tab's Competitor Price Gap feature, and even there it's a user-supplied input, not automated market intelligence.

**Cost Pressure Signals table** — seven rows mapping a symptom (large accounting premium, low actual Utilization, uncounted overhead, high new-part CAM, missing tools, expensive stock pieces, actuals diverging from plan) to what it means and exactly where in the tool to go look.

**Approval Message** — the closing argument, and arguably the actual thesis of the whole project: the value of this tool isn't that it produces one more number. It's that **every high price becomes explainable** to the right audience. If it's high because Utilization is low, management sees a sales/load problem, not a production problem. If it's high because overhead was missing, management sees the true cost of running the business, not an accounting trick. If it's high because setup or CAM assumptions are wrong, production sees a data problem. If it's high because target rates are unrealistic, management sees a market strategy problem. If it's high because tooling or material is missing, the quote can charge it instead of silently losing money on it.

---

## 7. Guide tab

Where the Business Case makes the argument, the Guide teaches the mechanics — this is the reference page for "wait, what does that field actually mean?"

**Production Cost Calculation Backbone** — the same four-link chain repeated from the Business Case, framed as the single organizing principle of the entire tool: a sell price is never one guessed number, it's a chain (material from stock → engineering prepares production → route consumes capacity → commercial policy converts cost to price), and each link is a place the offer can silently inflate above the market.

**OEE vs. Utilization — Two Different Gauges** — the clearest explanation in the app of the Availability/Utilization/OEE distinction, anchored with a concrete worked example using the seed data's numbers:

```text
Fixed monthly machine cost: 8,000 EUR
Planned monthly hours: 160 h

At 90% Availability, 95% Utilization (target): 136.8 productive h = 58.48 EUR/h
At 80% Availability, 35% Utilization (actual):  44.8 productive h = 178.57 EUR/h
```

The punchline, stated directly: the machine didn't get much worse between those two rows — Availability barely moved. The cost per productive hour roughly **tripled** because Utilization collapsed, not because performance did. Pricing off the second row as if it were permanent is exactly the trap the Death Spiral panel describes.

**Target Utilization Is The Strategy** — a three-column comparison (Target Price / Accounting Price / Accounting Premium) explaining what each answers: Target answers "what do we need to charge once the shop is properly loaded?"; Accounting answers "what price do we get if today's empty order book gets charged to this one order?"; the Premium between them is a direct management signal to win more orders, revisit overhead allocation, correct route assumptions, or accept that the market genuinely can't pay today's under-loaded cost structure.

**Typical Reasons A Quote Becomes Too High** — a nine-item checklist covering the same causal factors the Business Case discusses, but written as a diagnostic list rather than a narrative: low Utilization, ignored overhead, wrong route time, small batch size, new-part engineering, missing tools, material/cutoff reality, quality requirements, and unclear data quality (when assumptions are guesses, the company either adds risk allowance or overprices defensively to protect itself).

**Where To Look In The Tool** — a nine-row navigation table mapping a question directly to a tab and specifically what to check there: *Why is the price high?* → Quote Summary/Scenarios. *Is the machine rate believable?* → Resources Machine Rate Calculator. *Is overhead counted?* → Resources Overhead Allocation. *Can the company be profitable at all?* → Profitability. *Will the market actually pay this price?* → explicitly **not answered** by this tool automatically; Target price is a cost-side floor, compare it manually (or via the Scenarios competitor-gap input). *Is the production route realistic?* → Operations and Actuals Feedback. *Can the part actually be produced?* → Tool Check and Materials. *Can this connect to existing company systems?* → ERP Connection Demo. *Can external clients self-serve early estimates?* → Client Portal. This table exists so nobody has to remember where anything lives — it's the index for the whole app.

---

## 8. Print tab

The output stage: a browser-printable document, togglable between two formal modes with real, different content — not just a hidden-column view of the same page.

**Customer Offer mode** shows: header (quote number, part name and quantity, customer and RFQ reference, generated/valid-until/delivery/payment-terms metadata, formula version), a summary grid (material stock, Target sell price, Target unit price only — no Accounting numbers), a Quantity Pricing table (quantity / total price / unit price, Target only), a Route table (operation, machine, labor, setup minutes, cycle minutes/part), and a closing **Commercial Notes** disclaimer: *"This offer is based on the supplied RFQ information and current assumptions. Internal cost breakdowns and accounting-rate comparison are intentionally excluded."*

**Internal Cost Sheet mode** shows everything the customer sees, **plus**: both Accounting sell price and Accounting unit price in the summary grid; the **missing-tool cost** as its own line, separate from everything else (this was a deliberate addition — it used to be invisible in this view, folded into other numbers); the Quantity Pricing table gains Accounting total/unit and a Premium column; side-by-side **Target Cost Breakdown** and **Accounting Cost Breakdown** tables (every cost line, both rate modes); a full **Actuals Feedback** table (setup, cycle, scrap %, notes per operation); and an **Assumptions Snapshot** line stating the exact margin, risk allowance, and minimum admin cost that were in effect.

The distinction matters operationally: one document is safe to hand to a client, the other is safe to hand to your own management or finance team, and the tool enforces that split structurally rather than trusting someone to remember to redact a spreadsheet by hand.

---

## 9. Closing — How It All Fits Together

If you remember one thing from this walkthrough, make it this: **every number in this tool is the visible output of a chain you can inspect, and every link in that chain is either editable data or an honestly-labeled estimate.** Nothing is a hardcoded magic constant hiding inside a formula — Target Utilization is 95% because it's a documented, explained, per-machine-editable assumption, not because it's baked into the code. OEE isn't in the rate formula because keeping it out was a deliberate fix for a double-counting bug, and that reasoning is written down in three different places (Machine Rate Calculator, the Guide, the Business Case) so nobody has to take it on faith.

The backend exists specifically so the frontend can't quietly drift from that contract: `app/costing/rates.py` is a pure-Python mirror of the exact same rate math, with unit tests pinned to the seed data's numbers, and every operation payload can carry its own `rate_drivers` so the backend recomputes and *warns* — by name, with both numbers — if the label the frontend sent disagrees with what the drivers actually compute by more than 1%. `rate_mode` stopped being a decorative string the backend never checked.

And underneath all of it, the persistence layer — quote drafts, assumptions, ERP offer payloads — writes atomically (temp file + `os.replace`) under a per-store file lock, so two people saving at the same time can't silently clobber each other's work. That's not a glamorous feature to put in a pitch deck, but it's the kind of thing that decides whether a tool like this survives contact with more than one concurrent user.

That's the whole tool: eight tabs, one shared cost engine, and a running argument that a 3–4× price gap is never one number's fault — it's a chain of decisions, and this is the chain, made visible.
