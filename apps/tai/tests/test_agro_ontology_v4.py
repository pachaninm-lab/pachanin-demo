from tai.agro_ontology import (
    AGRO_ONTOLOGY_ENTITIES,
    AGRO_ONTOLOGY_SCHEMA,
    AgroDomain,
    entity_names,
    get_entity,
)


def test_v4_ontology_has_all_required_entities_without_duplicates() -> None:
    names = entity_names()
    assert AGRO_ONTOLOGY_SCHEMA == "tai.agro-ontology.v4.0"
    assert len(names) == 90
    assert len(set(names)) == len(names)
    assert len(AGRO_ONTOLOGY_ENTITIES) == len(names)


def test_v4_ontology_domain_counts_are_stable() -> None:
    assert len(entity_names(AgroDomain.CROP)) == 22
    assert len(entity_names(AgroDomain.LIVESTOCK)) == 24
    assert len(entity_names(AgroDomain.MACHINERY)) == 24
    assert len(entity_names(AgroDomain.AGRIBUSINESS)) == 20


def test_entity_lookup_is_fail_closed() -> None:
    assert get_entity("Animal").domain is AgroDomain.LIVESTOCK
    try:
        get_entity("ImaginaryMachine")
    except KeyError as exc:
        assert "unknown TAI Agro OS ontology entity" in str(exc)
    else:
        raise AssertionError("unknown entity must fail closed")
