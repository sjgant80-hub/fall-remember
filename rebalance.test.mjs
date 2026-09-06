// rebalance.test.mjs — the prescribed pass, falsifiable. Load-bearing: ROUTING BIAS is
// detected and fixed (a shared corpus direction dragging every memory to one chamber →
// centered routing spreads by difference), the HONESTY LAW refuses a cosmetic shuffle
// (already-balanced and no-shared-direction corpora), the center PERSISTS through JSON,
// new stores route by the same centered law, and exact recall is UNTOUCHED — chambers are
// structure, cosine is truth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import FallRemember, { AXES, chamber, DIM } from './fall-remember.mjs';

let seed = 6180;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const noiseVec = () => Array.from({ length: DIM }, () => rnd() - 0.5);
const plus = (a, b, wb) => a.map((x, i) => x + wb * b[i]);

// a corpus with one loud shared direction (axis 10) and quiet individual differences
const biased = (n) => {
  const s = new FallRemember();
  for (let i = 0; i < n; i++) {
    const rec = s.store({ id: 'm' + i, vector: plus(AXES[10].map((x) => x * 10), noiseVec(), 1) });
    assert.ok(rec, 'the fixture must store');
  }
  return s;
};

test('ROUTING BIAS — detected, fixed, and the books shown: before/after/moved', () => {
  const s = biased(120);
  const before = s.balance();
  assert.equal(before.distribution[chamber(AXES[10])], 120, 'the shared direction drags EVERY memory into one chamber');
  const r = s.rebalance();
  assert.ok(r.ok, 'a real bias is fixable: ' + (r.why || ''));
  assert.equal(r.before.distribution[chamber(AXES[10])], 120);
  assert.ok(r.after.cv <= r.before.cv * 0.85, 'the 15% bar was genuinely cleared: ' + r.before.cv.toFixed(2) + ' → ' + r.after.cv.toFixed(2));
  assert.ok(r.moved >= 60, 'a real rebalance moves memories — ' + r.moved + ' of 120');
  assert.equal(s.chambers.flat().length, 120, 'no memory lost in the move');
  assert.deepEqual(s.balance().distribution, r.after.distribution, 'the reported after IS the standing state');
  for (let c = 0; c < 12; c++) for (const rec of s.chambers[c]) assert.equal(rec.chamber, c, 'every record\'s chamber field matches where it lives');
});

test('THE HONESTY LAW — a cosmetic shuffle is refused; the why carries both cvs', () => {
  // an already-spread corpus: ten memories per axis direction, no shared pull
  const even = new FallRemember();
  for (let a = 0; a < 12; a++) for (let i = 0; i < 10; i++) {
    even.store({ id: 'e' + a + '-' + i, vector: plus(AXES[a].map((x) => x * 10), noiseVec(), 0.5) });
  }
  const r = even.rebalance();
  assert.equal(r.ok, false, 'balance that already holds is not surgery material');
  assert.match(r.why, /balance already holds \(cv \d+\.\d{3}\) — there is nothing to fix/);
  assert.equal(even.center, null, 'a refused pass changes NOTHING');
  // and the RELATIVE clause: unbalanced but centering barely helps → the cosmetic refusal speaks.
  // two loud groups of very different size share no single mean direction that fixes them.
  const twoLoud = new FallRemember();
  for (let i = 0; i < 90; i++) twoLoud.store({ id: 'a' + i, vector: plus(AXES[10].map((x) => x * 30), noiseVec(), 0.05) });
  for (let i = 0; i < 6; i++) twoLoud.store({ id: 'b' + i, vector: plus(AXES[3].map((x) => x * 30), noiseVec(), 0.05) });
  const r2 = twoLoud.rebalance();
  if (!r2.ok) {
    assert.match(r2.why, /does not materially improve balance \(cv \d+\.\d{3} → \d+\.\d{3}\)|balance already holds/);
    assert.equal(twoLoud.center, null, 'the relative refusal is also a no-op');
  } else {
    assert.ok(r2.after.cv <= r2.before.cv * 0.85, 'if it DID pass, the bar was genuinely cleared');
  }
  // and a corpus too small to judge — but EXACTLY 24 is enough (the floor is below, not at)
  const tiny = biased(20);
  assert.match(tiny.rebalance().why, /too few memories to judge balance/);
  const exactly24 = biased(24);
  const r24 = exactly24.rebalance();
  assert.ok(!(r24.why || '').includes('too few'), 'twenty-four memories ARE two per chamber — judged, not refused');
  assert.ok(r24.ok, 'and this biased 24 genuinely rebalances');
});

test('AFTER THE PASS — new stores route by difference; the near-mean fallback holds', () => {
  const s = biased(120);
  assert.ok(s.rebalance().ok);
  // a new memory = the same loud bias + a clear individual note toward axis 3
  const rec = s.store({ id: 'fresh', vector: plus(AXES[10].map((x) => x * 10), AXES[3], 2) });
  assert.equal(rec.chamber, chamber(AXES[3]), 'routed by what makes it DIFFERENT, not by the shared shout');
  // a memory that IS the crowd (≈ the center) falls back to raw routing, never degenerates
  const crowd = s.store({ id: 'crowd', vector: s.center.slice() });
  assert.ok(crowd, 'the crowd-memory still stores');
  assert.equal(crowd.chamber, chamber(s.center), 'too close to the mean → raw routing, honestly');
});

test('PERSISTENCE — the center survives JSON; a restored store routes identically', () => {
  const s = biased(120);
  assert.ok(s.rebalance().ok);
  const back = FallRemember.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(back.center, s.center, 'the center is part of the memory, not a mood');
  assert.deepEqual(back.balance(), s.balance());
  const v = plus(AXES[10].map((x) => x * 10), AXES[5], 2);
  assert.equal(back.store({ id: 'p1', vector: v.slice() }).chamber, s.store({ id: 'p2', vector: v.slice() }).chamber,
    'restored and original route the same vector to the same chamber');
  const fresh = FallRemember.fromJSON({ v: 1, chambers: Array.from({ length: 12 }, () => []) });
  assert.equal(fresh.center, null, 'no center in the JSON, no center in the store');
});

test('RECALL UNTOUCHED — chambers are structure, cosine is truth: exact retrieve identical', () => {
  const a = biased(120);
  const q = plus(AXES[10].map((x) => x * 10), noiseVec(), 1);
  const beforeHit = a.retrieve(q.slice(), { k: 3 });
  assert.ok(a.rebalance().ok);
  const afterHit = a.retrieve(q.slice(), { k: 3 });
  assert.equal(afterHit.center.name, beforeHit.center.name, 'the same memory answers before and after the pass');
  assert.equal(afterHit.score, beforeHit.score, 'the same score — the pass moved shelves, not meaning');
  // and pruned probes follow the centered law well enough to find a distinct memory
  const s = biased(120);
  s.store({ id: 'target', vector: plus(AXES[10].map((x) => x * 10), AXES[7], 3) });
  assert.ok(s.rebalance().ok);
  const probe = s.retrieve(plus(AXES[10].map((x) => x * 10), AXES[7], 3), { k: 2, exact: false, probes: 1 });
  assert.equal(probe.center.name, 'target', 'probe selection follows the same centered routing as store()');
});

test('THE FUZZ — 40 corpora: total, no memory ever lost, refused passes change nothing', () => {
  for (let t = 0; t < 40; t++) {
    const s = new FallRemember();
    const n = 30 + Math.floor(rnd() * 60);
    const loud = AXES[Math.floor(rnd() * 12)];
    const w = rnd() * 12;
    for (let i = 0; i < n; i++) s.store({ id: 't' + i, vector: plus(loud.map((x) => x * w), noiseVec(), 1) });
    const beforeJson = JSON.stringify(s.toJSON());
    const r = s.rebalance();
    assert.equal(typeof r.ok, 'boolean', 'total');
    assert.equal(s.chambers.flat().length, n, 'no memory lost, pass or refuse');
    if (!r.ok) assert.equal(JSON.stringify(s.toJSON()), beforeJson, 'a refusal is a no-op, always');
    else assert.ok(s.balance().cv <= r.before.cv, 'an accepted pass never worsens the books');
  }
});
