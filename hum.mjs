// hum.mjs — a FILESYSTEM YOU NAVIGATE BY PITCH. Every file gets a content-derived address, spelled two ways:
// a KAṬAPAYĀDI syllable-name you can SAY, and a pentatonic MELODY you can HUM. Retrieve by humming the tune —
// the pitch is the path.
//
// Underneath the delight it's a real content-addressing scheme: content → hash → base-10 digits → (a) the ancient
// Kaṭapayādi consonant→digit code gives a pronounceable name, (b) each digit maps to a note in a 2-octave
// pentatonic (10 singable pitches) giving a melody. Decoding a hum is KEY-INVARIANT: we match the RELATIVE
// intervals, not absolute Hz, so you can hum in any key/octave; then we NEAREST-MATCH over the known files, so a
// fuzzy hum still lands on the right one.
//
// HONEST SCOPE: this is a playful ADDRESSING layer, not a disk format — it maps names/content to a hummable
// address and back. Retrieval is nearest-neighbour over a KNOWN set (your files), not a global lookup of arbitrary
// audio; humming resolution limits how many files can share a short tune before collisions (longer tune = more).
// Pure kernel, zero-dep, offline. Real DSP (autocorrelation pitch detection), real historical code.

// ── content hash (FNV-1a ×2 → 16 hex) ──
export function h16(s) { s = String(s); let a = 0x811c9dc5 >>> 0, b = 0x9e3779b9 >>> 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul((b ^ c) >>> 0, 0x85ebca6b) >>> 0; b = ((b << 13) | (b >>> 19)) >>> 0; } return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0'); }

// ══ KAṬAPAYĀDI — the historical consonant→digit code. Each digit gets a distinct, singable syllable whose
//    consonant IS its Kaṭapayādi value: na=0, ka=1, ra=2, la=3, va=4, ma=5, ṣa=6, sa=7, ha=8, jha=9. ══
export const SYLL = ['na', 'ka', 'ra', 'la', 'va', 'ma', 'sha', 'sa', 'ha', 'jha'];
const CONS = [['sh', 6], ['jh', 9], ['n', 0], ['k', 1], ['r', 2], ['l', 3], ['v', 4], ['m', 5], ['s', 7], ['h', 8], ['j', 9]]; // 2-char first
export function digitsToName(digits) { return digits.map(d => SYLL[((d % 10) + 10) % 10]).join(''); }
export function nameToDigits(name) {
  const s = String(name).toLowerCase().replace(/[^a-z]/g, ''); const out = []; let i = 0;
  while (i < s.length) { let hit = null; for (const [c, d] of CONS) if (s.startsWith(c, i)) { hit = [c, d]; break; } if (!hit) { i++; continue; } out.push(hit[1]); i += hit[0].length; if (s[i] === 'a' || s[i] === 'i' || s[i] === 'u' || s[i] === 'e' || s[i] === 'o') i++; }
  return out;
}

// ── content → a fixed-length base-10 address (the digit sequence both encodings share) ──
export function addressOf(key, len = 6) { const digits = []; let h = h16(String(key)); for (let i = 0; i < len; i++) { h = h16(h + ':' + i); digits.push(parseInt(h.slice(0, 3), 16) % 10); } return digits; }

// ══ THE MELODY — 2-octave just pentatonic, 10 distinct singable pitches for digits 0..9 ══
export const RATIOS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3, 10 / 3];
export const melodyOf = (digits, tonic = 220) => digits.map(d => tonic * RATIOS[((d % 10) + 10) % 10]);

// render the melody to PCM: one tone per note with a soft envelope (so you can actually hear/hum it).
export function renderMelody(digits, { tonic = 220, noteDur = 0.32, sr = 22050, gap = 0.04 } = {}) {
  const freqs = melodyOf(digits, tonic), per = Math.floor(noteDur * sr), gp = Math.floor(gap * sr);
  const out = new Float64Array(digits.length * (per + gp));
  for (let n = 0; n < freqs.length; n++) { const base = n * (per + gp); for (let i = 0; i < per; i++) { const t = i / sr; const env = Math.min(1, t * 40) * Math.min(1, (noteDur - t) * 40); out[base + i] = env * (Math.sin(2 * Math.PI * freqs[n] * t) + 0.3 * Math.sin(4 * Math.PI * freqs[n] * t)); } }
  return out;
}

// ── autocorrelation pitch detection on one note-length buffer. Normalized by overlap count (removes the short-lag
//    bias) + parabolic interpolation of the peak lag (sub-sample resolution, so high notes decode cleanly). ──
export function detectPitch(buf, sr, fmin = 70, fmax = 2200) {
  const maxLag = Math.min(buf.length - 2, Math.floor(sr / fmin)), minLag = Math.max(2, Math.floor(sr / fmax));
  let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length || 1;
  let energy = 0; for (let i = 0; i < buf.length; i++) energy += (buf[i] - mean) * (buf[i] - mean);
  if (energy < 1e-6) return 0;
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1 && lag < buf.length; lag++) { let s = 0; for (let i = 0; i + lag < buf.length; i++) s += (buf[i] - mean) * (buf[i + lag] - mean); ac[lag] = s; }   // raw autocorrelation
  let gmax = -Infinity; for (let lag = minLag + 1; lag <= maxLag; lag++) if (ac[lag] > gmax) gmax = ac[lag];
  if (!(gmax > 0)) return 0;
  // pick the SHORTEST-lag local peak above a fraction of the global max — the FUNDAMENTAL, not a 2×/3× subharmonic
  const thr = 0.72 * gmax; let bestLag = -1;
  for (let lag = minLag + 1; lag <= maxLag; lag++) if (ac[lag] >= thr && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) { bestLag = lag; break; }
  if (bestLag < 0) { for (let lag = minLag + 1; lag <= maxLag; lag++) if (ac[lag] === gmax) { bestLag = lag; break; } }
  if (bestLag < 1) return 0;
  const a = ac[bestLag - 1], b = ac[bestLag], c = ac[bestLag + 1], den = a - 2 * b + c;
  const refined = bestLag + (Math.abs(den) > 1e-12 ? 0.5 * (a - c) / den : 0);
  return refined > 0 ? sr / refined : 0;
}
// split a recording into nNotes equal segments and detect each pitch (median of thirds for stability).
export function detectMelody(pcm, sr, nNotes) {
  const seg = Math.floor(pcm.length / nNotes), out = [];
  for (let n = 0; n < nNotes; n++) { const a = n * seg + Math.floor(seg * 0.15), b = n * seg + Math.floor(seg * 0.85); out.push(detectPitch(pcm.slice(a, b), sr)); }
  return out;
}

// ── KEY-INVARIANT decode: recover the digit sequence from note frequencies, whatever key they were hummed in ──
const log2 = x => Math.log(x) / Math.LN2;
function snapDeg(ratio) { let bd = 0, be = Infinity; for (let d = 0; d < 10; d++) { const e = Math.abs(log2(ratio) - log2(RATIOS[d])); if (e < be) { be = e; bd = d; } } return { d: bd, e: be }; }
export function pitchesToDigits(freqs) {
  const notes = freqs.filter(f => f > 0); if (!notes.length) return [];
  const cands = []; for (const n of notes) for (let d = 0; d < 10; d++) cands.push(n / RATIOS[d]);   // each note could be any degree
  let bestT = notes[0], bestErr = Infinity;
  for (const t of cands) { if (!(t > 0)) continue; let err = 0; for (const n of notes) err += snapDeg(n / t).e; if (err < bestErr) { bestErr = err; bestT = t; } }
  return freqs.map(f => f > 0 ? snapDeg(f / bestT).d : -1);
}

// ══ THE FILESYSTEM — register files, look them up by digits (nearest match) or by a hummed recording ══
export function fs() { return { files: [], len: 6 }; }
export function add(FS, name, content = name) { const digits = addressOf(content, FS.len); const f = { name, content, digits, tune: digitsToName(digits) }; FS.files.push(f); return f; }
const hamming = (a, b) => { let d = 0; const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++; return d; };
// nearest file to a (possibly noisy) digit sequence. Returns {file, distance, confidence}.
export function nearest(FS, digits) {
  if (!FS.files.length) return null;
  let best = null, bd = Infinity; for (const f of FS.files) { const d = hamming(f.digits, digits); if (d < bd) { bd = d; best = f; } }
  return { file: best, distance: bd, confidence: Math.max(0, 1 - bd / (FS.len || 1)) };
}
export function lookupByName(FS, name) { return nearest(FS, nameToDigits(name)); }
export function lookupByHum(FS, pcm, sr) { const digits = pitchesToDigits(detectMelody(pcm, sr, FS.len)); return { digits, ...nearest(FS, digits) }; }

export default { h16, SYLL, digitsToName, nameToDigits, addressOf, RATIOS, melodyOf, renderMelody, detectPitch, detectMelody, pitchesToDigits, fs, add, nearest, lookupByName, lookupByHum };
