#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import stat
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("artifact_intake.py")
SPEC = importlib.util.spec_from_file_location("pc_crop_08a_artifact_intake", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load artifact_intake.py")
intake = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = intake
SPEC.loader.exec_module(intake)


class ArtifactIntakeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def package(self, archive_path: Path) -> object:
        data = archive_path.read_bytes()
        return intake.PackageDownload(
            fetch=intake.FetchResult(
                requested_url="https://static.specagro.ru/fgis-zerno-api-1.0.23.zip",
                final_url="https://static.specagro.ru/fgis-zerno-api-1.0.23.zip",
                content_type="application/zip",
                content_length=len(data),
                redirects=(),
            ),
            sha256=intake.sha256_bytes(data),
            size_bytes=len(data),
            path=archive_path,
        )

    def write_zip(self, entries: dict[str, bytes], name: str = "fgis-zerno-api-1.0.23.zip") -> Path:
        path = self.root / name
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for entry_name, data in entries.items():
                archive.writestr(entry_name, data)
        return path

    def valid_entries(self) -> dict[str, bytes]:
        return {
            "schemas/root.xsd": b"""<?xml version='1.0' encoding='UTF-8'?>
<xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'
           targetNamespace='urn:fgis:test:root'>
  <xs:include schemaLocation='child.xsd'/>
  <xs:element name='Root' type='xs:string'/>
</xs:schema>""",
            "schemas/child.xsd": b"""<?xml version='1.0' encoding='UTF-8'?>
<xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'
           targetNamespace='urn:fgis:test:child'>
  <xs:element name='Child' type='xs:string'/>
</xs:schema>""",
            "docs/readme.txt": b"Official contract fixture for local tests only.",
        }

    def test_https_host_allowlist_rejects_downgrade_and_foreign_host(self) -> None:
        allowed = {"specagro.ru"}
        intake.validate_https_url("https://specagro.ru/fgis/api", allowed)
        with self.assertRaisesRegex(intake.IntakeError, "non-HTTPS"):
            intake.validate_https_url("http://specagro.ru/fgis/api", allowed)
        with self.assertRaisesRegex(intake.IntakeError, "not allowlisted"):
            intake.validate_https_url("https://example.com/fgis/api", allowed)
        with self.assertRaisesRegex(intake.IntakeError, "userinfo"):
            intake.validate_https_url("https://user@specagro.ru/fgis/api", allowed)

    def test_discovers_one_exact_versioned_package_link(self) -> None:
        html = b"""
<html><body>
<a href='/files/fgis-zerno-api-1.0.19.zip'>old</a>
<a href='https://static.specagro.ru/releases/fgis-zerno-api-1.0.23.zip'>new</a>
</body></html>
"""
        result = intake.discover_artifact_url(
            "https://specagro.ru/fgis/api",
            html,
            "fgis-zerno-api-1.0.23.zip",
        )
        self.assertEqual(
            result,
            "https://static.specagro.ru/releases/fgis-zerno-api-1.0.23.zip",
        )

    def test_valid_archive_produces_stable_inventory_and_resolved_schema_graph(self) -> None:
        archive = self.write_zip(self.valid_entries())
        package = self.package(archive)
        first_inventory, first_schema = intake.inspect_archive(package, "1.0.23")
        second_inventory, second_schema = intake.inspect_archive(package, "1.0.23")
        self.assertEqual(
            intake.sha256_bytes(intake.canonical_json_bytes(first_inventory)),
            intake.sha256_bytes(intake.canonical_json_bytes(second_inventory)),
        )
        self.assertEqual(first_schema, second_schema)
        self.assertEqual(first_schema["schemaCount"], 2)
        self.assertEqual(first_schema["unresolvedReferenceCount"], 0)
        root = next(row for row in first_schema["schemas"] if row["path"] == "schemas/root.xsd")
        self.assertEqual(root["references"][0]["resolvedPath"], "schemas/child.xsd")
        self.assertTrue(root["references"][0]["resolved"])

    def test_rejects_path_traversal(self) -> None:
        archive = self.write_zip({"../escape.xsd": b"<schema/>"})
        with self.assertRaisesRegex(intake.IntakeError, "unsafe ZIP entry|path traversal"):
            intake.inspect_archive(self.package(archive), "1.0.23")

    def test_rejects_case_collisions(self) -> None:
        archive = self.write_zip({"A/schema.xsd": b"<schema/>", "a/SCHEMA.xsd": b"<schema/>"})
        with self.assertRaisesRegex(intake.IntakeError, "case-colliding"):
            intake.inspect_archive(self.package(archive), "1.0.23")

    def test_rejects_executable_payload(self) -> None:
        archive = self.write_zip({"tools/setup.exe": b"MZ"})
        with self.assertRaisesRegex(intake.IntakeError, "executable payload"):
            intake.inspect_archive(self.package(archive), "1.0.23")

    def test_rejects_symbolic_link(self) -> None:
        archive_path = self.root / "fgis-zerno-api-1.0.23.zip"
        info = zipfile.ZipInfo("schemas/link.xsd")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(archive_path, "w") as archive:
            archive.writestr(info, "target.xsd")
        with self.assertRaisesRegex(intake.IntakeError, "symbolic link"):
            intake.inspect_archive(self.package(archive_path), "1.0.23")

    def test_rejects_xml_dtd_and_entities(self) -> None:
        archive = self.write_zip(
            {
                "schemas/unsafe.xsd": b"""<?xml version='1.0'?>
<!DOCTYPE schema [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>
<schema>&xxe;</schema>"""
            }
        )
        with self.assertRaisesRegex(intake.IntakeError, "DTD/entity"):
            intake.inspect_archive(self.package(archive), "1.0.23")

    def test_rejects_unresolved_relative_schema_reference(self) -> None:
        archive = self.write_zip(
            {
                "schemas/root.xsd": b"""<xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'>
<xs:include schemaLocation='missing.xsd'/>
</xs:schema>"""
            }
        )
        with self.assertRaisesRegex(intake.IntakeError, "unresolved reference"):
            intake.inspect_archive(self.package(archive), "1.0.23")

    def test_pinned_lock_rejects_hash_mismatch_and_accepts_exact_evidence(self) -> None:
        archive = self.write_zip(self.valid_entries())
        package = self.package(archive)
        inventory, schema = intake.inspect_archive(package, "1.0.23")
        inventory_hash = intake.sha256_bytes(intake.canonical_json_bytes(inventory))
        schema_hash = intake.sha256_bytes(intake.canonical_json_bytes(schema))
        lock = {
            "status": "PINNED",
            "packageSha256": package.sha256,
            "finalArtifactUrl": package.fetch.final_url,
            "artifactSizeBytes": package.size_bytes,
            "inventorySha256": inventory_hash,
            "schemaManifestSha256": schema_hash,
        }
        self.assertTrue(intake.enforce_lock(lock, package, inventory_hash, schema_hash))
        mismatched = dict(lock, packageSha256="0" * 64)
        with self.assertRaisesRegex(intake.IntakeError, "SHA-256 mismatch"):
            intake.enforce_lock(mismatched, package, inventory_hash, schema_hash)

    def test_source_lock_validation_fails_closed(self) -> None:
        lock_path = self.root / "lock.json"
        lock_path.write_text(json.dumps({"status": "PINNED"}), encoding="utf-8")
        with self.assertRaisesRegex(intake.IntakeError, "missing fields"):
            intake.load_lock(lock_path)


if __name__ == "__main__":
    unittest.main()
