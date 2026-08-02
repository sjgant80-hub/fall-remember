import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FallRemember, embed, chamber, address, cosine, goldenPos, DODECA, KAPPA } from './fall-remember.mjs';
import { cv } from './cam.mjs';

test('the dodeca graph is 12 chambers, each bordering exactly 5, symmetric', () => {
  assert.equal(DODECA.length, 12);
  for (let c = 0; c < 12; c++) {
    assert.equal(DODECA[c].length, 5, `chamber ${c} borders 5`);
    for (const nb of DODECA[c]) assert.ok(DODECA[nb].includes(c), `adjacency ${c}-${nb} is symmetric`);
  }
});

test('address is a deterministic 128-bit content hash', () => {
  assert.match(address('quantum'), /^[0-9a-f]{32}$/);
  assert.equal(address('quantum'), address('quantum'));
  assert.notEqual(address('quantum'), address('quantom'));
});

test('embed is deterministic, normalised, and separates topics', () => {
  const a = embed('quantum photon entangle'), b = embed('quantum photon qubit'), c = embed('garlic simmer broth');
  assert.equal(embed('quantum photon entangle').join(','), a.join(','), 'deterministic');
  assert.ok(Math.abs(a.reduce((s, x) => s + x * x, 0) - 1) < 1e-9, 'unit norm');
  assert.ok(cosine(a, b) > cosine(a, c), 'same-topic vectors are nearer than cross-topic');
});

test('chamber routing is deterministic and in range', () => {
  const v = embed('quantum photon entangle');
  assert.equal(chamber(v), chamber(v));
  assert.ok(chamber(v) >= 0 && chamber(v) < 12);
});

test('store returns a placed record; a degenerate (empty) memory is rejected at write', () => {
  const s = new FallRemember();
  const r = s.store({ text: 'proton neutron isotope nucleus', meta: { topic: 5 } });
  assert.ok(r && r.chamber >= 0 && r.chamber < 12);
  assert.match(r.name, /^[0-9a-f]{32}$/);
  assert.equal(s.size, 1);
  assert.equal(s.store({ text: '' }), null, 'empty memory is degenerate — not stored');
  assert.equal(s.size, 1);
});

test('retrieve returns a CUBE (focal + ≤8 context), focal = highest cosine, same topic', () => {
  const s = new FallRemember();
  for (let i = 0; i < 15; i++) s.store({ text: `cello sonata octave timbre run ${i}`, meta: { topic: 9 } });
  for (let i = 0; i < 15; i++) s.store({ text: `firewall packet subnet router run ${i}`, meta: { topic: 8 } });
  const cube = s.retrieve('cello sonata timbre');
  assert.ok(cube.center && cube.center.meta.topic === 9, 'focal is the right topic');
  assert.ok(cube.corners.length > 0 && cube.corners.length <= 8, '≤ 8 corners');
  // focal must be at least as close as any corner
  const qv = embed('cello sonata timbre');
  for (const c of cube.corners) assert.ok(cosine(qv, cube.center.vector) >= cosine(qv, c.vector));
});

test('exact retrieval scans all 12 chambers; local pruning scans fewer', () => {
  const s = new FallRemember();
  for (let t = 0; t < 12; t++) for (let i = 0; i < 6; i++) s.store({ text: `topic${t} word alpha beta ${i}`, meta: { topic: t } });
  assert.equal(s.retrieve('topic3 word alpha', { exact: true }).chambersSearched, 12);
  assert.ok(s.retrieve('topic3 word alpha', { exact: false, probes: 1 }).chambersSearched < 12);
});

test('κ-gate: a memory whose signature fails the validator is never retrieved', () => {
  const s = new FallRemember();
  s.store({ text: 'vaccine antibody pathogen immunity', sig: { drift: true }, meta: { topic: 11 } });
  s.store({ text: 'vaccine antibody antigen serology', meta: { topic: 11 } });
  const reject = () => ({ valid: false });
  const cube = s.retrieve('vaccine antibody', { validate: reject });
  const names = [cube.center, ...cube.corners].filter(Boolean);
  assert.ok(names.every((r) => !r.sig), 'the signed-but-drifted memory is κ-gated out');
});

test('traverse walks the pentagon edge-graph', () => {
  const s = new FallRemember();
  assert.deepEqual(s.traverse(0, 1).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]); // self + 5 neighbours
  assert.ok(s.traverse(0, 2).length > 6, 'two hops reach further');
});

test('persistence round-trips through a single JSON blob', () => {
  const s = new FallRemember();
  for (let i = 0; i < 10; i++) s.store({ text: `glacier moraine crevasse ${i}`, meta: { topic: 3 } });
  const blob = JSON.parse(JSON.stringify(s.toJSON()));
  const back = FallRemember.fromJSON(blob);
  assert.equal(back.size, s.size);
  assert.equal(back.retrieve('glacier moraine').center.meta.topic, 3);
});

test('balance(): the-cam golden-angle balance diagnostic, wired into fall-remember', () => {
  assert.equal(cv([3, 3, 3]), 0);                          // an even fill → CV 0 (the-cam metric)
  assert.ok(cv([0, 0, 9]) > 0.5);                          // clumped → high CV
  const s = new FallRemember();
  for (let t = 0; t < 12; t++) for (let i = 0; i < 6; i++) s.store({ text: `theme${t} alpha beta gamma ${i}` });
  const b = s.balance();
  assert.deepEqual(b.distribution, s.distribution());      // reports the REAL chamber fill
  assert.equal(b.cv, cv(s.distribution()));                // = the-cam CV of that fill (pins the wire exactly)
  assert.equal(b.balanced, b.cv <= 0.5);                   // the ≤0.5 verdict
  assert.equal(new FallRemember().balance().cv, 0);        // empty memory → CV 0 (no throw)
});

test('KAPPA is 1/φ', () => { assert.ok(Math.abs(KAPPA - 0.6180339887) < 1e-9); });
