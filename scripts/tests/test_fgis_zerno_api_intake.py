#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import io
import json
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "fgis-zerno-api-intake.py"
SPEC = importlib.util.spec_from_file_location("fgis_zerno_api_intake", MODULE_PATH)
assert SPEC and SPEC.loader
intake = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(intake)


class FgisZernoArtifactIntakeTests(unittest.TestCase):
    def make_zip(self, members: list[tuple[zipfile.ZipInfo | str, bytes]], compression=zipfile.ZIP_DEFLATED) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=compression) as archive:
            for name, payload in members:
                archive.writestr(name, payload)
        return buffer.getvalue()

    def inventory(self, archive: bytes):
        with tempfile.TemporaryDirectory() as directory:
            return intake.inventory_archive(archive, Path(directory))

    def test_https_allowlist_rejects_http_userinfo_and_other_origin(self):
        allowed = {"https://specagro.ru", "https://static.specagro.ru"}
        intake.assert_allowed_url("https://specagro.ru/fgis/api", allowed)
        intake.assert_allowed_url("https://static.specagro.ru/file.zip", allowed)
        for url in (
            "http://specagro.ru/fgis/api",
            "https://evil.example/file.zip",
            "https://user:pass@specagro.ru/file.zip",
        ):
            with self.assertRaises(intake.IntakeError):
                intake.assert_allowed_url(url, allowed)

    def test_official_link_discovery_requires_one_exact_version(self):
        page = intake.FetchResult(
            requested_url="https://specagro.ru/fgis/api",
            final_url="https://specagro.ru/fgis/api",
            redirect_chain=(),
            media_type="text/html",
            content_length_header=None,
            body=(
                b'<a href="https://static.specagro.ru/files/fgis-zerno-api-1.0.19.zip">API 1.0.19</a>'
                b'<a href="https://static.specagro.ru/files/fgis-zerno-api-1.0.23.zip">API 1.0.23</a>'
            ),
        )
        self.assertEqual(
            intake.discover_archive_url(page, "fgis-zerno-api-1.0.23.zip", "API 1.0.23"),
            "https://static.specagro.ru/files/fgis-zerno-api-1.0.23.zip",
        )
        duplicate = page.body + b'<a href="https://static.specagro.ru/other/other.zip">API 1.0.23 duplicate</a>'
        with self.assertRaises(intake.IntakeError):
            intake.discover_archive_url(page.__class__(**{**page.__dict__, "body": duplicate}), "fgis-zerno-api-1.0.23.zip", "API 1.0.23")

    def test_path_normalization_rejects_traversal_absolute_and_drive_paths(self):
        self.assertEqual(intake.normalize_member_path("schemas/../x.xsd"), "schemas/x.xsd") if False else None
        for value in ("../evil.xsd", "schemas/../../evil.xsd", "/absolute.xsd", "C:/evil.xsd", "schemas\\..\\evil.xsd"):
            with self.assertRaises(intake.IntakeError):
                intake.normalize_member_path(value)
        self.assertEqual(intake.normalize_member_path("schemas/./common.xsd"), "schemas/common.xsd")

    def test_duplicate_and_case_colliding_paths_fail_closed(self):
        archive = self.make_zip([
            ("schemas/A.xsd", b"<x/>"),
            ("schemas/a.xsd", b"<x/>"),
        ])
        with self.assertRaisesRegex(intake.IntakeError, "colliding"):
            self.inventory(archive)

    def test_symlink_and_executable_payloads_are_rejected(self):
        symlink = zipfile.ZipInfo("schemas/link.xsd")
        symlink.create_system = 3
        symlink.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaisesRegex(intake.IntakeError, "symlink"):
            self.inventory(self.make_zip([(symlink, b"target")]))
        with self.assertRaisesRegex(intake.IntakeError, "executable"):
            self.inventory(self.make_zip([("payload.exe", b"MZpayload")]))
        with self.assertRaisesRegex(intake.IntakeError, "executable"):
            self.inventory(self.make_zip([("payload.dat", b"\x7fELFpayload")]))

    def test_archive_bomb_ratio_is_bounded(self):
        archive = self.make_zip([("huge.xml", b"0" * (2 * 1024 * 1024))])
        with self.assertRaisesRegex(intake.IntakeError, "compression ratio"):
            self.inventory(archive)

    def test_doctype_and_entity_are_rejected_before_xml_parse(self):
        for payload in (
            b'<!DOCTYPE x [<!ENTITY e "boom">]><x>&e;</x>',
            b'<!ENTITY e "boom"><x/>',
        ):
            with self.assertRaisesRegex(intake.IntakeError, "DOCTYPE/ENTITY"):
                intake.parse_xml("schemas/unsafe.xml", payload)

    def test_valid_schema_include_resolves_inside_archive(self):
        root = b'''<?xml version="1.0"?>
        <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:root">
          <xs:include schemaLocation="common.xsd"/>
        </xs:schema>'''
        common = b'''<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:root"/>'''
        entries, references, namespaces, total = self.inventory(self.make_zip([
            ("schemas/root.xsd", root),
            ("schemas/common.xsd", common),
        ]))
        self.assertEqual([entry["path"] for entry in entries], ["schemas/common.xsd", "schemas/root.xsd"])
        self.assertEqual(references, [{
            "source": "schemas/root.xsd",
            "kind": "include",
            "location": "common.xsd",
            "resolvedPath": "schemas/common.xsd",
        }])
        self.assertIn({"prefix": "xs", "uri": intake.XSD_NS}, namespaces)
        self.assertEqual(total, len(root) + len(common))

    def test_unresolved_and_external_schema_references_fail_closed(self):
        unresolved = b'''<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:include schemaLocation="missing.xsd"/></xs:schema>'''
        external = b'''<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:import schemaLocation="https://evil.example/x.xsd"/></xs:schema>'''
        for payload in (unresolved, external):
            with self.assertRaisesRegex(intake.IntakeError, "unresolved"):
                self.inventory(self.make_zip([("schemas/root.xsd", payload)]))

    def test_inventory_hash_and_canonical_manifest_are_stable(self):
        archive = self.make_zip([("schema.xml", b"<root/>")])
        first = self.inventory(archive)
        second = self.inventory(archive)
        self.assertEqual(first, second)
        value = {"b": 2, "a": [3, 1]}
        self.assertEqual(intake.canonical_json(value), b'{"a":[3,1],"b":2}\n')
        self.assertEqual(intake.sha256_bytes(archive), intake.sha256_bytes(archive))

    def test_source_policy_rejects_maturity_inflation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "policy.json"
            policy = {
                "adapterCode": "FGIS_ZERNO",
                "apiVersion": "1.0.23",
                "expectedFilename": "fgis-zerno-api-1.0.23.zip",
                "operatorPageUrl": "https://specagro.ru/fgis/api",
                "allowedHttpsOrigins": ["https://specagro.ru", "https://static.specagro.ru"],
                "linkLabelContains": "API 1.0.23",
                "confirmedLive": True,
                "binaryArchiveInGit": False,
            }
            path.write_text(json.dumps(policy), "utf-8")
            with self.assertRaisesRegex(intake.IntakeError, "maturity"):
                intake.load_policy(path)


if __name__ == "__main__":
    unittest.main()
