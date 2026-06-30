# Market entry foundation

Separate pre-deal layer for platform-v7.

Included:
- sourced market price view;
- logistics-adjusted price calculation;
- buy or sell intent in the current workspace session;
- launch readiness gate;
- links into current lot, RFQ and bank pages.

Not included in this layer:
- exchange functions;
- automatic deal creation;
- payment movement;
- RBAC or shell changes;
- bank release changes.

Next hardening:
- durable persistence;
- licensed price source adapters;
- counterparty trust profile;
- notification events;
- navigation integration after current shell work is closed.
