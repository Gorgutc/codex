# ADR 0003: Project Skills Over Copied Claude Skills

## Decision

Create concise Codex skills in `.agents/skills` instead of copying `.claude/skill-*.md` verbatim.

## Context

Legacy skill files are useful but verbose and contain drift. Codex skills work best when their frontmatter triggers are clear and bodies stay lean.

## Consequences

Long background moves to `docs/agent`. Skills point to docs and focus on workflow.
