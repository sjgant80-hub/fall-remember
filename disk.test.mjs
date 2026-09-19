import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipCompress, gzipDecompress, makeSnapshot, restoreSnapshot, hasFileSystemAccess } from './disk.mjs';
import { FallRemember } from './fall-remember.mjs';

// ---- real compression, run not assumed ----

test('gzipCompress/gzipDecompress: a real string round-trips byte-exact, and is actually smaller compressed', async () => {
  const text = 'the dodeca remembers · '.repeat(80);
  const compressed = await gzipCompress(text);
  assert.ok(compressed.length < text.length, `compressed (${compressed.length}) should beat raw (${text.length}) on repetitive text`);
  const restored = await gzipDecompress(compressed);
  assert.equal(restored, text);
});

test('gzipCompress/gzipDecompress: round-trips an empty string, unicode, and a large record dump', async () => {
  for (const text of ['', '🜁 sovereign · κ=0.618 · 日本語', JSON.stringify({ chambers: Array.from({ length: 12 }, (_, i) => Array.from({ length: 30 }, (_, j) => ({ name: `rec-${i}-${j}`, text: `memory number ${i}-${j}` }))) })]) {
    const restored = await gzipDecompress(await gzipCompress(text));
    assert.equal(restored, text);
  }
});

test('gzipDecompress genuinely throws on corrupt bytes (not silently returns garbage) — caught by restoreSnapshot, tested there', async () => {
  await assert.rejects(() => gzipDecompress('bm90LWdlbnVpbmUtZ3ppcA==')); // valid base64, NOT valid gzip
});

// ---- makeSnapshot / restoreSnapshot: the real E2E round trip on a REAL FallRemember instance ----

function realMemory() {
  const fr = new FallRemember();
  fr.store({ text: 'decided: sovereign is the through-line' });
  fr.store({ text: 'the estate converges before it sprawls' });
  fr.store({ text: 'a receipt that can say LOSES is the trust primitive' });
  return fr;
}

test('makeSnapshot -> restoreSnapshot: a real FallRemember instance round-trips intact, verified valid', async () => {
  const fr = realMemory();
  const made = await makeSnapshot(fr.toJSON());
  assert.equal(made.ok, true, JSON.stringify(made));
  const restored = await restoreSnapshot(made.envelope);
  assert.equal(restored.ok, true);
  assert.equal(restored.valid, true);
  const fr2 = FallRemember.fromJSON(restored.state);
  assert.equal(fr2.size, fr.size);
  // compare against fr's OWN JSON round-trip (not fr directly) — JSON.stringify drops a key whose
  // value is undefined (sig, here), which is a universal JSON property, not something the disk
  // path lost; normalising both sides the same way isolates whether the DISK path itself is lossy.
  assert.deepEqual(fr2.chambers, JSON.parse(JSON.stringify(fr.chambers)));
});

test('restoreSnapshot catches a tampered compressed payload — a REAL swap, not a hand-picked field edit', async () => {
  const frA = realMemory();
  const frB = new FallRemember(); frB.store({ text: 'a completely different memory' });
  const madeA = await makeSnapshot(frA.toJSON());
  const madeB = await makeSnapshot(frB.toJSON());
  const swapped = { ...madeA.envelope, compressed: madeB.envelope.compressed }; // A's envelope, B's real compressed bytes
  const restored = await restoreSnapshot(swapped);
  assert.equal(restored.ok, true);
  assert.equal(restored.valid, false);
});

test('restoreSnapshot refuses a file that is not JSON-shaped, and a genuinely corrupt compressed field, without throwing', async () => {
  assert.equal((await restoreSnapshot(null)).ok, false);
  assert.equal((await restoreSnapshot({ kind: 'not-this' })).ok, false);
  const made = await makeSnapshot({ hello: 'world' });
  const corrupt = { ...made.envelope, compressed: 'bm90LWdlbnVpbmUtZ3ppcA==' };
  const r = await restoreSnapshot(corrupt);
  assert.equal(r.ok, false);
  assert.match(r.why, /will not decompress/);
});

test('makeSnapshot refuses non-serialisable state honestly instead of throwing or silently dropping data', async () => {
  const circular = {}; circular.self = circular;
  const r = await makeSnapshot(circular);
  assert.equal(r.ok, false);
});

// ---- capability detection ----

test('hasFileSystemAccess is honest in an environment with no window — no false capability claim', () => {
  assert.equal(hasFileSystemAccess(), false);
});
