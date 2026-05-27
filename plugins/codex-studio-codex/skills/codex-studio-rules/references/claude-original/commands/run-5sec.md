---
description: Invokes codex-5sec-test against a screenshot of the rendered Codex Studio page. Use after visual changes (hero, sidebar, cards, typography) or before deploy. Requires a running local server (e.g. `python3 -m http.server 5555`).
---

You are running a first-impression visual audit of Codex Studio.

## Step 1 — Confirm the screenshot

Ask the user (or accept from prompt) ONE of:

- A path to an existing PNG/JPG
- A URL to capture (e.g. `http://localhost:5555/`)

If neither provided, tell the user:

```
Need either a screenshot path or a URL.
Quick setup:
  Terminal 1:  python3 -m http.server 5555
  Then:        /run-5sec http://localhost:5555/
```

Then stop. Do not invoke the agent without input.

## Step 2 — Invoke codex-5sec-test

Single tool turn, single invocation. Pass the path or URL as the prompt.

## Step 3 — Surface the verdict

Show the user verbatim. Add one sentence of follow-up only:

- If verdict is PROFESSIONAL (8+): congratulate briefly and stop.
- If verdict is AMBIGUOUS or TEMPLATE: offer to address the "single highest-leverage fix" line.

## Hard rules

- Never invoke codex-5sec-test more than once per /run-5sec call (cost control — screenshot + vision is expensive).
- Never describe the screenshot yourself. The agent's verdict is the answer.
- If the agent returns "SKIPPED — no visual input", repeat the setup instructions instead of guessing.
