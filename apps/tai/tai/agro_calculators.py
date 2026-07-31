"""Deterministic calculators for the first TAI Agro OS v4 implementation slice.

Critical values are produced by code using Decimal arithmetic. These calculators do not
choose agronomic, veterinary or repair prescriptions. They only transform explicit inputs
with versioned formulas and fail closed when required data is missing or invalid.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Final, TypeAlias

__all__ = [
    "CalculationResult",
    "calculate_average_daily_gain",
    "calculate_effective_field_capacity",
    "calculate_feed_conversion",
    "calculate_machine_hour_cost",
    "calculate_seed_requirement",
]

DecimalInput: TypeAlias = Decimal | int | str
_HUNDRED: Final = Decimal("100")
_TEN_THOUSAND: Final = Decimal("10000")
_ONE_MILLION: Final = Decimal("1000000")


@dataclass(frozen=True, slots=True)
class CalculationResult:
    """Versioned, auditable result of one deterministic formula."""

    calculator_id: str
    formula_version: str
    value: Decimal
    unit: str
    inputs: tuple[tuple[str, str], ...]
    warnings: tuple[str, ...] = ()
    specialist_confirmation_required: bool = False

    def to_json_object(self) -> dict[str, object]:
        return {
            "calculator_id": self.calculator_id,
            "formula_version": self.formula_version,
            "inputs": dict(self.inputs),
            "specialist_confirmation_required": self.specialist_confirmation_required,
            "unit": self.unit,
            "value": format(self.value, "f"),
            "warnings": list(self.warnings),
        }


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


def _percent(name: str, value: DecimalInput, *, allow_zero: bool = False) -> Decimal:
    result = _decimal(name, value)
    minimum = Decimal("0") if allow_zero else Decimal("0.0000001")
    if result < minimum or result > _HUNDRED:
        lower = "zero" if allow_zero else "greater than zero"
        raise ValueError(f"{name} must be {lower} and not greater than 100")
    return result


def _quantize(value: Decimal, places: str) -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def _input_tuple(**values: Decimal) -> tuple[tuple[str, str], ...]:
    return tuple((name, format(value, "f")) for name, value in values.items())


def calculate_seed_requirement(
    *,
    area_ha: DecimalInput,
    target_plants_per_m2: DecimalInput,
    thousand_seed_weight_g: DecimalInput,
    germination_percent: DecimalInput,
    field_emergence_percent: DecimalInput,
    reserve_percent: DecimalInput = 0,
) -> CalculationResult:
    """Calculate total seed mass from explicit stand and quality assumptions.

    Formula:
      required seeds/ha = target plants/m² × 10,000 ÷ germination ÷ field emergence
      kg/ha = required seeds/ha × TSW(g) ÷ 1,000,000
      total kg = kg/ha × area × (1 + reserve)
    """

    area = _positive("area_ha", area_ha)
    target = _positive("target_plants_per_m2", target_plants_per_m2)
    tsw = _positive("thousand_seed_weight_g", thousand_seed_weight_g)
    germination = _percent("germination_percent", germination_percent)
    emergence = _percent("field_emergence_percent", field_emergence_percent)
    reserve = _percent("reserve_percent", reserve_percent, allow_zero=True)

    required_seeds_per_ha = target * _TEN_THOUSAND / (germination / _HUNDRED) / (
        emergence / _HUNDRED
    )
    kg_per_ha = required_seeds_per_ha * tsw / _ONE_MILLION
    total_kg = kg_per_ha * area * (Decimal("1") + reserve / _HUNDRED)

    return CalculationResult(
        calculator_id="crop.seed_requirement",
        formula_version="1.0.0",
        value=_quantize(total_kg, "0.01"),
        unit="kg",
        inputs=_input_tuple(
            area_ha=area,
            target_plants_per_m2=target,
            thousand_seed_weight_g=tsw,
            germination_percent=germination,
            field_emergence_percent=emergence,
            reserve_percent=reserve,
        ),
        warnings=(
            "Result depends on the supplied germination and field-emergence assumptions.",
        ),
        specialist_confirmation_required=True,
    )


def calculate_effective_field_capacity(
    *,
    working_width_m: DecimalInput,
    speed_kmh: DecimalInput,
    field_efficiency_percent: DecimalInput,
) -> CalculationResult:
    """Calculate effective field capacity in hectares per hour."""

    width = _positive("working_width_m", working_width_m)
    speed = _positive("speed_kmh", speed_kmh)
    efficiency = _percent("field_efficiency_percent", field_efficiency_percent)
    capacity = width * speed / Decimal("10") * (efficiency / _HUNDRED)
    return CalculationResult(
        calculator_id="machinery.effective_field_capacity",
        formula_version="1.0.0",
        value=_quantize(capacity, "0.001"),
        unit="ha/h",
        inputs=_input_tuple(
            working_width_m=width,
            speed_kmh=speed,
            field_efficiency_percent=efficiency,
        ),
    )


def calculate_average_daily_gain(
    *,
    start_weight_kg: DecimalInput,
    end_weight_kg: DecimalInput,
    days: DecimalInput,
) -> CalculationResult:
    """Calculate average daily liveweight gain in kilograms per day."""

    start = _non_negative("start_weight_kg", start_weight_kg)
    end = _positive("end_weight_kg", end_weight_kg)
    period = _positive("days", days)
    if end <= start:
        raise ValueError("end_weight_kg must be greater than start_weight_kg")
    gain = (end - start) / period
    return CalculationResult(
        calculator_id="livestock.average_daily_gain",
        formula_version="1.0.0",
        value=_quantize(gain, "0.001"),
        unit="kg/day",
        inputs=_input_tuple(start_weight_kg=start, end_weight_kg=end, days=period),
    )


def calculate_feed_conversion(
    *,
    feed_intake_kg: DecimalInput,
    weight_gain_kg: DecimalInput,
) -> CalculationResult:
    """Calculate feed conversion as kilograms of feed per kilogram of gain."""

    feed = _positive("feed_intake_kg", feed_intake_kg)
    gain = _positive("weight_gain_kg", weight_gain_kg)
    conversion = feed / gain
    return CalculationResult(
        calculator_id="livestock.feed_conversion",
        formula_version="1.0.0",
        value=_quantize(conversion, "0.001"),
        unit="kg_feed/kg_gain",
        inputs=_input_tuple(feed_intake_kg=feed, weight_gain_kg=gain),
    )


def calculate_machine_hour_cost(
    *,
    fixed_cost_total: DecimalInput,
    variable_cost_total: DecimalInput,
    operating_hours: DecimalInput,
    currency_code: str = "RUB",
) -> CalculationResult:
    """Calculate auditable machine-hour cost without binary floating-point money."""

    fixed = _non_negative("fixed_cost_total", fixed_cost_total)
    variable = _non_negative("variable_cost_total", variable_cost_total)
    hours = _positive("operating_hours", operating_hours)
    currency = currency_code.strip().upper()
    if len(currency) != 3 or not currency.isalpha() or not currency.isascii():
        raise ValueError("currency_code must be a three-letter ASCII code")
    cost = (fixed + variable) / hours
    return CalculationResult(
        calculator_id="machinery.machine_hour_cost",
        formula_version="1.0.0",
        value=_quantize(cost, "0.01"),
        unit=f"{currency}/h",
        inputs=_input_tuple(
            fixed_cost_total=fixed,
            variable_cost_total=variable,
            operating_hours=hours,
        ),
    )
