"""Second deterministic calculator wave for TAI Agro OS v4.

All critical values are produced with Decimal arithmetic from explicit inputs.
The module performs transformations only; it does not choose agronomic,
veterinary, financial, or machinery prescriptions.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Final

from .agro_calculators import CalculationResult

__all__ = [
    "calculate_break_even_yield",
    "calculate_crop_material_requirement",
    "calculate_downtime_percent",
    "calculate_expected_crop_margin",
    "calculate_field_time",
    "calculate_fleet_utilization",
    "calculate_livestock_water_requirement",
    "calculate_manure_production",
    "calculate_operation_cost",
    "calculate_ration_cost",
    "calculate_ration_dry_matter",
    "calculate_total_cost_of_ownership",
]

type DecimalInput = Decimal | int | str
_HUNDRED: Final = Decimal("100")


def _decimal(name: str, value: DecimalInput) -> Decimal:
    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{name} must be a finite decimal value") from exc
    if not result.is_finite():
        raise ValueError(f"{name} must be finite")
    return result


def _positive(name: str, value: DecimalInput) -> Decimal:
    result = _decimal(name, value)
    if result <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return result


def _non_negative(name: str, value: DecimalInput) -> Decimal:
    result = _decimal(name, value)
    if result < 0:
        raise ValueError(f"{name} must be zero or greater")
    return result


def _percent(name: str, value: DecimalInput, *, allow_zero: bool = True) -> Decimal:
    result = _decimal(name, value)
    minimum = Decimal("0") if allow_zero else Decimal("0.0000001")
    if result < minimum or result > _HUNDRED:
        raise ValueError(f"{name} must be between {minimum} and 100")
    return result


def _quantize(value: Decimal, places: str) -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def _inputs(**values: Decimal) -> tuple[tuple[str, str], ...]:
    return tuple((name, format(value, "f")) for name, value in values.items())


def _currency(value: str) -> str:
    currency = value.strip().upper()
    if len(currency) != 3 or not currency.isalpha() or not currency.isascii():
        raise ValueError("currency_code must be a three-letter ASCII code")
    return currency


def calculate_field_time(*, area_ha: DecimalInput, capacity_ha_per_h: DecimalInput) -> CalculationResult:
    area = _positive("area_ha", area_ha)
    capacity = _positive("capacity_ha_per_h", capacity_ha_per_h)
    return CalculationResult(
        calculator_id="machinery.field_time",
        formula_version="1.0.0",
        value=_quantize(area / capacity, "0.01"),
        unit="h",
        inputs=_inputs(area_ha=area, capacity_ha_per_h=capacity),
    )


def calculate_crop_material_requirement(
    *, area_ha: DecimalInput, rate_per_ha: DecimalInput, reserve_percent: DecimalInput = 0,
    unit: str = "kg",
) -> CalculationResult:
    area = _positive("area_ha", area_ha)
    rate = _non_negative("rate_per_ha", rate_per_ha)
    reserve = _percent("reserve_percent", reserve_percent)
    normalized_unit = unit.strip()
    if not normalized_unit or len(normalized_unit) > 24:
        raise ValueError("unit must be a non-empty value up to 24 characters")
    total = area * rate * (Decimal("1") + reserve / _HUNDRED)
    return CalculationResult(
        calculator_id="crop.material_requirement",
        formula_version="1.0.0",
        value=_quantize(total, "0.01"),
        unit=normalized_unit,
        inputs=_inputs(area_ha=area, rate_per_ha=rate, reserve_percent=reserve),
        specialist_confirmation_required=True,
    )


def calculate_operation_cost(
    *, machine_hours: DecimalInput, machine_hour_cost: DecimalInput,
    material_cost: DecimalInput = 0, labor_cost: DecimalInput = 0,
    currency_code: str = "RUB",
) -> CalculationResult:
    hours = _non_negative("machine_hours", machine_hours)
    hourly = _non_negative("machine_hour_cost", machine_hour_cost)
    materials = _non_negative("material_cost", material_cost)
    labor = _non_negative("labor_cost", labor_cost)
    currency = _currency(currency_code)
    total = hours * hourly + materials + labor
    return CalculationResult(
        calculator_id="crop.operation_cost",
        formula_version="1.0.0",
        value=_quantize(total, "0.01"),
        unit=currency,
        inputs=_inputs(
            machine_hours=hours,
            machine_hour_cost=hourly,
            material_cost=materials,
            labor_cost=labor,
        ),
    )


def calculate_break_even_yield(
    *, total_cost: DecimalInput, area_ha: DecimalInput, sale_price_per_t: DecimalInput,
) -> CalculationResult:
    cost = _non_negative("total_cost", total_cost)
    area = _positive("area_ha", area_ha)
    price = _positive("sale_price_per_t", sale_price_per_t)
    result = cost / area / price
    return CalculationResult(
        calculator_id="crop.break_even_yield",
        formula_version="1.0.0",
        value=_quantize(result, "0.001"),
        unit="t/ha",
        inputs=_inputs(total_cost=cost, area_ha=area, sale_price_per_t=price),
        warnings=("Excludes taxes, financing and quality adjustments unless included in total_cost.",),
    )


def calculate_expected_crop_margin(
    *, area_ha: DecimalInput, expected_yield_t_per_ha: DecimalInput,
    sale_price_per_t: DecimalInput, total_cost: DecimalInput,
    currency_code: str = "RUB",
) -> CalculationResult:
    area = _positive("area_ha", area_ha)
    crop_yield = _non_negative("expected_yield_t_per_ha", expected_yield_t_per_ha)
    price = _non_negative("sale_price_per_t", sale_price_per_t)
    cost = _non_negative("total_cost", total_cost)
    currency = _currency(currency_code)
    margin = area * crop_yield * price - cost
    return CalculationResult(
        calculator_id="crop.expected_margin",
        formula_version="1.0.0",
        value=_quantize(margin, "0.01"),
        unit=currency,
        inputs=_inputs(
            area_ha=area,
            expected_yield_t_per_ha=crop_yield,
            sale_price_per_t=price,
            total_cost=cost,
        ),
        warnings=("Expected margin is a scenario result, not a guaranteed financial outcome.",),
    )


def calculate_ration_dry_matter(
    *, as_fed_mass_kg: DecimalInput, dry_matter_percent: DecimalInput,
) -> CalculationResult:
    mass = _non_negative("as_fed_mass_kg", as_fed_mass_kg)
    dm = _percent("dry_matter_percent", dry_matter_percent)
    return CalculationResult(
        calculator_id="livestock.ration_dry_matter",
        formula_version="1.0.0",
        value=_quantize(mass * dm / _HUNDRED, "0.001"),
        unit="kg_DM",
        inputs=_inputs(as_fed_mass_kg=mass, dry_matter_percent=dm),
        specialist_confirmation_required=True,
    )


def calculate_ration_cost(
    *, ration_mass_kg: DecimalInput, price_per_kg: DecimalInput,
    animals: DecimalInput = 1, days: DecimalInput = 1, currency_code: str = "RUB",
) -> CalculationResult:
    ration = _non_negative("ration_mass_kg", ration_mass_kg)
    price = _non_negative("price_per_kg", price_per_kg)
    animal_count = _positive("animals", animals)
    period = _positive("days", days)
    currency = _currency(currency_code)
    total = ration * price * animal_count * period
    return CalculationResult(
        calculator_id="livestock.ration_cost",
        formula_version="1.0.0",
        value=_quantize(total, "0.01"),
        unit=currency,
        inputs=_inputs(
            ration_mass_kg=ration,
            price_per_kg=price,
            animals=animal_count,
            days=period,
        ),
        specialist_confirmation_required=True,
    )


def calculate_livestock_water_requirement(
    *, animals: DecimalInput, liters_per_animal_per_day: DecimalInput, days: DecimalInput = 1,
) -> CalculationResult:
    animal_count = _positive("animals", animals)
    daily = _non_negative("liters_per_animal_per_day", liters_per_animal_per_day)
    period = _positive("days", days)
    return CalculationResult(
        calculator_id="livestock.water_requirement",
        formula_version="1.0.0",
        value=_quantize(animal_count * daily * period, "0.01"),
        unit="L",
        inputs=_inputs(animals=animal_count, liters_per_animal_per_day=daily, days=period),
        specialist_confirmation_required=True,
    )


def calculate_manure_production(
    *, animals: DecimalInput, kg_per_animal_per_day: DecimalInput, days: DecimalInput,
) -> CalculationResult:
    animal_count = _positive("animals", animals)
    daily = _non_negative("kg_per_animal_per_day", kg_per_animal_per_day)
    period = _positive("days", days)
    return CalculationResult(
        calculator_id="livestock.manure_production",
        formula_version="1.0.0",
        value=_quantize(animal_count * daily * period, "0.01"),
        unit="kg",
        inputs=_inputs(animals=animal_count, kg_per_animal_per_day=daily, days=period),
        specialist_confirmation_required=True,
    )


def calculate_fleet_utilization(
    *, productive_hours: DecimalInput, available_hours: DecimalInput,
) -> CalculationResult:
    productive = _non_negative("productive_hours", productive_hours)
    available = _positive("available_hours", available_hours)
    if productive > available:
        raise ValueError("productive_hours must not exceed available_hours")
    return CalculationResult(
        calculator_id="machinery.fleet_utilization",
        formula_version="1.0.0",
        value=_quantize(productive / available * _HUNDRED, "0.01"),
        unit="percent",
        inputs=_inputs(productive_hours=productive, available_hours=available),
    )


def calculate_downtime_percent(
    *, downtime_hours: DecimalInput, scheduled_hours: DecimalInput,
) -> CalculationResult:
    downtime = _non_negative("downtime_hours", downtime_hours)
    scheduled = _positive("scheduled_hours", scheduled_hours)
    if downtime > scheduled:
        raise ValueError("downtime_hours must not exceed scheduled_hours")
    return CalculationResult(
        calculator_id="machinery.downtime",
        formula_version="1.0.0",
        value=_quantize(downtime / scheduled * _HUNDRED, "0.01"),
        unit="percent",
        inputs=_inputs(downtime_hours=downtime, scheduled_hours=scheduled),
    )


def calculate_total_cost_of_ownership(
    *, purchase_price: DecimalInput, residual_value: DecimalInput,
    maintenance_cost: DecimalInput, fuel_cost: DecimalInput,
    insurance_cost: DecimalInput = 0, other_cost: DecimalInput = 0,
    currency_code: str = "RUB",
) -> CalculationResult:
    purchase = _non_negative("purchase_price", purchase_price)
    residual = _non_negative("residual_value", residual_value)
    maintenance = _non_negative("maintenance_cost", maintenance_cost)
    fuel = _non_negative("fuel_cost", fuel_cost)
    insurance = _non_negative("insurance_cost", insurance_cost)
    other = _non_negative("other_cost", other_cost)
    if residual > purchase:
        raise ValueError("residual_value must not exceed purchase_price")
    currency = _currency(currency_code)
    total = purchase - residual + maintenance + fuel + insurance + other
    return CalculationResult(
        calculator_id="machinery.total_cost_of_ownership",
        formula_version="1.0.0",
        value=_quantize(total, "0.01"),
        unit=currency,
        inputs=_inputs(
            purchase_price=purchase,
            residual_value=residual,
            maintenance_cost=maintenance,
            fuel_cost=fuel,
            insurance_cost=insurance,
            other_cost=other,
        ),
        warnings=("Financing and tax effects are excluded unless supplied through other_cost.",),
    )
