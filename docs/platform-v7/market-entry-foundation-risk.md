# Risk note

Main risks:
- price data without source;
- marketplace drift;
- duplicated execution state;
- skipped checks before deal launch.

Current controls:
- source label and date on price records;
- isolated route;
- no runtime changes;
- readiness gate before execution links.
