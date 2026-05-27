# Code Review And Cleanup

## Review Posture

Find bugs, regressions, dead code, risky coupling, and missing verification first. Style-only comments are secondary.

## Dead-Code Standard

Only remove code when there is strong evidence:

- no references in shipped HTML/CSS/JS,
- no dynamic lookup path,
- no test-covered behavior,
- no asset/data coupling,
- and the removal passes verification.

If evidence is incomplete, record the item as "needs runtime proof" rather than deleting it.

## Optimization Standard

Prefer small, behavior-preserving changes:

- remove duplicated selectors or handlers when behavior is identical,
- move repeated constants to existing data structures,
- preserve script order and global contracts,
- avoid new abstractions unless they reduce real complexity.

Do not refactor frozen architecture just because it looks old-fashioned.
