# DESIGN_AUTHORITY.md

Status: **CANONICAL / ACTIVE**

Current UX implementation branch is required to remain rebased/merged to the current protected `main`; as of this authority revision it is `behind=0`.
Authority date: 2026-09-20
Authority base main: `5da8e80744908413102214f91dd68018911b892e`

## Rule

The files listed below are the only visual source of truth for the current “Прозрачная Цена” UX/UI implementation.

**Everything else is superseded.**

Do not use prior mockups, screenshots, generated variants, historical PR screenshots, or visual interpretations as design authority. Existing production code remains authoritative only for product semantics, data, security, permissions, API contracts, role/tenant boundaries, registration and Deal behavior.

If a listed mockup conflicts with accessibility, responsive behavior, a real product state, or an authoritative backend contract, make the smallest technically necessary deviation, preserve the visual character, and document the reason in the implementation PR.

## Canonical mockups

| File | Canonical target | Size | SHA-256 |
|---|---|---:|---|
| `01-home-desktop.jpg` | Главная — desktop | 1055×1491 | `922ce661af6031324424501f15e49dfe82570f8c6f72bd6fd112df2370b57420` |
| `02-home-mobile.jpg` | Главная — mobile | 864×1536 | `152af1f20d4ef7b47ecd864b4a7bbf5c8f1311aa6b0401de6c3f36d36bbc4477` |
| `03-market-desktop.jpg` | Рынок — desktop | 1448×1086 | `ff12ec79fc751bc8e6833fb17598ff011338f4db929a2a4ed351124b75a8c02c` |
| `06-market-mobile.png` | Рынок — mobile | 430×932 | `174c0f494b649bb491f7bd8e9fa2662baea91475ff338c10e55206153d8d32e6` |
| `04-lot-desktop.jpg` | Карточка лота — desktop; mobile derives from the same canonical design system and IA | 1448×1086 | `bb0398311fb97d7eb8a8a29c3467d8a211d52116711922bc037280a36a4857fc` |
| `05-deal-desktop.jpg` | Сделка в работе — desktop | 1448×1086 | `01dc6880116147200c501de6966989c66ea56d2488b03fa1712ee0d3b0db74a6` |
| `06-deal-mobile.png` | Сделка в работе — mobile | 430×932 | `e7d2af248e29c84145e98149b0033ee331212b8e0a23145b1c69ef1b82c89218` |
| `07-how-it-works-desktop.jpg` | Как проходит Сделка — desktop; mobile derives from the same canonical design system and IA | 1448×1086 | `7577ca792bebffdb8a94bc540b2c7fdd56f2be36286828b5cd2ff23720456448` |
| `08-trust-desktop.jpg` | Доверие — desktop; mobile derives from the same canonical design system and IA | 1448×1086 | `3b3a0c543dce4592c333fcac363e98b580ec74a964f9b247b73a47b68e96d4d2` |
| `09-gekta-desktop.jpg` | Гекта — desktop; mobile derives from the same canonical design system and IA | 1672×941 | `2d2a3dd0940cc920b9ea87c847ba204d504c76c658f375fe397862adb838e8f2` |

The canonical source bundle supplied for this work is `final_canonical_mockups(2).zip`.

## Canonical product contract

Navigation:
`Рынок · Как проходит Сделка · Возможности · Гекта · Доверие · О платформе`

Nine roles:
`Продавец · Покупатель · Логистика · Водитель · Элеватор · Лаборатория · Сюрвейер · Банк · Сотрудник подключённой организации`

Seven Deal stages:
`Лот → Торги → Обязательства → Доставка → Приёмка / качество → Документы / расчёт → Закрытие / спор`

Trust model:
`Полномочия → Основание → Источник → Решение`

## Canonical brand

Use only the existing repository asset rendered by `apps/web/components/v7r/BrandMark.tsx` / `ApprovedHeaderLogo`.
Do not redraw, regenerate or replace the logo.

## Implementation boundaries

- Preserve server-authoritative role, tenant and financial state.
- Preserve PostgreSQL authority, MFA, idempotency, audit/outbox, RLS and tenant isolation.
- Do not fabricate live prices, partners, companies, counts, ratings, documents, Deal IDs, integrations or statuses.
- Prefer real backend data; otherwise render explicit loading / empty / stale / unavailable / permission-denied / conflict states.
- Use one shared design system; do not fork route-local visual systems.
- Verify 320 / 375 / 390 / 768 / 1280 / 1440.
- No production release until build, functional QA, accessibility, visual-regression and production acceptance pass.


## Recorded minimal deviations

- `02-home-mobile.jpg` is a presentation-scale phone composition. Runtime mobile acceptance keeps its hierarchy, crop, CTA order, bottom navigation and visual character, but does not compress interactive controls below the required 44×44 px touch target or reduce text below readable WCAG-safe sizing.
- Public Market and Lot screens never invent inventory, counterparties, quality confirmations or documents to fill the mockup. When the PostgreSQL `ANONYMIZED_PUBLIC_MARKET` projection has no `PUBLIC_ALLOWED` data, the approved visual composition uses explicit empty/unavailable states.
- Protected Deal screens bind to the real server-authoritative Deal workspace. Public visual acceptance exercises the non-sensitive explanatory state; authoritative financial state, role, tenant and private Deal data are never fabricated for a public screenshot.


## Visual acceptance mechanism

The canonical Playwright acceptance captures the exact authority viewports and applies:
- runtime/error rejection;
- WCAG 2.2 AA serious/critical violation rejection;
- horizontal-overflow rejection;
- RU / EN / 中文 responsive checks at 320 / 375 / 390 / 768 / 1280 / 1440;
- perceptual average-hash distance thresholds bound to the final authority images above.

This is an acceptance guard, not a substitute for the source SHA-256 list. The source files and hashes in this document remain the visual authority.
