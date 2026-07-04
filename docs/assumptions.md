# Assumptions

## Principle

Starter assumptions are placeholders. They are useful only because they make the first calculator usable before the company has clean data. Every assumption must be editable, visible in quote output, and eventually replaceable with proven internal data.

## Latvian Baseline Calibration

The current starter labor baseline is calibrated from Latvia public wage and labor cost indicators, not from metalworking-specific company payroll.

Relevant public references:

- Latvia Official Statistics Portal lists wages and salaries datasets and press releases.
- The 2025 release reports average monthly gross wages of EUR 1,815 and hourly labour costs of EUR 15.45 in 2025.
- The Q1 2026 release reports provisional average monthly gross wages of EUR 1,831 and hourly labour costs of EUR 14.95.

These numbers are national averages, not CNC machinist market rates. The seed data therefore uses higher role-specific rates for skilled CNC work and setup/programming.

## Data Quality Levels

- `public_proxy`: based on public national or EU data.
- `industry_estimate`: reasonable industry estimate without confirmed company evidence.
- `company_estimate`: internal estimate from management or operators.
- `measured`: measured actual value from payroll, accounting, ERP, MES, invoices, or production records.

## Replacement Priority

Replace assumptions in this order:

1. machine available hours and actual Utilization (order load), tracked separately from OEE (performance when loaded)
2. operator and programmer employer cost per hour
3. material purchase prices and minimum stock sizes
4. setup times by operation family
5. actual cycle times by part family
6. tooling and insert usage
7. overhead allocation total and method (per machine hour vs percent of cost)
8. scrap and rework rates

## Calibration Loop (Actuals Feedback)

"Apply to Templates" in the Quote Builder's Actuals Feedback panel updates operation templates
from measured actuals, but it is a **per operation type** loop, not per part family: it averages
recorded actuals across whatever parts in the current session used that operation type, and
writes the result into the one shared template for that operation type. It is not yet smart
enough to notice that a `milling_3_axis` operation on a small aluminium bracket behaves
differently from the same operation type on a large steel plate -- part-family-aware
normalization is future work.

To keep one odd job from swinging the shared default for every future quote, the update is a
**running weighted mean**, not a flat overwrite: `new = (old * n + mean(actuals) * k) / (n + k)`,
where `n` is the template's `calibration_sample_count` (capped at 20 so the template stays
adaptive rather than freezing on old data forever) and `k` is the number of actuals just
recorded. Before applying, the UI shows an old -> new review per affected template; if any field
would move 3x or more, that template requires an explicit confirmation checkbox before the apply
button will proceed. Sample counts persist in `data/baseline_assumptions.lv.json` alongside each
template's `quality` field.

## Labor Cost From Gross Salary

Labor can be entered either as a direct loaded hourly rate or derived from gross monthly salary.
For Latvian standard employees, the seed assumption uses VID's employer-side VSAOI rate of 23.59%:

```text
employer_hourly_cost = gross_monthly_salary * (1 + employer_vsaoi_rate) / paid_hours_per_month
```

The default is only valid for standard employees insured for all social insurance types. Special employee categories, payroll caps, benefits, bonuses, sick-leave rules, vacation reserves, and other payroll costs should be added once company accounting data is available.

Source: https://www.vid.gov.lv/lv/valsts-socialas-apdrosinasanas-obligatas-iemaksas

## Fixed Cost From Purchase Price

Machine fixed cost should be derived forward from equipment purchase price, not back-solved to match a pre-existing assumption:

```text
depreciation_eur_per_month = purchase_price * (1 - salvage_percent) / (useful_life_years * 12)
monthly_fixed_cost_eur = depreciation_eur_per_month + other_monthly_fixed_cost_eur
```

`other_monthly_fixed_cost_eur` is for known recurring costs not captured by depreciation: maintenance contracts, floor/rent allocation, insurance, financing. It should stay a modest addition to depreciation, not the dominant term — if it does dominate, that is a sign the purchase price or useful life input needs review, not that the "other" bucket should be inflated to hit a target total. The seed data's purchase prices, useful lives, and salvage percentages are estimates for demonstration; replace them with the company's actual equipment costs and depreciation schedule.

## Deliberate MVP Simplifications

- Material starts from purchasable stock, not net part geometry.
- CAM-level machining physics are out of scope.
- Availability and Utilization are used for rate scenarios, not live machine monitoring. They are kept as separate drivers: Availability is uptime when a machine has work loaded; Utilization is whether it has work loaded at all. Idleness is derived from Utilization, not Availability or OEE. OEE (availability x performance x quality) is still shown as a diagnostic gauge but does not enter the rate formula, since performance losses already live in cycle/setup times and quality losses in the scrap allowance — folding OEE into the rate as well would double-count both.
- Overhead (admin, sales, quality management, facility) is a single editable monthly total, not a departmental cost allocation system; it can be spread per machine hour or expressed as a percent-of-cost coefficient.
- Tooling is initially entered as cost per part or per batch.
- Outsourced work is entered manually per part or per batch.
- STEP files are initially stored as RFQ metadata; geometry parsing is a later estimator layer.
- New parts include CAM programming and prove-out cost. Repeat parts reuse existing CAM and carry reduced review/prove-out cost.

