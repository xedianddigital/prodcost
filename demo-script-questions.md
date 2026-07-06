# Demo Walkthrough — Observations, Answers, and Changes Made

Each item below keeps your original question, followed by the answer and what was changed in the code (marked **DONE**) or the explanation where no change was needed. All changes are live — the dev server hot-reloads them.

---

**1. How to enter asset useful life correctly when machines were bought in different years (some fully depreciated)?**

Answer: this is an *economic* cost model, not a bookkeeping ledger — so don't enter the original invoice and original life. Enter each asset **as it stands today**: its current replacement/resale value as "purchase price" and its **remaining** useful years as "useful life". Two common cases:

- Machine bought 4 years ago with 10-year life → enter today's value (roughly 60% of new) over 6 remaining years.
- Fully depreciated 15-year-old machine → it is *not* free: it still wears and will need replacement. Give it a modest current value over a short remaining life, or enter its yearly maintenance + replacement reserve as recurring cost. Pricing off "free" old machines is how a shop wins orders today and can't afford the replacement tomorrow.

**DONE:** this guidance now appears as a help note directly under the Production Assets header in Profile.

---

**2. Compress Profile Material/Tool/Operation Scope sections by default?**

**DONE:** all three sections are now collapsed by default with a chevron toggle in the header. The same collapsible mechanism was added across the app (see items 8, 9, 14).

---

**3. OEE columns in the Machine Rate Calculator — needed? What is Variable EUR/h? Should machine power go to the bills section?**

**DONE — OEE columns removed** from the table. Rationale: OEE never scales the rate (only Availability does — performance losses live in cycle minutes, quality losses in scrap; charging full OEE would count both twice), so two "diagnostic" columns you can't act on from that table were pure noise. OEE stays in the data model and in the Guide tab explanation.

**Variable EUR/h** = what one *running* hour adds on top of fixed cost: machine electricity (Power kW × price), coolant, compressed air, routine wear items. It deliberately stays on the machine and NOT in the overhead bills: variable cost should be paid only by the parts that actually run on that machine. If you move machine electricity into overhead, a part machined on a small saw subsidizes the 20 kW machining center. **Building** electricity (lights, heating, offices) does belong in Overhead Allocation — that's the split. **DONE:** this explanation is now in the section help text.

---

**4. Reorder pages/sections to match the presentation flow?**

Answered, mostly not changed: the sidebar order already matches the data flow (Profile → Resources → Quote → Scenarios → Market Rates → Profitability). Reordering sections *within* pages would optimize for one audience (presentation) at the cost of the working order (inputs above results). The scrolling problem is solved differently: everything that isn't demo-critical is now collapsed by default (items 2, 8, 9, 14), so each page reads top-to-bottom much shorter. If a specific page still feels wrong after this, name it and I'll reorder that one.

---

**5. Overhead Allocation method toggle — nothing changes when switching.**

**DONE — resolved by removing the choice entirely (follow-up decision).** The percent-of-cost variant was mathematically equivalent, but selecting it stripped overhead out of the machine rates, so a ~3 EUR/h direct rate sat next to a ~55 EUR/h market sell rate — it read as an error to anyone watching. The UI now has one fixed behavior: the monthly overhead total is spread over planned productive hours and folded into every machine's EUR/h. The section shows just two readouts (total/month and EUR/h), the method selector is gone, old data files saying `percent_of_cost` are coerced on load, and the percent method remains only inside the engine for compatibility. Docs (costing-model.md, README) updated to match.

---

**6. Should Billable share % ≈ average target utilization among assets?**

Approximately yes, and the 85% default was chosen to line up with target availability (90%) × target utilization (95%) ≈ 85.5% — that keeps quote-side labor recovery consistent with the Profitability tab. But they are not the same concept and may legitimately diverge: an operator can be productive while their machine is idle (setup on another machine, deburring, packing), or one operator can tend 3 machines (machine utilization 90%, operator billable share can exceed it). Rule of thumb: start at 85%, then calibrate from timesheets — billable share = hours booked on customer jobs ÷ paid hours.

---

**7. Terminology from the Resources page:**

- **Equivalent EUR/h at target** — the total monthly overhead divided by the shop's planned productive hours at target availability/utilization. It's what overhead costs per sellable machine hour. Used automatically when allocation method = "per machine hour".
- **Equivalent % of cost at target** — the exact same overhead total, expressed as a percentage of own-work (conversion) cost instead of per hour. Used automatically when allocation method = "percent of cost". You never enter these two; they're derived from the expense list.
- **Risk allowance %** — a cost buffer added to the shop's own work before margin, covering estimation uncertainty: a cycle time that runs long, a fixture surprise, an extra inspection round. Raise it for first-time parts and rough drawings; lower it for repeat work with measured actuals.
- **Material/bought-out markup %** — the handling fee applied to material and purchased/outsourced items instead of the full profit margin (costing.v0.3). It covers procurement effort and material price risk. Typical job-shop range 5–15%.
- **Annual-volume relief %** — Client Portal only: when a customer declares a serious annual volume, the preliminary estimate is multiplied by this factor (0.92 = 8% relief) to reflect expected repeat-order economics. Applies only to portal pre-quotes, never to real quotes.
- **Low/High factor (× sell price)** — the Client Portal quotes a *range*, not one number, because portal data is incomplete. Low = price × 0.85, High = price × 1.35 by default. Asymmetric on purpose: an underquote is cheaper to fix than an overquote that loses the client.

---

**8. Resources page — compress sections? Remove JSON?**

**DONE:** Material Library, Tool Inventory, and Operation Templates are now collapsed by default; Commercial Policy, Overhead Allocation, Labor Classes, and the Machine Rate Calculator stay open (they're the presentation core). **Full JSON kept but collapsed** by default with an honest note — it's the only escape hatch for fields without structured inputs and costs nothing when folded; the Save button stays visible even when collapsed (it's the page's save).

---

**9. Quote page: Demo Flow / Quote Drafts noise, and pre-filled mock data before Load Demo RFQ.**

**DONE, all three:**
- Demo Flow instruction list replaced with a one-line intro + the Load Demo RFQ button.
- Quote Drafts and ERP Connection Demo are collapsed by default (buttons appear on expand).
- The quote now **starts empty** — no "S355 mounting bracket / Customer Ltd. / RFQ-001" mock strings. Nothing calculates until a route exists; fill manually, import ERP, or press Load Demo RFQ.

---

**10. Cutoff Calculator too incomplete — bars only? Plates? Other units?**

Plate support actually already existed (the width field only appeared when the selected material's shape was "plate") — the problem was that nothing *told* you the calculator is shape-aware. **DONE, rebuilt the block:**
- Shows the selected stock's format explicitly ("round bar 6000 mm, saw kerf 3 mm" / "Plate 2000 × 1000 mm").
- Labels adapt: "Cut length per part" for bars/tubes, "Blank length/width" for plate.
- Result now shows the math: blanks per stock unit, and ~% of purchased material actually used (the waste made visible).
- New third case: materials without stock dimensions are treated as **per-piece blanks** (casting, forging, pre-cut purchase) — one blank per part, suggested automatically.
- Plate keeps its honest disclaimer: area estimate at 82% nesting efficiency, not true 2D nesting.

---

**11. Quantity Breaks — "(material scaled linearly)" pollutes the column.**

**DONE:** replaced with a small `*`; the explanation moved to a single footnote line in the section help ("Rows marked * …"). Hover tooltip retained.

---

**12. Add the demo route's tools to Resources so Tool Check can be demonstrated with qty 0 ↔ 1.**

**DONE:** five specific tools added to the baseline Tool Inventory, exactly matching the Demo RFQ requirements, each with quantity 1: End mill D10 R1 (alu), End mill D6 R0.5 (alu), Drill D5, M5 machine tap, Engraving cutter D3. The old generic "sets" with diameter 0 could never match sized requirements (0 vs required 10 mm fails the tolerance check) — they remain as placeholders for bending/welding/inspection. Demo move: open Resources → Tool Inventory, set "M5 machine tap" quantity to 0, return to Quote → Tool Check shows the missing tool and its charge; set back to 1 and it clears.

---

**13. What is "Prove-out, min" in STEP & CAM?**

Prove-out = the supervised **first run on the machine**: verifying the CAM program, tool offsets, and fixturing at reduced feed, then measuring the first article until a good part comes off. It's real machine + operator time before production starts, which is why it's priced. New parts pay full prove-out; repeat parts only a reduced review. **DONE:** definition added to the STEP & CAM help text.

---

**14. Hide Actuals Feedback? ERP already keeps actuals.**

Keep it — but you're right about the framing, and it's now **collapsed by default**. Why keep: the ERP *stores* actuals, but nothing in the ERP feeds them back into quoting assumptions — that's the calibration loop this section demonstrates, and it's one of the tool's strongest credibility arguments ("the next quote starts from measured reality"). **DONE:** the help text now says explicitly that in a live installation these numbers would flow in from ERP operation confirmations automatically, and this manual table is the demo stand-in.

---

**15. Scenarios waterfall — what is deducted after the availability step / what is "Use target overhead policy: final target price"?**

**Follow-up ("how can we possibly affect overhead?"): you don't need to — it happens by itself.** The entire waterfall requires only the two actions you named: fill machines with orders (utilization) and reduce downtime via SMED etc. (availability). Overhead EUR/h is `fixed overhead money ÷ productive machine hours` — the money (rent, admin, quality salaries) never changes, but once the two actions above raise the hours, the same money is divided across more sold hours, so each quoted hour automatically carries a smaller overhead slice. The last step is **attribution, not a third initiative**: steps 1–2 deliberately keep overhead divided by today's low hours so you can see machine-recovery vs overhead-recovery shares separately. Overhead is usually the biggest drop simply because it is the biggest pool of fixed money sitting on too few hours today. **DONE:** the last step label now reads "Overhead follows automatically: the same fixed overhead money … divided by the new, higher hours from the two steps above — no extra action needed", and the section help explains the two-actions logic.

---

**16. Competitor Price Check — isolated levers only; want combined manual what-ifs.**

**DONE:** new "Combined what-if" block under the three single-lever suggestions. Set a margin % **and** an average shop utilization %, press "Recalculate with both levers" — the quote is genuinely recalculated (not a closed-form approximation) with both applied, and the result is compared against the competitor price ("still €X above" / "at or below"). Utilization scales every machine's target level proportionally, which is labeled as an approximation for mixed shops.

---

## Verification

- Frontend: `tsc --noEmit` clean, production build passes.
- Backend: 26/26 tests pass (no backend changes this round).
- Dev server picks all of this up via hot reload — refresh the browser tab if a section state looks stale.
