# Project Audit: Configurable Inputs, Hardcoded Logic, and Gaps

Date: 2026-07-05

## What Is Actually Configurable

- Quote RFQ metadata, quantity breaks, material stock cost/pieces, scrap recovery, CAM complexity/minutes, route operations, setup/run time, scrap, tooling/consumables/outsourced costs, missing-tool treatment, actuals feedback, and competitor unit price are editable in the Quote/Scenarios workflow.
- Commercial policy, CAM defaults, client portal range factors, labor classes, machine rate drivers, material library, tool inventory, operation templates, overhead items, and full assumptions JSON are editable through Resources.
- The new Company Profile tab now gives a client-friendly profile builder for production assets, low-value inventory reserve, employees/direct labor vs overhead, and facility/utilities/insurance overhead. Applying a profile updates the same assumptions used by quotes and profitability.
- Quote drafts persist full quote state plus target/accounting results and assumption snapshots.
- Company profiles persist separately from baseline assumptions, so alternate company setups can be loaded, edited, saved, and applied.

## Deliberate Mock / Approved Demo

- ERP import/export is a mock adapter over `data/mock_erp/*.json`. It is good enough to demonstrate import/export confidence, but it is not a real ERP connector and should stay described that way.

## Hardcoded or Heuristic Areas

- Client Portal complexity and adjustment factors are hardcoded heuristics in `frontend/src/main.tsx`; they are documented, but not editable from Resources.
- Default tool requirements by operation type are hardcoded in `defaultToolRequirementsForOperation()`, although individual quote requirements and tool inventory are editable.
- Portal default route selection is hardcoded: saw cutting, 3-axis milling, drilling, optional tapping, manual inspection.
- The plate cutoff packing efficiency is hardcoded at `0.82`.
- Fallback defaults remain in code for payroll tax, paid hours, target utilization, availability, stock cost, portal range, and CAM minutes when assumptions are missing.
- Print output currently renders a customer-oriented quote only. The guidebook describes customer/internal print modes, but the implemented UI does not expose that mode switch.
- The guidebook describes Resources `Values` and `Explanations` sub-tabs. The current Resources UI has editable values and inline explanations, but no actual sub-tab split.

## Real-Life Simulation Gaps

- STEP files are metadata only; no geometry parsing, feature extraction, tolerances, nesting, material mass, or machining physics are computed.
- Operation templates are per operation type, not per part family/material/tolerance family.
- Actuals calibration updates shared operation templates; it does not normalize by part family, machine, operator, material, or fixture strategy.
- Tool requirements are seeded by operation type, not generated from geometry or CAM data.
- Material costing starts from purchasable stock and a rough cutoff model; it is not supplier-integrated and plate nesting is approximate.
- Capacity/profitability is monthly and deterministic; it does not model order mix, queueing, delivery dates, shift calendars per asset, bottlenecks, or cash timing.
- Market price comparison is user-supplied only. The tool does not benchmark competitors or customer willingness-to-pay.
- Backend calculation trusts the frontend-resolved machine/labor rates, except for rate-driver mismatch warnings. A future production version should move more assumption resolution server-side.

## Recommended Next Steps

- Move Client Portal heuristic factors and default route rules into editable assumptions.
- Add internal/customer print modes or update the guidebook to match the current print implementation.
- Add profile import/export JSON so profiles can move between demo environments.
- Add part-family-aware actuals calibration before relying on template updates for production quoting.
- Keep ERP as a mock demo until a real client system and field mapping are known.
