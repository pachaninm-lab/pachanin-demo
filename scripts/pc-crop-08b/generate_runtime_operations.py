#!/usr/bin/env python3
"""Generate compact runtime operation metadata from the accepted catalog JSON."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

FIELDS = (
    "code",
    "name",
    "family",
    "classification",
    "namespace",
    "requestQName",
    "responseQName",
)


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text("utf-8"))
    if catalog.get("schemaVersion") != "pc-crop.fgis-grain-operation-catalog.v1":
        raise SystemExit("unexpected catalog schema")
    adapter = catalog.get("adapter") or {}
    if adapter.get("apiVersion") != "1.0.23" or adapter.get("status") != "ADAPTER_READY":
        raise SystemExit("unexpected adapter authority")
    source = catalog.get("sourceAuthority") or {}
    if source.get("packageSha256") != "085e22c50b6564219585c96e814b0793d906f4c5e401cbb7446a949c26f0bcd7":
        raise SystemExit("package hash drift")

    source_operations = (catalog.get("business") or {}).get("operations") or []
    operations = [{field: row[field] for field in FIELDS} for row in source_operations]
    codes = [row["code"] for row in operations]
    if len(operations) != 57 or len(set(codes)) != 57:
        raise SystemExit("operation cardinality drift")

    payload = canonical(operations)
    output = f'''/* eslint-disable */
/**
 * Generated from fgis-grain-api-1.0.23.operation-catalog.json.
 * Do not edit by hand.
 */
import type {{
  FgisGrainBusinessFamily,
  FgisGrainBusinessOperationCode,
}} from './fgis-grain-1.0.23.generated';

export type FgisGrainBusinessOperation = Readonly<{{
  code: FgisGrainBusinessOperationCode;
  name: string;
  family: FgisGrainBusinessFamily;
  classification: 'READ' | 'MUTATION';
  namespace: string;
  requestQName: string;
  responseQName: string;
}}>;

export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATIONS = {payload} as const satisfies readonly FgisGrainBusinessOperation[];
'''
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
