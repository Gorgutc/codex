# Agent Eval Prompts

These prompts are copy-paste checks for future sessions in either harness
(Codex or Claude Code).

Each prompt includes expected behavior. Passing the eval means the agent reads
the right context, uses the right orchestration, avoids stale Claude-era
assumptions (see `references/claude-original/`), and verifies with the current
suite.
