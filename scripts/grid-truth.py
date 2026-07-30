#!/usr/bin/env python3
"""
Grid truth — does the stored beat grid land on the beat that was actually recorded?

This is the instrument the whole timing effort is judged by. It does not read the app's
waveform sidecar, does not call any app code, and does not trust any timestamp the app
wrote. It decodes the SAVED AUDIO FILE to samples, finds where the metronome clicks
actually are, and compares that to the grid the app stored beside the file.

    error = grid_line_time - click_time      (milliseconds)

    error > 0  →  the grid line sits AFTER the click: "the recorded beat is just before
                  the grid marker" — the grid is LATE.
    error < 0  →  the grid line sits BEFORE the click: the grid is EARLY.

Resolution is ~1ms — roughly 20× finer than the 2048-bin sidecar the app aligns against,
which is what makes this an independent check rather than a restatement.

Usage
-----
    python3 scripts/grid-truth.py                     # every click take in the booted sim
    python3 scripts/grid-truth.py --clip clip-1785…   # one take
    python3 scripts/grid-truth.py --audio a.m4a --bpm 92 --downbeat 15
    python3 scripts/grid-truth.py --json              # machine-readable

Requires ffmpeg and numpy.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, asdict

import numpy as np

DEFAULT_UDID = "19A51129-C9CF-451D-91CF-AE5BE8DBD932"
DEFAULT_BUNDLE = "com.bmostudio.songnook.dev"

SAMPLE_RATE = 48_000
FRAME_MS = 1.0
"""Onset envelope hop. 1ms is the resolution of every number this script prints."""
COMB_STEP_MS = 0.5
"""Phase search step for the coarse pass — finer than the envelope, so the parabolic
   refinement has something to work with."""
MIN_BEATS = 6
SEARCH_WINDOW_MS = 60.0
"""How far either side of a predicted beat to look for that beat's click."""


# ─────────────────────────────────────────────────────────────── audio → onsets ──

def decode_mono(path: str) -> np.ndarray:
    """Decode to mono float32 at SAMPLE_RATE. ffmpeg honours the container's edit list,
    so AAC encoder priming is already stripped — the same t=0 a DAW would see."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-map", "0:a:0",
         "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True, check=True,
    )
    return np.frombuffer(out.stdout, dtype="<f4").astype(np.float64)


def onset_envelope(samples: np.ndarray) -> np.ndarray:
    """Positive spectral-ish flux at FRAME_MS resolution.

    A metronome click is a short broadband transient, so a first difference (a crude but
    very cheap high-pass) followed by framed energy makes it stand far above sung or played
    material, which is comparatively low-frequency and slow to rise. Taking the POSITIVE
    difference of that energy — the rising edge — is what makes this measure ONSETS rather
    than loudness: a beat is where a sound starts, not where it is loudest.
    """
    high = np.diff(samples, prepend=samples[:1])
    hop = int(round(SAMPLE_RATE * FRAME_MS / 1000.0))
    usable = (len(high) // hop) * hop
    if usable <= 0:
        return np.zeros(0)
    energy = (high[:usable] ** 2).reshape(-1, hop).sum(axis=1)
    energy = np.sqrt(energy)
    flux = np.diff(energy, prepend=energy[:1])
    return np.maximum(0.0, flux)


# ─────────────────────────────────────────────────────────────────── measuring ──

def comb_phase(flux: np.ndarray, beat_ms: float, start_ms: float, end_ms: float):
    """Best click phase in [0, beat_ms), plus its contrast over the median phase."""
    phases = np.arange(0.0, beat_ms, COMB_STEP_MS)
    scores = np.empty_like(phases)
    for index, phase in enumerate(phases):
        times = np.arange(phase, end_ms, beat_ms)
        times = times[times >= start_ms]
        frames = np.rint(times / FRAME_MS).astype(int)
        frames = frames[(frames >= 0) & (frames < len(flux))]
        scores[index] = flux[frames].mean() if len(frames) else 0.0

    if not np.any(scores > 0):
        return None
    best = int(np.argmax(scores))
    median = float(np.median(scores))
    if median <= 0:
        return None

    previous, peak, following = (
        scores[(best - 1) % len(scores)], scores[best], scores[(best + 1) % len(scores)]
    )
    denominator = previous - 2 * peak + following
    shift = 0.5 * (previous - following) / denominator if denominator else 0.0
    refined = (phases[best] + np.clip(shift, -1, 1) * COMB_STEP_MS) % beat_ms
    return float(refined), float(peak / median)


def click_at(flux: np.ndarray, predicted_ms: float) -> float | None:
    """The strongest onset within SEARCH_WINDOW_MS of `predicted_ms`, in ms."""
    low = int(round((predicted_ms - SEARCH_WINDOW_MS) / FRAME_MS))
    high = int(round((predicted_ms + SEARCH_WINDOW_MS) / FRAME_MS))
    low, high = max(0, low), min(len(flux), high)
    if high - low < 3:
        return None
    window = flux[low:high]
    if not np.any(window > 0):
        return None
    peak = int(np.argmax(window))
    # Parabolic interpolation across the peak frame — sub-frame, so the answer is not
    # quantised to the 1ms envelope.
    if 0 < peak < len(window) - 1:
        a, b, c = window[peak - 1], window[peak], window[peak + 1]
        denominator = a - 2 * b + c
        offset = 0.5 * (a - c) / denominator if denominator else 0.0
        offset = float(np.clip(offset, -1, 1))
    else:
        offset = 0.0
    return (low + peak + offset) * FRAME_MS


@dataclass
class Verdict:
    clip: str
    audio: str
    bpm: float
    stored_downbeat_ms: float | None
    duration_ms: float
    beats_found: int
    contrast: float
    median_error_ms: float
    p90_abs_error_ms: float
    spread_ms: float
    drift_ms_per_min: float
    verdict: str
    note: str = ""


def measure(clip_id: str, audio_path: str, bpm: float, downbeat_ms: float | None) -> Verdict:
    samples = decode_mono(audio_path)
    duration_ms = len(samples) / SAMPLE_RATE * 1000.0
    flux = onset_envelope(samples)
    beat_ms = 60_000.0 / bpm

    blank = Verdict(clip_id, audio_path, bpm, downbeat_ms, duration_ms, 0, 0.0,
                    float("nan"), float("nan"), float("nan"), float("nan"), "NO DATA")
    if duration_ms / beat_ms < MIN_BEATS:
        blank.note = "too short"
        return blank

    combed = comb_phase(flux, beat_ms, 0.0, duration_ms)
    if combed is None:
        blank.note = "no periodic onsets"
        return blank
    measured_phase, contrast = combed

    # Per-beat error against the STORED grid, so drift shows up as well as offset.
    # A missing downbeat means the app claimed nothing; measure the phase anyway and
    # report it as the offset from zero, which is what the app would have to stamp.
    grid_phase = (downbeat_ms % beat_ms) if downbeat_ms is not None else 0.0
    errors: list[tuple[float, float]] = []
    time_ms = measured_phase
    while time_ms < duration_ms:
        found = click_at(flux, time_ms)
        if found is not None:
            beats_from_start = round((found - grid_phase) / beat_ms)
            grid_line = grid_phase + beats_from_start * beat_ms
            errors.append((found, grid_line - found))
        time_ms += beat_ms

    if len(errors) < MIN_BEATS:
        blank.contrast = contrast
        blank.note = "clicks not resolvable beat by beat"
        return blank

    positions = np.array([e[0] for e in errors])
    deltas = np.array([e[1] for e in errors])
    # Errors are only meaningful modulo a beat; centre them so a whole-beat ambiguity in
    # the numbering cannot masquerade as a huge offset.
    deltas = (deltas + beat_ms / 2) % beat_ms - beat_ms / 2

    median_error = float(np.median(deltas))
    spread = float(np.percentile(deltas, 75) - np.percentile(deltas, 25))
    p90 = float(np.percentile(np.abs(deltas - median_error), 90))
    slope = float(np.polyfit(positions, deltas, 1)[0]) if len(positions) > 3 else 0.0
    drift = slope * 60_000.0

    if contrast < 1.5:
        verdict = "NO CLICK"
    elif abs(median_error) <= 10 and abs(drift) <= 20:
        verdict = "ON THE GRID"
    elif abs(median_error) <= 30:
        verdict = "CLOSE"
    else:
        verdict = "OFF"

    return Verdict(
        clip=clip_id, audio=audio_path, bpm=bpm, stored_downbeat_ms=downbeat_ms,
        duration_ms=duration_ms, beats_found=len(errors), contrast=contrast,
        median_error_ms=median_error, p90_abs_error_ms=p90, spread_ms=spread,
        drift_ms_per_min=drift, verdict=verdict,
    )


# ─────────────────────────────────────────────────────────────────── the store ──

def load_sim_clips(udid: str, bundle: str):
    container = subprocess.run(
        ["xcrun", "simctl", "get_app_container", udid, bundle, "data"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    db = f"{container}/Documents/SQLite/songnook.db"
    rows = subprocess.run(
        ["sqlite3", db, "select value from kv where key like 'songnook-store::ws::%';"],
        capture_output=True, text=True, check=True,
    ).stdout

    clips = []
    for line in rows.splitlines():
        if not line.strip():
            continue
        try:
            workspace = json.loads(line)
        except json.JSONDecodeError:
            continue
        for idea in workspace.get("ideas", []):
            for clip in idea.get("clips", []):
                grid = clip.get("recordingGrid")
                if not grid or not grid.get("clickThroughTake"):
                    continue
                if grid.get("tempoMap") and len(grid["tempoMap"].get("segments", [])) > 1:
                    continue  # one phase cannot describe a tempo change
                uri = clip.get("audioUri") or ""
                clips.append({
                    "id": clip.get("id"),
                    "path": uri.replace("file://", ""),
                    "bpm": grid.get("bpm"),
                    "downbeat": grid.get("firstDownbeatMs"),
                })
    return clips


# ─────────────────────────────────────────────────────────────────────── main ──

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio")
    parser.add_argument("--bpm", type=float)
    parser.add_argument("--downbeat", type=float, default=0.0)
    parser.add_argument("--clip")
    parser.add_argument("--udid", default=DEFAULT_UDID)
    parser.add_argument("--bundle", default=DEFAULT_BUNDLE)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if args.audio:
        if not args.bpm:
            parser.error("--audio needs --bpm")
        targets = [{"id": args.audio.rsplit("/", 1)[-1], "path": args.audio,
                    "bpm": args.bpm, "downbeat": args.downbeat}]
    else:
        targets = load_sim_clips(args.udid, args.bundle)
        if args.clip:
            targets = [t for t in targets if t["id"] == args.clip]

    if not targets:
        print("No click takes found.", file=sys.stderr)
        return 1

    verdicts = []
    for target in targets:
        if not target["bpm"]:
            continue
        try:
            verdicts.append(measure(target["id"], target["path"], target["bpm"], target["downbeat"]))
        except subprocess.CalledProcessError:
            print(f"  ! could not decode {target['path']}", file=sys.stderr)

    if args.json:
        print(json.dumps([asdict(v) for v in verdicts], indent=2))
        return 0

    print()
    print(f"{'take':<24}{'bpm':>5}{'beats':>7}{'contrast':>10}"
          f"{'error':>10}{'±p90':>8}{'drift/min':>11}  verdict")
    print("─" * 96)
    for v in verdicts:
        error = "—" if np.isnan(v.median_error_ms) else f"{v.median_error_ms:+.1f}ms"
        p90 = "—" if np.isnan(v.p90_abs_error_ms) else f"{v.p90_abs_error_ms:.1f}"
        drift = "—" if np.isnan(v.drift_ms_per_min) else f"{v.drift_ms_per_min:+.0f}ms"
        print(f"{v.clip[:23]:<24}{v.bpm:>5.0f}{v.beats_found:>7}{v.contrast:>10.2f}"
              f"{error:>10}{p90:>8}{drift:>11}  {v.verdict}"
              + (f"  ({v.note})" if v.note else ""))

    real = [v for v in verdicts if not np.isnan(v.median_error_ms) and v.verdict != "NO CLICK"]
    if real:
        errors = np.array([v.median_error_ms for v in real])
        print("─" * 96)
        print(f"{len(real)} measurable take(s): median {np.median(errors):+.1f}ms, "
              f"worst {errors[np.argmax(np.abs(errors))]:+.1f}ms")
        print()
        print("  error > 0  the grid line sits AFTER the recorded click (grid late)")
        print("  error < 0  the grid line sits BEFORE it (grid early)")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
