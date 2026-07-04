# Fix Brief — Logic & Execution Gaps (from review 2026-07-04)

Execute all items. This brief is self-contained; the review conclusions are restated inline.
Order matters: items 1–3 change the rate/cost formula contract and everything downstream
(examples, tests, docs) must be recomputed **after** them. Bump the formula version to
`costing.v0.2` (backend `FormulaVersion`) as part of this batch — items 2, 4, 5, 6 change
calculated numbers.

Global decision already made by the owner: **Target Utilization default = 95%** (not 70%,
not 100%).

---

## 1. Target Utilization: settle on 95% everywhere

Problem: code/model default is 70% (`frontend/src/main.tsx:494`, seed data, `docs/costing-model.md:145-147`),
while the Business Case / Guide prose and `docs/architecture.md:71` still teach 100% ("fully
booked shop"). The approval narrative contradicts the calculator.

Fix:
- `DEFAULT_TARGET_UTILIZATION_PERCENT = 0.95` in `frontend/src/main.tsx:494`.
- All 7 machines in `data/baseline_assumptions.lv.json`: `target_utilization_percent: 0.95`.
- `docs/costing-model.md:145-147`: rewrite the rationale — 95% is a near-fully-booked
  commercial ambition with a small buffer below theoretical capacity; keep the IAS 2 /
  ASC 330 normal-capacity point (don't price off theoretical 100%), drop the "70% starting
  point" framing, keep "editable per machine, never hardcoded".
- `docs/architecture.md:71`: "default 100%" → "default 95%".
- `frontend/src/main.tsx:3489` (Death Spiral panel), `:3585` (worked example), `:3593`
  (Guide target scenario): replace "100% Utilization / fully booked" with 95% and
  recompute the worked example numbers (do this AFTER item 2, since the rate formula
  changes). Also update the comment at `main.tsx:491-493`.
- Grep the whole repo for `70%`, `0.7`, `100% Utilization`, `fully booked` to catch stragglers
  (README, Guide cards, Case text, `to_consider.md` is a log — leave logs as-is).

## 2. OEE double-counting in machine rates

Problem: `machineRateFromDrivers` (`main.tsx:396-401`) divides fixed cost by
`planned_hours × utilization × OEE` where OEE = availability × performance × quality. But
cycle/setup times are inputs too, and the calibration loop (item 8) feeds *measured* times
into them. Measured times already contain performance losses; scrap allowance already covers
quality losses. So performance and quality get charged twice: once as slower minutes, once
as a higher EUR/h.

Fix (decision): only **availability** belongs in the rate denominator.
- Add per-machine fields `actual_availability_percent` and `target_availability_percent`
  to `data/baseline_assumptions.lv.json` (seed: actual 0.80, target 0.90 — tune so
  accounting/target rates stay in a plausible EUR/h band; document the chosen seeds).
- Rate formula becomes `fixed_cost / (planned_hours × utilization × availability) + variable + overhead_per_hour`.
  Update `machineRateFromDrivers`, `totalPlannedProductiveHours`, `overheadPerMachineHour`,
  `blendedDirectMachineRate`, `overheadPercentEquivalent`, the Machine Rate Calculator UI,
  and the Profitability Calculator hours (`profitabilityEffectiveHours`) to use
  availability, not full OEE.
- Keep `actual_oee_percent` / `target_oee_percent` as **diagnostic display** (per-machine
  gauges, Case signals) — they no longer enter EUR/h math.
- Docs (`costing-model.md` Machine Rates section, Guide/Case OEE explanations, `assumptions.md:67`):
  state explicitly that performance losses live in cycle/setup minutes, quality losses in
  scrap allowance, and only availability scales the rate — name the double-count this avoids.
- Machine Rate Calculator explanation cards updated to match.

## 3. Backend must own (or verify) the rate math — `rate_mode` is decorative

Problem: the backend receives already-resolved EUR/h from the frontend; `rate_mode` is a
label it never checks, and the load-bearing rate/overhead derivation exists only in
TypeScript, untested by pytest.

Fix:
- Port the rate derivation to a pure Python module `backend/app/costing/rates.py`:
  machine rate from drivers (per item 2), overhead-per-machine-hour, percent-equivalent,
  blended rate. Full pytest coverage with the same numbers as the seed data.
- Extend `OperationInput` with optional `rate_drivers` (fixed cost/month, planned hours,
  utilization, availability, variable EUR/h, overhead method inputs). When present, the
  backend recomputes the rate, and if it differs from `machine_hour_rate_eur` by > 1%,
  appends a warning naming the operation and both numbers ("rate label may not match
  drivers"). Frontend sends drivers for every operation with a selected machine class.
- Keep the frontend TS implementation but add a comment pointing at `rates.py` as the
  contract; ideally add one frontend-vs-backend fixture test (same JSON in, same EUR/h out).

## 4. Quantity breaks use frozen material quantity

Problem: `quotePayloadForMode(mode, overrideQuantity)` (`main.tsx:1285-1339`) overrides
quantity per break but keeps `stock_pieces_required: stockPieces` from the main quantity.
The 250-pc break is priced with 50 pcs of material.

Fix:
- When a library material with cut-length data is selected, recompute stock pieces per
  break via `stockPiecesRequiredForMaterial(material, cutLengthMm, cutWidthMm, breakQuantity)`.
- When no cutoff data exists (manual stock pieces), scale proportionally:
  `ceil(stockPieces / quantity × breakQuantity)`, min 1 — and append a visible note in the
  quantity-break table that material was scaled linearly, not cutoff-optimized.
- Same rule applies to the missing-tool batch cost? No — batch costs stay per-batch. Only
  material scales.
- Add a frontend check or backend test fixture proving unit material cost differs across
  breaks when cutoff data exists.

## 5. Profitability Calculator is circular — can never show a loss

Problem: `profitabilityRevenueMonth` (`main.tsx:557-561`) derives revenue from the scenario's
own cost (`(direct+overhead)×(1+risk)/(1−margin)`), so gross profit ≥ 0 for any margin > 0 at
any Utilization. The "route from negative to positive" bridge cannot go negative.

Fix (decision): revenue and cost must move independently.
- **Price per hour is fixed at the pricing basis**: compute a blended target sell rate
  EUR/h once, at target utilization (95%) and target availability — i.e. what the shop
  charges per sold machine hour under its commercial policy (direct rate + overhead/h,
  grossed up by risk and margin).
- **Sold hours follow the scenario**: `planned_hours × availability(target) × utilization_scenario`
  per machine.
- Revenue = sold hours × fixed sell rate. Costs = full monthly fixed cost (does NOT shrink
  with the scenario) + variable × sold hours + full monthly overhead.
- Gross profit = revenue − costs. At low scenario utilization this now goes negative —
  verify: with seed data at the actual ~35-50% utilization the bridge should show a loss;
  at 95% it should show profit.
- Update the explanation card (`main.tsx:3366`) and the bridge chart labels; add a line
  showing the break-even utilization (solve revenue = cost for the scenario variable —
  linear, closed form).

## 6. Cost formula fixes (backend `calculator.py`, mirror in frontend estimate at `main.tsx:1280`)

6a. **Scrap allowance must not multiply setup or batch costs** (`calculator.py:94`).
    Apply `scrap_allowance_percent` only to run machine/labor cost + per-part variable
    (tooling, consumables, outsourced per part). Setup and `outsourced_batch_cost` stay
    outside. Update the CostLine details and tests.

6b. **Cumulative yield across the route.** To ship Q good parts, quantity started at op i
    is `Q / Π(1 − scrap_j)` for j ≥ i (ops in route order). Run cost of op i uses its
    started quantity; material stock pieces are computed from the op-1 started quantity
    (round up). Requires the backend to treat `operations` as ordered (it already is a
    list). Expose per-op `started_quantity` in CostLine details. Keep it simple: per-op
    scrap defaults are small; guard against scrap ≥ 1. Docs: replace the "two levels of
    scrap" section in `costing-model.md` with the sequential-yield formula.

6c. **Overhead percent_of_cost base = conversion cost only.** Today `overhead_percent`
    multiplies the whole subtotal incl. material, outsourced work, and CAM
    (`calculator.py:168`), so the two allocation methods diverge on material-heavy quotes
    while `costing-model.md:153-158` claims they're comparable. Fix: overhead_percent
    applies to conversion cost = operation machine+labor cost (setup + run, post-scrap)
    + engineering cost, excluding material, tooling/consumables pass-through, and
    outsourced costs. Recompute `overheadPercentEquivalent` accordingly (same base).
    Update docs to state the base explicitly.

6d. **Pass-through visibility warning.** When (material + outsourced) > 40% of total cost,
    append a warning that full risk and margin are being applied to pass-through cost and
    that this is a known driver of uncompetitive quotes.

6e. **Commercial multiplier visibility.** Add `commercial_multiplier` to `QuoteResult`
    (= sell_price / subtotal_before_policy) and display it in Quote Summary as
    "Commercial multiplier ×N (overhead, risk, margin, min-order admin)".

## 7. Diagnostic gap: the tool can't answer its own founding question

Problem: the pinned objective is to expose *which* driver makes quotes 3–4× too high.
The tool isolates only one (utilization burden via target-vs-accounting).
`docs/architecture.md:72` promises Level 3 "sensitivity by OEE, Utilization, batch size,
and margin" — not implemented. No competitor-price input exists.

Fix (Scenarios tab):
- **Gap waterfall**: decompose accounting price − target price into named steps by
  recalculating with one driver switched at a time, in a fixed order (utilization →
  availability → overhead basis). Show EUR and % per step.
- **Sensitivity table**: unit target price at ±10% and ±25% on: utilization, availability,
  cycle times, material cost, margin. Reuse the existing calculate API; 10 extra calls
  are fine.
- **Competitor price input**: one field "competitor/market unit price EUR". Output: the
  gap in EUR/%, plus back-solved single-driver answers — required blended EUR/h, required
  utilization, and required margin that would each alone close the gap (closed-form from
  the cost structure; label clearly "single-driver what-ifs"). Persist the field in drafts.
- Update `costing-model.md` "What This Model Does Not Do" — market comparison is now an
  input the user supplies, still not scraped/benchmarked automatically.

## 8. Calibration loop corrupts templates

Problem: `applyActualsToTemplates` (`main.tsx:2113`) averages actuals by operation type
across unrelated parts and overwrites the template; one odd job swings the default for all
future quotes.

Fix:
- Templates gain `calibration_sample_count` (and keep `quality`). Apply = running weighted
  mean: `new = (old × n + mean(actuals) × k) / (n + k)`, n capped at e.g. 20 so it stays
  adaptive.
- Before applying, show a confirm summary per affected template: old → new values and the
  deviation. If any new value deviates ×3 or more from the old, require an explicit
  per-template checkbox.
- Persist sample counts in `baseline_assumptions.lv.json`; note in the Resources UI.
- Docs (`assumptions.md`, Guide): calibration is per operation type, not per part family —
  state the limitation; part-family normalization stays future work.

## 9. Tool check isn't part-driven and hides its cost

Problem: tool requirements are generated from operation-type templates, not the part —
the check validates owning generic tools, not the ⌀3.5 reamer this part needs. Missing-tool
cost is folded into `outsourced_batch_cost_eur`, indistinguishable from real outsourcing in
exports.

Fix:
- Quote-level editable "Required tools" list per operation: type + diameter/radius +
  material suitability, seeded from the operation template but editable per quote. Matching
  against inventory by type + dimension (exact type, diameter within tolerance field, e.g.
  ±0.05 mm default, editable).
- Backend: add `missing_tool_batch_cost_eur` to `OperationInput`; calculator emits it inside
  the operation CostLine details AND sums it into a dedicated top-level result field
  `missing_tool_cost_eur`. Frontend stops adding it to `outsourced_batch_cost_eur`
  (`main.tsx:1328` and the local estimate at `:1280`).
- Exports (CSV/JSON/print internal sheet) show the missing-tool line separately.
- Guide/Case text: be honest that dimensions come from the operator-edited requirement
  list, not parsed geometry, until STEP parsing lands.

## 10. Client Portal fixes

10a. **qcFactor display mismatch** (`main.tsx:1387`, `:3009`): `combined` excludes QC
     (QC intentionally scales only inspection ops). Keep the costing as-is; fix the label:
     "combined ×N (QC ×M applies to inspection operations only)".
10b. **Drop file-size-in-bytes as a complexity signal** (`main.tsx:1367`). Redistribute the
     score weights over the remaining signals so the same seed inputs land in the same
     complexity classes where reasonable; note the change in the heuristic disclaimer.
10c. **Anchoring**: widen the client-facing range asymmetrically pending calibration —
     make range factors editable assumptions (`client_portal.range_low_factor` /
     `range_high_factor`, seed 0.85 / 1.35) instead of whatever is hardcoded now, and
     strengthen the on-screen disclaimer: preliminary, subject to engineering confirmation,
     confirmed price may differ materially.
10d. **Portal annual-volume relief** (`main.tsx:1391`, hardcoded 0.92): move to an editable
     assumption with the same seed value.

## 11. Persistence safety

Problem: `data/*.json` writes (drafts, assumptions, ERP offer payloads) are read-modify-write
with no locking or atomicity; concurrent saves clobber each other.

Fix: shared helper in the backend — write to a temp file in the same directory + `os.replace`
(atomic), guarded by an `fcntl.flock` on a lockfile per store. Apply to
`quote_drafts.py`, `assumptions.py`, `erp.py` (`_write_offer_payloads`). Test: concurrent
writes via threads don't lose entries.

---

## Execution order

1. Item 1 (95% settlement) — mechanical, unblocks doc rewrites.
2. Item 2 (availability-based rates) — changes every EUR/h number.
3. Item 6 (calculator formula fixes) + FormulaVersion → `costing.v0.2`.
4. Item 3 (backend rates module + driver verification).
5. Items 4, 5 (quantity breaks, profitability rebuild) — depend on 2/6.
6. Items 7–10 (diagnostics, calibration, tool check, portal).
7. Item 11 (persistence) — independent, do anytime.
8. Final pass: recompute all worked examples in Guide/Case (`main.tsx:3585` area), README
   scope text, `docs/*.md`; append a dated section to `logfile.md` summarizing the batch.

## Verification (must all pass before done)

- `cd backend && python3 -m pytest` — extend tests: rates module fixtures, scrap-on-run-only,
  cumulative yield, conversion-base overhead, missing-tool field, driver-mismatch warning,
  atomic persistence.
- `cd frontend && npm run build` clean.
- Manual/scripted checks against the running app:
  - Quantity-break table: unit material cost differs across breaks for the demo RFQ.
  - Profitability tab: shows a **loss** at seed actual utilization (~35–50%), profit at 95%,
    break-even utilization displayed.
  - Quote Summary shows commercial multiplier; internal print sheet shows missing-tool line.
  - No occurrence of "100% Utilization" or 70% default remains in UI text or docs
    (logs excluded).
- Demo flow (`Load Demo RFQ`) still completes end-to-end and the Case page numbers render.
