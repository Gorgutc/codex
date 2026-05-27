---
name: codex-studio-run-5sec
description: Use when the user asks to run the Codex Studio 5-second visual test, or when a major visual change needs rendered first-impression QA. Replaces the former Claude /run-5sec command.
---

# Codex Studio Run 5-Second Test

1. Require either a screenshot path or a local URL.
2. If a URL is provided, capture a screenshot with Playwright or the browser tool.
3. Use `codex-studio-5sec-test` on that visual input.
4. Return only the verdict and the highest-leverage fix.

For the original Claude command text, see `../codex-studio-rules/references/claude-original/commands/run-5sec.md`.
