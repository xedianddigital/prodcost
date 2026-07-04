# Roadmap

## Phase 0: Project Foundation

- Define costing contract.
- Add editable Latvian starter assumptions.
- Add backend cost engine with tests.
- Add frontend quote-builder scaffold.

## Phase 1: Usable Manual Calculator

- Create quote manually.
- Add material stock line.
- Add operations.
- Calculate breakdown.
- Compare accounting vs target rate scenario. Done in the quote builder for live operation rows.
- Export saved quote breakdown as JSON/CSV. Done for quote drafts.

## Phase 2: Persistence and Quote History

- PostgreSQL schema and migrations.
- Saved quotes and revisions.
- Assumption set versioning.
- Resource library for machines, labor classes, and materials.

## Phase 3: Commercial Quote Workflow

- Customer/RFQ/quote metadata on quote drafts. Done as draft fields; full customer records can follow with database persistence.
- Printable Customer Offer and Internal Cost Sheet. Done through browser print/PDF; server-side PDF can follow after layout approval.
- Quantity-break pricing. Done in Quote builder for target and accounting rates.
- Approval states.
- Margin and discount guardrails.

## Phase 4: Calibration

- Actuals feedback entry for setup/cycle/scrap by operation. Done in the quote screen; import can follow later.
- Quoted vs actual variance.
- Operation benchmark library. Started through actuals-to-template calibration; historical benchmarks can follow with database persistence.
- Recommended setup/cycle updates.

## Phase 5: Strategy Correction — Utilization, Overhead, Profitability

- Separate OEE (performance when loaded) from Utilization (whether time is loaded with orders at all); Idleness is derived from Utilization only. Done in Machine Rate Calculator and Guide/Case narrative.
- Death-spiral framing: accounting-rate pricing is sound bookkeeping but unsafe as a growth strategy. Done in Business Case.
- Overhead Allocation: editable total monthly overhead, spread per machine hour or as a percent-of-cost coefficient, both derived from the same input. Done in Resources.
- Fixed cost transparency: derive `monthly_fixed_cost_eur` from purchase price, useful life, salvage %, and other known fixed costs. Done in Machine Rate Calculator.
- Profitability Calculator: standalone monthly gross profit/loss estimate from department expenses, a stress-testable shop Utilization scenario, and commercial policy, independent of any single quote. Done as a new tab.

