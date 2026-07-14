# Clip-interaction Maestro flows (require sample audio)

These flows exercise features that need a real audio clip — the player transport,
waveform, overdub, editor — which the main `.maestro/flows/` suite can't cover
(the Simulator has no mic, and the system document picker isn't automatable).

They use the __DEV__ "Import samples (dev)" create-FAB item, which imports audio
from the app's `Documents/dev-samples/` through the real import pipeline.

## Setup (once per sim boot / after any clearState)

    scripts/push-dev-samples.sh            # stages sample audio into the sim

IMPORTANT: do NOT run these together with the main suite's flow 01 — its
`clearState` wipes `Documents/dev-samples/`. Run this set on its own:

    maestro test .maestro/clip-flows/

Each flow uses `launchApp` (never `clearState`), imports fresh, interacts, and
deletes the clips it created, so it's self-cleaning and repeatable.
