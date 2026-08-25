// Owner-only cabinet selector. Role authority remains server-verified.
// The V4 wrapper adds an explicit bounded CONTROL_PLANE bootstrap for the
// registration-review ceremony without weakening the existing V3 cabinet flow.
export { OwnerAccessCenter } from './OwnerAccessCenterV4';
