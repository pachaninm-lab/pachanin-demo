#!/usr/bin/env python3
"""Create the fixed, fail-closed reviewer-reset preflight for issue 4637."""

from __future__ import annotations

import argparse
from pathlib import Path


class PatchContractError(RuntimeError):
    """The reviewed source no longer has the exact continuation contract."""


REVIEWED_RESET_SHA = "9310d7ae231b4d3b4904fe04712af05fbbea7a9c"
MANIFEST_SIZE = 23
EXPECTED_MANIFEST = (
    "apps/api/src/common/prisma/database-principal-boundary.ts",
    "apps/api/src/common/prisma/database-principal-inspection.ts",
    "apps/api/src/common/prisma/prisma.service.ts",
    "apps/api/src/modules/auth/auth.module.ts",
    "apps/api/src/modules/auth/auth-prisma.service.ts",
    "apps/api/src/modules/auth/auth-crypto.ts",
    "apps/api/src/modules/auth/auth.controller.ts",
    "apps/api/src/modules/auth/password-reset.repository.ts",
    "apps/api/src/modules/auth/password-reset.service.ts",
    "apps/api/src/modules/auth/password-reset-token.ts",
    "apps/api/src/modules/auth/persistent-auth.repository.ts",
    "apps/api/src/modules/auth/dto/password-reset.dto.ts",
    "apps/api/src/modules/auth/password-hashing.ts",
    "apps/api/src/common/validators/strong-password.validator.ts",
    "apps/api/src/modules/auth-mail/auth-mail-crypto.ts",
    "apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts",
    "apps/api/src/modules/auth-mail/auth-mail-templates.ts",
    "apps/web/app/api/auth/forgot-password/route.ts",
    "apps/api/prisma/migrations/20260731195000_p0_password_reset_challenges/migration.sql",
    "apps/api/prisma/migrations/20260808120000_p0_password_reset_authority/migration.sql",
    "apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql",
    "apps/api/prisma/migrations/20260812154500_p0_reviewer_password_reset_subject/migration.sql",
    "apps/api/prisma/migrations/20260816161500_p0_password_reset_challenge_runtime_grant/migration.sql",
)
REPLACEMENTS = (
    (
        "release-issue",
        "RELEASE_ISSUE_NUMBER='3072'",
        "RELEASE_ISSUE_NUMBER='4637'",
    ),
    (
        "reviewed-reset-reference",
        "REVIEWED_RESET_SHA='a9c16814960520b20e8ae0c722570d9a3b4147f9'",
        f"REVIEWED_RESET_SHA='{REVIEWED_RESET_SHA}'",
    ),
    (
        "runtime-reset-dependencies",
        "  'apps/api/src/modules/auth/dto/password-reset.dto.ts'\n"
        "  'apps/api/src/modules/auth-mail/auth-mail-crypto.ts'",
        "  'apps/api/src/modules/auth/dto/password-reset.dto.ts'\n"
        "  'apps/api/src/modules/auth/password-hashing.ts'\n"
        "  'apps/api/src/common/validators/strong-password.validator.ts'\n"
        "  'apps/api/src/modules/auth-mail/auth-mail-crypto.ts'",
    ),
    (
        "manifest-cardinality",
        "(( ${#RESET_CRITICAL_PATHS[@]} == 21 ))",
        f"(( ${{#RESET_CRITICAL_PATHS[@]}} == {MANIFEST_SIZE} ))",
    ),
)


def manifest_entries(text: str) -> list[str]:
    return [
        line.strip().strip("'")
        for line in text.splitlines()
        if line.startswith("  'apps/")
    ]


def transform(text: str) -> str:
    if len(EXPECTED_MANIFEST) != MANIFEST_SIZE or len(set(EXPECTED_MANIFEST)) != MANIFEST_SIZE:
        raise PatchContractError("EXPECTED_MANIFEST_INTERNAL_INVALID")
    for label, old, new in REPLACEMENTS:
        count = text.count(old)
        if count != 1 or new in text:
            raise PatchContractError(f"PATCH_CARDINALITY_FAILED:{label}:{count}")
        text = text.replace(old, new, 1)

    entries = manifest_entries(text)
    if tuple(entries) != EXPECTED_MANIFEST or len(set(entries)) != MANIFEST_SIZE:
        raise PatchContractError("CONTINUATION_MANIFEST_EXACT_SET_INVALID")
    return text


def expect_rejected(text: str, label: str) -> None:
    try:
        transform(text)
    except PatchContractError:
        return
    raise PatchContractError(f"NEGATIVE_FIXTURE_ACCEPTED:{label}")


def self_test(source: Path) -> None:
    original = source.read_text(encoding="utf-8")
    transformed = transform(original)
    if len(manifest_entries(transformed)) != MANIFEST_SIZE:
        raise PatchContractError("POSITIVE_FIXTURE_MANIFEST_INVALID")

    for label, old, _new in REPLACEMENTS:
        expect_rejected(original.replace(old, "", 1), f"missing-{label}")
        expect_rejected(f"{original}\n{old}\n", f"duplicate-{label}")

    manifest_end = ")\n\nTARGET_SHA='unknown'"
    if original.count(manifest_end) != 1:
        raise PatchContractError("MANIFEST_BOUNDARY_INVALID")
    unlisted = original.replace(
        manifest_end,
        "  'apps/api/src/modules/auth/unlisted-negative-fixture.ts'\n" + manifest_end,
        1,
    )
    expect_rejected(unlisted, "unlisted-manifest-entry")

    duplicate = original.replace(
        manifest_end,
        "  'apps/api/src/modules/auth/auth.controller.ts'\n" + manifest_end,
        1,
    )
    expect_rejected(duplicate, "duplicate-manifest-entry")

    same_count_substitution = original.replace(
        "  'apps/api/src/modules/auth/auth.controller.ts'",
        "  'apps/api/src/modules/auth/unlisted-same-count-negative-fixture.ts'",
        1,
    )
    expect_rejected(same_count_substitution, "same-count-manifest-substitution")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    patch_parser = subparsers.add_parser("patch")
    patch_parser.add_argument("--source", type=Path, required=True)
    patch_parser.add_argument("--target", type=Path, required=True)

    test_parser = subparsers.add_parser("self-test")
    test_parser.add_argument("--source", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "self-test":
        self_test(args.source)
        print("CONTINUATION_PATCH_SELF_TEST=PASS")
        return

    source = args.source.resolve(strict=True)
    target = args.target.resolve(strict=False)
    if source == target:
        raise PatchContractError("SOURCE_TARGET_ALIAS_FORBIDDEN")
    target.write_text(transform(source.read_text(encoding="utf-8")), encoding="utf-8")


if __name__ == "__main__":
    main()
