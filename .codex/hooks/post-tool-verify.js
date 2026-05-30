const { execSync } = require("node:child_process");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    payload = {};
  }

  const text = JSON.stringify(payload);
  const patch = payload.tool_input && (payload.tool_input.patch || payload.tool_input.input || "");
  const file = payload.tool_input && (payload.tool_input.file_path || payload.tool_input.path || "");
  const source = [text, patch, file].join("\n");

  const shipped = [
    /(?:^|[\\/\s"])(index\.html|free-assets\.html|verify-frozen\.js)(?:$|[\\/\s"])/,
    /(?:^|[\\/\s"])css[\\/][^\\/\s"]+\.css(?:$|[\\/\s"])/,
    /(?:^|[\\/\s"])js[\\/]vendor[\\/]codex-three-viewer\.js(?:$|[\\/\s"])/,
    /(?:^|[\\/\s"])js[\\/](?!vendor[\\/]|model-data\.js)[^\\/\s"]+\.js(?:$|[\\/\s"])/
  ].some(rx => rx.test(source));

  if (!shipped) return;

  try {
    const command = process.platform === "win32" ? "npm.cmd run verify" : "npm run verify";
    const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const summary = output.match(/SUMMARY:\s+.*$/m);
    process.stdout.write(`verify-frozen.js: ${summary ? summary[0] : "PASS"}\n`);
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}`.trim();
    process.stderr.write("verify-frozen.js failed after a shipped-code edit.\n");
    process.stderr.write(output.split(/\r?\n/).slice(-40).join("\n"));
    process.stderr.write("\nFix the regression or revert the shipped-code edit before continuing.\n");
    process.exit(2);
  }
});
