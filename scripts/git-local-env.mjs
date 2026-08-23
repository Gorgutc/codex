import { execFileSync } from 'node:child_process';

const GIT_LOCAL_ENV_VARS = execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
})
  .trim()
  .split('\n')
  .filter(Boolean);

export function sanitizedGitEnv(requestedEnv) {
  const env = { ...process.env, ...requestedEnv };
  GIT_LOCAL_ENV_VARS.forEach((name) => delete env[name]);
  return env;
}
