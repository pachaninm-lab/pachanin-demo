// Owner-only cabinet selector. Role authority remains server-verified.
// Cabinet opening refreshes the request state before the authenticated transition.
// Existing authenticated sessions are repaired server-side before the form is rendered.
// Client loading and role handoff improve navigation only; they never grant authority.
export { OwnerAccessCenter } from './OwnerAccessCenterV3';
