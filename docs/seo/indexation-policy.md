# Indexation policy

Date: 2026-06-30
Status: controlled pilot / pre-integration

## Index

These routes are public SEO surfaces:

- /platform-v7
- /platform-v7/about
- /platform-v7/demo
- /platform-v7/docs
- /platform-v7/contact

## Noindex, follow

These routes are available for users or trust navigation, but are not search landing pages:

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

## Disallow in robots

These routes should not be crawled as public content:

- /api/
- /platform-v7/deals
- /platform-v7/operator
- /platform-v7/buyer
- /platform-v7/seller
- /platform-v7/logistics
- /platform-v7/driver
- /platform-v7/elevator
- /platform-v7/lab
- /platform-v7/surveyor
- /platform-v7/bank
- /platform-v7/arbitrator
- /platform-v7/compliance
- /platform-v7/executive

## Rule

If a route is required for application flow but does not explain the public value of the project, use noindex/follow. If a route contains role data, deals, private actions, API or cabinet context, block it from crawling.
