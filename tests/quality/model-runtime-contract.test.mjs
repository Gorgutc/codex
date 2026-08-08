import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const contract = require('../../scripts/model-runtime-contract.cjs');

assert.equal(contract.MODEL_RUNTIME_TARGET_MS, 120_000);
assert.equal(contract.MODEL_RUNTIME_TIMEOUT_MS, 210_000);

assert.equal(contract.classifyModelRuntime(120_000).label, 'within-target');
assert.equal(contract.classifyModelRuntime(120_001).label, 'PERF_WARN');
assert.equal(contract.classifyModelRuntime(210_000).label, 'PERF_WARN');
assert.equal(contract.classifyModelRuntime(210_001).label, 'FAIL');

assert.deepEqual(contract.generalModelPlan('light', 'heavy'), {
  timeoutMs: 30_000,
  stopAutoRotate: false
});
assert.deepEqual(contract.generalModelPlan('heavy', 'heavy'), {
  timeoutMs: 210_000,
  stopAutoRotate: true
});

const validOutcome = {
  responseStatus: 200,
  ready: true,
  materialStates: [
    { expected: 'clay', active: 'clay', aria: 'true' },
    { expected: 'xray', active: 'xray', aria: 'true' },
    { expected: 'pbr', active: 'pbr', aria: 'true' }
  ],
  pageErrors: [],
  consoleErrors: [],
  contextLosses: 0,
  totalMs: 120_001
};
assert.deepEqual(contract.modelRuntimeProblems(validOutcome), []);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, responseStatus: 503 })[0], /HTTP 503/);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, ready: false })[0], /not ready/);
assert.match(
  contract.modelRuntimeProblems({
    ...validOutcome,
    materialStates: validOutcome.materialStates.map((state, index) =>
      index === 1 ? { ...state, aria: 'false' } : state)
  })[0],
  /material state/
);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, pageErrors: ['boom'] })[0], /page error/);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, consoleErrors: ['boom'] })[0], /console error/);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, contextLosses: 1 })[0], /context lost/);
assert.match(contract.modelRuntimeProblems({ ...validOutcome, totalMs: 210_001 })[0], /210000 ms/);

const lifecycle = contract.classifyContextLosses(
  { loseContextCalls: 0, lostEvents: 0, restoredEvents: 0 },
  {
    loseContextCalls: [{ id: 1 }],
    lostEvents: [{ id: 1 }, { id: 2 }],
    restoredEvents: []
  }
);
assert.equal(lifecycle.intentionalReleases, 1);
assert.deepEqual(lifecycle.unexpectedLosses, [{ id: 2 }]);

const repeatedLoss = contract.classifyContextLosses(
  { loseContextCalls: 0, lostEvents: 0, restoredEvents: 0 },
  {
    loseContextCalls: [{ id: 7 }],
    lostEvents: [{ id: 7 }, { id: 7 }],
    restoredEvents: []
  }
);
assert.deepEqual(repeatedLoss.unexpectedLosses, [{ id: 7 }]);

const localBase = 'http://127.0.0.1:43210';
assert.equal(
  contract.consoleErrorForRuntime(
    'Failed to load resource: the server responded with a status of 404',
    `${localBase}/js/vendor/missing-loader.js`,
    localBase
  ),
  'Failed to load resource: the server responded with a status of 404'
);
assert.equal(
  contract.consoleErrorForRuntime(
    'Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID',
    'https://api.fontshare.com/v2/css',
    localBase
  ),
  null
);
assert.equal(
  contract.firstPartyHttpFailure(`${localBase}/assets/missing.hdr`, 404, localBase),
  'first-party HTTP 404: /assets/missing.hdr'
);
assert.equal(
  contract.firstPartyHttpFailure('https://api.fontshare.com/v2/css', 404, localBase),
  null
);

await assert.rejects(
  contract.withAbsoluteDeadline(new Promise(() => {}), Date.now() + 10, 'unit-test'),
  /unit-test.*absolute 210000 ms model runtime ceiling exceeded/
);
await assert.rejects(
  contract.withAbsoluteDeadline(Promise.resolve(), Date.now() - 1, 'generic-test', 30_000),
  /generic-test.*absolute 30000 ms model runtime ceiling exceeded/
);

console.log('model runtime contract boundaries and failure modes pass');
