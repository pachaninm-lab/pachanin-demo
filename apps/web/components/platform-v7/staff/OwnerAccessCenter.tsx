// Owner-only cabinet selector. Role authority remains server-verified.
// Cabinet navigation is a native server POST and must not depend on React submit state.
// The client role handoff only prevents a legacy guard bounce; it never grants authority.
export { OwnerAccessCenter } from './OwnerAccessCenterV3';
