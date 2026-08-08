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

function lightweightPaginationPlan(orderedIds, startId, heaviestId, switchCount = 9) {
  if (!Array.isArray(orderedIds) || !Number.isInteger(switchCount) || switchCount <= 0) {
    throw new TypeError('invalid lightweight pagination inputs');
  }
  const startIndex = orderedIds.indexOf(startId);
  if (orderedIds.length < 3 || startIndex < 0 || startId === heaviestId) return null;

  const candidates = [
    { direction: 'next', opposite: 'prev', index: (startIndex + 1) % orderedIds.length },
    { direction: 'prev', opposite: 'next', index: (startIndex - 1 + orderedIds.length) % orderedIds.length }
  ];
  const neighbor = candidates.find(candidate => {
    const id = orderedIds[candidate.index];
    return id !== startId && id !== heaviestId;
  });
  if (!neighbor) return null;

  const directions = Array.from(
    { length: switchCount },
    (_, index) => index % 2 === 0 ? neighbor.direction : neighbor.opposite
  );
  let cursor = startIndex;
  const targetIds = directions.map(direction => {
    cursor = direction === 'next'
      ? (cursor + 1) % orderedIds.length
      : (cursor - 1 + orderedIds.length) % orderedIds.length;
    return orderedIds[cursor];
  });
  if (targetIds.some(id => id === heaviestId)) return null;
  return {
    startId,
    directions,
    targetIds,
    finalId: targetIds[targetIds.length - 1]
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
  operation,
  deadlineAt,
  label,
  ceilingMs = MODEL_RUNTIME_TIMEOUT_MS
) {
  if (!Number.isFinite(ceilingMs) || ceilingMs <= 0) {
    throw new TypeError(`invalid model runtime ceiling: ${ceilingMs}`);
  }
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    if (typeof operation !== 'function') {
      Promise.resolve(operation).catch(() => {});
    }
    return Promise.reject(
      new Error(
        `${label}: absolute ${ceilingMs} ms model runtime ceiling exceeded`
      )
    );
  }

  let observed;
  try {
    observed = Promise.resolve(
      typeof operation === 'function' ? operation() : operation
    );
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${label}: absolute ${ceilingMs} ms model runtime ceiling exceeded`
        )
      );
    }, remainingMs);
    observed.then(
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
  lightweightPaginationPlan,
  modelRuntimeProblems,
  withAbsoluteDeadline
};
