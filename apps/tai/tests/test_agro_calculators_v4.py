from decimal import Decimal

import pytest

from tai.agro_calculators import (
    calculate_average_daily_gain,
    calculate_effective_field_capacity,
    calculate_feed_conversion,
    calculate_machine_hour_cost,
    calculate_seed_requirement,
)


def test_seed_requirement_is_decimal_versioned_and_requires_confirmation() -> None:
    result = calculate_seed_requirement(
        area_ha="100",
        target_plants_per_m2="500",
        thousand_seed_weight_g="40",
        germination_percent="95",
        field_emergence_percent="90",
        reserve_percent="5",
    )
    assert result.value == Decimal("24561.40")
    assert result.unit == "kg"
    assert result.formula_version == "1.0.0"
    assert result.specialist_confirmation_required is True


def test_effective_field_capacity() -> None:
    result = calculate_effective_field_capacity(
        working_width_m="6",
        speed_kmh="10",
        field_efficiency_percent="75",
    )
    assert result.value == Decimal("4.500")
    assert result.unit == "ha/h"


def test_livestock_calculators() -> None:
    gain = calculate_average_daily_gain(
        start_weight_kg="300", end_weight_kg="390", days="90"
    )
    conversion = calculate_feed_conversion(feed_intake_kg="720", weight_gain_kg="90")
    assert gain.value == Decimal("1.000")
    assert conversion.value == Decimal("8.000")


def test_machine_hour_cost_uses_decimal_money() -> None:
    result = calculate_machine_hour_cost(
        fixed_cost_total="1200000",
        variable_cost_total="800000",
        operating_hours="1000",
    )
    assert result.value == Decimal("2000.00")
    assert result.unit == "RUB/h"


@pytest.mark.parametrize(
    ("call", "expected"),
    [
        (
            lambda: calculate_seed_requirement(
                area_ha="100",
                target_plants_per_m2="500",
                thousand_seed_weight_g="40",
                germination_percent="0",
                field_emergence_percent="90",
            ),
            "germination_percent",
        ),
        (
            lambda: calculate_average_daily_gain(
                start_weight_kg="390", end_weight_kg="300", days="90"
            ),
            "end_weight_kg",
        ),
        (
            lambda: calculate_machine_hour_cost(
                fixed_cost_total="1",
                variable_cost_total="1",
                operating_hours="0",
            ),
            "operating_hours",
        ),
    ],
)
def test_invalid_inputs_fail_closed(call, expected: str) -> None:
    with pytest.raises(ValueError, match=expected):
        call()
