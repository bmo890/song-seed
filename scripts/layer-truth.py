#!/usr/bin/env python3
"""
Layer truth — does a saved layer sit where the song it was played to says it should?

When a layer is recorded with the guide coming out of the speaker, the microphone hears
the guide too: the layer's own file carries a copy of the song. If the layer is placed
right, that copy lines up with the song itself at the layer's stored offset. This script
measures how far it doesn't, in milliseconds, from the audio files alone: it reads no
app timestamp, no latency estimate and no waveform sidecar.

    residual = where the song is heard inside the layer − where the layer claims to be

    residual > 0  →  the layer is LATE: its content plays after the moment it belongs to.
    residual < 0  →  the layer is EARLY.

Layers recorded on headphones carry no copy of the song and report "no bleed"; that is
the honest answer, not a failure.

Usage
-----
    python3 scripts/layer-truth.py                      # every layer in the booted sim
    python3 scripts/layer-truth.py --clip clip-178…     # one take's layers
    python3 scripts/layer-truth.py --base a.m4a --layer b.m4a --offset 26000
    python3 scripts/layer-truth.py --json

Requires ffmpeg and numpy. Grid-truth's sibling (docs/qa/grid-truth.md).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass

import numpy as np

DEFAULT_UDID = "19A51129-C9CF-451D-91CF-AE5BE8DBD932"
DEFAULT_BUNDLE = "com.bmostudio.songnook.dev"

SAMPLE_RATE = 48_000
FRAME_MS = 0.5
"""Envelope hop. Peaks are refined below it by parabolic interpolation."""
SEARCH_MS = 1500.0
"""How far either way to look for the song inside the layer."""
MAX_COMPARE_MS = 30_000.0
"""Enough song to be certain; more only costs time."""


def decode_mono(path: str) -> np.ndarray:
    """Decode the way the iPhone does. Apple's decoders (the app's player, its mixer,
    AVAudioFile) strip AAC encoder priming even from files that carry no edit list;
    ffmpeg does not, and reads such a file 2112 samples (≈48 ms) late. Measuring with
    ffmpeg alone reported every layer on those takes 48 ms off (2026-10-22). So on a
    Mac, convert with afconvert (Core Audio) first; ffmpeg only resamples a WAV."""
    source = path
    tmp = None
    if shutil.which("afconvert") and not path.lower().endswith(".wav"):
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.close()
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEF32", path, tmp.name],
                       capture_output=True, check=True)
        source = tmp.name
    try:
        out = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", source, "-map", "0:a:0",
             "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
            capture_output=True, check=True,
        )
    finally:
        if tmp:
            os.unlink(tmp.name)
    return np.frombuffer(out.stdout, dtype="<f4").astype(np.float64)


def onset_envelope(samples: np.ndarray) -> np.ndarray:
    """Rising edges of high-passed energy at FRAME_MS: what a microphone copy and the
    original share even when the room colours one of them (the same envelope grid-truth
    uses for clicks)."""
    high = np.diff(samples, prepend=samples[:1])
    hop = int(round(SAMPLE_RATE * FRAME_MS / 1000.0))
    usable = (len(high) // hop) * hop
    if usable <= 0:
        return np.zeros(0)
    energy = (high[:usable].reshape(-1, hop) ** 2).sum(axis=1)
    energy = np.log1p(energy * 1e4)
    flux = np.maximum(0.0, np.diff(energy, prepend=energy[:1]))
    flux -= flux.mean()
    norm = np.linalg.norm(flux)
    return flux / norm if norm > 0 else flux


@dataclass
class Result:
    clip: str
    layer: str
    offset_ms: float
    layer_ms: float
    residual_ms: float | None
    confidence: float
    halves_ms: tuple[float | None, float | None]
    verdict: str


def best_lag(layer_env: np.ndarray, base_env: np.ndarray, offset_frames: int, search: int):
    """Lag (frames) at which the layer envelope best matches the base envelope placed at
    the layer's offset, refined to sub-frame; with a peak-to-noise confidence."""
    n = len(layer_env)
    lags = np.arange(-search, search + 1)
    scores = np.full(len(lags), np.nan)
    for i, lag in enumerate(lags):
        start = offset_frames - lag
        lo = max(0, -start)
        hi = min(n, len(base_env) - start)
        if hi - lo < n * 0.5:
            continue
        scores[i] = float(np.dot(layer_env[lo:hi], base_env[start + lo:start + hi]))
    if np.all(np.isnan(scores)):
        return None, 0.0
    k = int(np.nanargmax(scores))
    peak = scores[k]
    refined = float(lags[k])
    if 0 < k < len(scores) - 1 and not np.isnan(scores[k - 1]) and not np.isnan(scores[k + 1]):
        a, b, c = scores[k - 1], peak, scores[k + 1]
        denom = a - 2 * b + c
        if denom != 0:
            refined += 0.5 * (a - c) / denom
    # Noise: everything further than 40ms from the peak.
    far = np.abs(lags - lags[k]) > int(40 / FRAME_MS)
    noise = np.nanstd(scores[far]) if np.any(far) else 0.0
    confidence = float(peak / noise) if noise > 0 else 0.0
    return refined, confidence


def measure(base_path: str, layer_path: str, offset_ms: float, clip="", layer="") -> Result:
    base = onset_envelope(decode_mono(base_path))
    layer_samples = decode_mono(layer_path)
    layer_ms = len(layer_samples) / SAMPLE_RATE * 1000.0
    env = onset_envelope(layer_samples)
    env = env[: int(MAX_COMPARE_MS / FRAME_MS)]
    offset_frames = int(round(offset_ms / FRAME_MS))
    search = int(SEARCH_MS / FRAME_MS)

    lag, confidence = best_lag(env, base, offset_frames, search)
    halves: list[float | None] = []
    half = len(env) // 2
    for part, shift in ((env[:half], 0), (env[half:], half)):
        if len(part) < int(2000 / FRAME_MS):
            halves.append(None)
            continue
        h_lag, h_conf = best_lag(part, base, offset_frames + shift, search)
        halves.append(h_lag * FRAME_MS if h_lag is not None and h_conf >= 6 else None)

    residual = lag * FRAME_MS if lag is not None else None
    if residual is None or confidence < 6:
        verdict = "no bleed"
        residual = None
    elif all(h is not None for h in halves) and abs(halves[0] - halves[1]) > 8:
        verdict = "UNSTABLE"
    elif abs(residual) <= 3:
        verdict = "OK"
    elif abs(residual) <= 10:
        verdict = "close"
    else:
        verdict = "OFF"
    return Result(clip=clip, layer=layer, offset_ms=offset_ms, layer_ms=layer_ms,
                  residual_ms=residual, confidence=confidence,
                  halves_ms=(halves[0], halves[1]), verdict=verdict)


def load_sim_layers(udid: str, bundle: str):
    container = subprocess.run(
        ["xcrun", "simctl", "get_app_container", udid, bundle, "data"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    db = f"{container}/Documents/SQLite/songnook.db"
    rows = subprocess.run(
        ["sqlite3", db, "select value from kv where key like 'songnook-store::ws::%';"],
        capture_output=True, text=True, check=True,
    ).stdout
    found = []
    for line in rows.splitlines():
        try:
            workspace = json.loads(line)
        except json.JSONDecodeError:
            continue
        for idea in workspace.get("ideas", []):
            for clip in idea.get("clips", []):
                stems = (clip.get("overdub") or {}).get("stems") or []
                base = (clip.get("audioUri") or "").replace("file://", "")
                for stem in stems:
                    uri = (stem.get("audioUri") or "").replace("file://", "")
                    if base and uri:
                        found.append({
                            "clip": clip.get("id"), "title": clip.get("title"),
                            "layer": stem.get("title"), "created": stem.get("createdAt") or 0,
                            "base": base, "path": uri, "offset": stem.get("offsetMs") or 0,
                        })
    return sorted(found, key=lambda f: f["created"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base")
    parser.add_argument("--layer")
    parser.add_argument("--offset", type=float, default=0.0)
    parser.add_argument("--clip")
    parser.add_argument("--udid", default=DEFAULT_UDID)
    parser.add_argument("--bundle", default=DEFAULT_BUNDLE)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if args.base or args.layer:
        if not (args.base and args.layer):
            parser.error("--base and --layer go together")
        results = [measure(args.base, args.layer, args.offset)]
    else:
        results = []
        for item in load_sim_layers(args.udid, args.bundle):
            if args.clip and item["clip"] != args.clip:
                continue
            try:
                results.append(measure(item["base"], item["path"], item["offset"],
                                       clip=f'{item["title"]}', layer=item["layer"]))
            except subprocess.CalledProcessError:
                print(f'skipped {item["layer"]}: could not decode', file=sys.stderr)

    if args.json:
        print(json.dumps([asdict(r) for r in results], indent=2))
        return 0
    print(f'{"take":22} {"layer":12} {"offset":>8} {"residual":>9} {"halves":>15} {"conf":>6}  verdict')
    print("─" * 84)
    for r in results:
        res = f"{r.residual_ms:+.1f}ms" if r.residual_ms is not None else "—"
        halves = " / ".join(f"{h:+.0f}" if h is not None else "—" for h in r.halves_ms)
        print(f"{r.clip[:22]:22} {r.layer[:12]:12} {r.offset_ms:8.0f} {res:>9} {halves:>15} "
              f"{r.confidence:6.1f}  {r.verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
