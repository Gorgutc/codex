# Skill Map

Project-local Codex skills live in `.agents/skills`. Primary plugin skills live
in `plugins/codex-studio-codex/skills` (see the list in `AGENTS.md`; the
content-layer/admin-panel rules live in `codex-studio-admin-rules`). Both sets
are mirrored into `.claude/skills/` for Claude Code by `npm run sync:harness`
(ADR 0008); the mirror is generated — edit only the canonical locations listed
here.

- `codex-studio-code`: HTML/CSS/JS generation, review, cleanup, refactor.
- `codex-studio-motion`: GSAP, ScrollTrigger, SplitText, Lenis, preloader, reduced motion.
- `codex-studio-a11y-seo-deploy`: accessibility, metadata, structured data, deploy checks.
- `codex-studio-assets`: images, SVG, GLB, HDR, favicons, OG, downloads.
- `codex-studio-copy`: bilingual copy and i18n text workflow.
- `codex-studio-visual-review`: screenshot-based visual quality.
- `codex-studio-instruction-audit`: AGENTS, .codex, skills, hooks, .claude drift.

Keep skills concise. Put long explanations in `docs/agent/*` or references, not in skill bodies.

## Adding a skill (dual-harness runbook)

1. Create the skill in its canonical home: project rules and workflows go to
   `plugins/codex-studio-codex/skills/<name>/` (SKILL.md + `agents/openai.yaml`),
   lightweight audit guidance goes to `.agents/skills/<name>/` (SKILL.md only).
2. Run `npm run sync:harness` to regenerate the `.claude/skills/` mirror.
3. Update the skill lists in `AGENTS.md` and this file.
4. `npm run codex:ship` must pass (`check:parity` verifies the mirror).
