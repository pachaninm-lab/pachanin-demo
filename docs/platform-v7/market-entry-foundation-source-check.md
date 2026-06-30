# Source check

Checked public sources before implementation.

Findings:
- NTB publishes the concept of anonymous order book, firm bids, online trading and real-time market data for wheat.
- ProZerno publishes market analysis, regional price monitoring and index values.
- Grainboard shows how market users expect simple listings, regions, company directories and price dynamics.

Implementation decision:
- keep sourced prices with date and source label;
- calculate delivered price from a selected route;
- do not claim automatic live quotes;
- use market entry only as a pre-deal layer before execution.
