from pathlib import Path

route_path = Path('apps/web/app/api/restricted-public-platform-assistant/route.ts')
source = route_path.read_text(encoding='utf-8')

constant = 'const FAST_FALLBACK_TIMEOUT_MS = 8_000;\n'
old_call = '''          answer = await callInternalModel(
            runtimeConfig,
            payload,
            request.signal,
            Math.min(runtimeConfig.timeoutMs, FAST_FALLBACK_TIMEOUT_MS),
          );'''
new_call = '''          answer = await callInternalModel(
            runtimeConfig,
            payload,
            request.signal,
            runtimeConfig.timeoutMs,
          );'''

if source.count(constant) != 1:
    raise SystemExit(f'expected one fast fallback timeout constant, found {source.count(constant)}')
if source.count(old_call) != 1:
    raise SystemExit(f'expected one capped model call, found {source.count(old_call)}')

rendered = source.replace(constant, '', 1).replace(old_call, new_call, 1)
if 'FAST_FALLBACK_TIMEOUT_MS' in rendered:
    raise SystemExit('fast fallback timeout authority remains')
if 'Math.min(runtimeConfig.timeoutMs' in rendered:
    raise SystemExit('configured model timeout is still capped')
if rendered.count('runtimeConfig.timeoutMs,') < 1:
    raise SystemExit('configured model timeout was not bound')

route_path.write_text(rendered, encoding='utf-8')
print('TAI real-Qwen timeout patch PASS')
