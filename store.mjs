// fall-remember · store.mjs — the durable STORE under the dodeca. fall-remember's own header
// already said the intent: "single object, JSON-serialisable to one file (SQLite/IndexedDB is
// just the envelope)." This is that file's envelope law — the tamper-evident wrapper around a
// compressed snapshot, so a memory file the user keeps on their own disk can be trusted on the
// way back in, not just written on the way out.
//
// REUSE, NOT REBUILD, checked directly before writing a line of this:
//   · toJSON()/fromJSON() already exist on FallRemember (confirmed by reading the class, not
//     assumed) — this is the SHAPE. This file does not touch them.
//   · address() already exists (FNV-1a×4+fmix, 128-bit, deterministic, "no crypto needed") — this
//     IS the integrity hash. Reused verbatim, not reimplemented with sha256 or anything else.
//   · geometric-computer's fold.mjs primorial subset/residue codec (foldSubset/foldResidues) is a
//     BOUNDED 7-dimensional encoder — a divisor of 510510, at most ~19 bits — and does not apply
//     to arbitrary-size record text/vectors; using it as "the compression" for a memory file would
//     be dishonest, so it is not used that way here. What genuinely DOES apply, and IS reused: the
//     Mersenne-127 shield (shielded/verifyShield) — "a cheap corruption guard" by its own doc
//     comment — layered under the full address() check as a fast pre-check, the same two-teeth
//     shape fall-remember's own senses.mjs already established (checksum catches noise fast, the
//     fuller check catches deliberate tampering).
//   · Real byte-size compression is a SEPARATE, honest concern from either of the above — that is
//     disk.mjs's job (CompressionStream, a real W3C standard, identical in Node and every evergreen
//     browser), kept out of this file on purpose: this file is pure and total, compression is I/O.
//
// Pure and total: garbage in -> { ok:false, why }, never a throw. No I/O, no clock (createdAt is
// passed in by the caller, same discipline as every receipt-sealing function in this estate).

import { address } from './fall-remember.mjs';
import { shielded, verifyShield } from './fold.mjs';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isInt = (v) => Number.isInteger(v) && v >= 0;

export const KIND = 'fall-remember-snapshot';
export const VERSION = 1;

function shieldOf(addr) {
  // shield() takes an integer; derive one from the first 32 bits of the 128-bit address hex —
  // deterministic, and independent enough of the full check to be worth a second look (a tamper
  // that only patches the trailing hex of addr would still usually flip these leading bits too,
  // but the real defence is that BOTH checks must pass, not that either alone is unbeatable).
  return shielded(parseInt(addr.slice(0, 8), 16));
}

/**
 * sealEnvelope({ json, compressedB64, createdAt }) — json: the exact string that was compressed
 * (fall-remember's toJSON(), JSON.stringify'd). compressedB64: the base64 of the REAL compressed
 * bytes (disk.mjs's job to produce — this function never compresses anything itself). Returns the
 * tamper-evident envelope ready to write to one file.
 */
export function sealEnvelope(input) {
  const { json, compressedB64, createdAt } = isObj(input) ? input : {};
  if (!isStr(json)) return { ok: false, why: 'the envelope needs the exact JSON string that was compressed' };
  if (!isStr(compressedB64)) return { ok: false, why: 'the envelope needs the compressed payload, base64-encoded' };
  if (!isStr(createdAt)) return { ok: false, why: 'the envelope needs a createdAt timestamp' };
  const addr = address(json);
  const shield = shieldOf(addr);
  return {
    ok: true,
    envelope: {
      v: VERSION,
      kind: KIND,
      createdAt,
      addr,
      shield,
      rawBytes: json.length,
      compressedBytes: compressedB64.length,
      compressed: compressedB64,
    },
  };
}

/**
 * openEnvelope(envelope, decompressedJson) — decompressedJson: what disk.mjs got back out after
 * decompressing envelope.compressed (this function never decompresses anything itself). Verifies
 * BOTH teeth: the shield (cheap, fast) and the full address (the real check) must agree with what
 * the decompressed bytes actually hash to — never trusts the envelope's own claim about itself.
 */
export function openEnvelope(envelope, decompressedJson) {
  const e = isObj(envelope) ? envelope : null;
  if (!e) return { ok: false, why: 'not a snapshot envelope' };
  if (e.kind !== KIND) return { ok: false, why: `not a ${KIND} envelope` };
  if (e.v !== VERSION) return { ok: false, why: `unknown snapshot version ${String(e.v)}` };
  if (!isStr(e.addr)) return { ok: false, why: 'the envelope carries no address' };
  if (!isObj(e.shield)) return { ok: false, why: 'the envelope carries no shield' };
  if (!isInt(e.rawBytes)) return { ok: false, why: 'the envelope carries no rawBytes count' };
  if (!isStr(decompressedJson)) return { ok: false, why: 'nothing was decompressed to check against the envelope' };

  const realAddr = address(decompressedJson);
  if (!verifyShield(e.shield)) return { ok: true, valid: false, why: 'the shield itself is malformed — refused before the full check even runs' };
  const shieldNow = shieldOf(realAddr);
  if (shieldNow.chk !== e.shield.chk) return { ok: true, valid: false, why: 'the shield does not match the decompressed bytes — corruption caught by the cheap check first' };
  if (realAddr !== e.addr) return { ok: true, valid: false, why: 'the decompressed bytes do not match the envelope\'s address — tampered or corrupted after it was written' };
  if (decompressedJson.length !== e.rawBytes) return { ok: true, valid: false, why: 'the decompressed length does not match what was sealed' };
  return { ok: true, valid: true, why: 'snapshot intact — both the shield and the full address agree with the decompressed bytes' };
}

/**
 * parseSnapshotFile(raw) — raw: whatever JSON.parse produced from a file the user picked. Refuses
 * anything that isn't shaped like a real envelope before disk.mjs ever tries to decompress it —
 * a malformed file should never reach the decompressor at all.
 */
export function parseSnapshotFile(raw) {
  if (!isObj(raw)) return { ok: false, why: 'not a fall-remember snapshot file (not an object)' };
  if (raw.kind !== KIND) return { ok: false, why: `not a ${KIND} file` };
  if (raw.v !== VERSION) return { ok: false, why: `unsupported snapshot version ${String(raw.v)}` };
  if (!isStr(raw.compressed)) return { ok: false, why: 'the file carries no compressed payload' };
  return { ok: true, envelope: raw };
}
