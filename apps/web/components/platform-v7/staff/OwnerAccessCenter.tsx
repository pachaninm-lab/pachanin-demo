// Owner-only cabinet selector. Role authority remains server-verified.
// Cabinet opening uses an authenticated JSON transition with native POST fallback.
// Existing authenticated sessions are repaired server-side before a CSRF-protected form is rendered.
// Client loading and role handoff improve navigation only; they never grant authority.
export { OwnerAccessCenter } from './OwnerAccessCenterV3';
