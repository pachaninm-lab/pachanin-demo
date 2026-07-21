from __future__ import annotations

import argparse
import json
from pathlib import Path

from tai.model_bundle_storage import verify_bundle_storage_v2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify non-self-referential TAI model bundle storage"
    )
    parser.add_argument("authority", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("original_root", type=Path)
    parser.add_argument("restored_root", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)

    report = verify_bundle_storage_v2(
        authority_path=args.authority,
        manifest_path=args.manifest,
        original_root=args.original_root,
        restored_root=args.restored_root,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    print(json.dumps(report, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return 0 if report["status"] == "VERIFIED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
