#!/usr/bin/env python3
from __future__ import annotations

import io
import stat
import sys
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fgis_intake as intake


def make_zip(entries: list[tuple[zipfile.ZipInfo | str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name_or_info, data in entries:
            archive.writestr(name_or_info, data)
    return buffer.getvalue()


class UrlPolicyTests(unittest.TestCase):
    def test_https_allowlist(self):
        parsed = intake.validate_https_url(
            "https://static.specagro.ru/path/file.zip",
            ["static.specagro.ru"],
        )
        self.assertEqual(parsed.hostname, "static.specagro.ru")

    def test_rejects_wrong_host_and_scheme(self):
        with self.assertRaises(intake.IntakeError):
            intake.validate_https_url(
                "http://static.specagro.ru/file.zip",
                ["static.specagro.ru"],
            )
        with self.assertRaises(intake.IntakeError):
            intake.validate_https_url(
                "https://evil.example/file.zip",
                ["static.specagro.ru"],
            )

    def test_selects_exact_official_filename(self):
        html = b'''
        <a href="https://static.specagro.ru/old.zip">API 1.0.19</a>
        <a href="/cdn/fgis-zerno-api-1.0.23.zip">Download API 1.0.23</a>
        '''
        selected = intake.select_artifact_url(
            html,
            "https://specagro.ru/fgis/api",
            "fgis-zerno-api-1.0.23.zip",
            "1.0.23",
        )
        self.assertEqual(
            selected,
            "https://specagro.ru/cdn/fgis-zerno-api-1.0.23.zip",
        )


class ZipSafetyTests(unittest.TestCase):
    def test_rejects_path_traversal(self):
        payload = make_zip([("../escape.xsd", b"<schema />")])
        with self.assertRaises(intake.IntakeError):
            intake.inspect_archive(payload)

    def test_rejects_case_collisions(self):
        payload = make_zip(
            [
                ("Schema/A.xsd", b"<schema />"),
                ("schema/a.xsd", b"<schema />"),
            ]
        )
        with self.assertRaises(intake.IntakeError):
            intake.inspect_archive(payload)

    def test_rejects_symlink_and_executable_metadata(self):
        symlink = SimpleNamespace(flag_bits=0, external_attr=(stat.S_IFLNK | 0o777) << 16)
        with self.assertRaises(intake.IntakeError):
            intake.validate_zip_info(symlink, "link.xsd")

        executable = SimpleNamespace(flag_bits=0, external_attr=(stat.S_IFREG | 0o755) << 16)
        with self.assertRaises(intake.IntakeError):
            intake.validate_zip_info(executable, "tool")

    def test_rejects_encrypted_metadata(self):
        encrypted = SimpleNamespace(flag_bits=0x1, external_attr=0)
        with self.assertRaises(intake.IntakeError):
            intake.validate_zip_info(encrypted, "schema.xsd")

    def test_rejects_archive_bomb_ratio(self):
        payload = make_zip([("bomb.xml", b"0" * 1_000_000)])
        with self.assertRaises(intake.IntakeError):
            intake.inspect_archive(payload)

    def test_inventory_is_deterministic(self):
        payload = make_zip(
            [
                ("b.xml", b"<root />"),
                ("a.xsd", b'<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" />'),
            ]
        )
        first, _ = intake.inspect_archive(payload)
        second, _ = intake.inspect_archive(payload)
        self.assertEqual(first, second)
        self.assertEqual([entry["path"] for entry in first], ["a.xsd", "b.xml"])


class XmlContractTests(unittest.TestCase):
    def test_rejects_doctype_and_entities(self):
        malicious = {
            "schema.xsd": b'<!DOCTYPE x [<!ENTITY boom "x">]><x>&boom;</x>'
        }
        with self.assertRaises(intake.IntakeError):
            intake.analyze_xml_entries(malicious)

    def test_resolves_local_xsd_reference(self):
        entries = {
            "schema/root.xsd": b'''
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                  <xs:include schemaLocation="types.xsd"/>
                </xs:schema>
            ''',
            "schema/types.xsd": b'''
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>
            ''',
        }
        files, unresolved = intake.analyze_xml_entries(entries)
        self.assertEqual(unresolved, [])
        root = next(item for item in files if item["path"] == "schema/root.xsd")
        self.assertEqual(root["references"][0]["resolution"], "RESOLVED")

    def test_reports_missing_and_external_references(self):
        entries = {
            "root.xsd": b'''
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                  <xs:include schemaLocation="missing.xsd"/>
                  <xs:import schemaLocation="https://example.com/external.xsd"/>
                </xs:schema>
            ''',
        }
        _, unresolved = intake.analyze_xml_entries(entries)
        self.assertEqual(
            {item["resolution"] for item in unresolved},
            {"MISSING", "EXTERNAL_UNRESOLVED"},
        )

    def test_canonical_hash_is_key_order_stable(self):
        left = intake.sha256_bytes(intake.canonical_json_bytes({"b": 2, "a": 1}))
        right = intake.sha256_bytes(intake.canonical_json_bytes({"a": 1, "b": 2}))
        self.assertEqual(left, right)


if __name__ == "__main__":
    unittest.main()
