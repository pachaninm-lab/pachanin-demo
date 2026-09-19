# Platform v7 vertical rhythm contract

Status: runtime design-system contract

## Purpose

Provide one deterministic vertical rhythm for interface copy across role cockpits, forms, metric cards, notices and long-form help content.

## Tokens

- `--pc-text-gap-xs`: 4px
- `--pc-text-gap-sm`: 8px
- `--pc-text-gap-md`: 12px
- `--pc-text-gap-lg`: 16px
- `--pc-group-gap`: 20px mobile / 24px desktop
- `--pc-section-gap`: 24px mobile / 32px desktop

## Primitives

- `.pc-text-stack`: regular text group, 12px gap
- `.pc-text-stack--compact`: label/value or metric group, 8px gap
- `.pc-text-stack--relaxed`: explanatory group, 16px gap
- `.pc-prose`: long-form content with deterministic paragraph, list and heading spacing
- `.pc-field-stack`: form fields, 20px mobile / 24px desktop
- `.pc-metric-stack`: metric label/value/note, 4px gap
- `.pc-section-stack`: page sections, 24px mobile / 32px desktop

## Rules

1. UI text nodes do not own external margins; parent stacks own spacing.
2. Long-form content must be wrapped in `.pc-prose`.
3. Do not use empty `<br>` elements for layout.
4. Do not use `justify-content: space-between` to distribute textual paragraphs.
5. Fixed-height cards may push only their footer with `margin-top: auto`; body text remains top-aligned.
6. Optional elements must not leave an empty gap when absent.
7. Acceptance widths: 360, 390, 430, 1280 and 1440 px; locales RU, EN and ZH; browser zoom 200%.
