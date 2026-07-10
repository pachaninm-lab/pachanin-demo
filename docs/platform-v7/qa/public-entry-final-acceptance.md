# Public entry final acceptance register

Status date: 2026-07-10

This register separates implemented controls from executed evidence. A row is not considered passed until an attached CI, preview, real-device or production artifact exists.

## Scope

- `/platform-v7`;
- `/platform-v7/login`;
- `/platform-v7/forgot-password`;
- `/platform-v7/reset-password`;
- canonical public header;
- RU/EN/ZH;
- public support dialog;
- login, MFA and password recovery BFF boundaries;
- public-entry telemetry.

## Evidence states

- **Implemented** — code and automated gate exist in an open PR.
- **CI passed** — required checks passed on the exact head commit.
- **Preview passed** — smoke and browser evidence were captured on an immutable preview.
- **Production passed** — production deploy and smoke were executed on the released commit.
- **External pending** — requires a device, provider, secret, contract or production integration that is not available in repository CI.

## Acceptance matrix

| Area | Required evidence | Current state |
|---|---|---|
| Public route isolation | Static gate proves no legacy layout/template ancestry | Implemented in PR-5 |
| Single public header | Landing/login/recovery use `PublicSiteHeader` | Implemented |
| Two hero CTAs | Playwright asserts register + deal-flow only | Implemented |
| No role selection | Static + browser query-parameter tests | Implemented |
| Server role authority | Login consumes only server `redirectTo` | Implemented; API integration pending |
| RU/EN/ZH | Catalog parity + browser cycle | Implemented |
| No DOM translator | Static gates prohibit observer/text replacement on isolated routes | Implemented |
| Support overlap | Bounding-box test on mobile/desktop | Implemented |
| Password form | duplicate-request, network error, email preservation | Implemented |
| MFA | separate TOTP/backup step and encrypted pending cookie | Implemented; live API flow pending |
| Password reset | universal response, one-time token, session revocation | Implemented across stacked PRs; delivery pending |
| Accessibility | axe critical/serious = 0, keyboard/focus tests | Implemented; CI/real-device pending |
| VoiceOver iOS | manual scripted pass on current + previous supported iOS | External pending |
| TalkBack Android | manual scripted pass on supported Android | External pending |
| 200% zoom | browser/manual evidence | Pending execution |
| Width matrix | 320/360/375/390/414/430/1280/1440/1920 | Implemented |
| Browser matrix | Chromium/Firefox/WebKit and mobile profiles | Implemented in CI config |
| Edge | optional CI project plus manual desktop pass | External pending unless runner has Edge |
| Real iPhone | current and previous supported Safari | External pending |
| LCP | median ≤ 2.5 s on defined throttled profile | Gate implemented; result pending |
| INP | field p75 ≤ 200 ms; observed lab interactions ≤ 200 ms | Telemetry/gate implemented; field sample pending |
| CLS | median/field p75 ≤ 0.1 | Gate implemented; result pending |
| Blank screen | cold start/back/reload + telemetry | Implemented |
| Chunk failures | coarse client category + release tag | Implemented |
| Correlation IDs | BFF/telemetry/error references | Implemented |
| Visual regression | approved RU/EN/ZH baselines for required sizes/states | Baseline workflow present; approval pending |
| Production deploy | immutable release equals accepted commit | Pending |
| Production smoke | scripted routes/auth/error/recovery checks | Pending |
| Rollback | documented and rehearsed against preview | Documented; rehearsal pending |

## Automated commands

From repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir apps/web exec tsc --noEmit
pnpm --dir apps/web exec vitest run
pnpm --dir apps/web exec next build
pnpm --dir apps/web exec playwright test --config=playwright.public-entry.config.ts
pnpm --dir apps/web exec lhci autorun --config=lighthouserc.public-entry.cjs
```

Required runtime variables for security-path builds:

```text
API_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_RELEASE
MFA_LOGIN_TICKET_SECRET
PASSWORD_RESET_DELIVERY_KEY
PASSWORD_RESET_TOKEN_SECRET
JWT_SECRET
```

Mail delivery additionally requires either:

```text
RESEND_API_KEY + RESEND_FROM_EMAIL
```

or:

```text
PC_SMTP_HOST + PC_SMTP_PORT + PC_SMTP_USER + PC_SMTP_PASS + PC_MAIL_FROM
```

## Manual accessibility script

1. Open landing at 320 px equivalent and 200% zoom.
2. Navigate only with keyboard/switch control.
3. Confirm header, language, both CTAs and support trigger have visible focus.
4. Open support; confirm title/description announcement and Escape return of focus.
5. Open login; confirm labels, error announcement and password-visibility state.
6. Complete password → MFA with TOTP and backup code.
7. Complete forgot-password and expired/reset-used states.
8. Repeat with VoiceOver iOS and TalkBack Android.
9. Record device, OS/browser version, release SHA and defects.

## Visual baseline approval

Baselines must be generated from the immutable preview of the final stacked head, not from a developer server. Required dimensions and states:

- RU/EN/ZH;
- 320/375/390/430;
- 1280/1440;
- landing normal;
- login normal/loading/error/MFA;
- forgot-password sent/error;
- reset expired/success;
- increased text size;
- reduced motion.

Set `PLAYWRIGHT_VISUAL_BASELINES=1` only during the explicit baseline generation/approval run. A skipped baseline test is not a pass.

## External integration status

The public UI must not imply that the following are production-confirmed until separate evidence exists:

- persistent auth foundation PR merged and migrated;
- production email sender/domain verified;
- live bank callbacks and reconciliation;
- live nominal-account or safe-deal API;
- live FGИС «Зерно»/СДИЗ;
- live ЭДО/ЭПД;
- production alert routing for login/MFA/reset/blank-screen error growth.

## Exit rule

Do not use `production-ready`, `production-proven` or equivalent language until every mandatory row is either **Production passed** or explicitly accepted as **External pending** by the accountable owner with a dated risk acceptance.
