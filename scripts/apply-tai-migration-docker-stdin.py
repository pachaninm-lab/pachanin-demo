#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/tai-reg-ru-deploy.sh')
text = path.read_text(encoding='utf-8')
old = 'docker run --rm --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE"'
new = 'docker run --rm --interactive --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE"'
if new not in text:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one production migration bundle command, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('TAI_MIGRATION_DOCKER_STDIN_PATCH=APPLIED')
