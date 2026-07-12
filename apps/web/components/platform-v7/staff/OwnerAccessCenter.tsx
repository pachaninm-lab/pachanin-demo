// Owner-only cabinet selector. Role authority remains server-verified.
// Cabinet navigation is a native server POST and must not depend on React submit state.
// Existing authenticated sessions are repaired server-side before a CSRF-protected form is rendered.
// The client role handoff only prevents a legacy guard bounce; it never grants authority.
export { OwnerAccessCenter } from './OwnerAccessCenterV3';
