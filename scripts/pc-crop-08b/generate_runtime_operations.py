#!/usr/bin/env python3
"""Generate normalized runtime rows from the accepted operation catalog."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

FAMILY_FIELDS = [
    "code",
    "namespace",
    "schemaFile",
    "schemaFileSha256",
    "operationCount",
    "readCount",
    "mutationCount",
]
OPERATION_FIELDS = [
    "code",
    "name",
    "family",
    "classification",
    "requestLocalName",
    "responseLocalName",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text("utf-8"))
    business = catalog.get("business") or {}
    if (
        catalog.get("schemaVersion")
        != "pc-crop.fgis-grain-operation-catalog.v1"
        or business.get("familyFields") != FAMILY_FIELDS
        or business.get("operationFields") != OPERATION_FIELDS
    ):
        raise SystemExit("catalog schema drift")
    families = business.get("families") or []
    operations = business.get("operations") or []
    if (
        len(families) != 8
        or len(operations) != 57
        or len({row[0] for row in operations}) != 57
    ):
        raise SystemExit("catalog cardinality drift")

    family_payload = json.dumps(
        families,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    operation_payload = json.dumps(
        operations,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    output = f'''/* eslint-disable */
/** Generated from the accepted FGIS Grain API 1.0.23 operation catalog. */
import type {{ FgisGrainBusinessFamily, FgisGrainBusinessOperationCode }} from './fgis-grain-1.0.23.generated';
export type FgisGrainBusinessFamilyRow = readonly [code:FgisGrainBusinessFamily,namespace:string,schemaFile:string,schemaFileSha256:string,operationCount:number,readCount:number,mutationCount:number];
export type FgisGrainBusinessOperationRow = readonly [code:FgisGrainBusinessOperationCode,name:string,family:FgisGrainBusinessFamily,classification:'READ'|'MUTATION',requestLocalName:string,responseLocalName:string];
export const FGIS_GRAIN_1_0_23_BUSINESS_FAMILY_ROWS = {family_payload} as const satisfies readonly FgisGrainBusinessFamilyRow[];
export const FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS = {operation_payload} as const satisfies readonly FgisGrainBusinessOperationRow[];
'''
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
