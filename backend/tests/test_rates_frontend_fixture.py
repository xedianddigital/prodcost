"""Cross-checks one fixed JSON input against both sides of the rate contract.

The frontend has no test runner (no vitest/jest configured), so this fixture is the
practical substitute for item 3's "frontend-vs-backend fixture test": the same JSON
drivers a browser would send in `rate_drivers` (built by rateDriversForOperation in
frontend/src/main.tsx) is fed to the backend's machine_rate_from_drivers, and the
expected EUR/h below was hand-computed with the identical formula both sides implement
(fixed_cost / (planned_hours * utilization * availability) + variable + overhead).
If this test ever fails after a frontend or backend formula edit, one side has drifted
from the shared contract.
"""

from app.costing.rates import MachineRateDrivers, machine_rate_from_drivers

# Same JSON shape frontend/src/main.tsx's rateDriversForOperation sends in
# QuoteInput.operations[].rate_drivers for the seed cnc_milling_3_axis machine, target mode.
FIXTURE_JSON = {
    "fixed_cost_eur_per_month": 1565.0,
    "planned_hours_per_month": 160,
    "utilization_percent": 0.95,
    "availability_percent": 0.90,
    "variable_cost_eur_per_hour": 5,
    "overhead_eur_per_hour": 18.8,
}

EXPECTED_EUR_PER_HOUR = 35.24  # 1565 / (160*0.95*0.90) + 5 + 18.8, rounded to 2 decimals


def test_fixture_json_produces_same_rate_backend_and_frontend_agree_on() -> None:
    drivers = MachineRateDrivers(
        fixed_cost_eur_per_month=FIXTURE_JSON["fixed_cost_eur_per_month"],
        planned_hours_per_month=FIXTURE_JSON["planned_hours_per_month"],
        utilization_percent=FIXTURE_JSON["utilization_percent"],
        availability_percent=FIXTURE_JSON["availability_percent"],
        variable_cost_eur_per_hour=FIXTURE_JSON["variable_cost_eur_per_hour"],
    )
    computed = machine_rate_from_drivers(drivers, FIXTURE_JSON["overhead_eur_per_hour"])
    assert computed == EXPECTED_EUR_PER_HOUR
