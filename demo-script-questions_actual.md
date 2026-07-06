# Demo Walkthrough — Observations, Answers, and Changes Made

Each item below keeps your original question, followed by the answer and what was changed in the code (marked **DONE**) or the explanation where no change was needed. All changes are live — the dev server hot-reloads them.

---


**5. Overhead Allocation method toggle — nothing changes when switching.**

It *does* change things, just not inside that section — that was the UX gap. Both readouts ("Equivalent EUR/h" and "Equivalent % of cost") always show the same total expressed two ways, by design. The switch changes **where** overhead lands: with *per machine hour* it's folded into every machine's Accounting/Target EUR/h (watch those columns in the Machine Rate Calculator change when you toggle); with *percent of cost* the machine rates drop back to direct cost and the overhead instead hits each quote as a coefficient on own-work cost.

**DONE:** the active readout is now labeled "— in use", and a help paragraph states exactly what changes where, so the toggle no longer looks dead.


**7. Terminology from the Resources page:**

- **Equivalent EUR/h at target** — the total monthly overhead divided by the shop's planned productive hours at target availability/utilization. It's what overhead costs per sellable machine hour. Used automatically when allocation method = "per machine hour".
- **Equivalent % of cost at target** — the exact same overhead total, expressed as a percentage of own-work (conversion) cost instead of per hour. Used automatically when allocation method = "percent of cost". You never enter these two; they're derived from the expense list.
- **Risk allowance %** — a cost buffer added to the shop's own work before margin, covering estimation uncertainty: a cycle time that runs long, a fixture surprise, an extra inspection round. Raise it for first-time parts and rough drawings; lower it for repeat work with measured actuals.
- **Material/bought-out markup %** — the handling fee applied to material and purchased/outsourced items instead of the full profit margin (costing.v0.3). It covers procurement effort and material price risk. Typical job-shop range 5–15%.
- **Annual-volume relief %** — Client Portal only: when a customer declares a serious annual volume, the preliminary estimate is multiplied by this factor (0.92 = 8% relief) to reflect expected repeat-order economics. Applies only to portal pre-quotes, never to real quotes.
- **Low/High factor (× sell price)** — the Client Portal quotes a *range*, not one number, because portal data is incomplete. Low = price × 0.85, High = price × 1.35 by default. Asymmetric on purpose: an underquote is cheaper to fix than an overquote that loses the client.

---


---

**10. Cutoff Calculator too incomplete — bars only? Plates? Other units?**

Plate support actually already existed (the width field only appeared when the selected material's shape was "plate") — the problem was that nothing *told* you the calculator is shape-aware. **DONE, rebuilt the block:**
- Shows the selected stock's format explicitly ("round bar 6000 mm, saw kerf 3 mm" / "Plate 2000 × 1000 mm").
- Labels adapt: "Cut length per part" for bars/tubes, "Blank length/width" for plate.
- Result now shows the math: blanks per stock unit, and ~% of purchased material actually used (the waste made visible).
- New third case: materials without stock dimensions are treated as **per-piece blanks** (casting, forging, pre-cut purchase) — one blank per part, suggested automatically.
- Plate keeps its honest disclaimer: area estimate at 82% nesting efficiency, not true 2D nesting.

---


**12. Add the demo route's tools to Resources so Tool Check can be demonstrated with qty 0 ↔ 1.**

**DONE:** five specific tools added to the baseline Tool Inventory, exactly matching the Demo RFQ requirements, each with quantity 1: End mill D10 R1 (alu), End mill D6 R0.5 (alu), Drill D5, M5 machine tap, Engraving cutter D3. The old generic "sets" with diameter 0 could never match sized requirements (0 vs required 10 mm fails the tolerance check) — they remain as placeholders for bending/welding/inspection. Demo move: open Resources → Tool Inventory, set "M5 machine tap" quantity to 0, return to Quote → Tool Check shows the missing tool and its charge; set back to 1 and it clears.

---

**15. Scenarios waterfall — what is deducted after the availability step / what is "Use target overhead policy: final target price"?**

The waterfall moves from the accounting price to the target price in three separate steps so each driver's share is visible. The subtlety: overhead EUR/h is also "fixed money ÷ productive hours", so it *also* depends on utilization/availability. To isolate effects, the first two steps re-rate only the **machines** at target utilization, then target availability, while overhead stays divided by today's low hours. The last step finally spreads the **overhead** over target hours too — that's the remaining price drop, and it lands on the final target price. **DONE:** the step labels now say this in plain words (e.g. "Overhead also spread over target hours (until this step it was still divided by today's low hours) = final target price").

---


