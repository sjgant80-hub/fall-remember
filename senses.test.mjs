// senses.test.mjs — the ear and the voice, falsifiable. Load-bearing: every memory has a
// deterministic tune from its content address; recall-by-hum is KEY-INVARIANT end to end
// (hummed at 220 or 330, same memory found); a memory survives all three carriers exactly
// (multi-byte UTF-8 included); the checksum catches noise and the SIGNATURE catches lies —
// a checksum-passing forgery is still refused because it does not re-hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import FallRemember, { address } from './fall-remember.mjs';
import { renderMelody, addressOf } from './hum.mjs';
import { encode, decode, RUNGS } from './ladder.mjs';
import { TUNE_LEN, tuneOf, earIndex, recallByTune, recallByHum, carry, receiveCarried } from './senses.mjs';

const seeded = () => {
  const s = new FallRemember();
  s.store({ text: 'the mutation gate rings like a bell when the suite is clean' });
  s.store({ text: 'golden angle placement keeps the twelve chambers balanced' });
  s.store({ text: 'a carried memory must re-hash to the address it claims ◊' });
  return s;
};

test('THE TUNE — deterministic, derived from the content address, no schema change', () => {
  const s = seeded();
  const rec = s.chambers.flat()[0];
  const t1 = tuneOf(rec), t2 = tuneOf(rec);
  assert.ok(t1.ok);
  assert.deepEqual(t1, t2, 'same memory, same tune, forever');
  assert.equal(t1.digits.length, TUNE_LEN);
  assert.equal(TUNE_LEN, 6, 'six notes name a memory');
  assert.deepEqual(t1.digits, addressOf(rec.name, 6), 'the tune IS the content address, sung');
  assert.equal(t1.freqs.length, 6);
  assert.match(tuneOf(null).why, /needs the record with its content address/);
  assert.match(tuneOf({ text: 'no name' }).why, /content address/);
});

test('THE EAR INDEX — twelve chambers or nothing; every stored memory is singable', () => {
  const s = seeded();
  const idx = earIndex(s);
  assert.ok(idx.ok);
  assert.equal(idx.rows.length, 3);
  assert.ok(idx.rows.every((r) => r.digits.length === 6 && r.chamber >= 0 && r.chamber < 12));
  assert.match(earIndex(null).why, /twelve chambers or nothing/);
  assert.match(earIndex({ chambers: [[], []] }).why, /twelve chambers or nothing/);
  // smuggled garbage in a chamber is SKIPPED, never thrown on, never indexed
  const dirty = seeded();
  dirty.chambers[0].push(null);
  dirty.chambers[1].push({ text: 'nameless' });
  const idx2 = earIndex(dirty);
  assert.ok(idx2.ok);
  assert.equal(idx2.rows.length, 3, 'a null and a nameless record are invisible to the ear — not errors, not rows');
});

test('RECALL BY TUNE — the syllable name finds the memory; noise degrades confidence honestly', () => {
  const s = seeded();
  const rec = s.chambers.flat()[1];
  const t = tuneOf(rec);
  const hit = recallByTune(s, t.tune);
  assert.ok(hit.ok);
  assert.equal(hit.rec.name, rec.name, 'the tune round-trips to its own memory');
  assert.equal(hit.distance, 0);
  assert.equal(hit.confidence, 1);
  // one wrong syllable still finds it, confidence drops by exactly one sixth
  const noisy = (t.tune.slice(0, 2) === 'na' ? 'ka' : 'na') + t.tune.slice(2);
  const near = recallByTune(s, noisy);
  assert.equal(near.rec.name, rec.name, 'hamming-nearest absorbs one bad note');
  assert.ok(Math.abs(near.confidence - 5 / 6) < 1e-12);
  assert.match(recallByTune(new FallRemember(), 'nakara').why, /empty dodeca has no songs/);
  assert.match(recallByTune(s, '').why, /needs a tune name/);
});

test('RECALL BY HUM — KEY-INVARIANT end to end: 220 and 330 find the same memory', () => {
  const s = seeded();
  const rec = s.chambers.flat()[2];
  const t = tuneOf(rec);
  for (const tonic of [220, 330, 180]) {
    const pcm = renderMelody(t.digits, { tonic });
    const hit = recallByHum(s, pcm, 22050);
    assert.ok(hit.ok, 'tonic ' + tonic + ' must be heard');
    assert.equal(hit.rec.name, rec.name, 'hummed at ' + tonic + ' Hz — same memory (key-invariance composed)');
    assert.equal(hit.distance, 0, 'a clean hum lands exactly');
  }
  assert.match(recallByHum(s, null, 22050).why, /needs a real recording/);
  assert.match(recallByHum(s, new Float32Array(4), 22050).why, /needs a real recording/);
  assert.match(recallByHum(s, new Float32Array(22050), 0).why, /needs a real recording/);
  const silence = new Float32Array(22050 * 2);
  assert.match(recallByHum(s, silence, 22050).why, /no melody found/, 'silence is not a song');
  // the length floor is EXACT: 6 samples is absurd audio but not a shape refusal — it fails
  // as "no melody", never as "needs a real recording" (< not <=)
  assert.match(recallByHum(s, new Float32Array(TUNE_LEN), 22050).why, /no melody found/);
});

test('THE VOICE — a memory travels every rung exactly, multi-byte UTF-8 included', () => {
  const s = seeded();
  const rec = s.chambers.flat().find((r) => r.text.includes('◊'));
  for (const rung of ['sound', 'radio', 'light']) {
    const c = carry(rec, rung);
    assert.ok(c.ok, rung + ' must carry');
    assert.equal(c.address, rec.name);
    const got = receiveCarried(c.frames, rung);
    assert.ok(got.ok, rung + ' must deliver: ' + (got.why || ''));
    assert.equal(got.memory.text, rec.text, 'byte-exact across ' + rung + ' — the ◊ survives');
    assert.equal(got.memory.name, rec.name, 'the address travelled with it');
    // and the received memory stores straight into a SECOND dodeca
    const other = new FallRemember();
    const stored = other.store({ text: got.memory.text });
    assert.equal(stored.name, rec.name, 'a memory sung into another dodeca keeps its identity');
  }
  assert.match(carry({ text: '' }, 'sound').why, /only a memory with text can travel/);
  assert.match(carry(rec, 'quantum').why, /the ladder has sound, radio, light/);
  assert.match(carry({ text: 'x', name: 'not-a-hash' }, 'sound').why, /only signed memories travel/);
  // frame count is EXACT: an 8-byte text is 1 length + 4 address + 2 data frames, never a padder more
  const eight = seeded().store({ text: 'abcdefgh' });
  assert.equal(carry(eight, 'sound').frames.length, 7, 'no phantom frame on a 4-byte boundary');
  // a zero-byte envelope that SIGNS correctly is exactly five frames — and it is accepted
  const emptyAddr = address('' + '|' + JSON.stringify(null));
  const addrWords = [0, 8, 16, 24].map((o) => parseInt(emptyAddr.slice(o, o + 8), 16) >>> 0);
  const five = [0, ...addrWords].map((w) => RUNGS.sound.voice(encode(w)));
  const fiveGot = receiveCarried(five, 'sound');
  assert.ok(fiveGot.ok, 'exactly five valid frames are enough — the floor is below 5, not at it');
  assert.equal(fiveGot.memory.text, '');
});

test('THE TEETH — checksum catches noise; the SIGNATURE catches a checksum-passing forgery', () => {
  const s = seeded();
  const rec = s.chambers.flat()[0];
  const c = carry(rec, 'radio');
  // noise: corrupt one symbol of one frame → that frame's checksum breaks
  const noisy = c.frames.map((f) => f.slice());
  noisy[2][3] = noisy[2][3] + 140; // shift one FSK bin
  const n = receiveCarried(noisy, 'radio');
  assert.equal(n.ok, false);
  assert.match(n.why, /frame 2 broke in flight \(checksum\)/);
  // forgery: flip TWO nibbles of a data word so the xor checksum CANCELS — decode passes,
  // the text changes, and the signature refuses. Frame 5 = first text word.
  const forged = c.frames.map((f) => f.slice());
  const heard = RUNGS.radio.hear(forged[5]);
  assert.ok(decode(heard).ok, 'sanity: the frame decodes before forging');
  const pattern = heard.slice();
  pattern[1] = pattern[1] ^ 0x3; pattern[2] = pattern[2] ^ 0x3; // xor-cancelling pair
  assert.ok(decode(pattern).ok, 'the forgery PASSES the checksum — this is the attack');
  forged[5] = RUNGS.radio.voice(pattern);
  const f = receiveCarried(forged, 'radio');
  assert.equal(f.ok, false, 'and the signature still refuses it');
  assert.match(f.why, /TAMPERED — the carried memory does not re-hash/);
  assert.match(f.why, /deeper teeth/);
  // garbage totality
  assert.match(receiveCarried(null, 'sound').why, /at least five frames/);
  assert.match(receiveCarried([[1], [2]], 'sound').why, /at least five frames/);
  assert.match(receiveCarried(c.frames, 'x').why, /the ladder has/);
});

test('THE FUZZ — 60 random memories: tune deterministic, every rung round-trips, no throw', () => {
  let seed = 6180;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const words = ['gate', 'bell', 'chamber', 'golden', 'signal', 'fold', 'κ', '◊', 'memory', 'sings'];
  for (let t = 0; t < 60; t++) {
    const text = Array.from({ length: 3 + Math.floor(rnd() * 8) }, () => words[Math.floor(rnd() * words.length)]).join(' ');
    const s = new FallRemember();
    const rec = s.store({ text });
    assert.deepEqual(tuneOf(rec), tuneOf(rec));
    const rung = ['sound', 'radio', 'light'][Math.floor(rnd() * 3)];
    const c = carry(rec, rung);
    const got = receiveCarried(c.frames, rung);
    assert.ok(got.ok && got.memory.text === text, 'round-trip exact on ' + rung);
    const bad = receiveCarried(c.frames.map((f) => (rnd() > 0.5 ? f : [7])), rung);
    assert.equal(typeof bad.ok, 'boolean', 'garbage frames never throw');
  }
});
