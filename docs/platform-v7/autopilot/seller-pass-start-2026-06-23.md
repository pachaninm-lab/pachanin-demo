# seller cabinet pass start criteria

Linked issues: #1976 #1978 #1979

Start the seller cabinet functional pass only when this docs-only audit PR is merged or superseded by a cleaner audit state PR.

## Exact criteria

- Identify exact seller cabinet file paths before editing.
- Keep the PR to one role only.
- Preserve shell/header/bottom navigation.
- Validate mobile 390x844 for no horizontal overflow.
- Route CTAs to existing routes/actions/sections or disable them with a reason.
- Keep all copy honest: controlled-pilot / pre-integration.

## Stop condition

Stop and report if exact seller cabinet files cannot be identified safely.