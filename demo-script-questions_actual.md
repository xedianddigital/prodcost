# Demo Walkthrough — Observations, Answers, and Changes Made

Each item below keeps your original question, followed by the answer and what was changed in the code (marked **DONE**) or the explanation where no change was needed. All changes are live — the dev server hot-reloads them.

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



• Your markup reading also needs a small correction: 5% risk plus 25% margin is not a plain
  31.25% markup on all cost. The formula is base * 1.05 / 0.75, so the required sell rate
  is 140% of base, i.e. 40% uplift over base. The margin is on selling price, not on cost.

    required price = base * 1.05 / (1 - 0.25)
                 = base * 1.40

  So it is a 40% uplift over base cost, while still producing 25% gross margin on the final
  sell price.





 3. Labor under-recovery, in plain language

  Take your own CNC milling station and its operator, paid €1,800 gross — about
  €2,225/month with employer tax. The machine runs about 130 hours a month, so having him
  stand at it really costs about €17 for every machine hour.

  Now look at your CNC-AL-120 quote. Each bracket takes 7.5 minutes of machine time but the
  route says only 0.9 minutes of labor — the moments he's actually loading the part and
  pressing buttons. So one hour of machine running carries about 7 minutes of his wage into
  the price — roughly €1.90.

  But he was there the whole hour. He can't be sold to another customer while the spindle
  turns — he's watching the process, checking dimensions, deburring the previous part. At
  the end of the month the quotes have collected about €250 of his €2,225 salary. The
  missing €2,000 didn't disappear — it quietly came out of profit. That's under-recovery:
  the wage flows per hour of attendance, but the quote charges per minute of touching.

  The small labor minutes are honest in one case: if he genuinely tends three machines at
  once. Then each machine hour should carry a third of him — 20 minutes, about €5.70 —
  still far more than 0.9. So the fix isn't in a formula, it's in the route data: labor
  minutes per operation should reflect his attendance share (60 min/h if the machine has
  his full attention, 20 min/h if he runs three), not just hands-on time. That's the number
  I'd revisit in your operation templates if you want quotes to stop leaking operator
  salary.
