# ProdCost Build Log

## Initial Context

The project started from an interview case for a Latvian metalworking manufacturer. The company mainly serves an internal group client but wants more external work. It has relatively modern CNC milling and turning capacity, low OEE, and insufficient orders. The stated pricing problem is severe: calculated customer prices can be 3-4x above market alternatives in Central/Eastern Europe.

The working hypothesis is that the company may not understand its real quote cost structure well enough. Low utilization, accounting burden allocation, incomplete routing assumptions, material stock waste, setup/CAM effort, missing tooling, and weak feedback from actual production can all distort pricing.

## Implemented Project Foundation

- Created a clean web project in `/home/xediand/prodcost`.
- Added FastAPI backend with deterministic costing engine.
- Added React + TypeScript + Vite frontend.
- Added editable Latvian starter assumptions in `data/baseline_assumptions.lv.json`.
- Added project documentation in `README.md` and `docs/`.
- Added local dev setup using backend port `8001` because port `8000` was occupied.

## Costing Engine

- Implemented material, engineering/CAM, operation, overhead/risk, margin, and sell-price calculation.
- Separated production cost from commercial sell price.
- Added formula version `costing.v0.1`.
- Added target competitive vs accounting full-cost rate modes.
- Added unit tests for quote calculation.

## Assumptions And Resources

- Added web-based Resources editor backed by `data/baseline_assumptions.lv.json`.
- Added structured editors for commercial policy, CAM defaults, labor classes, machine classes, material library, and operation templates.
- Added full JSON editor for all remaining assumption fields.
- Added plain-language Resources explanations for terminology such as Accounting EUR/h, Target EUR/h, OEE, Power kW, labor cost, and operation templates.
- Added Latvian payroll defaults based on VID standard VSAOI split: 23.59% employer and 10.50% employee for standard insured employees.
- Added gross-monthly-salary labor-cost calculation as an alternative to direct hourly cost.

## Quote Builder

- Added RFQ/customer metadata fields: customer, RFQ/reference, quote number, validity date, delivery estimate, payment terms.
- Added material library selection with manual override.
- Added STEP metadata upload field. Full STEP geometry parsing is intentionally not implemented yet.
- Added new-part vs repeat-part CAM logic. New parts include full CAM/programming/prove-out; repeat parts use reusable-program reduction.
- Added editable operation route rows from Resources operation templates.
- Added machine/labor resource selection per operation.
- Added editable setup, cycle, tooling, consumables, outsourced cost, and scrap assumptions per operation.
- Added live target vs accounting calculations.
- Added quantity break pricing with target/accounting totals, unit prices, and premium per unit.

## Drafts, Export, And Print

- Added JSON-backed quote draft persistence in `data/quote_drafts.json`.
- Drafts store quote state, route, quantity breaks, actuals feedback, target/accounting results, and assumptions snapshot.
- Added JSON and CSV export for saved quote drafts.
- Added printable document view with two modes:
  - Customer Offer: customer-safe output, hides internal costs.
  - Internal Cost Sheet: includes target/accounting comparison, cost breakdowns, route, assumptions, and actuals feedback.

## Actuals And Calibration

- Added Actuals Feedback section for each operation.
- Actuals capture setup machine/labor minutes, cycle machine/labor minutes per part, scrap %, and notes.
- Added quoted vs actual operation cost comparison in the selected rate mode.
- Added Apply to Templates action that averages actuals by operation type and updates Resources operation-template defaults.
- Calibration marks affected templates as `company_estimate`; user must save Resources to persist.

## Demo And Approval Support

- Added Load Demo RFQ button.
- Demo RFQ fills customer metadata, material, route, quantity breaks, CAM settings, actuals, and calibration notes.
- Added Case page with approval narrative explaining pricing pain, target/accounting rates, assumption transparency, actuals learning loop, and pilot success criteria.

## Verification Status

Last verified checks during build-up:

- Frontend production build passes with `npm run build`.
- Backend tests pass with `python3 -m pytest`. Current suite includes costing, assumptions API, draft API, and export API tests.
- Frontend dev server responds at `http://127.0.0.1:5173/`.
- Backend API responds at `http://127.0.0.1:8001/health`.

## Known Deliberate Simplifications

- Storage is JSON-backed for demo speed, not production multi-user safety.
- STEP upload stores metadata only; geometry parsing and feature extraction are future work.
- Tool inventory is not implemented yet.
- Customer Offer generation is browser-printable and exportable as JSON/CSV, but not yet handed back to ERP.
- No authentication, permissions, or audit trail yet.

## Mock ERP Integration

- Added backend mock ERP adapter endpoints for ERP part listing, quote-ready RFQ import, Customer Offer handoff, and sent-offer listing.
- Added seeded ERP datasets under `data/mock_erp/` for customers, parts, BOM, routes, materials, stock, machines, labor finance, and customer offer payloads.
- Added Quote-screen ERP Mock Integration panel.
- ERP import now fills customer, RFQ reference, part, quantity breaks, new/repeat CAM state, material stock piece cost, and operation route.
- Customer Offer handoff sends a clean ERP-facing payload with quote metadata, quantity pricing, target/accounting prices, and source quote state.
- Added backend tests for ERP RFQ import and mock Customer Offer round trip.

## Tool Inventory And Missing Tool Cost

- Added editable tool inventory seed data to `data/baseline_assumptions.lv.json`.
- Added Resources Tool Inventory table for tool type, diameter, corner radius, material suitability, available quantity, replacement cost, lead time, reusable flag, and quality.
- Added default operation-level tool requirements for common CNC operations such as milling, drilling, tapping, engraving, and turning.
- Added Quote-side Tool Check section that matches required tools against inventory.
- Missing tools now add visible operation batch cost through the quote calculation payload.
- Missing tool treatment can be adjusted per requirement as full charge, amortized charge, or ignored/included for management override.

## Quote UI Clarity Pass

- Moved Target/Accounting rate-mode switcher from the page header into Quote Summary.
- Added plain-language definitions for Target price, Accounting price, and Accounting premium beside the quote numbers.
- Added units to many quote labels and table headers, including EUR, EUR/pc, EUR/h, min, min/part, pcs, and %.
- Added Engineering Operation section so CAM/programming is visible as a route-like step before production operations.
- Kept the current calculation model unchanged; CAM still uses the existing engineering cost formula while being presented more clearly in the workflow.

## Client Portal Demo

- Added Client tab for customer-facing RFQ intake demonstration.
- Client portal supports multiple STEP/STP uploads and manual blank part rows.
- Each part captures quantity, tolerance class, mandatory QC requirement, surface finish, material/stock, stock cost, stock pieces, and complexity.
- Portal calculates one client-facing preliminary estimate range per part using the existing quote calculation API.
- Portal shows total preliminary order estimate range and states that manual engineering confirmation is required before formal Customer Offer.
- STEP parsing remains metadata-only; route and CAM estimates are generated from assumptions and specification factors.

## Guide And Visual Refinement

- Added a dedicated Guide tab for built-in principles and terminology.
- Replaced user-facing "mock ERP" wording with "ERP connection demo" and "sample ERP adapter" to make the integration concept clearer to non-technical reviewers.
- Added role-oriented explanations for production manager, accounting manager, and CEO/general manager.
- Added a simple flow chart explaining input, reality checks, cost model, output, and learning loop.
- Added plain-language explanations for Quote, ERP connection, Target price, Accounting price, Accounting premium, low-utilization burden, Client Portal, Resources, Scenarios, Print, Case, and data quality.
- Tightened visual spacing across panels and made the Target/Accounting selector compact enough to fit in Quote Summary.

## Case And Guide Rewrite

- Reworked Case tab around the core approval argument: why the company is forced into high prices.
- Added live diagnostic signals for accounting premium, premium versus target, missing tool exposure, and CAM/engineering cost.
- Added production cost backbone: sellable stock, engineering, route, readiness, and commercial policy.
- Added explicit OEE formula: machine EUR/h equals fixed machine cost divided by planned hours times OEE.
- Added cost pressure signal table showing where high prices come from and where the tool exposes each signal.
- Reworked Guide tab away from many small glossary cards toward a production-cost calculation backbone.
- Added OEE example showing how the same fixed monthly machine cost becomes much higher EUR/h at low OEE.
- Added clearer explanation of target price, accounting price, accounting premium, and reasons quotes become too high.

9. Machine-rate calculator. DONE for Resources v0.
   - Accounting and target machine rates are calculated from fixed cost, planned hours, OEE, variable hourly cost, and optional target discount.
   - This answers where Target EUR/h and Accounting EUR/h come from.


10. Client portal RFQ realism. DONE for portal v1.
   - Client sees one preliminary estimate range, not target/accounting.
   - Client provides STEP plus drawing/specification, material, tolerances, QC, finish, delivery, and quantity.
   - Internal stock quantity, stock cost, and complexity are hidden from the client.

