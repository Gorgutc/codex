import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const contract = require('../../scripts/model-runtime-contract.cjs');

assert.equal(contract.MODEL_RUNTIME_TARGET_MS, 120_000);
assert.equal(contract.MODEL_RUNTIME_PHASE_TIMEOUT_MS, 120_000);
assert.equal(contract.MODEL_RUNTIME_WATCHDOG_MS, 360_000);

assert.equal(contract.classifyModelRuntime(120_000).label, 'within-target');
assert.equal(contract.classifyModelRuntime(120_001).label, 'PERF_WARN');
assert.equal(contract.classifyModelRuntime(360_000).label, 'PERF_WARN');
assert.equal(contract.classifyModelRuntime(360_001).label, 'FAIL');

assert.deepEqual(contract.generalModelPlan('light', 'heavy'), {
  timeoutMs: 30_000,
  stopAutoRotate: false
});
assert.deepEqual(contract.generalModelPlan('heavy', 'heavy'), {
  timeoutMs: 120_000,
  stopAutoRotate: true
});

assert.deepEqual(contract.modelRuntimePhasePlan(1_000, 361_000), {
  deadlineAt: 121_000,
  timeoutMs: 120_000,
  kind: 'phase'
});
assert.deepEqual(contract.modelRuntimePhasePlan(300_000, 361_000), {
  deadlineAt: 361_000,
  timeoutMs: 360_000,
  kind: 'watchdog'
});

assert.deepEqual(
  contract.lightweightPaginationPlan(
    ['heavy', 'light-a', 'light-b'],
    'light-b',
    'heavy',
    9
  ),
  {
    startId: 'light-b',
    directions: ['prev', 'next', 'prev', 'next', 'prev', 'next', 'prev', 'next', 'prev'],
    targetIds: ['light-a', 'light-b', 'light-a', 'light-b', 'light-a', 'light-b', 'light-a', 'light-b', 'light-a'],
    finalId: 'light-a'
  }
);
assert.equal(
  contract.lightweightPaginationPlan(['heavy', 'light'], 'light', 'heavy', 9),
  null
);

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
assert.deepEqual(contract.modelRuntimeProblems({ ...validOutcome, totalMs: 300_000 }), []);
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
assert.match(contract.modelRuntimeProblems({ ...validOutcome, totalMs: 360_001 })[0], /360000 ms/);

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
  contract.withAbsoluteDeadline(
    new Promise(() => {}),
    Date.now() + 10,
    'watchdog-test',
    contract.MODEL_RUNTIME_WATCHDOG_MS
  ),
  /watchdog-test.*absolute 360000 ms deadline exceeded/
);
await assert.rejects(
  contract.withAbsoluteDeadline(
    new Promise(() => {}),
    Date.now() + 10,
    'phase-test',
    contract.MODEL_RUNTIME_PHASE_TIMEOUT_MS
  ),
  /phase-test.*absolute 120000 ms deadline exceeded/
);
await assert.rejects(
  contract.withAbsoluteDeadline(Promise.resolve(), Date.now() - 1, 'generic-test', 30_000),
  /generic-test.*absolute 30000 ms deadline exceeded/
);

await assert.rejects(
  contract.withAbsoluteDeadline(() => {
    const blockedUntil = Date.now() + 20;
    while (Date.now() < blockedUntil) {
      // Deliberately block past the deadline to prove the post-factory guard.
    }
    return Promise.resolve('too late');
  }, Date.now() + 5, 'blocked-factory-test', 30_000),
  /blocked-factory-test.*absolute 30000 ms deadline exceeded/
);

await assert.rejects(
  contract.withAbsoluteDeadline(
    new Promise(resolve => {
      setTimeout(() => {
        const blockedUntil = Date.now() + 20;
        while (Date.now() < blockedUntil) {
          // Make fulfillment win the microtask race after the deadline.
        }
        resolve('too late');
      }, 0);
    }),
    Date.now() + 5,
    'late-fulfillment-test',
    30_000
  ),
  /late-fulfillment-test.*absolute 30000 ms deadline exceeded/
);

await assert.rejects(
  contract.withAbsoluteDeadline(
    Promise.reject(new Error('page.click: Timeout 20ms exceeded')),
    Date.now() + 1_000,
    'material-pbr phase: pbr material click',
    contract.MODEL_RUNTIME_PHASE_TIMEOUT_MS
  ),
  /material-pbr phase: pbr material click: page\.click: Timeout 20ms exceeded/
);

let expiredFactoryCalls = 0;
await assert.rejects(
  contract.withAbsoluteDeadline(() => {
    expiredFactoryCalls += 1;
    return Promise.resolve();
  }, Date.now() - 1, 'lazy-test', 30_000),
  /lazy-test.*absolute 30000 ms deadline exceeded/
);
assert.equal(expiredFactoryCalls, 0);

let rejectLateOperation;
const lateOperation = new Promise((_, reject) => {
  rejectLateOperation = reject;
});
let lateUnhandled = null;
const onUnhandled = reason => {
  lateUnhandled = reason;
};
process.on('unhandledRejection', onUnhandled);
try {
  await assert.rejects(
    contract.withAbsoluteDeadline(lateOperation, Date.now() - 1, 'late-test', 30_000),
    /late-test.*absolute 30000 ms deadline exceeded/
  );
  rejectLateOperation(new Error('late underlying rejection'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lateUnhandled, null);
} finally {
  process.removeListener('unhandledRejection', onUnhandled);
}

let rejectAggregateChild;
const aggregateChild = new Promise((_, reject) => {
  rejectAggregateChild = reject;
});
const alreadyObservedAggregate = Promise.all([
  aggregateChild,
  Promise.reject(new Error('second aggregate rejection')),
  Promise.reject(new Error('third aggregate rejection'))
]);
let aggregateUnhandled = null;
const onAggregateUnhandled = reason => {
  aggregateUnhandled = reason;
};
process.on('unhandledRejection', onAggregateUnhandled);
try {
  await assert.rejects(
    contract.withAbsoluteDeadline(
      alreadyObservedAggregate,
      Date.now() - 1,
      'aggregate-test',
      30_000
    ),
    /aggregate-test.*absolute 30000 ms deadline exceeded/
  );
  rejectAggregateChild(new Error('late aggregate child rejection'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(aggregateUnhandled, null);
} finally {
  process.removeListener('unhandledRejection', onAggregateUnhandled);
}

console.log('model runtime contract boundaries and failure modes pass');
