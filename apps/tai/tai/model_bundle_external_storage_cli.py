from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from tai.model_bundle_external_storage import verify_external_model_bundle


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify a TAI model bundle restored from exact immutable external storage."
    )
    parser.add_argument("authority", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("original_root", type=Path)
    parser.add_argument("restored_root", type=Path)
    parser.add_argument("archive_observation", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    report = verify_external_model_bundle(
        authority_path=arguments.authority,
        manifest_path=arguments.manifest,
        original_root=arguments.original_root,
        restored_root=arguments.restored_root,
        archive_observation_path=arguments.archive_observation,
    )
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0 if report["status"] == "VERIFIED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
