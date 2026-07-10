from __future__ import annotations

import json
from pathlib import Path

path = Path('docs/platform-v7/autopilot/autopilot-state.json')
state = json.loads(path.read_text())
state.setdefault('approvedConcurrentScopes', {})['agent/remove-login-legacy-overlay'] = [
    'apps/web/app/platform-v7/login/layout.tsx',
    'apps/web/app/platform-v7/login/template.tsx',
    'apps/web/tests/unit/platformV7CanonicalLoginRoute.test.ts',
    'docs/platform-v7/autopilot/autopilot-state.json',
]
path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
