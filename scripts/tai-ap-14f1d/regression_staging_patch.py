from __future__ import annotations

import json
from pathlib import Path


def replace_sequence(path: Path, old: list[str], new: list[str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    matches = [
        index
        for index in range(len(lines) - len(old) + 1)
        if lines[index : index + len(old)] == old
    ]
    if len(matches) != 1:
        raise SystemExit(f"{path}: expected one sequence, found {len(matches)}")
    start = matches[0]
    lines[start : start + len(old)] = new
    path.write_text("".join(lines), encoding="utf-8")


def replace_invocation(
    path: Path,
    verifier: str,
    strict_condition: list[str],
) -> None:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    starts = [
        index
        for index, line in enumerate(lines)
        if line.strip() == "set +e"
        and index + 1 < len(lines)
        and verifier in lines[index + 1]
    ]
    if len(starts) != 1:
        raise SystemExit(
            f"{path}: expected one verifier invocation, found {len(starts)}"
        )
    start = starts[0]
    ends = [
        index
        for index in range(start + 1, min(len(lines), start + 16))
        if lines[index].strip() == "set -e"
    ]
    if len(ends) != 1:
        raise SystemExit(f"{path}: invocation terminator mismatch")
    end = ends[0]
    replacement = [
        "          strict_slice=false\n",
        "          verifier_args=()\n",
        *strict_condition,
        '          export STRICT_SLICE="$strict_slice"\n',
        "          printf '%s\\n' \"$STRICT_SLICE\" > \"$EVIDENCE_DIR/verifier-strict-slice.txt\"\n",
        "          set +e\n",
        f'          node {verifier} "${{verifier_args[@]}}" \\\n',
        '            > "$EVIDENCE_DIR/acceptance.json" \\\n',
        '            2> "$EVIDENCE_DIR/verifier-error.txt"\n',
        "          verifier_status=$?\n",
        "          set -e\n",
    ]
    lines[start : end + 1] = replacement
    path.write_text("".join(lines), encoding="utf-8")


def main() -> None:
    ap1a = Path(".github/workflows/tai-ap-14f1a.yml")
    replace_invocation(
        ap1a,
        "scripts/tai-ap-14f1a/verify.mjs",
        [
            '          case "${GITHUB_HEAD_REF:-$GITHUB_REF_NAME}" in\n',
            "            agent/tai-ap-14f1a-public-corpus-authority-3345|agent/tai-ap-14f1a-exact-main-3345)\n",
            "              strict_slice=true\n",
            '              verifier_args=(--scope-guard "${{ steps.base.outputs.base_ref }}")\n',
            "              ;;\n",
            "          esac\n",
        ],
    )
    replace_sequence(
        ap1a,
        [
            "          if (report.counts.changedPaths < 1) process.exit(1);\n",
            "          if (report.counts.changedPaths > 11) process.exit(1);\n",
        ],
        [
            "          const strictSlice = process.env.STRICT_SLICE === 'true';\n",
            "          if (strictSlice && report.counts.changedPaths < 1) process.exit(1);\n",
            "          if (strictSlice && report.counts.changedPaths > 11) process.exit(1);\n",
            "          if (!strictSlice && report.counts.changedPaths !== 0) process.exit(1);\n",
        ],
    )

    ap1b2 = Path(".github/workflows/tai-ap-14f1b2.yml")
    replace_invocation(
        ap1b2,
        "scripts/tai-ap-14f1b2/verify.mjs",
        [
            '          if [[ "${GITHUB_HEAD_REF:-$GITHUB_REF_NAME}" == \\\n',
            '            "agent/tai-ap-14f1b2-acquisition-authority-3362" ]]; then\n',
            "            strict_slice=true\n",
            '            verifier_args=(--scope-guard "${{ steps.base.outputs.base_ref }}")\n',
            "          fi\n",
        ],
    )
    replace_sequence(
        ap1b2,
        ["          if (report.counts.changedPaths !== 9) process.exit(1);\n"],
        [
            "          const strictSlice = process.env.STRICT_SLICE === 'true';\n",
            "          if (strictSlice && report.counts.changedPaths !== 9) process.exit(1);\n",
            "          if (!strictSlice && report.counts.changedPaths !== 0) process.exit(1);\n",
        ],
    )

    verifier = Path("scripts/tai-ap-14f1b2/verify.mjs")
    replace_sequence(
        verifier,
        [
            "const versions = manifest.migrations.map((entry) => entry.version);\n",
            "assert(versions.at(-1) === 22, 'manifest terminal version');\n",
            "assert(\n",
            "  manifest.migrations.at(-1)?.path === '0021_public_official_acquisition_authority.sql',\n",
            "  'manifest terminal path',\n",
            ");\n",
            "assert(new Set(versions).size === versions.length, 'manifest versions unique');\n",
            "assert(versions.every((value, index) => value === index + 1), 'manifest versions contiguous');\n",
        ],
        [
            "const versions = manifest.migrations.map((entry) => entry.version);\n",
            "const acceptedPrefixLength = 22;\n",
            "assert(\n",
            "  manifest.migrations.length >= acceptedPrefixLength,\n",
            "  'manifest may not remove AP-14F1B2 history',\n",
            ");\n",
            "const acceptedAuthority = manifest.migrations[acceptedPrefixLength - 1];\n",
            "assert(acceptedAuthority?.version === 22, 'manifest accepted prefix version');\n",
            "assert(\n",
            "  acceptedAuthority?.path === '0021_public_official_acquisition_authority.sql',\n",
            "  'manifest accepted prefix path',\n",
            ");\n",
            "assert(new Set(versions).size === versions.length, 'manifest versions unique');\n",
            "assert(versions.every((value, index) => value === index + 1), 'manifest versions contiguous');\n",
        ],
    )
    replace_sequence(
        verifier,
        [
            "      migrations: manifest.migrations.map((entry, index) =>\n",
            "        index === manifest.migrations.length - 1 ? { ...entry, version: 21 } : entry,\n",
            "      ),\n",
        ],
        [
            "      migrations: manifest.migrations.map((entry, index) =>\n",
            "        index === 21 ? { ...entry, version: 21 } : entry,\n",
            "      ),\n",
        ],
    )
    replace_sequence(
        verifier,
        ["    || candidate.migrations?.at(-1)?.version !== 22;\n"],
        ["    || candidate.migrations?.[21]?.version !== 22;\n"],
    )

    scope_path = Path("docs/platform-v7/autopilot/scopes/tai-ap-14f1d-3374.json")
    scope = json.loads(scope_path.read_text(encoding="utf-8"))
    scope["allowedPaths"] = sorted(
        set(scope["allowedPaths"])
        | {
            ".github/workflows/tai-ap-14f1a.yml",
            ".github/workflows/tai-ap-14f1b2.yml",
            "scripts/tai-ap-14f1b2/verify.mjs",
        }
    )
    scope["acceptance"]["changedPathCount"] = 12
    scope_path.write_text(
        json.dumps(scope, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
