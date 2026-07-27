# fall-remember — specification

## Purpose

A sovereign, fold-native memory organ — a 12-chamber dodecahedral store with content-addressed fold-signatures, cube retrieval, and a kappa-gate.

## Contract

- **FallRemember** — part of the fall-remember public surface; deterministic, total (never throws).
- **address** — part of the fall-remember public surface; deterministic, total (never throws).
- **chamber** — part of the fall-remember public surface; deterministic, total (never throws).
- **cosine** — part of the fall-remember public surface; deterministic, total (never throws).
- **default** — part of the fall-remember public surface; deterministic, total (never throws).
- **embed** — part of the fall-remember public surface; deterministic, total (never throws).
- **goldenPos** — part of the fall-remember public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits fall-remember only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.
