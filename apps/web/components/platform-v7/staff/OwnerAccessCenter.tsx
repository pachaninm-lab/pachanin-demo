// Owner-only Control Center entry. Role authority remains server-verified.
// The V4 wrapper keeps the registration CONTROL_PLANE bootstrap while V3
// consumes the canonical Founder VIEW_AS role-mode contract for cabinet reads.
export { OwnerAccessCenter } from './OwnerAccessCenterV4';
