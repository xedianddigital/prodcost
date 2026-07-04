

# important features

[x] Most of the information we entered in json usually comes from ERP: bom, part operation card (operations, machines, cycles, etc), materials in stock / available to be ordered / need confirmation. Depending on the ERP system or access rights, financial data is also available (salaries, costs, etc) - but not always. So, we need to show ability to connect to ERP (using mock adapters) but the client must be confident that this path is prepared. 
[x] tool inventory must be implemented  - you cannot produce the part if you dont have a tool with a needed radius. I do not know which approach is correct, but buying a tool for a single one time order and not making the client pay for it is a path to a loosing business. So we must built a simple library to show examples when all tools are in place or a few/one is missing.
[x] final CO (customer offer) with rows and prices also usually is produced in the ERP. I will say more, even price creation chain is also already there, but we build this tool just and only because most big ERPs are not able to fully recreate all conditions and dependancies of real life company operation. Well, they could, but usually it is not polished to that detailed level of precision. So basically this tool should pull data from erp (to show that not only manual entry is possible), calculate according to precise data with real dependancies that have the critical impact on the price, then send necessary data back to ERP to form a CO. -> this solution wins client approval with high probability.
[x] we use this tool to recalculate existing parts in erp (with model,boms,route,etc) and new parts off step files. The most ideal solution is to build a new tab that is built for clients of the company - there is a client A that want to produce 5 different parts requiring different operations and materials in different batch size. Client A goes to the website, uploads steps files, fills in specification block, tolerance requirements, mandatory QC parameters, required quantity. and then clicks calculate and he see the approximate price for his order. This would need to be manually confirmed before CO, but can be automated if proven working correctly in the future. 

[ ] we need to count in employee operation execution efficiency. plan/fact deviations because of qualification level, product complexity, first time set up.
[ ] full eng/lv i18n



## adjustments

[x] display units for all text box title where applicable: title, unit.
[x] what is target price (how is it made) and accounting price? what exactly is Accounting premium?
[x] CAM/programming as an operation not a Quote Summary step?
[x] target/accounting switcher should move from the header to Quote Summary section


## thoughts

[x] We need to integrate calculator for the target machine rates and full-cost machine rates to avoid question how is it calculated. Tab "resources" Machine Rate Calculator does this with fixed cost, planned hours, actual/target OEE, actual/target Utilization, and variable EUR/h, plus a purchase-price-to-fixed-cost helper.

## Strategy correction (2026-07-04) — see logfile.md section 20 for full detail

[x] 1-2) Accounting-rate pricing (current, low Utilization) is shown but explicitly framed as the Death Spiral trap, not a price floor. Target pricing assumes 100% Target Utilization plus an achievable Target OEE (~80-85%, optimized batch/setup). OEE and Utilization are now separate fields per machine; Idleness = 1 - Utilization (not OEE), shown per machine.
[x] 3-4) Overhead Allocation added in Resources: one editable total monthly overhead, spread per machine hour or as a percent-of-cost coefficient (both derived from the same total). Guide/Case explain that re-enabling overhead raises price back up and that a cheaper competitor has less overhead or more efficiency, no third option.
[x] 5) Profitability Calculator tab: department expenses + stress-testable shop Utilization scenario + commercial policy -> monthly gross profit/loss bridge chart.
[x] 6) Machine Rate Calculator purchase-price-to-fixed-cost helper (purchase price, useful life, salvage %, other fixed costs -> suggested Fixed cost EUR/month).
[x] 7) Added plain-language explanation cards for every new concept.
[x] 8) Added a hand-rolled profit-bridge chart and per-machine Utilization/Idleness bars, styled consistently with the existing UI.