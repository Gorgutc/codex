import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Generates and verifies the Claude Code mirror of the Codex harness.
// Canon: plugins/codex-studio-codex/skills, .agents/skills, .codex/agents, .codex/hooks.json.
// Mirror: .claude/skills, .claude/agents (generated; never edit by hand).
// Usage: node scripts/sync-harness.mjs --write | --check

const root = process.cwd();
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null;

if (!mode) {
  console.error('Usage: node scripts/sync-harness.mjs --write | --check');
  process.exit(1);
}

const rootPackageJson = path.join(root, 'package.json');
if (!existsSync(rootPackageJson) || JSON.parse(readFileSync(rootPackageJson, 'utf8')).name !== 'codex') {
  console.error('sync-harness: run from the Gorgutc/codex repo root (package.json with name "codex" not found).');
  process.exit(1);
}

const pluginSkillsRoot = path.join(root, 'plugins', 'codex-studio-codex', 'skills');
const agentsSkillsRoot = path.join(root, '.agents', 'skills');
const codexAgentsRoot = path.join(root, '.codex', 'agents');
const codexHooksJson = path.join(root, '.codex', 'hooks.json');
const claudeSkillsRoot = path.join(root, '.claude', 'skills');
const claudeAgentsRoot = path.join(root, '.claude', 'agents');
const claudeSettings = path.join(root, '.claude', 'settings.json');
const claudeMd = path.join(root, 'CLAUDE.md');

const textExtensions = new Set([
  '.md',
  '.markdown',
  '.yaml',
  '.yml',
  '.json',
  '.jsonc',
  '.js',
  '.mjs',
  '.toml',
  '.txt',
  '.html',
  '.css',
  '.sh'
]);
const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, condition: Boolean(condition), detail });
}

function listFilesRecursive(startPath, prefix = '') {
  if (!existsSync(startPath)) return [];
  const files = [];
  for (const entry of readdirSync(startPath, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(path.join(startPath, entry.name), rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files.sort();
}

function normalizedEquals(fileA, fileB) {
  const bufA = readFileSync(fileA);
  const bufB = readFileSync(fileB);
  if (bufA.equals(bufB)) return true;
  if (!textExtensions.has(path.extname(fileA).toLowerCase())) return false;
  const normalize = (buf) => buf.toString('utf8').replaceAll('\r\n', '\n');
  return normalize(bufA) === normalize(bufB);
}

function collectSkillSources() {
  const sources = new Map();
  for (const skillsRoot of [pluginSkillsRoot, agentsSkillsRoot]) {
    if (!existsSync(skillsRoot)) continue;
    for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (sources.has(entry.name)) {
        throw new Error(`duplicate skill name across canonical roots: ${entry.name}`);
      }
      sources.set(entry.name, path.join(skillsRoot, entry.name));
    }
  }
  return sources;
}

function parseAgentToml(file) {
  const raw = readFileSync(file, 'utf8');
  const scalar = (key) => {
    const match = raw.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
    const value = match ? match[1] : '';
    if (value.includes('\\')) {
      throw new Error(`unsupported escape sequence in ${path.basename(file)} key "${key}"; keep contract values plain`);
    }
    return value;
  };
  const block = raw.match(/developer_instructions\s*=\s*"""\r?\n?([\s\S]*?)"""/);
  return {
    name: scalar('name'),
    description: scalar('description'),
    sandboxMode: scalar('sandbox_mode'),
    instructions: block ? block[1].replaceAll('\r\n', '\n').trim() : ''
  };
}

function agentMarkdown(tomlFile) {
  const agent = parseAgentToml(tomlFile);
  const kebab = agent.name.replaceAll('_', '-');
  const lines = ['---', `name: ${kebab}`, `description: ${JSON.stringify(agent.description)}`];
  if (agent.sandboxMode === 'read-only') {
    lines.push('tools: Read, Grep, Glob');
  }
  lines.push('---', '');
  lines.push(
    `<!-- Generated from .codex/agents/${path.basename(tomlFile)} by scripts/sync-harness.mjs. Do not edit; run: npm run sync:harness -->`,
    ''
  );
  lines.push(agent.instructions, '');
  return { kebab, content: lines.join('\n') };
}

const skillsReadme = [
  '# Generated Claude Code skill mirror',
  '',
  'Every directory here is a generated copy of a canonical Codex skill from',
  '`plugins/codex-studio-codex/skills/` or `.agents/skills/`.',
  'Do not edit these copies. Edit the canonical skill, then run `npm run sync:harness`.',
  'Parity is enforced by `npm run check:parity` (part of `npm run codex:ship`).',
  ''
].join('\n');

function expectedMirrorState() {
  const skillFiles = new Map();
  for (const [name, sourceDir] of collectSkillSources()) {
    for (const rel of listFilesRecursive(sourceDir)) {
      skillFiles.set(`${name}/${rel}`, path.join(sourceDir, rel));
    }
  }
  const agents = existsSync(codexAgentsRoot)
    ? readdirSync(codexAgentsRoot)
        .filter((file) => file.endsWith('.toml'))
        .map((file) => agentMarkdown(path.join(codexAgentsRoot, file)))
    : [];
  return { skillFiles, agents };
}

function hookScriptsByEvent(config) {
  const result = new Map();
  for (const [event, entries] of Object.entries(config.hooks || {})) {
    const scripts = new Set();
    for (const entry of entries || []) {
      for (const hook of entry.hooks || []) {
        const sources = [hook.command, hook.commandWindows].filter(Boolean).join('\n');
        for (const match of sources.matchAll(/\.codex[\\/]hooks[\\/]([\w-]+\.js)/g)) {
          scripts.add(match[1]);
        }
      }
    }
    result.set(event, scripts);
  }
  return result;
}

const { skillFiles, agents } = expectedMirrorState();

if (mode === 'write') {
  rmSync(claudeSkillsRoot, { recursive: true, force: true });
  rmSync(claudeAgentsRoot, { recursive: true, force: true });
  for (const [rel, source] of skillFiles) {
    const target = path.join(claudeSkillsRoot, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source));
  }
  writeFileSync(path.join(claudeSkillsRoot, 'README.md'), skillsReadme);
  mkdirSync(claudeAgentsRoot, { recursive: true });
  for (const agent of agents) {
    writeFileSync(path.join(claudeAgentsRoot, `${agent.kebab}.md`), agent.content);
  }
  const skillCount = new Set([...skillFiles.keys()].map((rel) => rel.split('/')[0])).size;
  console.log(
    `sync-harness: mirrored ${skillCount} skills (${skillFiles.size} files) and ${agents.length} agents into .claude/`
  );
  process.exit(0);
}

// --check
check('.codex/agents directory exists', existsSync(codexAgentsRoot));

let skillMismatches = 0;
for (const [rel, source] of skillFiles) {
  const target = path.join(claudeSkillsRoot, rel);
  if (!existsSync(target)) {
    skillMismatches += 1;
    check(`mirror skill file exists: ${rel}`, false);
  } else if (!normalizedEquals(source, target)) {
    skillMismatches += 1;
    check(`mirror skill file matches canon: ${rel}`, false);
  }
}
check('mirror skills match canon', skillMismatches === 0, `${skillFiles.size} files compared`);

const expectedSkillPaths = new Set([...skillFiles.keys(), 'README.md']);
const orphanSkillFiles = listFilesRecursive(claudeSkillsRoot).filter((rel) => !expectedSkillPaths.has(rel));
check('no orphan files in .claude/skills', orphanSkillFiles.length === 0, orphanSkillFiles.slice(0, 3).join(', '));

for (const agent of agents) {
  const target = path.join(claudeAgentsRoot, `${agent.kebab}.md`);
  const matches = existsSync(target) && readFileSync(target, 'utf8').replaceAll('\r\n', '\n') === agent.content;
  check(`mirror agent matches contract: ${agent.kebab}`, matches);
}
const expectedAgentFiles = new Set(agents.map((agent) => `${agent.kebab}.md`));
const orphanAgentFiles = listFilesRecursive(claudeAgentsRoot).filter((rel) => !expectedAgentFiles.has(rel));
check('no orphan files in .claude/agents', orphanAgentFiles.length === 0, orphanAgentFiles.slice(0, 3).join(', '));

check('.claude/skills README present', existsSync(path.join(claudeSkillsRoot, 'README.md')));

if (existsSync(claudeSettings) && existsSync(codexHooksJson)) {
  const claudeConfig = JSON.parse(readFileSync(claudeSettings, 'utf8'));
  const claudeEvents = hookScriptsByEvent(claudeConfig);
  const codexEvents = hookScriptsByEvent(JSON.parse(readFileSync(codexHooksJson, 'utf8')));
  const allEvents = new Set([...codexEvents.keys(), ...claudeEvents.keys()]);
  for (const event of allEvents) {
    const codexScripts = codexEvents.get(event) || new Set();
    const claudeScripts = claudeEvents.get(event) || new Set();
    const same =
      codexScripts.size === claudeScripts.size && [...codexScripts].every((script) => claudeScripts.has(script));
    check(`hooks parity for ${event}`, same, `codex=[${[...codexScripts]}] claude=[${[...claudeScripts]}]`);
    for (const script of new Set([...codexScripts, ...claudeScripts])) {
      check(`hook script exists: ${script}`, existsSync(path.join(root, '.codex', 'hooks', script)));
    }
  }
  const postToolMatchers = (claudeConfig.hooks?.PostToolUse || []).flatMap((entry) => (entry.matcher || '').split('|'));
  check(
    'PostToolUse matcher covers Edit and Write',
    postToolMatchers.includes('Edit') && postToolMatchers.includes('Write'),
    postToolMatchers.join('|')
  );
} else {
  check('.claude/settings.json exists', existsSync(claudeSettings));
  check('.codex/hooks.json exists', existsSync(codexHooksJson));
}

check('CLAUDE.md imports AGENTS.md', existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').includes('@AGENTS.md'));

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
if (failed > 0) {
  console.error('Run: npm run sync:harness to regenerate the mirror from the canon.');
}
process.exitCode = failed === 0 ? 0 : 1;
