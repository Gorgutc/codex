# Migration From Claude Infrastructure

The repo historically used `.claude/` for Claude Code agents, hooks, slash commands, and skills.

Update (ADR 0008): the repo now runs a dual harness. `.claude/` is active again
as a GENERATED mirror of the Codex canon (`npm run sync:harness`), not as a
hand-maintained configuration layer. The notes below describe the original
one-way migration and remain accurate for the archived legacy material.

## What Carries Forward

- `verify-frozen.js` is the source of truth.
- Parallel gate mindset remains useful.
- Project briefs remain useful as source material.
- Visual review and skill drift audit remain useful workflows.

## What Changes For Codex

- `AGENTS.md` becomes the primary session entrypoint.
- `.codex/agents/*.toml` describes Codex agent contracts.
- `.agents/skills/*/SKILL.md` provides Codex skills.
- Hooks should not hard-code old test counts.
- Skills should be shorter and more trigger-focused than legacy `.claude/skill-*.md`.

## Known Legacy Drift

- Some files mention `56/56`; current verification output is larger and should be treated as `0 FAIL`.
- Some files still imply English-only UI; current runtime is bilingual.
- Some files mention old CDN paths or old model-viewer source.
- Some files describe preloader behavior that no longer matches the live site.
