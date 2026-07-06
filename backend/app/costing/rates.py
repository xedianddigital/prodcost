"""Pure Python mirror of the machine-rate math in frontend/src/main.tsx.

This is the authoritative contract for the rate formulas -- the frontend implementation at
main.tsx (machineRateFromDrivers, overheadPerMachineHour) must compute the same numbers from
the same inputs. See item 2/3 of FIX_BRIEF.md: only Availability belongs in the rate
denominator, not full OEE, because performance losses already live in cycle/setup minutes
and quality losses in the scrap allowance. Overhead allocation itself is the frontend's
weighted shared-recovery share (see weightedSharedRecoveryPerMachineHour); it arrives here
as the overhead_eur_per_hour input.
"""

from dataclasses import dataclass


def _round_money(value: float) -> float:
    return round(value + 1e-9, 2)


@dataclass
class MachineRateDrivers:
    fixed_cost_eur_per_month: float
    planned_hours_per_month: float
    utilization_percent: float
    availability_percent: float
    variable_cost_eur_per_hour: float = 0.0


def machine_rate_from_drivers(drivers: MachineRateDrivers, overhead_eur_per_hour: float = 0.0) -> float:
    effective_hours = (
        drivers.planned_hours_per_month
        * max(0.01, drivers.utilization_percent)
        * max(0.01, drivers.availability_percent)
    )
    return _round_money(
        drivers.fixed_cost_eur_per_month / max(1.0, effective_hours)
        + drivers.variable_cost_eur_per_hour
        + overhead_eur_per_hour
    )


def total_planned_productive_hours(machines: list[MachineRateDrivers]) -> float:
    total = 0.0
    for machine in machines:
        utilization = max(0.01, machine.utilization_percent)
        availability = max(0.01, machine.availability_percent)
        total += machine.planned_hours_per_month * utilization * availability
    return total


def overhead_per_machine_hour(total_monthly_overhead_eur: float, machines: list[MachineRateDrivers]) -> float:
    hours = total_planned_productive_hours(machines)
    return _round_money(total_monthly_overhead_eur / max(1.0, hours))
