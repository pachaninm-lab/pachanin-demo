#!/usr/bin/env python3
from pathlib import Path

LIVE = Path("scripts/production-full-stack-live-acceptance.sh")
CHECKER = Path("scripts/check-production-full-stack-release.mjs")

live = LIVE.read_text(encoding="utf-8")
checker = CHECKER.read_text(encoding="utf-8")

old_cases = """    ru)
      expected_kicker='Платформа управления агросделками в растениеводстве'
      expected_title='Управляйте агросделкой'
      expected_accent='от цены до расчёта'
      retired_title='Цена согласована. Теперь нужно исполнить Сделку.'
      ;;
    en)
      expected_kicker='Crop Deal execution platform'
      expected_title='Manage an agricultural Deal'
      expected_accent='from price to settlement'
      retired_title='The price is agreed. Now the Deal must be executed.'
      ;;
    zh)
      expected_kicker='种植业农业交易管理平台'
      expected_title='管理农业交易'
      expected_accent='从价格到结算'
      retired_title='价格已经确定。现在需要完成交易履约。'
      ;;
"""
new_cases = """    ru)
      expected_kicker_primary='Платформа управления агросделками в растениеводстве'
      expected_kicker_secondary='с собственным искусственным интеллектом'
      expected_title='Управляйте агросделкой'
      expected_accent='от цены до расчёта'
      retired_title='Цена согласована. Теперь нужно исполнить Сделку.'
      ;;
    en)
      expected_kicker_primary='Crop Deal management platform'
      expected_kicker_secondary='with proprietary artificial intelligence'
      expected_title='Manage an agricultural Deal'
      expected_accent='from price to settlement'
      retired_title='The price is agreed. Now the Deal must be executed.'
      ;;
    zh)
      expected_kicker_primary='种植业农业交易管理平台'
      expected_kicker_secondary='配备自主人工智能'
      expected_title='管理农业交易'
      expected_accent='从价格到结算'
      retired_title='价格已经确定。现在需要完成交易履约。'
      ;;
"""
if old_cases not in live:
    raise SystemExit("locale hero authority block not found")
live = live.replace(old_cases, new_cases, 1)

old_grep = """  grep -Fq \"$expected_kicker\" \"$EVIDENCE_DIR/platform-$locale.html\"
  grep -Fq \"$expected_title\" \"$EVIDENCE_DIR/platform-$locale.html\"
"""
new_grep = """  grep -Fq \"$expected_kicker_primary\" \"$EVIDENCE_DIR/platform-$locale.html\"
  grep -Fq \"$expected_kicker_secondary\" \"$EVIDENCE_DIR/platform-$locale.html\"
  grep -Fq \"$expected_title\" \"$EVIDENCE_DIR/platform-$locale.html\"
"""
if old_grep not in live:
    raise SystemExit("hero grep authority block not found")
live = live.replace(old_grep, new_grep, 1)

old_checker = """  'Платформа управления агросделками в растениеводстве',
  'Управляйте агросделкой',
  'от цены до расчёта',
  'Crop Deal execution platform',
  'Manage an agricultural Deal',
  '种植业农业交易管理平台',
"""
new_checker = """  'Платформа управления агросделками в растениеводстве',
  'с собственным искусственным интеллектом',
  'Управляйте агросделкой',
  'от цены до расчёта',
  'Crop Deal management platform',
  'with proprietary artificial intelligence',
  'Manage an agricultural Deal',
  '种植业农业交易管理平台',
  '配备自主人工智能',
"""
if old_checker not in checker:
    raise SystemExit("checker hero authority block not found")
checker = checker.replace(old_checker, new_checker, 1)

for stale in ("Crop Deal execution platform", "expected_kicker="):
    if stale in live or stale in checker:
        raise SystemExit(f"stale hero contract remains: {stale}")

LIVE.write_text(live, encoding="utf-8")
CHECKER.write_text(checker, encoding="utf-8")
