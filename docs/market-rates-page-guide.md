# Market Rates Page Guide

This page exists to answer one business question:

```text
What EUR/h can the market actually pay for each work-center family, and is that enough to make the company profitable?
```

It deliberately separates two different ideas:

- **Market sell EUR/h**: external commercial rate, based on accepted orders, lost quotes, competitor targets, or management rate-card evidence.
- **Required cost-plus EUR/h**: internal cost-recovery floor, based on production cost, overhead, risk, and target margin.

Do not force the market rate to equal the cost-plus rate. If the market rate is lower, the tool should show the margin problem rather than hide it.

## Before You Start

1. Open **Profile**.
2. Load the saved company profile you want to price, for example `Test1`.
3. Click **Apply to Costing** so Resources, Market Rates, and Profitability use that profile's assets and overhead.
4. Open **Market Rates**.
5. Check the compatibility strip at the top of the Market Rate Card:
   - **Loaded profile** must show the company profile you intend to price.
   - **Rate card bound to** must show the same profile.
   - **Compatibility** must be `Compatible` before applying rates to Profitability.

If this is a first-time rate card for the profile, click **Bind to Loaded Profile**. If the profile already has a saved rate-card snapshot, click **Load Card from Profile**.

## Page Sections

### 1. Market Rate Card

This is the commercial price list by work-center family.

Default classes are:

- CNC machining
- Manual / bench work
- Welding / fabrication
- Assembly / fitting
- Inspection / QC if billable

Add extra classes only when the market really prices them differently. Examples:

- Laser cutting
- Laser engraving
- Press brake / bending
- Painting / coating coordination
- Robot welding

For each row, enter:

- **Pricing class**: human-readable rate name.
- **Market EUR/h**: commercial sell rate used for revenue.
- **Source**: where the rate came from.
- **Confidence**: data quality, for example `company_estimate`, `measured`, `preliminary`.
- **Last updated**: date of last evidence update.
- **Notes**: quote IDs, customer segment, exclusions, or assumptions.

Use **Save Rate Card** to persist the card into the assumptions baseline. Use **Save Profile** on the Profile page afterward if you also want the company profile snapshot to carry that rate card.

### 2. Quote Evidence Backsolve

Use this section when you have a real sold quote, a lost quote target, or a competitor reference price.

Enter totals for the full sold quantity, not per-piece values.

Formula:

```text
Conversion revenue =
  Product sell price
- Material sell amount
- Bought-out / outsourced sell amount
- Engineering / admin / batch charges
```

Then:

```text
Implied market EUR/h = Conversion revenue / route hours
```

If several pricing classes are used in the route and you already trust some of them, choose **Solve residual for** one selected class. The tool subtracts revenue from known classes and assigns the remaining conversion revenue to the selected class.

### 3. Decision Logic

This section tells whether the evidence price is commercially healthy.

It compares:

```text
Gross profit = Product sell price - Product production cost
Gross margin = Gross profit / Product sell price
Required sell at target margin = Product production cost / (1 - target margin)
```

Interpretation:

- If market price is above required sell price, the rate is profitable at the target margin.
- If market price is below required sell price but above true cost, it may still contribute to overhead or fill spare capacity.
- If market price is below true production cost, accepting it creates a loss unless there is a specific strategic reason.

### 4. Basket Evidence Solver

Use this section instead of the single-quote backsolve when you want to bootstrap or cross-check a whole rate card from several real competitor quotes at once, rather than sanity-checking one order.

The single-quote backsolve above only works if you already trust every other class's card rate -- it subtracts their assumed revenue and solves the one remaining class as a residual. It cannot bootstrap a card from zero, and it cannot separate a fixed per-order engineering/admin charge from an hourly rate, because a single order gives you only one equation.

The basket solver fits one shared batch/engineering charge plus one market EUR/h per pricing class jointly across every row, by least squares. More rows than pricing classes used lets the fixed charge and the hourly rates come out separately instead of being tangled together.

How to build a basket:

1. Upload a competitor quote PDF and click **Extract Line Items**. This reads the PDF's embedded text and asks an LLM to pull out supplier, date, currency, and each line item's part name, quantity, unit price, and line total -- never a guess, only what is explicitly present in the text. Fields not found come back blank for you to fill in.
   - This pass is text-only: it works for digital/native PDFs. A scanned or image-only PDF will extract nothing; add that row manually instead. (A vision-model fallback for scanned quotes is a documented future addition, not built yet.)
2. Or click **Add Row Manually** to start a row from scratch.
3. For every row, fill in (or correct) the quantity, the total sell price for the full row quantity (not per-piece), and your own **material sell estimate** -- the competitor's PDF will not reliably itemize this, so it's always your estimate from your own routings/BOM, same as the backsolve panel above.
4. Add one route-hours entry per pricing class the row actually used, with total hours for the row's full quantity (same convention as "How To Enter Route Hours" above).
5. Click **Save** on a row once it looks right, so it persists across sessions.
6. Once you have more solvable rows (quantity, sell price, material estimate, and route hours all present) than pricing classes in use, click **Solve Basket**. Review the solved batch charge and per-class EUR/h, and check for any row flagged "off-model" -- a large residual there means that row doesn't fit the shared model well (mixed evidence quality, a misclassified operation, or a genuine outlier) and is worth a second look before trusting the card.
7. Click **Apply Solved Rates to Card** to write the solved per-class rates into the Market Rate Card above (only classes with a positive solved rate are touched). Then **Save Rate Card** as usual to persist.

### 5. Asset Mapping to Profitability

Map each machine asset to a pricing class.

Examples:

- CNC machine 1 -> CNC machining
- Manual tool station 1 -> Manual / bench work
- Assembly station 1 -> Assembly / fitting
- QC station 1 -> Inspection / QC if billable, or support cost pool if not directly sold

Click **Apply Rate Card to Assets** only when the compatibility strip says `Compatible`.

Sellable assets receive the card EUR/h. Support/internal assets receive 0 EUR/h and their cost is recovered through the support cost pool in Profitability.

## Important Compatibility Rule

A market rate card belongs to one saved Company Profile.

Why this matters:

- Different profiles can have different machines, operators, support assets, overhead, and route mix.
- A CNC-heavy profile and an assembly-heavy profile should not accidentally share the same asset mappings.
- Applying the wrong card can silently create misleading Revenue capacity.

Required workflow:

1. Load the saved profile in **Profile**.
2. Open **Market Rates**.
3. If the card is not bound, click **Bind to Loaded Profile**.
4. If a saved card exists in the profile snapshot, click **Load Card from Profile**.
5. Check that Compatibility is `Compatible`.
6. Only then click **Apply to Profitability** or **Apply Rate Card to Assets**.

If compatibility says `Wrong profile` or `Not bound`, do not apply the card.

## How To Enter Route Hours

Use work-center occupancy hours for the full sold quantity.

Do not double count machine and labor time. For each operation, use the larger of machine occupancy and labor occupancy if they happen at the same time.

Example:

```text
Operation setup machine: 30 min
Operation setup labor:   45 min
Run machine:             6 min/part x 20 = 120 min
Run labor:               4 min/part x 20 = 80 min

Machine occupancy = 30 + 120 = 150 min
Labor occupancy   = 45 + 80  = 125 min
Route hours       = max(150, 125) / 60 = 2.50 h
```

If labor is separate and not concurrent with machine time, split it into the correct pricing class instead of using max time.

## Fake Evidence Cases

The examples below are deliberately simple. Use them to learn the page, not as real rates.

### Fake Quote 1: Engraved Shaft Collar

Sold product:

- Product: Engraved shaft collar
- Quantity: 40 pcs
- Operations: saw cutting, CNC lathe, laser engraving, QC
- CAM required: yes, simple lathe program plus engraving setup

Enter in Quote Evidence Backsolve:

| Field | Value |
|---|---:|
| Product sell price | 3,780 EUR |
| Product production cost | 2,640 EUR |
| Material sell amount | 550 EUR |
| Bought-out / outsourced sell amount | 0 EUR |
| Engineering / admin / batch charges | 420 EUR |
| Evidence source | Won quote / accepted order |

Route rows:

| Pricing class | Route h |
|---|---:|
| Manual / bench work | 2.8 |
| CNC machining | 12.5 |
| Laser engraving | 2.0 |
| Inspection / QC if billable | 1.2 |

How to use it:

1. Add a `Laser engraving` pricing class if it does not exist.
2. If you do not trust any rates yet, choose **Solve residual for: Blended route** to understand the overall conversion EUR/h.
3. If CNC and manual rates are already credible, choose **Solve residual for: Laser engraving** to estimate engraving separately.
4. Apply the implied rate only if the evidence source is credible.

### Fake Quote 2: Welded Drill Bracket

Sold product:

- Product: Welded drill bracket
- Quantity: 18 pcs
- Operations: CNC milling, drilling, deburr, welding, QC
- CAM required: yes, medium milling program

Enter:

| Field | Value |
|---|---:|
| Product sell price | 4,950 EUR |
| Product production cost | 3,420 EUR |
| Material sell amount | 780 EUR |
| Bought-out / outsourced sell amount | 120 EUR |
| Engineering / admin / batch charges | 650 EUR |
| Evidence source | Won quote / accepted order |

Route rows:

| Pricing class | Route h |
|---|---:|
| CNC machining | 14.4 |
| Manual / bench work | 3.1 |
| Welding / fabrication | 5.6 |
| Inspection / QC if billable | 1.6 |

How to use it:

1. Enter the route hours for the full batch of 18 pieces.
2. If CNC rate is already known, solve residual for **Welding / fabrication**.
3. Check the margin at sell price. If the quote was won but margin is weak, keep the rate as evidence but mark confidence as `preliminary` or add notes.

### Fake Quote 3: Three-Part Welded Assembly

Sold product:

- Product: Welded motor mount assembly
- Quantity: 12 assemblies
- The customer buys one finished welded assembly, not the separate child parts.
- CAM required: yes, one milling program and one drilling fixture setup.

Child parts per assembly:

1. Two side plates
   - Laser cutting
   - Drilling
   - Deburr
2. One turned spacer boss
   - Saw cutting
   - CNC lathe
3. One mounting tab
   - CNC milling
   - Drilling
4. Final assembly
   - Fixture setup
   - Welding
   - Grind/clean
   - QC

Enter one evidence record for the sold assembly, not four separate product prices.

| Field | Value |
|---|---:|
| Product sell price | 7,800 EUR |
| Product production cost | 5,380 EUR |
| Material sell amount | 1,120 EUR |
| Bought-out / outsourced sell amount | 180 EUR |
| Engineering / admin / batch charges | 900 EUR |
| Evidence source | Won quote / accepted order |

Route rows for all 12 assemblies combined:

| Pricing class | Route h |
|---|---:|
| Laser cutting | 5.1 |
| CNC machining | 16.5 |
| Manual / bench work | 7.2 |
| Welding / fabrication | 12.6 |
| Inspection / QC if billable | 2.8 |

How to use it:

1. Sum route hours across every child part and the final assembly.
2. Put all material for child parts into **Material sell amount**.
3. Put purchased inserts, coating, or subcontracted operations into **Bought-out / outsourced sell amount**.
4. Put CAM, fixture proving, admin, or batch engineering into **Engineering / admin / batch charges**.
5. Do not enter internal transfer prices for the child parts unless the customer buys those parts separately.
6. If only welding is uncertain, solve residual for **Welding / fabrication** after entering credible CNC and laser rates.

### Fake Quote 4: Small Mixed Repeat Order

Sold products in one customer order:

- Product A: simple milled stop block, 60 pcs
- Product B: saw-cut spacer, 120 pcs
- Product C: engraved nameplate, 30 pcs
- Product D: inspection-only rework verification, 25 pcs

Use this as one evidence record only if the customer order has one combined sell price and you want a blended market check.

Enter:

| Field | Value |
|---|---:|
| Product sell price | 5,600 EUR |
| Product production cost | 3,950 EUR |
| Material sell amount | 890 EUR |
| Bought-out / outsourced sell amount | 0 EUR |
| Engineering / admin / batch charges | 300 EUR |
| Evidence source | Won quote / accepted order |

Route rows:

| Pricing class | Route h |
|---|---:|
| CNC machining | 9.8 |
| Manual / bench work | 6.4 |
| Laser engraving | 1.8 |
| Inspection / QC if billable | 3.5 |

How to use it:

1. Use **Blended route** first because the order mixes several products.
2. If the blended implied EUR/h is far from your card, split the customer order into product-level evidence records next time.
3. Use the result as lower-confidence evidence unless product-level route data is reliable.

## Recommended Operating Routine

For every real quote or order:

1. Record accepted/lost/competitor sell price excluding VAT.
2. Record total quantity.
3. Separate material sell amount, bought-out sell amount, and fixed charges.
4. Calculate route hours by pricing class.
5. Enter the evidence into Market Rates.
6. Solve blended EUR/h first.
7. Solve a specific residual class only when all other class rates are credible.
8. Update the rate card row.
9. Save Rate Card.
10. Save Profile to preserve a profile-bound snapshot.
11. Apply Rate Card to Assets.
12. Open Profitability and review market Revenue capacity, gross profit/loss, and break-even utilization.

## Common Mistakes To Avoid

- Do not enter per-piece values when the page expects total batch values.
- Do not include VAT in sell price.
- Do not count both machine hours and labor hours when they are concurrent.
- Do not assign support/internal QC assets as revenue-generating unless inspection is actually sold separately.
- Do not use cost-plus required EUR/h as market evidence.
- Do not apply a rate card when compatibility is `Wrong profile` or `Not bound`.
- Do not treat one small quote as enough evidence for a permanent rate card. Use it as preliminary evidence.
