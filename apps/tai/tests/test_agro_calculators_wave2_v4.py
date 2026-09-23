from decimal import Decimal

import pytest

from tai.agro_calculators_wave2 import (
    calculate_break_even_yield,
    calculate_crop_material_requirement,
    calculate_downtime_percent,
    calculate_expected_crop_margin,
    calculate_field_time,
    calculate_fleet_utilization,
    calculate_livestock_water_requirement,
    calculate_manure_production,
    calculate_operation_cost,
    calculate_ration_cost,
    calculate_ration_dry_matter,
    calculate_total_cost_of_ownership,
)


def test_field_time() -> None:
    result = calculate_field_time(area_ha="120", capacity_ha_per_h="6")
    assert result.value == Decimal("20.00")
    assert result.unit == "h"


def test_crop_material_requirement_with_reserve() -> None:
    result = calculate_crop_material_requirement(
        area_ha="100", rate_per_ha="2.5", reserve_percent="4", unit="L"
    )
    assert result.value == Decimal("260.00")
    assert result.specialist_confirmation_required is True


def test_operation_cost() -> None:
    result = calculate_operation_cost(
        machine_hours="10", machine_hour_cost="4500", material_cost="12000", labor_cost="8000"
    )
    assert result.value == Decimal("65000.00")
    assert result.unit == "RUB"


def test_break_even_yield() -> None:
    result = calculate_break_even_yield(total_cost="1500000", area_ha="100", sale_price_per_t="15000")
    assert result.value == Decimal("1.000")


def test_expected_crop_margin_can_be_negative() -> None:
    result = calculate_expected_crop_margin(
        area_ha="100", expected_yield_t_per_ha="2", sale_price_per_t="10000", total_cost="2500000"
    )
    assert result.value == Decimal("-500000.00")


def test_ration_dry_matter() -> None:
    result = calculate_ration_dry_matter(as_fed_mass_kg="25", dry_matter_percent="40")
    assert result.value == Decimal("10.000")


def test_ration_cost() -> None:
    result = calculate_ration_cost(
        ration_mass_kg="20", price_per_kg="15", animals="100", days="30"
    )
    assert result.value == Decimal("900000.00")


def test_water_requirement() -> None:
    result = calculate_livestock_water_requirement(
        animals="80", liters_per_animal_per_day="70", days="7"
    )
    assert result.value == Decimal("39200.00")


def test_manure_production() -> None:
    result = calculate_manure_production(animals="50", kg_per_animal_per_day="40", days="10")
    assert result.value == Decimal("20000.00")


def test_fleet_utilization() -> None:
    result = calculate_fleet_utilization(productive_hours="75", available_hours="100")
    assert result.value == Decimal("75.00")


def test_downtime() -> None:
    result = calculate_downtime_percent(downtime_hours="8", scheduled_hours="40")
    assert result.value == Decimal("20.00")


def test_total_cost_of_ownership() -> None:
    result = calculate_total_cost_of_ownership(
        purchase_price="10000000",
        residual_value="3000000",
        maintenance_cost="1000000",
        fuel_cost="2500000",
        insurance_cost="300000",
        other_cost="200000",
    )
    assert result.value == Decimal("11000000.00")


@pytest.mark.parametrize(
    ("call", "message"),
    [
        (lambda: calculate_field_time(area_ha="1", capacity_ha_per_h="0"), "capacity_ha_per_h"),
        (
            lambda: calculate_fleet_utilization(productive_hours="11", available_hours="10"),
            "must not exceed",
        ),
        (
            lambda: calculate_total_cost_of_ownership(
                purchase_price="10", residual_value="11", maintenance_cost="0", fuel_cost="0"
            ),
            "residual_value",
        ),
        (
            lambda: calculate_operation_cost(
                machine_hours="1", machine_hour_cost="1", currency_code="RUBLE"
            ),
            "currency_code",
        ),
    ],
)
def test_fail_closed_validation(call, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        call()
