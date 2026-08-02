#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


deploy = Path("scripts/tai-reg-ru-deploy.sh")
normalizer = Path("scripts/check-tai-migration-sql-normalization.mjs")
diagnostic = Path(".github/workflows/diagnose-tai-migration-image.yml")

replace_once(
    deploy,
    'docker run --rm --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE"',
    'docker run --rm -i --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE"',
)

replace_once(
    normalizer,
    'if (!generator.includes("wrapped=re.fullmatch")) failures.push(\'generator does not normalize wrapped migrations\');\n',
    '''if (!deploy.includes('docker run --rm -i --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" -')) {
  failures.push('production migration extraction does not attach container stdin');
}
if (deploy.includes('docker run --rm --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" -')) {
  failures.push('production migration extraction still launches python - with detached stdin');
}
if (!generator.includes("wrapped=re.fullmatch")) failures.push('generator does not normalize wrapped migrations');
''',
)

replace_once(
    diagnostic,
    'docker run --rm --read-only --network none --entrypoint python "$TAI_DIGEST" - > "$RUNNER_TEMP/image-bundle.json"',
    'docker run --rm -i --read-only --network none --entrypoint python "$TAI_DIGEST" - > "$RUNNER_TEMP/image-bundle.json"',
)
replace_once(
    diagnostic,
    "          PY\n      - name: Verify packaged migration parity with source\n",
    "          PY\n          test -s \"$RUNNER_TEMP/image-bundle.json\"\n      - name: Verify packaged migration parity with source\n",
)

print("TAI_MIGRATION_CONTAINER_STDIN_FIX=APPLIED")
