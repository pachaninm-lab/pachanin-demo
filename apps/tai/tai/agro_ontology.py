"""Canonical TAI Agro OS v4 domain ontology registry.

This module is deliberately data-only. It does not grant tool authority, infer tenant
context, or claim that a domain capability is operational. The registry provides stable
canonical entity names for contracts, ingestion, retrieval and deterministic evaluation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final

__all__ = [
    "AGRO_ONTOLOGY_ENTITIES",
    "AGRO_ONTOLOGY_SCHEMA",
    "AgroDomain",
    "OntologyEntity",
    "entity_names",
    "get_entity",
]

AGRO_ONTOLOGY_SCHEMA: Final = "tai.agro-ontology.v4.0"


class AgroDomain(StrEnum):
    """Top-level domains required by TAI Agro OS v4."""

    CROP = "crop"
    LIVESTOCK = "livestock"
    MACHINERY = "machinery"
    AGRIBUSINESS = "agribusiness"


@dataclass(frozen=True, slots=True)
class OntologyEntity:
    """One stable canonical entity name and its owning domain."""

    canonical_name: str
    domain: AgroDomain

    def to_json_object(self) -> dict[str, str]:
        return {
            "canonical_name": self.canonical_name,
            "domain": self.domain.value,
            "schema": AGRO_ONTOLOGY_SCHEMA,
        }


def _entities(domain: AgroDomain, names: tuple[str, ...]) -> tuple[OntologyEntity, ...]:
    return tuple(OntologyEntity(canonical_name=name, domain=domain) for name in names)


_CROP_NAMES: Final[tuple[str, ...]] = (
    "LandParcel",
    "Field",
    "FieldBoundary",
    "ManagementZone",
    "SoilProfile",
    "SoilSample",
    "SoilAnalysis",
    "Season",
    "Crop",
    "Variety",
    "Hybrid",
    "SeedLot",
    "Rotation",
    "TechnologyMap",
    "CropOperation",
    "InputMaterial",
    "Fertilizer",
    "PlantProtectionProduct",
    "IrrigationPlan",
    "HarvestPlan",
    "YieldRecord",
    "StorageLot",
)

_LIVESTOCK_NAMES: Final[tuple[str, ...]] = (
    "Animal",
    "AnimalGroup",
    "Herd",
    "Species",
    "Breed",
    "GeneticLine",
    "Pedigree",
    "ProductionCycle",
    "ReproductiveEvent",
    "HealthEvent",
    "VeterinaryProcedure",
    "Feed",
    "FeedBatch",
    "Ration",
    "FeedingGroup",
    "MilkYield",
    "WeightRecord",
    "EggProduction",
    "HousingUnit",
    "Barn",
    "Pen",
    "Pasture",
    "BiosecurityEvent",
    "AnimalMovement",
)

_MACHINERY_NAMES: Final[tuple[str, ...]] = (
    "Manufacturer",
    "Brand",
    "MachineFamily",
    "MachineModel",
    "Generation",
    "Variant",
    "SerialRange",
    "Configuration",
    "Component",
    "Assembly",
    "Part",
    "Consumable",
    "Fluid",
    "MaintenanceOperation",
    "FaultCode",
    "DiagnosticStep",
    "RepairProcedure",
    "Attachment",
    "CompatibilityRule",
    "Firmware",
    "ECU",
    "Sensor",
    "Actuator",
    "TelematicsSignal",
)

_AGRIBUSINESS_NAMES: Final[tuple[str, ...]] = (
    "Organization",
    "Counterparty",
    "Contract",
    "Lot",
    "Offer",
    "Deal",
    "Delivery",
    "LaboratoryProtocol",
    "QualitySpecification",
    "Document",
    "Payment",
    "Dispute",
    "Evidence",
    "Warehouse",
    "Route",
    "Vehicle",
    "Integration",
    "User",
    "Role",
    "Permission",
)

AGRO_ONTOLOGY_ENTITIES: Final[tuple[OntologyEntity, ...]] = (
    *_entities(AgroDomain.CROP, _CROP_NAMES),
    *_entities(AgroDomain.LIVESTOCK, _LIVESTOCK_NAMES),
    *_entities(AgroDomain.MACHINERY, _MACHINERY_NAMES),
    *_entities(AgroDomain.AGRIBUSINESS, _AGRIBUSINESS_NAMES),
)

_ENTITY_BY_NAME: Final[dict[str, OntologyEntity]] = {
    entity.canonical_name: entity for entity in AGRO_ONTOLOGY_ENTITIES
}
if len(_ENTITY_BY_NAME) != len(AGRO_ONTOLOGY_ENTITIES):
    raise RuntimeError("TAI Agro OS ontology contains duplicate canonical entity names")


def entity_names(domain: AgroDomain | None = None) -> tuple[str, ...]:
    """Return stable canonical names, optionally filtered by domain."""

    return tuple(
        entity.canonical_name
        for entity in AGRO_ONTOLOGY_ENTITIES
        if domain is None or entity.domain is domain
    )


def get_entity(canonical_name: str) -> OntologyEntity:
    """Resolve one canonical entity or fail closed for an unknown name."""

    normalized = canonical_name.strip()
    if not normalized:
        raise ValueError("canonical_name must not be empty")
    try:
        return _ENTITY_BY_NAME[normalized]
    except KeyError as exc:
        raise KeyError(f"unknown TAI Agro OS ontology entity: {normalized}") from exc
