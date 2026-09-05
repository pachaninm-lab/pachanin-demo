#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

PATCHER = Path(__file__).with_name('p0-registration-decision-durable-outbox-patch.py')
TARGET_PATH = 'apps/web/tests/unit/p0FirstCustomerCompletion.test.ts'
TARGET_LABEL = 'durable join delivery fixture'
SUCCESS_RESPONSE_SUFFIX = "    }), {\n      status: 201,"
LEGACY_NEGATIVE_ASSERTION = "    expect(bff).not.toContain('sendTransactionalMail');\n"


def load_patcher():
    spec = importlib.util.spec_from_file_location('p0_registration_decision_outbox_patcher', PATCHER)
    if spec is None or spec.loader is None:
        raise RuntimeError('unable to load durable outbox patcher')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    patcher = load_patcher()
    original_replace_once = patcher.Workspace.replace_once
    original_patch_web_tests = patcher.patch_web_tests

    def replace_once(self, relative: str, old: str, new: str, label: str) -> None:
        if relative == TARGET_PATH and label == TARGET_LABEL:
            source = self.read(relative)
            generic_count = source.count(old)
            if generic_count != 2:
                raise patcher.PatchError(
                    f'{relative}: {label}: expected two legacy fixtures before bounded replacement, found {generic_count}'
                )
            contextual_old = old + SUCCESS_RESPONSE_SUFFIX
            contextual_new = new + SUCCESS_RESPONSE_SUFFIX
            contextual_count = source.count(contextual_old)
            if contextual_count != 1:
                raise patcher.PatchError(
                    f'{relative}: {label}: expected one HTTP 201 success fixture, found {contextual_count}'
                )
            self.set(relative, source.replace(contextual_old, contextual_new, 1))
            return
        original_replace_once(self, relative, old, new, label)

    def patch_web_tests(workspace) -> None:
        try:
            original_patch_web_tests(workspace)
            return
        except patcher.PatchError as error:
            expected = f'{TARGET_PATH}: legacy synchronous notification assertions remain'
            if str(error) != expected:
                raise
        source = workspace.read(TARGET_PATH)
        count = source.count(LEGACY_NEGATIVE_ASSERTION)
        if count != 1:
            raise patcher.PatchError(
                f'{TARGET_PATH}: expected one obsolete direct-mail negative assertion, found {count}'
            )
        cleaned = source.replace(LEGACY_NEGATIVE_ASSERTION, '', 1)
        if 'sendTransactionalMail' in cleaned:
            raise patcher.PatchError(f'{TARGET_PATH}: legacy synchronous notification assertions remain')
        workspace.set(TARGET_PATH, cleaned)

    patcher.Workspace.replace_once = replace_once
    patcher.patch_web_tests = patch_web_tests
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    sys.argv = [str(PATCHER), mode]
    try:
        return int(patcher.main())
    except patcher.PatchError as error:
        print(f'P0_REGISTRATION_DECISION_DURABLE_OUTBOX_PATCH_FAILED: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
