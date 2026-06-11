import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pluginRoot = path.join(root, 'plugins', 'codex-studio-codex');
const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, condition: Boolean(condition), detail });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function listFilesRecursive(startPath) {
  if (!existsSync(startPath)) return [];
  const stat = statSync(startPath);
  if (stat.isFile()) return [startPath];

  const files = [];
  for (const entry of readdirSync(startPath, { withFileTypes: true })) {
    const full = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

const marketplacePath = path.join(root, '.agents', 'plugins', 'marketplace.json');
const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
const skillsRoot = path.join(pluginRoot, 'skills');
const originalRefs = path.join(skillsRoot, 'codex-studio-rules', 'references', 'claude-original');
const instructionRoots = [
  'AGENTS.md',
  'README.md',
  'RUN_INSTRUCTIONS.md',
  'docs',
  '.codex',
  '.agents',
  path.join('plugins', 'codex-studio-codex', 'skills'),
];
const instructionExts = new Set(['.md', '.toml', '.js', '.json', '.jsonc', '.yml', '.yaml']);
const stalePassCountPattern = /\b(?:SUMMARY:\s*)?\d+\/\d+\s+PASS\b/i;
const activeInstructionFiles = instructionRoots
  .flatMap((entry) => listFilesRecursive(path.join(root, entry)))
  .filter((file) => instructionExts.has(path.extname(file)))
  .filter((file) => !file.includes(`${path.sep}references${path.sep}claude-original${path.sep}`));
const staleInstructionCounts = activeInstructionFiles
  .flatMap((file) =>
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line, index) => (stalePassCountPattern.test(line) ? `${path.relative(root, file)}:${index + 1}` : null))
      .filter(Boolean),
  );

check('marketplace exists', existsSync(marketplacePath), marketplacePath);
check('plugin manifest exists', existsSync(manifestPath), manifestPath);
check('skills root exists', existsSync(skillsRoot), skillsRoot);
check('claude-original references moved', existsSync(originalRefs), originalRefs);
const trackedClaudeFiles = execFileSync('git', ['ls-files', '.claude'], { cwd: root, encoding: 'utf8' }).trim();
check('legacy .claude not tracked in git', trackedClaudeFiles === '', trackedClaudeFiles.split('\n')[0] || '');
check(
  'active instructions avoid stale pass totals',
  staleInstructionCounts.length === 0,
  staleInstructionCounts.join(', '),
);

if (existsSync(marketplacePath)) {
  const marketplace = readJson(marketplacePath);
  const entry = marketplace.plugins?.find((plugin) => plugin.name === 'codex-studio-codex');
  check('marketplace entry exists', entry);
  check('marketplace entry path is local plugin', entry?.source?.path === './plugins/codex-studio-codex');
  check('marketplace installation policy set', entry?.policy?.installation === 'AVAILABLE');
  check('marketplace authentication policy set', entry?.policy?.authentication === 'ON_INSTALL');
}

if (existsSync(manifestPath)) {
  const manifest = readJson(manifestPath);
  check('plugin name matches folder', manifest.name === 'codex-studio-codex');
  check('plugin exposes skills directory', manifest.skills === './skills/');
  check('plugin display name set', Boolean(manifest.interface?.displayName));
}

if (existsSync(skillsRoot)) {
  const skills = readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  check('at least nine skills migrated', skills.length >= 9, `count=${skills.length}`);
  for (const skill of skills) {
    const skillPath = path.join(skillsRoot, skill.name, 'SKILL.md');
    const uiPath = path.join(skillsRoot, skill.name, 'agents', 'openai.yaml');
    check(`${skill.name}: SKILL.md`, existsSync(skillPath));
    check(`${skill.name}: agents/openai.yaml`, existsSync(uiPath));
  }
}

let failed = 0;
for (const item of checks) {
  if (item.condition) {
    console.log(`[PASS] ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
  }
}

console.log(`SUMMARY: ${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
process.exitCode = failed === 0 ? 0 : 1;
