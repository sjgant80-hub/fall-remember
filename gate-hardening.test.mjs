// gate-hardening.test.mjs — the 2026-08-27 re-gate: seven survivors found beyond the argued
// baseline, each pinned here. The kernel is deterministic by design, so pinned outputs are
// legitimate regression law, not brittleness: the same text must embed to the same vector forever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import FallRemember, { embed, address, goldenPos } from './fall-remember.mjs';

test('EMBED — the exact deterministic fingerprint (3- AND 4-grams, every position, every char)', () => {
  // kills: the n<=4 gram-order bound, the i+n<=len last-gram bound, and the charCode loop bound —
  // any of them shifts the vector, and the vector may never shift.
  assert.equal(address(JSON.stringify(embed('sovereign konomi estate'))), '486ea9958c905a0740108c398acdfef8');
});

test('ADDRESS — the exact 128-bit name; the same memory has the same name in every session', () => {
  assert.equal(address('konomi'), 'd4b0354d21b1610baff26bb8a3d6d289');
});

test('GOLDENPOS — the first memory sits at radius 1, angle 0 — never at sqrt(-1)', () => {
  const [x, y] = goldenPos(0);
  assert.equal(x, 1);
  assert.equal(y, 0);
  assert.ok(Number.isFinite(goldenPos(0)[0]), 'i+1 keeps the radius real at i=0');
});

test('BALANCE — cv EXACTLY 0.5 is still balanced (the ceiling is inclusive)', () => {
  const fr = new FallRemember();
  // six chambers holding 1, six holding 3 → mean 2, std 1, cv exactly 0.5
  fr.chambers = Array.from({ length: 12 }, (_, i) => Array.from({ length: i < 6 ? 1 : 3 }, () => ({})));
  const b = fr.balance();
  assert.equal(b.cv, 0.5, 'the crafted fill sits exactly on the boundary');
  assert.equal(b.balanced, true, 'exactly 0.5 is balanced — <= not <');
  const skew = new FallRemember();
  skew.chambers = Array.from({ length: 12 }, (_, i) => Array.from({ length: i === 0 ? 24 : 1 }, () => ({})));
  assert.equal(skew.balance().balanced, false, 'a clumped fill is said to be clumped');
});
