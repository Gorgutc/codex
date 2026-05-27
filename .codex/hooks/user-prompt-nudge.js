let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  let prompt = "";
  try {
    const parsed = JSON.parse(input || "{}");
    prompt = parsed.prompt || parsed.user_prompt || "";
  } catch {
    prompt = input || "";
  }

  const lower = prompt.toLowerCase();
  const codeTask = [
    "implement", "refactor", "audit", "cleanup", "dead code", "optimize",
    "rewrite instructions", "agents", "skills", "hooks", "ship",
    "сделай", "добавь", "проверь", "аудит", "агент", "скилл", "хуки",
    "инструкц", "оптимиз"
  ].some(word => lower.includes(word));

  if (!codeTask) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "[Codex Studio reminder] This looks like a code or agent-infra task. Read AGENTS.md, use docs/agent/orchestration.md for broad work, and run npm run verify after shipped-code changes."
    }
  }));
});
