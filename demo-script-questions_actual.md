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



● Both are implemented, tested, and committed (079c328) — and yes, exactly right: this is
  the standard ERP construct. SAP work centers, JobBOSS, E2, ProShop all carry it as crew 
  size (or machine-crew ratio) on the work center, and labor cost flows from machine time ×
  crew ratio. That's precisely what I built.

  The leak fix — attendance floor:
  - Every machine class now has operator_attendance_share: 1.0 = dedicated operator, 0.33 =
  one operator tending three machines, 0 = unattended/support. Your stations are seeded at
  1.0 (matching your one-operator-per-station decision); QC at 0.
  - At pricing time, charged labor minutes become max(entered minutes, machine minutes × 
  share) — applied to setup and run minutes in every quote payload (main quote, quantity
  breaks, scenario diagnostics, client portal) and in the Route rate check math.
  Under-entering labor can no longer leak salary out of the price; hands-on work above
  machine time still charges as entered.
  - The demo data itself was made honest too: the milling operation that charged 0.9 labor
  minutes against 7.5 machine minutes now shows the real numbers in the route (14 fields
  raised across the mock ERP routes, 3 in the operation templates). So what you see in the
  inputs is what gets charged — the floor is the safety net, not a hidden correction.
  - Concretely: that CNC milling hour now carries ~€16 of operator wage instead of ~€1.90,
  and the quote-side labor recovery finally lines up with what the Profitability page said
  a station hour must earn.

  NRE — confirmed and implemented:
  - The CAM programmer's payroll is excluded from the shared-recovery pool in both the
  quote machine rates and the Profitability breakdown — he's recovered solely through the
  engineering line on quotes (which already discounts repeat parts). The double-count is
  gone.
  - His salary still counts as monthly cost in the Profitability P&L, so profit is never
  overstated — slightly conservative, since NRE income isn't modeled as revenue there.
  - Rule of the model now, documented in costing-model.md: every person has exactly one 
  recovery channel — operators through machine rates, the programmer through NRE, office
  staff through overhead.

  Frontend typechecks and builds, backend tests 24/24, and the running app confirms the new
  data (shares seeded, milling template now 8/8 machine/labor minutes). Reload the Quote
  page and re-load the demo RFQ or ERP part to see the corrected route — expect visibly
  higher prices on machine-pace Jump to bottom (ctrl+End) ↓ d, not inflation.




❯ now check the logic of 2 pages of the project. Many has changed since the original idea of the project, so I will explain how i see it (i can be mistaken as well, check my logic, too). Then compare it with the code and lets discuss what and how do we need to change: 
Profile selected (SIA) - Apply to Costing - Quote page, select ERP part, click Import ERP data - we have Quote Summary. 
for the part  CNC-AL-120 rev A it has target unit price = €42.17. Route rate check says €109.66/h market | €116.95/h cost-plus | -€7.29/h. 
Which means that in this calculation we are charging  more that manually entered market rates for the stations. I dont know why we have minus sign for 7.29 and red color. Flagging overprice? Is this appropriate way to Show red negatime overprice, and green positive underprice?

 Anyway, the main question comes next. We proceed to Market Rates page. It was supposed to use closed quotes to exctract sold market rates from the quotes of the company. There was no link between production cost and station sell rate, and this was a helper tool to calculate it. A few days ago this was very needed because we did not calculate machine station sell rate eur/h at quote stage, it was not used to form a prod cost and a price. Now it does, yesterday we fixed that. 
 So this page does not do the initially intended job since it has shifted. But we still form a market seel rate here, which is still used for building Profitability simulation chart. 
 If we go to Profitability page and look at Base EUR/h Required EUR/h columns and say - lets count Profitability of Required EUR/h column - these would only be our dreams - target production cost + full desirable margin. It may inflate the chart to show optimistic numbers. BUT! Who said the market is ready to buy at such Market rate? Noone. No proof, no grounding. Therefore we can rebuild Market Rates page ONLY for competitor price/rate calculation and use it as a realistic Profitability cut-off level. So the page should clearly say what it is used for and drop irrelevant leftover piecies of the previous logic. 
 Lets think further. Required EUR/h for a certain station says 120 eur. After Competitor analysis we found out that Market rate is 100 eur. What does it say? 
 1) we need to go to Resources page and reduce margin to see the effect - Required EUR/h will drop, probably will reach Market rate. Do we want to sacrifice margin? No. We go to Resources page, and look at the highest sell rate among teh stations, CNC lathe as an example, it says Actual Utilization = 70% with target 95%. Lets imagine we have enough order to reach 90% of utilization. We set actual 90, go back to Profitability - Required rate for CNC lather has dropped significantly and now is below Market rate, meaning we earn full 25% margin and we even have room to bump price a bit. So Required EUR/h column is a very important column, but it is not enough, it show current actual competitive level and unachievable Market revenue capacity. Must have for comparison. But what do we miss? We need a Target EUR/h column to show possible rate for each station if actual availability and utilization reach their target levels. The same thing I just did by changing 70 to 90 (well I had to change to 95 to be precise). We form the price based of factory state when all targets are achieved. So this target columns is the most critical thing we need. And then we keep Market sell rate as the third column. In real life Target and market should be very close to each other. But we calculate Market revenue capacity still based of Market sell rate. 