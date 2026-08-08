// Generated mirror only: .claude/skills/** and .claude/agents/**; .claude/settings.json stays editable.
const MIRROR_PATH = /(^|\/)\.claude\/(skills|agents)\//;

const GUIDANCE =
  ".claude/skills/** and .claude/agents/** are a generated mirror - edit the canonical skill/agent contract and run npm run sync:harness; parity enforced by npm run check:parity.\n";

// Case, dot segments and doubled separators must not bypass the match.
function normalize(value) {
  const segments = String(value).replace(/\\/g, "/").split("/");
  const out = [];
  for (const segment of segments) {
    if (segment === "" && out.length > 0) continue; // collapse repeated separators
    if (segment === ".") continue; // drop /./ segments
    if (segment === "..") {
      const last = out.length > 0 ? out[out.length - 1] : undefined;
      if (last === undefined || last === "..") out.push("..");
      else if (last === "" && out.length === 1) continue; // already at root
      else out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join("/").toLowerCase();
}

function isMirrorPath(value) {
  return typeof value === "string" && value !== "" && MIRROR_PATH.test(normalize(value));
}

// apply_patch carries its targets inside the patch text ("*** Update File: <path>"), not in file_path.
function findMirrorLine(body) {
  for (const line of body.split(/\r?\n/)) {
    for (const token of line.split(/[\s"'`]+/)) {
      if (isMirrorPath(token.replace(/^[^\w./\\]+/, ""))) return line.trim();
    }
  }
  return null;
}

function block(subject, matchedLine) {
  process.stderr.write(`Blocked write to ${subject}\n`);
  if (matchedLine) process.stderr.write(`Matching patch line: ${matchedLine}\n`);
  process.stderr.write(GUIDANCE);
  process.exit(2);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  // Windows shells can prepend a UTF-8 BOM when piping; never fail open on it.
  const raw = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    payload = {};
  }

  const toolInput = payload && typeof payload.tool_input === "object" && payload.tool_input ? payload.tool_input : {};

  const target = toolInput.file_path || toolInput.path;
  if (isMirrorPath(target)) block(target, null);

  for (const body of [toolInput.patch, toolInput.input]) {
    if (typeof body !== "string" || !body) continue;
    const line = findMirrorLine(body);
    if (line) block("generated mirror path in patch body", line);
  }
});
