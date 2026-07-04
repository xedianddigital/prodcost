# ProdCost

Production cost calculator for CNC-focused metalworking manufacturers quoting external customer work.

The project starts from a practical constraint: early quotes often have incomplete data. The cost model therefore supports progressive precision levels, from a fast estimate to operation-level costing and later actuals feedback.


## Pinned Objective

Build a web-based production cost calculator for Latvian/CEE metalworking manufacturers with CNC milling and turning capacity, focused on external-client quoting. The original business problem is that the target company has years of negative net profit and low machine OEE, yet quoted prices are reportedly 3-4x higher than competitors. The tool must help expose whether that gap comes from costing logic, idle-capacity burden, weak assumptions, missing data, routing/material/tooling reality, or genuinely expensive production.

The calculator must support layered precision: fast estimates when data is incomplete, operation-based costing when route data exists, resource-accurate costing when machine/labor/material data is available, and actuals feedback for calibration. It must use editable assumptions first, then show a credible path to ERP-sourced data, STEP-file-driven new-part workflows, tool inventory checks, and ERP customer-offer handoff.

## Current Scope

- Single-company quote calculator.
- Manual quote inputs.
- Configurable Latvian starter assumptions, editable through the web UI.
- Operation-based costing for common metalworking flows, with operations added from editable resource templates.
- Explicit separation of production cost, margin, and quoted selling price.
- Scenario-ready quote builder comparing accounting full-cost rates against target competitive rates.
- Mock ERP adapter for importing BOM/material/route/customer data and sending Customer Offer payloads back to ERP.
- Editable tool inventory with quote-side missing-tool checks and cost treatment.
- Client RFQ portal demo for multi-part STEP uploads and preliminary pricing before manual confirmation. Prices at the Target rate for the client, with an internal-only Accounting cross-check, a real Tool Inventory check (including a real tapping/tap-tool check when threads are requested), a Cutoff Calculator for material waste from fixed stock dimensions, and a "Send to Quote Builder" bridge into a real quote draft.
- Principles Guide tab explaining pricing logic, tab purpose, role-specific meaning, and data-quality assumptions.
- Machine rates driven by two separate gauges: OEE (performance when a machine has work loaded) and Utilization (whether it has work loaded at all). Idleness (1 - Utilization) is the empty-order gap; it is never derived from OEE.
- Overhead Allocation in Resources: one editable total monthly overhead (admin, sales, quality management, facility), spread per machine hour or expressed as a percent-of-cost coefficient.
- Machine Rate Calculator can derive `Fixed cost EUR/month` from equipment purchase price, useful life, salvage %, and other known fixed costs.
- Profitability Calculator tab: a standalone "can we be profitable" estimate from department expenses, a stress-testable shop Utilization scenario, and commercial policy, independent of any single quote.

## Repository Layout

```text
backend/       FastAPI API and deterministic costing engine
frontend/      React + TypeScript UI scaffold
data/          Editable baseline assumptions and seed data
docs/          Architecture, costing model, assumptions, roadmap
```

## Demo Flow

Use `Load Demo RFQ` on the Quote screen for an approval-ready walkthrough. The demo fills customer/RFQ metadata, material, CNC route, quantity breaks, actuals, and calibration notes. Use the `Case` page for the approval narrative.

## First Development Milestones

1. Stabilize the cost formula contract with unit tests.
2. Build the quote builder UI against sample data.
3. Persist quotes, assumptions, resources, and calculation snapshots.
4. Add quote versioning and accounting-vs-target rate scenarios.
5. Add PDF/Excel export once the calculation model is trusted.

## Local Development

Backend:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend development server proxies `/api` requests to `http://localhost:8001`.

Open `Resources` in the UI to edit the baseline assumptions stored in `data/baseline_assumptions.lv.json`. Structured fields cover the most common commercial, CAM, labor, machine-rate, material-library, and operation-template timing values; the full JSON editor exposes every remaining seed value. The Resources explanations tab defines the terminology, documents Latvian gross salary conversion, and explains how actuals can calibrate operation templates.

Quote drafts are saved through the UI to `data/quote_drafts.json`. Each draft stores the editable quote state, operation route, quantity breaks, actuals feedback, target/accounting calculation results, and an assumptions snapshot. Saved drafts can be exported as JSON or CSV from the Quote screen, including quantity break results. The Print view provides a browser-printable quote summary that can be saved as PDF. It supports customer/RFQ/quote metadata and two formal document modes: Customer Offer and Internal Cost Sheet, both with quantity pricing.

## Baseline Assumptions

Starter assumptions are intentionally not treated as truth. They live in `data/baseline_assumptions.lv.json` and should be replaced as soon as company-specific data is available.

Primary public references currently used for calibration:

- Latvia Official Statistics Portal, wages and salaries: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries
- Latvia Official Statistics Portal, 2025 wages press release: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries/press-releases/26599-wages-and-salaries-4th?themeCode=DS
- Latvia Official Statistics Portal, Q1 2026 wages press release: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries/press-releases/27579-wages-and-salaries-1st?themeCode=DS
- Eurostat non-household electricity prices dataset: https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table?lang=en

