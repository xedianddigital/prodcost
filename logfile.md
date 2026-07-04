# ProdCost Build Log

Last updated: 2026-07-04

This file records the work completed in the ProdCost project so the project can continue after a session break without losing context. It is intentionally practical: what was built, why it was built, how it was verified, and what still remains open.

## 1. Original Business Context Captured

- Captured the starting case from the interview with a Latvian metalworking manufacturer.
- Defined the core business problem: modern CNC milling/turning capacity exists, OEE is low, external orders are insufficient, and quoted prices can be 3-4x higher than competitors in Latvia/Central/Eastern Europe.
- Recorded the working hypothesis: the company may not know its real cost structure well enough, and low utilization/accounting burden may be forcing high prices.
- Captured the intended tool purpose: a web-based production cost calculator focused on CNC metalworking, not a generic calculator.
- Captured the need for layered calculation precision: fast estimate when data is incomplete, deeper calculation when routing/material/machine/labor/tooling data exists.
- Captured the principle that calculation starts from a sellable stock piece, not from theoretical net material volume, because cutoffs and waste are real manufacturing costs.

## 2. Project Foundation Created

- Created the project in `/home/xediand/prodcost`.
- Added a FastAPI backend for deterministic costing and demo APIs.
- Added a React + TypeScript + Vite frontend for the calculator UI.
- Added editable starter assumptions in `data/baseline_assumptions.lv.json`.
- Added local development flow using backend port `8001` because port `8000` was already occupied.
- Added a grey/dark-neutral frontend visual direction because the user explicitly requested to avoid white backgrounds.
- Added `README.md` and pinned the original task/focus there so future work stays aligned with the business case.
- Added `todo.md` to preserve remaining work and project direction.
- Added this `logfile.md` as the running record of completed work.

## 3. Backend Costing Engine Implemented

- Implemented quote calculation endpoint `/api/quotes/calculate`.
- Added formula version `costing.v0.1`.
- Implemented material cost, engineering/CAM cost, operation cost, overhead/risk, margin, and sell-price calculation.
- Separated internal production cost from commercial selling price.
- Added target competitive vs accounting full-cost rate modes.
- Added support for material stock piece cost rather than theoretical net part material.
- Added operation-level setup time, cycle time, labor time, tooling, consumables, outsourced cost, scrap, and missing-tool cost inputs.
- Added backend assumptions API: `/api/assumptions` GET/PUT.
- Added JSON-backed quote draft storage and export APIs.
- Added backend tests for costing, assumptions, drafts, exports, and ERP mock flows.

## 4. Frontend Quote Builder Implemented

- Added the main Quote tab as the internal estimator workspace.
- Added customer/RFQ metadata: customer name, RFQ/reference, quote number, validity date, delivery estimate, and payment terms.
- Added material selection from the Resources material library with manual override.
- Added STEP metadata upload field for new-part RFQs. Full STEP geometry parsing is not implemented yet.
- Added new-part vs repeat-part checkbox logic:
  - New part includes CAM/programming/prove-out cost.
  - Repeat part assumes CAM already exists and applies reduced engineering effort.
- Added Engineering Operation section so CAM/programming appears visibly before production operations.
- Added editable operation route rows based on Resources operation templates.
- Added machine and labor selection per operation.
- Added editable setup minutes, cycle minutes, tooling, consumables, outsourced cost, and scrap assumptions per operation.
- Added live quote summary with selected target/accounting mode.
- Added quantity break pricing with target/accounting totals, unit prices, and premium per unit.
- Added scenario strip for target, accounting, and premium comparison.

## 5. Drafts, Export, And Print Added

- Added JSON-backed quote draft persistence in `data/quote_drafts.json`.
- Drafts store quote state, route, quantity breaks, actuals feedback, target/accounting results, and assumptions snapshot.
- Added load/save/delete draft actions in the Quote tab.
- Added JSON and CSV export for saved quote drafts.
- Added Print tab with two document modes:
  - Customer Offer: customer-safe output that hides internal costs.
  - Internal Cost Sheet: includes target/accounting comparison, cost breakdown, route, assumptions, and actuals feedback.

## 6. Resources Editing Added

- Added Resources tab for editing assumptions through the frontend instead of manually editing JSON.
- Added structured editors for:
  - Commercial policy.
  - CAM defaults.
  - Labor classes.
  - Machine classes.
  - Material library.
  - Tool inventory.
  - Operation templates.
- Added full JSON editor for fields not yet covered by structured controls.
- Added plain-language explanations for Resource section titles and important labels.
- Added Latvian payroll defaults based on standard VSAOI split:
  - Employer VSAOI: 23.59%.
  - Employee VSAOI: 10.50%.
- Added gross monthly salary as an alternative labor-cost input method so human resource cost can be calculated from gross salary plus employer tax burden.

## 7. Machine Rate Calculator Added

- Replaced unexplained manual machine rates with a visible rate calculator in Resources.
- Added machine cost-driver fields:
  - Fixed monthly cost.
  - Planned hours per month.
  - Actual OEE.
  - Target OEE.
  - Variable EUR/h.
  - Optional target discount percent.
- Resources now calculates Accounting EUR/h and Target EUR/h.
- Accounting EUR/h uses actual OEE.
- Target EUR/h uses target OEE and optional target discount.
- Added formula text in Resources: fixed monthly machine cost / (planned hours x OEE) + variable hourly cost.
- Updated Case and Guide content to point reviewers to the Machine Rate Calculator when they ask where machine rates come from.

## 8. Actuals Feedback And Calibration Added

- Added Actuals Feedback section for each operation.
- Actuals capture:
  - Setup machine minutes.
  - Setup labor minutes.
  - Cycle machine minutes per part.
  - Cycle labor minutes per part.
  - Scrap percent.
  - Notes.
- Added quoted vs actual operation cost comparison in the selected rate mode.
- Added Apply to Templates action that averages actuals by operation type and updates Resources operation-template defaults.
- Marked calibrated templates as `company_estimate`; user must save Resources to persist them.

## 9. Mock ERP Integration Added

- Added backend mock ERP router in `backend/app/api/erp.py`.
- Added sample ERP datasets under `data/mock_erp/`:
  - Customers.
  - Parts.
  - Materials.
  - Stock.
  - BOM.
  - Routes.
  - Machines.
  - Labor finance.
  - Customer offer payloads.
- Added ERP part listing endpoint.
- Added ERP RFQ import endpoint that converts mock ERP BOM/material/route/customer data into quote-ready state.
- Added Customer Offer handoff endpoint that receives calculated offer data back from the calculator.
- Added sent-offer listing endpoint.
- Added Quote-screen ERP Connection Demo panel.
- Renamed user-facing wording from technical `mock ERP` language to clearer `ERP connection demo` / `sample ERP adapter` wording.
- ERP import fills customer, RFQ reference, part, quantity breaks, CAM repeat/new state, material stock piece cost, and operation route.
- ERP handoff sends quote metadata, quantity pricing, target/accounting prices, and source quote state back to the sample ERP payload store.
- Added backend tests for ERP RFQ import and Customer Offer round trip.

## 10. Tool Inventory And Missing Tool Cost Added

- Added editable tool inventory seed data to `data/baseline_assumptions.lv.json`.
- Added Resources Tool Inventory table with:
  - Tool type.
  - Diameter.
  - Corner radius.
  - Material suitability.
  - Available quantity.
  - Replacement cost.
  - Lead time.
  - Reusable flag.
  - Quality.
- Added default operation-level tool requirements for common CNC operations such as milling, drilling, tapping, engraving, and turning.
- Added Quote-side Tool Check section that matches required tools against inventory.
- Missing tools now appear as visible operation batch cost in the quote calculation payload.
- Added missing-tool treatment options: full charge, amortized charge, or ignored/included for management override.

## 11. Client Portal Demo Added And Then Reworked

- Added Client tab for a customer-facing RFQ intake demonstration.
- First version allowed multiple STEP/STP uploads and manual part rows.
- Reconsidered the Client tab after the user pointed out practical RFQ problems:
  - STEP file alone is usually not enough.
  - Drawing/specification is needed for tolerances, threads, surface finish, material, and QC.
  - Client should not see target vs accounting pricing.
  - Client should not choose internal complexity.
  - Client should not see stock material quantity or cost.
- Reworked Client tab from internal estimator into external RFQ intake.
- Client now provides:
  - STEP model.
  - Drawing/specification file.
  - Material requirement.
  - Tolerance requirement.
  - Inspection/documentation level.
  - Threads/inserts note.
  - Surface finish/treatment.
  - Delivery need.
  - Order quantity.
  - Annual quantity.
  - Notes.
- Client now sees one preliminary estimate range, not target/accounting alternatives.
- Complexity is inferred internally from RFQ signals.
- Stock assumptions remain internal.
- Added readiness/confidence signal explaining missing RFQ information such as missing drawing, material, or thread confirmation.
- Estimate range widens when required manufacturing information is missing.

## 12. Case And Guide Reworked

- Added Case tab for approval narrative and business diagnosis.
- Initial Case/Guide versions were too card-heavy and role-fragmented.
- Reworked Case tab around the core business question: why is the company forced into high prices?
- Added live diagnostic signals:
  - Accounting premium.
  - Premium versus target.
  - Missing tool exposure.
  - CAM/engineering cost.
- Added production cost backbone:
  - Sellable stock.
  - Engineering.
  - Route.
  - Readiness.
  - Commercial policy.
- Added explicit OEE formula: machine EUR/h = fixed machine cost / (planned hours x OEE).
- Added cost-pressure signal table showing where high prices come from and where the tool exposes each signal.
- Reworked Guide tab away from many small glossary cards into a production-cost calculation backbone.
- Added OEE example showing how the same fixed monthly machine cost becomes much higher EUR/h at low OEE.
- Added clearer explanation of target price, accounting price, accounting premium, and reasons quotes become too high.
- Added guidance on where different reviewers should look inside the tool.

## 13. Visual Refinement And Quote Cleanup Completed

- Applied grey/dark-neutral UI styling across tabs to reduce eye strain.
- Tightened spacing across panels and forms.
- Moved Target/Accounting mode selector from the top header into Quote Summary.
- Made Target/Accounting selector compact enough to fit inside Quote Summary.
- Removed the long explanatory text block from Quote Summary; detailed principles now live in Case and Guide.
- Added targeted CSS alignment fixes for Quote tab panels, form grids, ERP controls, draft controls, summary rows, and operation editor inputs.
- Removed unused Quote Summary explanation styling.
- Checked and corrected several misaligned form sections.

## 14. Demo Flow And Approval Support Added

- Added Load Demo RFQ button.
- Demo RFQ fills customer metadata, material, CNC route, quantity breaks, CAM settings, actuals, and calibration notes.
- Added Scenarios tab for comparing quote outcomes.
- Added Guide tab to make built-in principles self-explanatory for non-technical reviewers.
- Added Print tab to show how customer-facing and internal quote documents differ.
- Preserved the positioning that this is a demonstration and approval-flow tool first; practical production hardening comes later after the concept passes approval.

## 15. Documentation Actions Completed

- Pinned the original task and project focus in `README.md`.
- Added `todo.md` with remaining plan tasks so progress is not lost after a session break.
- Read `to_consider.md` and incorporated its points into planning and implementation direction.
- Updated this `logfile.md` to document all completed actions and major decisions.
- Current action: consolidated the build history into a cleaner chronological log on 2026-07-04.

## 16. Verification History

Last known verification during build-up:

- Frontend production build passes with `npm run build`.
- Backend tests pass with `python3 -m pytest`.
- Current backend suite includes costing, assumptions API, draft API, export API, and ERP mock API tests.
- Backend tests last reported 7 passing tests with one Starlette/httpx deprecation warning.
- Frontend dev server responds at `http://127.0.0.1:5173/`.
- Backend API responds at `http://127.0.0.1:8001/health`.

## 17. Current Local Runtime State

- Frontend dev server: `http://127.0.0.1:5173/`.
- Backend dev server: `http://127.0.0.1:8001`.
- Backend was started with `uvicorn app.main:app --reload --port 8001`.
- The project root is not currently a git repository, so there is no git commit history in this folder.

## 18. Known Deliberate Simplifications

- Storage is JSON-backed for demo speed, not production multi-user safety.
- STEP upload stores metadata only; no real STEP geometry parsing, feature recognition, or CAM time extraction exists yet.
- Client portal produces preliminary ranges only; formal Customer Offer still requires engineering confirmation.
- ERP integration is a mock/sample adapter, not a real ERP connector.
- Customer Offer handoff is represented as JSON payload storage, not a production ERP transaction.
- No authentication, user permissions, approval workflow, or audit trail exists yet.
- No production database exists yet.
- No real PDF/Excel server-side document generation exists yet.
- Machine and labor cost assumptions are editable but still seeded from assumptions, not verified company data.
- Tool inventory is simplified and demonstrates the principle rather than a full tool crib system.
- Latvians taxes are represented by editable defaults; they still require accounting review before any real use.

## 19. Remaining Important Work

- Add employee execution efficiency / plan-vs-fact logic by qualification, operation type, complexity, first-time setup, and repeat work.
- Improve route estimation for new STEP-based parts, especially when drawings/specs are incomplete.
- Add stronger data-quality scoring for client RFQs.
- Add realistic handling for customer-supplied material versus company-supplied material.
- Add real ERP connector abstraction once target ERP system and access rights are known.
- Add database-backed persistence if the demo is approved.
- Add authentication, roles, and audit history for production use.
- Add better formal Customer Offer output, likely PDF/Excel plus ERP payload.
- Add internationalization/localization if Latvian/English presentation is required.
- Validate all default assumptions with real Latvian manufacturer data and company accounting/production records.

## 20. Strategy Correction: Utilization vs OEE, Overhead, Profitability (2026-07-04)

The original framing conflated two different gauges. Corrected diagnosis: this company's OEE (performance when a machine has work loaded) is OK-ish; the real problem is low Utilization (how much of available time actually gets loaded with orders). Idleness is `1 - Utilization`, not `1 - OEE`. Changes made, frontend/data/docs only, no backend formula changes required (`commercial_policy.overhead_percent` already existed in the backend calculator; it was just never fed a non-zero value from the frontend):

- Added `actual_utilization_percent` / `target_utilization_percent` to every machine class, independent of `actual_oee_percent` / `target_oee_percent`. Re-seeded `data/baseline_assumptions.lv.json` so OEE reflects "runs fine when loaded" (~80-85%) and Utilization reflects the real, low order-load figures that were previously (incorrectly) stored as OEE.
- Reworked `machineRateFromDrivers` to `fixed cost / (planned hours x Utilization x OEE) + variable cost`; target rate defaults to 100% target Utilization (fully booked) with a modestly higher target OEE (optimized batch/setup).
- Added Idleness (`1 - Utilization`) display per machine, with a small Utilization/Idleness stacked bar, shown separately from OEE everywhere in the UI.
- Added Overhead Allocation section in Resources: one editable total monthly overhead (admin, sales, quality management, facility), spread either per machine hour (folded into machine EUR/h) or as an equivalent percent-of-cost coefficient (wired into `commercial_policy.overhead_percent`, replacing the previously hardcoded `0`). Both readouts derive from the same total so switching methods stays comparable and overhead is never double-counted.
- Added a purchase-price-to-fixed-cost helper per machine (purchase price, useful life, salvage %, other fixed costs -> suggested `monthly_fixed_cost_eur`, straight-line depreciation, with an Apply action).
- Added a new "Profitability" tab: department expenses (shared with Overhead Allocation), a stress-testable shop-wide Utilization scenario, and commercial policy combine into a monthly gross-profit bridge (hand-rolled waterfall chart: Revenue capacity -> minus machine direct cost -> minus overhead -> Gross profit/loss).
- Rewrote Business Case and Guide narrative: added "The Death Spiral" (accounting-rate pricing is sound bookkeeping but commercially unsafe as a growth strategy), "OEE vs. Utilization — Two Different Gauges", "Target Utilization Is The Strategy", and "Overhead Was Missing" panels.
- Added plain-language explanation cards for every new concept in Resources > Explanations.
- Verified: `python3 -m pytest` (backend, unchanged, still passes) and `npm run build` (frontend, passes) after each stage.

## 21. Independent Review Corrections (2026-07-04)

After section 20's build, an independent review of the section 20 changes surfaced five corrections, all applied:

1. **Target Utilization default changed from 100% to 70%**, still fully editable per machine (`DEFAULT_TARGET_UTILIZATION_PERCENT` constant, not a hardcoded literal scattered through the code). Rationale: standard cost accounting (IAS 2 / ASC 330 "normal capacity" rules) deliberately avoids pricing off theoretical full capacity — pricing at 100% target Utilization risks under-recovering fixed cost if real bookings land below that ceiling, a mirror-image risk to the death spiral itself.
2. **Softened the "no third option" framing** in the Business Case "Overhead Was Missing" panel: added that in the Baltic market price is the dominant purchasing factor for the large majority of orders (special requirements are typically under 10% of business), and broadened the list of realistic explanations for a cheaper competitor (less overhead, more efficient, already-depreciated equipment, different batch/scale) rather than a strict binary.
3. **Fixed a real bug in the Profitability Calculator**: `profitabilityRevenueMonth` was grossing up margin/risk only on machine direct cost, then subtracting overhead afterward un-marked-up — inconsistent with `calculator.py`'s `total_cost = subtotal + overhead + risk_allowance`. This understated required revenue and overstated gross profit. Fixed to gross up (direct cost + overhead) together, matching the core quote engine.
4. **Rebuilt all 7 machine classes' fixed cost forward from purchase price**, rather than back-solving an "other" cost bucket to match the old arbitrary `monthly_fixed_cost_eur` values. Purchase prices, useful lives, and salvage percentages are still estimates (industry_estimate quality, not verified), but the depreciation math is now genuinely load-bearing rather than reverse-engineered — this measurably changed machine EUR/h (generally lower, since operator labor is billed separately per operation and was not the source of the old high fixed-cost placeholders).
5. **Added an explicit "what this tool does not do" caveat**: Target price is a cost-side floor, not a market-side benchmark. No feature compares against real competitor prices or customer willingness-to-pay; that remains a manual, external step. Added to the Business Case panel and the Guide's "Where To Look" map.

Verified: `python3 -m pytest` and `npm run build` both pass after all five corrections.

## 22. Client Portal Review And Cutoff Calculator (2026-07-04)

An independent review of the Client Portal (`activeView === "client_portal"`) surfaced several gaps; the most serious was fixed this session:

- **Fixed: material cost did not scale with batch size at all.** `PortalPart.stockPieces` was hardcoded to `1` with no input field anywhere in the portal, so a 5-piece and a 500-piece order of the same material were charged identical material cost. The real intent (per user clarification) was cutoff/waste from fixed-dimension stock: a client ordering 20x1.5m pipe pieces from 2m stock needs 40m purchased, not 30m, because pieces don't divide evenly into stock length. Built a real cutoff calculator:
  - `MaterialExample` extended with `stock_shape` (round_bar/hex_bar/square_bar/tube/plate), `stock_length_mm`, `stock_width_mm` (plate only), `kerf_mm` (saw cut loss).
  - Linear stock: `stock_pieces_required = ceil(quantity / floor((stock_length_mm + kerf_mm) / (cut_length_mm + kerf_mm)))`.
  - Plate: rough area-based estimate with a packing-efficiency factor (0.82 default), explicitly not true 2D nesting.
  - Re-seeded `material_examples` with 7 curated, dimensioned stock items typical for milling/turning (round/hex/square bar, tube, plate) replacing the 2 dimensionless placeholders.
  - Added to both the Quote Builder (RFQ panel Cutoff Calculator helper, Apply button writes into `stockPieces`) and the Client Portal (per-part cut length/width fields, computed automatically, shown internally alongside a readiness flag when no library material is selected so cutoff can't be calculated).
- **Not yet fixed, flagged for follow-up**: portal always prices off the Target rate with no visibility to staff; thread/insert cost uses a flat placeholder instead of real Tool Inventory data; no missing-tool check in the portal at all; adjustment-factor multipliers (complexity/tolerance/QC/delivery) are hand-picked and uncalibrated; no workflow bridge from a portal RFQ into a real Quote Builder draft; no persistence/export of portal RFQs; annual volume signal barely used (only a flat material discount, no CAM repeat-part linkage).

Verified: `python3 -m pytest` and `npm run build` pass after all portal/cutoff changes.

## 23. Client Portal Follow-Ups Completed (2026-07-04)

All remaining agreed items from section 22's follow-up list were implemented:

- **Target-rate visibility for staff**: `calculatePortalEstimates` now fetches both Target and Accounting quotes per part. A new "Show internal pricing detail" toggle per part reveals the Accounting cross-check price, the % gap versus the client-facing Target price, and a warning framing when the gap exceeds 25% ("today's real capacity cannot yet support this price without more orders"). The client-facing box is unchanged (Target-only range).
- **Real Tool Inventory integration**: the flat €0.35 thread/insert guess is gone. The portal route now conditionally includes a real `tapping` operation (with the actual M5-tap tool requirement) when threads/inserts are requested, and every route operation carries its real default tool requirements, checked against `tool_inventory` via the same `checkToolRequirement`/`findToolForRequirement` logic the main Quote Builder uses (refactored `missingToolBatchCostForOperation` into a reusable `missingToolBatchCost(toolRequirements, operation?)` so both surfaces share one implementation). Missing tools now add real batch cost and are listed in the internal detail panel.
- **Adjustment-factor transparency**: the internal detail panel shows the actual complexity/tolerance/QC/delivery multipliers applied and the combined factor, labeled as "heuristic placeholders, not calibrated against actuals" rather than a silent black box.
- **Workflow bridge**: a "Send to Quote Builder" button per part builds a real `QuoteOperation[]` route (with tool requirements), populates the Quote Builder's RFQ state (material, cutoff fields, CAM settings, quantity), switches to the Quote view, and clears `draftId` so it doesn't silently overwrite an existing draft. This gives portal RFQs the persistence/export/print the main Quote Builder already has (drafts, JSON/CSV, Print) instead of building a parallel system, and closes the "manual confirmation required" promise the portal copy makes.
- **Annual volume signal**: added an informational-only "Repeat-order CAM savings estimate" (declared annual volume >= 2x order quantity) shown in the internal detail panel. It does not change this order's price -- the current order is still correctly priced as new-part CAM in full.
- Added a "Client Portal Methodology" explanation card covering all of the above.

Verified: `python3 -m pytest` and `npm run build` pass.

## 24. Current Recommended Next Step

The best next implementation step is to add an employee efficiency and execution-risk layer. Machine rate and material logic are now visible enough for demonstration, but labor productivity and plan-vs-fact variation can strongly affect quoted cost, especially for first-time parts, complex setups, manual deburring/QC, and low-repeat work. The Client Portal follow-ups from sections 22-23 are now complete; remaining known gaps there are the uncalibrated adjustment-factor values themselves (need real actuals) and true 2D nesting for plate (currently a rough area estimate).
