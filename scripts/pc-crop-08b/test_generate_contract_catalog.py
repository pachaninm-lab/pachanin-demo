#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("generate_contract_catalog.py")
SPEC = importlib.util.spec_from_file_location("pc_crop_08b_generator", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load generator")
generator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)


class CatalogGeneratorTests(unittest.TestCase):
    def test_operation_code_conversion_is_stable(self) -> None:
        self.assertEqual(
            generator.snake_case("CreateSDIZElevator"),
            "CREATE_SDIZ_ELEVATOR",
        )
        self.assertEqual(
            generator.snake_case("GetListGpbSDIZ"),
            "GET_LIST_GPB_SDIZ",
        )
        self.assertEqual(generator.snake_case(""), "DICTIONARIES")

    def test_orphan_request_fails_closed(self) -> None:
        files = {
            "fgis-zerno-api-sdiz-1.0.23.xsd": b"""<?xml version='1.0'?>
              <xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'
                targetNamespace='urn://example/sdiz/1.0.23'>
                <xs:element name='RequestCreateSDIZ' type='xs:string'/>
                <xs:element name='ResponseGetListSDIZ' type='xs:string'/>
              </xs:schema>""",
        }
        with self.assertRaisesRegex(generator.CatalogError, "orphan request"):
            generator.parse_business_operations(
                files,
                {"fgis-zerno-api-sdiz-1.0.23.xsd": "a" * 64},
            )

    def test_duplicate_operation_code_across_families_fails_closed(self) -> None:
        schema = b"""<?xml version='1.0'?>
          <xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'
            targetNamespace='urn://example/1.0.23'>
            <xs:element name='RequestCreateThing' type='xs:string'/>
            <xs:element name='ResponseCreateThing' type='xs:string'/>
          </xs:schema>"""
        files = {
            "fgis-zerno-api-gpb-1.0.23.xsd": schema,
            "fgis-zerno-api-sdiz-1.0.23.xsd": schema,
        }
        with self.assertRaisesRegex(
            generator.CatalogError,
            "duplicate operation code",
        ):
            generator.parse_business_operations(
                files,
                {name: "a" * 64 for name in files},
            )

    def test_catalog_canonical_json_hash_is_order_stable(self) -> None:
        left = generator.sha256_bytes(
            generator.canonical_json_bytes({"b": 2, "a": 1}),
        )
        right = generator.sha256_bytes(
            generator.canonical_json_bytes({"a": 1, "b": 2}),
        )
        self.assertEqual(left, right)


if __name__ == "__main__":
    unittest.main()
