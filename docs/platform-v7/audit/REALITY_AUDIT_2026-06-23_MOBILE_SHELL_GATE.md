# platform-v7 mobile shell gate — 2026-06-23

This gate applies to each role-cabinet PR from the reality audit queue.

## Required viewport

Check cabinet behavior at 390x844.

## Must remain stable

- shell/header visible;
- bottom navigation visible where expected;
- no horizontal overflow;
- primary status cards fit the viewport;
- CTA rows wrap or stack safely;
- role navigation does not hide the next action;
- no visual carousel regression on first entry.

## Fail examples

- first screen requires excessive unsorted scrolling before the current blocker is visible;
- bottom nav overlaps the primary CTA;
- wide table/card creates horizontal overflow;
- desktop-only layout hides responsible party or money at risk;
- visual decoration dominates operational status.

## Fix rule

If the defect is shared shell or CSS, split it from the role-cabinet PR unless the exact role file owns the defect locally.
