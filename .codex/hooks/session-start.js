const context = [
  "Codex Studio: static vanilla HTML/CSS/JS site.",
  "Primary instructions: AGENTS.md, then docs/agent/*, then .agents/skills/*.",
  "Source of truth: verify-frozen.js and npm run verify with 0 FAIL.",
  "Important drift note: legacy .claude docs may mention 56/56 or English-only UI; current suite is larger and bilingual i18n is expected.",
  "For broad audits or shipped-code changes, use the Codex agent orchestration described in docs/agent/orchestration.md."
].join(" ");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
