# platform-v7 queue state note

Linked issues: #1974 #1984

## Active order

1. Keep queue and acceleration anchors active.
2. Merge clean open PRs when gates pass.
3. If no clean PR exists, use the audit output to create exact small PRs.
4. Advance seller cabinet pass.
5. Continue role cabinets one by one.
6. Split runtime work into separate PRs.

## Current safe next action

After this checkpoint PR is merged, start a narrow seller cabinet PR.