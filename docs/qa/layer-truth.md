# Layer truth — does a saved layer sit where the song says it should?

**Instrument:** `scripts/layer-truth.py` · **Requires:** `ffmpeg`, `numpy` (and `afconvert`, on any Mac)

A layer recorded with the guide coming out of the speaker carries a copy of the song: the
microphone heard it. If the layer is placed right, that copy lines up with the song at the
layer's stored offset. The script measures how far it doesn't, from the audio files alone.

```bash
python3 scripts/layer-truth.py                  # every layer in the booted simulator
python3 scripts/layer-truth.py --base a.m4a --layer b.m4a --offset 26000
```

| Column | Means |
| --- | --- |
| `residual` | ms the layer is **late** (negative: early). OK ≤ 3 ms. |
| `halves` | The same measurement on each half of the layer. They must agree, or the number is not a constant offset. |
| `conf` | How far the match stands above every other lag. Under ~6 there is no song in the layer (recorded on headphones): "no bleed", the honest answer. |

**Decode like the phone.** Apple's decoders strip AAC encoder priming (2112 samples, ≈48 ms)
even from a file with no edit list; ffmpeg does not. Both scripts convert with `afconvert`
first, so a file reads as the app plays it. Without that, takes recorded by a path that writes
no edit list read 48 ms late and every layer on them looks 48 ms early.

Takes the app records carry the edit list. Imported files keep whatever their source wrote
(import copies them as they are); many voice-recorder exports have none. Whether Android's
player strips the priming on such a file is unchecked (see RUN-LOG, 2026-10-22).

The app runs the same measurement after every layer save (`domain/layerAlignment.ts`,
`services/layerSelfAlignment.ts`) and moves the layer when both halves agree.
