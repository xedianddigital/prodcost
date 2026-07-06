# ProdCost — CEO Presentation Script

Audience: the CEO of a company with years of negative net profit and quotes reportedly 3–4x above competitors.
Goal of the meeting: show that every high price becomes **explainable**, and that the tool can answer the four questions that matter:

1. What does our product really cost to produce?
2. Is our price after margin competitive?
3. Why are we more expensive than competitors?
4. With all expenses counted, can this business be profitable at all?

Total time: ~30–40 minutes. The order below is deliberate — it follows the data flow of the tool itself (company → assumptions → quote → market → profitability), so nothing has to be explained twice.

---

## 0. Before the meeting (15 min, alone)

- [ ] Start both services (`runbook.md`): backend on 8002, frontend on 8001. Open `http://localhost:8001`.
- [ ] **Profile**: load the saved company profile you'll present (e.g. `Test1`), click **Apply to Costing**.
- [ ] **Market Rates**: check the compatibility strip says `Compatible` (bind/load the card if not).
- [ ] **Quote**: click **Load Demo RFQ** once and confirm numbers calculate without warnings you can't explain.
- [ ] **Profitability**: confirm every sellable asset has a market sell EUR/h (no "Not set"), so break-even and the sensitivity table display.
- [ ] Know your three headline numbers in advance: current-load operating loss/month, break-even Utilization %, and profit at 95%. Write them on paper. If a live demo dies, you can still tell the story.

---

## 1. Opening — no tool yet (2 min)

**Say:** "You know the symptom: we quote, we lose, and the year ends negative. This tool doesn't guess why. It rebuilds our prices from the ground up — machines, people, overhead, market rates — so that every expensive quote points at its own cause: an idle machine park, uncounted overhead, wrong assumptions, or a market that simply pays less. I'll show you the whole chain in half an hour."

Do **not** open with features. Open with the question the CEO already has.

---

## 2. Profile tab — "this is your company in numbers" (4 min)

**Navigate:** Profile.

**Say:** "Everything starts from the company itself, not from a quote." 

**Show / click:**
- Scroll the **Production Assets** table — purchase price, useful life, planned hours. "Each machine's monthly cost is derived from what it cost and how long it lives, not invented."
- **Employees** — point at the Direct/Overhead split. "People who touch parts are priced into hours; managers, sales, and accounting go into overhead. Nobody disappears from the math."
- **Facility / utilities / insurance** rows.
- Click **Apply to Costing** (even if already applied) and say: "One button pushes this cost base into every other page. There is one source of truth."

**Key sentence:** "If a number in here is wrong, it's *our* number to fix — everything is editable, nothing is hardcoded."

## 3. Resources tab — the two machine rates (5 min) — CRITICAL

**Navigate:** Resources → Machine Rate Calculator.

This is the intellectual heart of the pitch. Take it slowly.

**Show / point:**
- One CNC machine row: fixed cost/month, planned hours, then the two gauges: **Availability** (is the machine up when it has work) and **Utilization** (does it have work at all).
- The two computed rates: **Accounting EUR/h** (today's real, low Utilization) vs **Target EUR/h** (a realistically busy shop, 95% target Utilization).

**Say:** "Here is why our quotes are expensive. The machine doesn't run worse than the competitor's — it runs *less*. The same lease and depreciation get divided over fewer sold hours, so the hourly rate inflates. If we then quote off that inflated rate, we lose the order, Utilization drops further, and the next quote is even higher. That's the death spiral, and it's a *sales-load* problem, not a shop-floor problem."

**Also show quickly:**
- **Overhead Allocation** — "Admin, sales, quality, facility — this used to be missing from quotes entirely. Now it's one editable total, spread over machine hours."
- **Labor Classes** — point at **Billable share %**: "An operator's salary is recovered over the hours we can actually sell, not every paid hour. Same honesty as the machine rate."

## 4. Quote tab — one real part, start to finish (7 min)

**Navigate:** Quote → click **Load Demo RFQ**.

**Walk the chain top to bottom, in this order:**
1. **RFQ panel** — customer, part, quantity, material. Point at the **Cutoff Calculator**: "Steel comes in fixed bars; the leftover piece is our cost, and it's calculated, not guessed."
2. **STEP and CAM** — "A new part pays for programming and first-run prove-out; a repeat part reuses it. That difference alone can decide an order."
3. **Operations** — the route. Point at machine + labor minutes per step. "These minutes are the assumptions that matter most — and the calibration loop below corrects them from real production data over time."
4. **Tool Check** — "If a tap or cutter is missing for this order, the quote *charges* it instead of silently eating it."
5. **Quote Summary** — pause here. Point at the split: **Own work (margin applies)** vs **Material pass-through + handling markup**. "We take profit on our work. On raw steel we take a handling fee. Customers read prices exactly this way, and this alone removes a chunk of our overpricing on material-heavy parts."
6. Toggle **Target / Accounting** mode. "Same part, two prices: what we must charge today at low load, and what we should charge as a busy shop. The gap between them is the price of our empty order book — in euros, on this very part."
7. **Quantity Breaks** — "Setup and programming amortize; the 250-piece price is not the 20-piece price divided down."

**Key sentence:** "Every euro of this price can be traced to a line in this page. Nothing is a coefficient someone once invented."

## 5. Scenarios tab — "which lever moves the price" (4 min)

**Navigate:** Scenarios.

**Click:** **Run Gap Waterfall**, then **Run Sensitivity Table**.

**Say:** "The waterfall decomposes the difference between today's accounting price and the target price: how much is Utilization, how much Availability, how much overhead policy. The sensitivity table shows what happens if any driver is 10 or 25 percent off — so we know which assumptions are worth fighting over and which don't matter."

**Click:** enter a competitor unit price in **Competitor Price Check**.

**Say:** "And when a competitor's number is on the table, the tool answers: what margin, what hourly rate, or what Utilization would we need to match it — instead of a shrug."

## 6. Market Rates tab — what the market actually pays (4 min)

**Navigate:** Market Rates.

**Say:** "Cost tells us our floor. It doesn't tell us the ceiling — what customers pay. This page builds the market rate per hour from *evidence*: won orders, lost quotes, competitor prices."

**Show / click:**
- The **Market Rate Card** — EUR/h per work-center family, each row with source and confidence.
- **Quote Evidence Backsolve** — enter (or show) one example: sell price minus material minus bought-out = conversion revenue; divided by route hours = implied market EUR/h. "One real invoice becomes a market data point."
- **Decision Logic** — the three-way verdict: profitable at target margin / covers overhead only / loss-making.
- Point at the compatibility strip, then click **Apply to Profitability**.

**Key sentence:** "We stop arguing about feelings — 'the market won't pay that' becomes a measured number with a confidence label."

## 7. Profitability tab — the answer to the big question (6 min) — CRITICAL

**Navigate:** Profitability. This is the page the whole meeting builds to.

**Show / click, in order:**
1. The expense list — "same overhead list as before, one source of truth."
2. **Shop Utilization scenario**: click **Use current weighted load**. Let the bridge chart show the **red bar**. Pause. "At today's real load, selling at market rates, we lose roughly €X per month. The tool is built so it *can* say this — revenue comes from market rates, cost from our expense base, independently."
3. Point at **Break-even Utilization**: "We need the shop ~Y% loaded to stop losing money — and this assumes even loading; the real bottleneck makes it a bit worse."
4. The **sensitivity table** (50–100%): "One slider position is not the story. Here's the result at every load level — 80–85% is what accountants call 'normally busy'."
5. Drag / set the scenario to **95%** — the bar turns green. "Profitable at +€Z per month. The business model works; the order book is what's broken."
6. Mention the label: "This is *operating* profit — before interest and tax — deliberately, so it answers 'does the model work', not 'what's in the bank'."

**Key sentence:** "So the answer to 'can we be profitable?' is: **yes, at sufficient load and market prices — and here is the exact load number to manage toward.**"

## 8. Client portal — growth, not just analysis (3 min)

**Navigate:** Client (portal).

**Say:** "Diagnosis alone doesn't fill the order book. This is the acquisition side: a customer uploads their STEP files and requirements and gets a preliminary price range in minutes, priced at our target rate — with an internal-only cross-check and a real tool-inventory check behind it. Every estimate can be pulled into the real Quote Builder with one click."

**Click:** show a filled example part → estimate → **Send to Quote Builder**.

## 9. Close — Case tab (3 min)

**Navigate:** Case.

Let the page do the talking — it *is* the closing argument. Point at:
- The death-spiral diagram (recap of section 3 in one picture).
- The live cost-pressure signal cards from the current quote.
- The closing message. **Say it out loud:** "The value isn't one more number. It's that every high price becomes explainable: if it's Utilization — that's a sales problem; if it's overhead — that's the real cost of running the company; if it's assumptions — that's a data problem with a named owner. No more arguing in the dark."

**Ask for the decision you want:** e.g. approval to load real company data (payroll, machine list, 12 months of quotes/invoices) so the numbers become *theirs* instead of a simulation.

---

## Pages you deliberately do NOT present (but be ready for)

- **Print** — one sentence if asked: "Any quote exports to a customer-ready PDF offer or an internal cost sheet."
- **ERP Connection Demo** (Quote page, top) — one sentence: "Import of parts/BOM/routes and export of offers is demonstrated against a mock ERP; a real connector needs the real system's field mapping." Do not oversell — it is a mock, and it's presented honestly as one.
- **Guide / Methods** — don't walk through them live; instead say: "Every term and every formula in this tool is explained in plain language inside it — and the Methods page shows which costing method we use and which alternatives exist, so nobody has to take the math on faith." (If the CEO has a finance background, the **Methods** tab is your credibility ace — show it.)

## Likely CEO questions — prepared answers

- **"Are these numbers real?"** — "The math is real and tested; the inputs are starter assumptions clearly labeled by data quality. Step one after this meeting is replacing them with your actual payroll, machine, and invoice data. The tool tracks data quality per field for exactly this reason."
- **"Which accounting method is this? Can our auditor check it?"** — "Full costing with machine-hour rates at normal capacity — the standard method behind IAS 2 — plus a classic cost-volume-profit break-even. The Methods page documents it, and the formula version is stored with every quote."
- **"Why not just cut prices 30%?"** — Show Scenarios: "Here's what a 30% cut requires in margin, rate, or load. Cutting price without a plan for one of those three is just choosing where the loss appears."
- **"What does it NOT do?"** — Be honest, it builds trust: no automatic competitor benchmarking (market prices are entered as evidence), no real ERP connector yet, STEP geometry is not parsed automatically, capacity model is monthly and deterministic (no queueing/delivery dates).

## Timing summary

| # | Section | Min |
|---|---------|-----|
| 1 | Opening (no tool) | 2 |
| 2 | Profile | 4 |
| 3 | Resources / two rates | 5 |
| 4 | Quote walkthrough | 7 |
| 5 | Scenarios | 4 |
| 6 | Market Rates | 4 |
| 7 | Profitability | 6 |
| 8 | Client portal | 3 |
| 9 | Case + ask | 3 |
|   | **Total** | **~38** |

If time is cut to 15 minutes, present only sections 1, 3, 4 (stop after Quote Summary), and 7 — that's the minimum path that still answers all four business questions.
