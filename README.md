# fall-remember

A sovereign, fold-native memory organ — a 12-chamber dodecahedral store with content-addressed fold-signatures, cube retrieval, and a kappa-gate.

## What it is

fall-remember is a deterministic, zero-dependency estate tool. A sovereign, fold-native memory organ — a 12-chamber dodecahedral store with content-addressed fold-signatures, cube retrieval, and a kappa-gate. It never throws on hostile input and
produces the same result on every machine.

## API

- `FallRemember`
- `address`
- `chamber`
- `cosine`
- `default`
- `embed`
- `goldenPos`

## Verify

```bash
npm test
```

Every source line is guarded by a test (mutation-checked with witness). Structure and behaviour are gated by
konomify before this build joins the mesh.

## License

MIT © 2026 sjgant80-hub

## The senses — multimodal recall, wired in

`senses.mjs` composes two other gated organs verbatim ([hum](https://github.com/sjgant80-hub/hum),
[one-ladder](https://github.com/sjgant80-hub/one-ladder)) into the dodeca:

- **THE EAR** — every memory already *has* a tune: six notes derived from its content
  address. `recallByHum(store, pcm, sr)` finds a memory from a hummed melody, **whatever
  key it was hummed in** (hum's key-invariance, composed and re-proven here at 220/330/180 Hz).
  `recallByTune(store, "nakarala…")` does the same from the syllable name.
- **THE VOICE** — a memory can *travel*: `carry(rec, 'sound'|'radio'|'light')` frames it
  on any of one-ladder's carriers, and `receiveCarried()` re-hashes the text against the
  address it claims. The frame checksum catches noise; **the signature catches lies** — a
  crafted checksum-passing forgery is still refused (tested, not promised). A memory sung
  into another dodeca keeps its identity.

Gated like everything else: 32/33 mutants killed, 1 reviewed-equivalent argued in
`senses.baseline.json` (the hamming tie — either tie member IS a nearest match).
