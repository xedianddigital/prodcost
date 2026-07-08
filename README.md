# ProdCost

A production cost calculator and quoting tool for CNC-focused metalworking manufacturers. It turns a customer RFQ into a defensible sell price by building the price up from real machine, labor, material, and overhead cost, then showing every step of that chain rather than a single opaque number.

The tool was built around a concrete business question: why can a shop's quoted prices be several times higher than competitors even though its machines and people aren't unusually expensive? The answer is rarely one thing — it's a mix of idle machine capacity, uncounted overhead, optimistic route assumptions, missing tooling, material waste, and one-time engineering effort — so the tool is built to make each of those contributions visible and adjustable on its own, instead of collapsing them into one estimate.

## What it does

- **Quote Builder** — builds a quote from RFQ metadata, a material/stock selection (with a cutoff calculator for real buy-quantity from fixed stock lengths), a CAM/engineering step for new vs. repeat parts, an editable operation route, and a tool-inventory check that prices in any missing tooling. Every quote is priced twice — at a realistic **Target** rate and today's **Accounting** rate — so the cost of under-loaded capacity is visible on every quote, not just in aggregate.
- **Company Profile** — a plain-language builder for a company's production assets, employees, and facility overhead, which feeds every other calculation from one source of truth.
- **Resources** — the assumptions warehouse: commercial policy, labor and machine rate drivers, material library, tool inventory, operation templates, and overhead allocation, each with a plain-language explanation of what it means and why the default is what it is.
- **Market Rates** — builds an external market EUR/h rate per work center from real evidence: your own quote history, and competitor quotes uploaded as PDFs, matched to your own parts and broken down by the work center (machine) that actually did the job — not a blended, unreliable regression.
- **Scenarios** — decomposes the gap between today's price and a properly-loaded price into Utilization, Availability, and overhead, runs a sensitivity table across the main cost drivers, and answers "what would it take to match a competitor's price" for margin, rate, or utilization alone.
- **Profitability** — an independent "can this business be profitable at all" model: fixed cost, overhead, and a stress-testable shop utilization scenario, with a real break-even utilization figure.
- **Client Portal** — a self-serve RFQ intake for external customers: STEP upload, requirement fields, and a preliminary price range, with a one-click bridge into a full internal quote once someone needs to confirm it.
- **Print** — a browser-printable Customer Offer (customer-safe) and Internal Cost Sheet (full cost breakdown), and a mock ERP adapter for importing part/route/BOM data and sending calculated offers back out.
- **EN / LV** — the whole UI is available in English and Latvian, switchable at any time.

See [`guidebook.md`](guidebook.md) for a full tab-by-tab walkthrough, and [`demo-script.md`](demo-script.md) for a ready-to-use presentation script.

## Quick start

Requires **Python 3.11+** and **Node.js 18+**. No database or external services — everything is stored in `data/*.json`.

```bash
./setup.sh   # once, after cloning: creates the backend virtualenv, installs frontend deps
./start.sh   # every time: starts backend (8002) + frontend (8001), opens the browser
```

Then open `http://localhost:8001` and click **Load Demo RFQ** on the Quote tab for a filled-in example. See [`runbook.md`](runbook.md) for manual start steps, running tests, and troubleshooting.

## Repository layout

```text
backend/       FastAPI API and the deterministic costing engine
frontend/      React + TypeScript UI
data/          Editable baseline assumptions and seed/demo data
docs/          Architecture, costing model, and assumptions reference
```

## Documentation map

| File | What it's for |
|---|---|
| [`runbook.md`](runbook.md) | Manual start steps, running tests, troubleshooting |
| [`guidebook.md`](guidebook.md) | Full tab-by-tab walkthrough of every feature |
| [`demo-script.md`](demo-script.md) | A ready-to-use presentation script |
| [`docs/architecture.md`](docs/architecture.md) | Core concepts and product boundary |
| [`docs/costing-model.md`](docs/costing-model.md) | The cost formula in detail |
| [`docs/assumptions.md`](docs/assumptions.md) | Where the starter assumption values come from |
| [`docs/market-rates-page-guide.md`](docs/market-rates-page-guide.md) | What the Market Rates page answers and how |

## Baseline assumptions

Starter assumptions are intentionally not treated as truth. They live in `data/baseline_assumptions.lv.json`, are editable through the Resources tab, and should be replaced with company-specific data as soon as it's available.

Primary public references currently used for calibration:

- Latvia Official Statistics Portal, wages and salaries: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries
- Latvia Official Statistics Portal, 2025 wages press release: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries/press-releases/26599-wages-and-salaries-4th?themeCode=DS
- Latvia Official Statistics Portal, Q1 2026 wages press release: https://stat.gov.lv/en/statistics-themes/labour-market/wages-and-salaries/press-releases/27579-wages-and-salaries-1st?themeCode=DS
- Eurostat non-household electricity prices dataset: https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_205/default/table?lang=en
