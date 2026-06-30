# Live SEO audit protocol

Date: 2026-06-30

## Scope

Use this after each SEO deploy. GitHub code is not enough; the live domain must return the expected files and metadata.

## Required live checks

Fetch these URLs from the production domain:

- /robots.txt
- /sitemap.xml
- /indexnow.txt
- /discovery.txt
- /platform-v7
- /platform-v7/about
- /platform-v7/demo
- /platform-v7/docs
- /platform-v7/contact

## Expected public pages

Each public SEO page must have:

- HTTP 200
- title
- meta description
- canonical
- visible content matching the page intent
- no accidental noindex

## Expected trust and application pages

These must return noindex/follow:

- /platform-v7/login
- /platform-v7/open
- /platform-v7/register
- /platform-v7/auth
- /platform-v7/onboarding
- /platform-v7/privacy
- /platform-v7/terms
- /platform-v7/oferta
- /platform-v7/status
- /platform-v7/security

## Blockers

Treat as SEO blockers:

- robots.txt missing or blocking the public platform
- sitemap missing public URLs
- public page returns 404/500
- public page has noindex
- canonical points to wrong host
- title does not mention Прозрачная Цена or Процент Агро
- role cabinet route is indexable
- fake company details appear on public trust pages

## Search checks

Run after indexing has had time to update:

- site:процент-агро.рф
- процент агро
- процент агро сайт
- прозрачная цена процент агро
- процент-агро.рф

## Interpretation

If code is green but search does not show the site, the next action is external discovery and Yandex Webmaster re-crawl, not more keyword stuffing.
