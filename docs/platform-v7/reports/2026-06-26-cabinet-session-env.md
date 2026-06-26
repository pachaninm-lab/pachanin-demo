# Cabinet session env flags

- `PLATFORM_V7_ALLOW_BODY_ROLE_CABINET_SESSION`: explicit opt-in for direct body-role cabinet session issuance.
- `PLATFORM_V7_CONTROLLED_PILOT_BODY_ROLE_SESSION`: controlled-pilot opt-in for current demo flow.
- `PLATFORM_V7_PRODUCTION_LIKE`: production-like hardening flag.
- `PLATFORM_V7_CABINET_SESSION_MODE=production-like`: production-like hardening mode.

Recommended controlled-pilot deployment:
- keep the body-role flag only while backend login/membership wiring is incomplete;
- remove it when verified backend cabinet sessions are active.
