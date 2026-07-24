#!/usr/bin/env python3
"""Generate compact TypeScript runtime constants from the pinned 08C profile."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True, type=Path)
    parser.add_argument("--lock", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    profile_bytes = args.profile.read_bytes()
    profile = json.loads(profile_bytes)
    lock = json.loads(args.lock.read_text("utf-8"))
    profile_sha256 = hashlib.sha256(profile_bytes).hexdigest()
    if profile_sha256 != lock.get("profileSha256"):
        raise SystemExit("profile hash mismatch")
    if profile.get("profileVersion") != lock.get("profileVersion"):
        raise SystemExit("profile version mismatch")

    runtime = {
        "profileVersion": profile["profileVersion"],
        "xml": {
            "typesNamespace": profile["xml"]["typesNamespace"],
            "messageData": {
                "qname": profile["xml"]["messageData"]["qname"],
                "idAttribute": profile["xml"]["messageData"]["idAttribute"],
                "fields": profile["xml"]["messageData"]["fields"],
                "primaryContentWildcard": profile["xml"]["messageData"][
                    "primaryContentWildcard"
                ],
            },
            "responseCodes": profile["xml"]["responseCodes"],
            "wrappers": profile["xml"]["wrappers"],
        },
        "limits": profile["limits"],
        "signingPolicy": profile["signingPolicy"],
        "boundaries": profile["boundaries"],
    }
    rendered = json.dumps(
        runtime,
        ensure_ascii=False,
        sort_keys=True,
        indent=2,
    )
    output = f'''/* eslint-disable */
/** Generated from the hash-pinned official FGIS Grain API 1.0.23 profile. */
export const FGIS_GRAIN_MESSAGE_DATA_PROFILE_SHA256 = {json.dumps(profile_sha256)} as const;
export const FGIS_GRAIN_MESSAGE_DATA_PROFILE = {rendered} as const;
'''
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
