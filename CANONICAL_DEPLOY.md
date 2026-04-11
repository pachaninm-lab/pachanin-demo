# Canonical deploy branch

Branch: `canonical-v1`

Use this branch as the single source for a fresh Vercel project.

Required routes:
- `/platform-v4-redesign`
- `/platform-v4-redesign/roles`
- `/platform-v4-redesign/deal`
- `/platform-v4-redesign/seller`
- `/platform-v4-redesign/buyer`
- `/platform-v4-redesign/driver`
- `/platform-v4-redesign/receiving`
- `/platform-v4-redesign/bank`
- `/platform-v4-redesign/documents`
- `/platform-v4-redesign/control`

Purpose:
- bypass stale old Vercel deployments
- attach one clean Vercel project to one clean branch
- stop using old preview and legacy production deploys
