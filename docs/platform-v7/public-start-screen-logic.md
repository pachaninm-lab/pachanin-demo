# Public start screen logic

This note records the implementation decision for `/platform-v7` public entry.

The public start screen must explain the platform before sending a user into operational actions. Actions such as creating a deal, posting a lot, procurement requests, personal deals, notifications and execution maps are role-cabinet actions and should not be primary public-entry CTAs.

Public entry flow:

1. Explain the risk after price agreement.
2. Show what the platform controls: money, documents, logistics and quality.
3. Show the deal execution chain.
4. Route the user by role.
5. Keep login/demo visible.
6. Keep maturity honest: controlled pilot / pre-integration.
