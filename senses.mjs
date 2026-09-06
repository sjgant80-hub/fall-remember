// fall-remember · senses.mjs — THE EAR AND THE VOICE: the dodeca goes multimodal.
//
// The honest gap, closed in place: hum (retrieve by melody, key-invariant) and one-ladder
// (one codec, three carriers) existed as separate gated organs but were never wired into
// the memory. Now they are its senses, composing the vendored kernels VERBATIM:
//
//   THE EAR   — every memory already HAS a tune: its melody derives from its content
//               address (hum.addressOf over rec.name), so no schema changes and no
//               opt-in — sing six notes at the dodeca and it finds the memory,
//               whatever key you hummed in (hum's key-invariance, unchanged).
//   THE VOICE — a memory can TRAVEL on a carrier (sound, radio, light — one-ladder's
//               rungs) as framed words, and on arrival it must RE-HASH to the content
//               address it claims. The frame checksum catches noise; the signature
//               catches lies. A carried memory that does not re-hash is REFUSED —
//               tamper-evident across the air, nothing stored.
//
// Pure and total: garbage in → { ok:false, why } (or null where the vendored kernels
// speak that dialect), never a throw mid-song.

import { address } from './fall-remember.mjs';
import { addressOf, digitsToName, nameToDigits, melodyOf, detectMelody, pitchesToDigits } from './hum.mjs';
import { encode, decode, RUNGS, FRAME } from './ladder.mjs';

export const TUNE_LEN = 6;                       // six notes name a memory — hum's own default

const S = (v) => typeof v === 'string' && v.length > 0;

/** THE TUNE — a memory's melody, derived from its content address. Deterministic, universal. */
export function tuneOf(rec) {
  if (!rec || !S(rec.name)) return { ok: false, why: 'a tune belongs to a stored memory — it needs the record with its content address (rec.name)' };
  const digits = addressOf(rec.name, TUNE_LEN);
  return { ok: true, digits, tune: digitsToName(digits), freqs: melodyOf(digits) };
}

/** THE EAR'S INDEX — every memory in the dodeca, with its tune digits. Chambers preserved. */
export function earIndex(store) {
  if (!store || !Array.isArray(store.chambers) || store.chambers.length !== 12)
    return { ok: false, why: 'the ear listens to a dodeca — twelve chambers or nothing' };
  const rows = [];
  for (let c = 0; c < 12; c++) for (const rec of store.chambers[c]) {
    if (rec && S(rec.name)) rows.push({ name: rec.name, digits: addressOf(rec.name, TUNE_LEN), chamber: c, rec });
  }
  return { ok: true, rows };
}

// distance = TUNE_LEN − matches, so an off-by-one loop cannot hide as a no-op iteration
const hamming = (a, b) => { let same = 0; for (let i = 0; i < TUNE_LEN; i++) if (a[i] === b[i]) same++; return TUNE_LEN - same; };

/** nearest memory to a (possibly noisy) digit sequence — hamming over the tune space. */
function nearestRow(rows, digits) {
  let best = null, bd = Infinity;
  for (const r of rows) { const d = hamming(r.digits, digits); if (d < bd) { bd = d; best = r; } }
  return { row: best, distance: bd, confidence: Math.max(0, 1 - bd / TUNE_LEN) };
}

/** RECALL BY TUNE — the syllable name ("nakarala…") finds the memory. */
export function recallByTune(store, tuneName) {
  const idx = earIndex(store);
  if (!idx.ok) return idx;
  if (idx.rows.length === 0) return { ok: false, why: 'an empty dodeca has no songs — store something first' };
  if (!S(tuneName)) return { ok: false, why: 'the ear needs a tune name — syllables, from tuneOf' };
  const n = nearestRow(idx.rows, nameToDigits(tuneName));
  return { ok: true, rec: n.row.rec, chamber: n.row.chamber, distance: n.distance, confidence: n.confidence };
}

/** RECALL BY HUM — six hummed notes, ANY key, find the memory (hum's key-invariance, composed). */
export function recallByHum(store, pcm, sr) {
  const idx = earIndex(store);
  if (!idx.ok) return idx;
  if (idx.rows.length === 0) return { ok: false, why: 'an empty dodeca has no songs — store something first' };
  if (!pcm || typeof pcm.length !== 'number' || pcm.length < TUNE_LEN || !Number.isFinite(sr) || sr <= 0)
    return { ok: false, why: 'the ear needs a real recording — samples and a sample rate' };
  const digits = pitchesToDigits(detectMelody(pcm, sr, TUNE_LEN));
  // pitchesToDigits returns [] when no note is voiced — an all(-1) result is unreachable, so [] is the whole test
  if (!digits.length) return { ok: false, why: 'no melody found in the recording — hum six notes, any key' };
  const n = nearestRow(idx.rows, digits);
  return { ok: true, rec: n.row.rec, chamber: n.row.chamber, distance: n.distance, confidence: n.confidence, digits };
}

// ── THE VOICE — a memory as words on a carrier, signature-verified on arrival ──
// envelope words: [byteLen, addr0..addr3 (the 32-hex content address as 4 uint32s), data words…]

const wordsOfText = (text) => {
  const bytes = new TextEncoder().encode(text);
  const words = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push((((bytes[i] || 0) << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0);
  }
  return { byteLen: bytes.length, words };
};
const textOfWords = (byteLen, words) => {
  const bytes = new Uint8Array(words.length * 4);
  words.forEach((w, i) => { bytes[i * 4] = (w >>> 24) & 255; bytes[i * 4 + 1] = (w >>> 16) & 255; bytes[i * 4 + 2] = (w >>> 8) & 255; bytes[i * 4 + 3] = w & 255; });
  return new TextDecoder().decode(bytes.slice(0, byteLen));
};
const addrWords = (hex32) => [0, 8, 16, 24].map((o) => parseInt(hex32.slice(o, o + 8), 16) >>> 0);
const hexOfAddrWords = (ws) => ws.map((w) => (w >>> 0).toString(16).padStart(8, '0')).join('');

/** CARRY — voice a memory onto a rung. Each word is one checksummed frame on the carrier. */
export function carry(rec, rungName) {
  if (!rec || !S(rec.text)) return { ok: false, why: 'only a memory with text can travel — vectors stay home' };
  const rung = RUNGS[rungName];
  if (!rung) return { ok: false, why: 'unknown rung "' + String(rungName) + '" — the ladder has sound, radio, light' };
  const name = S(rec.name) ? rec.name : address(rec.text + '|' + JSON.stringify(null));
  if (!/^[0-9a-f]{32}$/.test(name)) return { ok: false, why: 'the memory\'s name is not a content address — only signed memories travel' };
  const { byteLen, words } = wordsOfText(rec.text);
  const envelope = [byteLen >>> 0, ...addrWords(name), ...words];
  return { ok: true, rung: rungName, address: name, frames: envelope.map((w) => rung.voice(encode(w))) };
}

/** RECEIVE — hear the frames, decode with the checksum's teeth, then THE DEEPER TEETH:
 *  the reassembled text must re-hash to the carried address, or nothing is stored. */
export function receiveCarried(frames, rungName) {
  const rung = RUNGS[rungName];
  if (!rung) return { ok: false, why: 'unknown rung "' + String(rungName) + '" — the ladder has sound, radio, light' };
  if (!Array.isArray(frames) || frames.length < 5) return { ok: false, why: 'a carried memory is at least five frames — length, four address words, then the text' };
  const words = [];
  for (let i = 0; i < frames.length; i++) {
    const d = decode(rung.hear(frames[i]));
    if (!d.ok) return { ok: false, why: 'frame ' + i + ' broke in flight (' + d.why + ') — the checksum has teeth; nothing stored' };
    words.push(d.n);
  }
  const [byteLen, ...rest] = words;
  const claimed = hexOfAddrWords(rest.slice(0, 4));
  const text = textOfWords(byteLen, rest.slice(4));
  const actual = address(text + '|' + JSON.stringify(null));
  if (actual !== claimed) {
    return { ok: false, why: 'TAMPERED — the carried memory does not re-hash to the address it claims (' + claimed.slice(0, 8) + '… vs ' + actual.slice(0, 8) + '…); the signature has deeper teeth than the checksum; nothing stored' };
  }
  return { ok: true, memory: { text, name: claimed }, frames: frames.length };
}
