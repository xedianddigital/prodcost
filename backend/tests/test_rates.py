from app.costing.rates import (
    MachineRateDrivers,
    blended_direct_machine_rate,
    machine_rate_from_drivers,
    overhead_per_machine_hour,
    overhead_percent_equivalent,
)

# Mirrors data/baseline_assumptions.lv.json: saw_cutting, actual scenario.
# fixed cost 273.75, planned hours 160, actual utilization 0.35, actual availability 0.80.
SAW_ACTUAL = MachineRateDrivers(
    fixed_cost_eur_per_month=273.75,
    planned_hours_per_month=160,
    utilization_percent=0.35,
    availability_percent=0.80,
    variable_cost_eur_per_hour=3,
)
# Target scenario: utilization 0.95, availability 0.90.
SAW_TARGET = MachineRateDrivers(
    fixed_cost_eur_per_month=273.75,
    planned_hours_per_month=160,
    utilization_percent=0.95,
    availability_percent=0.90,
    variable_cost_eur_per_hour=3,
)

TOTAL_MONTHLY_OVERHEAD = 18000  # 7000 + 4500 + 3000 + 3500, per baseline_assumptions.lv.json


def _all_actual_machines() -> list[MachineRateDrivers]:
    # planned_hours=160 for all 7 seed machines; utilization varies, availability is 0.80 flat.
    utilizations = [0.35, 0.35, 0.35, 0.35, 0.40, 0.45, 0.50]
    return [
        MachineRateDrivers(
            fixed_cost_eur_per_month=0,
            planned_hours_per_month=160,
            utilization_percent=u,
            availability_percent=0.80,
        )
        for u in utilizations
    ]


def _all_target_machines() -> list[MachineRateDrivers]:
    return [
        MachineRateDrivers(
            fixed_cost_eur_per_month=0,
            planned_hours_per_month=160,
            utilization_percent=0.95,
            availability_percent=0.90,
        )
        for _ in range(7)
    ]


def test_machine_rate_from_drivers_matches_seed_accounting_rate() -> None:
    # 273.75 / (160*0.35*0.80) + 3 + 0 overhead = 273.75/44.8 + 3 = 6.1116... + 3 = 9.11
    assert machine_rate_from_drivers(SAW_ACTUAL) == 9.11


def test_machine_rate_from_drivers_matches_seed_target_rate_with_overhead() -> None:
    # 273.75 / (160*0.95*0.90) + 3 + 18.80 overhead = 273.75/136.8 + 3 + 18.80 = 23.80
    assert machine_rate_from_drivers(SAW_TARGET, overhead_eur_per_hour=18.80) == 23.80


def test_overhead_per_machine_hour_actual_matches_seed() -> None:
    assert overhead_per_machine_hour(TOTAL_MONTHLY_OVERHEAD, _all_actual_machines()) == 51.14


def test_overhead_per_machine_hour_target_matches_seed() -> None:
    assert overhead_per_machine_hour(TOTAL_MONTHLY_OVERHEAD, _all_target_machines()) == 18.8


def test_blended_direct_machine_rate_is_positive_and_weighted() -> None:
    machines = [
        MachineRateDrivers(
            fixed_cost_eur_per_month=1000,
            planned_hours_per_month=160,
            utilization_percent=0.5,
            availability_percent=0.8,
            variable_cost_eur_per_hour=2,
        ),
        MachineRateDrivers(
            fixed_cost_eur_per_month=200,
            planned_hours_per_month=160,
            utilization_percent=0.5,
            availability_percent=0.8,
            variable_cost_eur_per_hour=2,
        ),
    ]
    rate = blended_direct_machine_rate(machines)
    assert rate > 2  # above the variable-only floor
    # Weighted toward the higher-fixed-cost machine since both have equal hours.
    high_rate = machine_rate_from_drivers(machines[0])
    low_rate = machine_rate_from_drivers(machines[1])
    assert low_rate < rate < high_rate


def test_overhead_percent_equivalent_is_zero_with_no_machines() -> None:
    assert overhead_percent_equivalent(TOTAL_MONTHLY_OVERHEAD, []) == 0
