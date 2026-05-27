# ADR 0005: Keep Large Runtime Data Lazy

## Decision

Keep `js/model-data.js` and `<model-viewer>` lazy-loaded.

## Context

3D data is large and not needed for first paint. The current architecture protects initial load and user-driven 3D activation.

## Consequences

Do not add `model-data.js` to static script blocks. Do not eager-load model-viewer to simplify implementation unless the user approves a performance tradeoff.
