'use strict';

const MODEL_RUNTIME_TARGET_MS = 120_000;
const MODEL_RUNTIME_TIMEOUT_MS = 210_000;
const GENERAL_MODEL_TIMEOUT_MS = 30_000;
const MATERIAL_MODES = ['clay', 'xray', 'pbr'];
const KNOWN_EXTERNAL_RUNTIME_NOISE = /(fontshare|cloudflare|jsdelivr)/i;

function classifyModelRuntime(totalMs) {
  if (!Number.isFinite(totalMs) || totalMs < 0) {
    throw new TypeError(`invalid model runtime duration: ${totalMs}`);
  }
  if (totalMs <= MODEL_RUNTIME_TARGET_MS) {
    return { pass: true, label: 'within-target' };
  }
  if (totalMs <= MODEL_RUNTIME_TIMEOUT_MS) {
    return { pass: true, label: 'PERF_WARN' };
  }
  return { pass: false, label: 'FAIL' };
}

function generalModelPlan(generalCaseId, heaviestCaseId) {
  const isHeaviest = generalCaseId === heaviestCaseId;
  return {
    timeoutMs: isHeaviest ? MODEL_RUNTIME_TIMEOUT_MS : GENERAL_MODEL_TIMEOUT_MS,
    stopAutoRotate: isHeaviest
  };
}

function modelRuntimeProblems(outcome) {
  const problems = [];
  const status = outcome.responseStatus;
  if (!Number.isInteger(status) || status < 200 || status > 299) {
    problems.push(`exact GLB response returned HTTP ${status}`);
  }
  if (outcome.ready !== true) problems.push('heaviest model is not ready');

  const states = Array.isArray(outcome.materialStates) ? outcome.materialStates : [];
  const validMaterials =
    states.length === MATERIAL_MODES.length &&
    states.every(
      (state, index) =>
        state &&
        state.expected === MATERIAL_MODES[index] &&
        state.active === MATERIAL_MODES[index] &&
        state.aria === 'true'
    );
  if (!validMaterials) problems.push('invalid Clay/Xray/PBR material state');

  if (Array.isArray(outcome.pageErrors) && outcome.pageErrors.length) {
    problems.push(`page error: ${outcome.pageErrors.join(' | ')}`);
  }
  if (Array.isArray(outcome.consoleErrors) && outcome.consoleErrors.length) {
    problems.push(`console error: ${outcome.consoleErrors.join(' | ')}`);
  }
  if (Number(outcome.contextLosses) > 0) {
    problems.push(`WebGL context lost ${outcome.contextLosses} time(s) during model runtime`);
  }
  if (!classifyModelRuntime(outcome.totalMs).pass) {
    problems.push(`absolute ${MODEL_RUNTIME_TIMEOUT_MS} ms model runtime ceiling exceeded`);
  }
  return problems;
}

function classifyContextLosses(before, lifecycle) {
  const intentionalReleases = (lifecycle.loseContextCalls || []).slice(
    before.loseContextCalls
  );
  const lostEvents = (lifecycle.lostEvents || []).slice(before.lostEvents);
  const intentionalCounts = new Map();
  for (const entry of intentionalReleases) {
    intentionalCounts.set(entry.id, (intentionalCounts.get(entry.id) || 0) + 1);
  }
  const unexpectedLosses = lostEvents.filter((entry) => {
    const remaining = intentionalCounts.get(entry.id) || 0;
    if (remaining <= 0) return true;
    intentionalCounts.set(entry.id, remaining - 1);
    return false;
  });
  const restoredEvents = Math.max(
    0,
    (lifecycle.restoredEvents || []).length - before.restoredEvents
  );
  return {
    intentionalReleases: intentionalReleases.length,
    unexpectedLosses,
    restoredEvents
  };
}

function sameOrigin(value, baseUrl) {
  try {
    return new URL(value).origin === new URL(baseUrl).origin;
  } catch (_error) {
    return false;
  }
}

function consoleErrorForRuntime(messageText, locationUrl, baseUrl) {
  const value = String(messageText || '');
  if (sameOrigin(locationUrl, baseUrl)) return value;
  if (KNOWN_EXTERNAL_RUNTIME_NOISE.test(`${value} ${locationUrl || ''}`)) return null;
  return value;
}

function firstPartyHttpFailure(responseUrl, status, baseUrl) {
  if (!sameOrigin(responseUrl, baseUrl)) return null;
  if (Number.isInteger(status) && status >= 200 && status <= 299) return null;
  let pathname = responseUrl;
  try {
    pathname = new URL(responseUrl).pathname;
  } catch (_error) {
    // sameOrigin already validated the URL; retain the original as a fallback.
  }
  return `first-party HTTP ${status}: ${pathname}`;
}

function withAbsoluteDeadline(
  promise,
  deadlineAt,
  label,
  ceilingMs = MODEL_RUNTIME_TIMEOUT_MS
) {
  if (!Number.isFinite(ceilingMs) || ceilingMs <= 0) {
    throw new TypeError(`invalid model runtime ceiling: ${ceilingMs}`);
  }
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    return Promise.reject(
      new Error(
        `${label}: absolute ${ceilingMs} ms model runtime ceiling exceeded`
      )
    );
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${label}: absolute ${ceilingMs} ms model runtime ceiling exceeded`
        )
      );
    }, remainingMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

module.exports = {
  GENERAL_MODEL_TIMEOUT_MS,
  MODEL_RUNTIME_TARGET_MS,
  MODEL_RUNTIME_TIMEOUT_MS,
  classifyContextLosses,
  classifyModelRuntime,
  consoleErrorForRuntime,
  firstPartyHttpFailure,
  generalModelPlan,
  modelRuntimeProblems,
  withAbsoluteDeadline
};
