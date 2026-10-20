# Clip-interaction Maestro flows (require sample audio)

These flows exercise features that need a real audio clip — the player transport,
marks, the clip editor, copy/move — which the main `.maestro/flows/` suite can't
cover (the Simulator has no mic, and the system document picker isn't automatable).

They use the __DEV__ "Import samples (dev)" / "Import as sketch (dev)" items in the
collection "…" menu, which import audio from the app's `Documents/dev-samples/`
through the real import pipeline.

## Setup (once per sim boot / after any clearState)

    scripts/push-dev-samples.sh            # stages sample audio into the sim

The flows only need `sample-01.m4a` (the 38 s file) and at least one more sample;
they don't depend on how many are staged.

IMPORTANT: do NOT run these together with the main suite's flow 01 — its
`clearState` wipes `Documents/dev-samples/`. Run this set on its own:

    maestro test .maestro/clip-flows/

## Where they run (library safety)

Every flow works inside a throwaway **"Maestro Clips"** collection in the primary
workspace (`subflows/clip-open-scratch.yaml` creates it, `clip-close-scratch.yaml`
deletes it at the end). Their cleanup uses "Select all", which must never run in a
real collection — on a seeded test library "Ideas" holds hundreds of ideas.
clip-10 / clip-11 also create and delete a "Maestro Dest" collection. Each flow
launches with `stopApp: true` (never `clearState`), clears leftovers, imports fresh,
interacts, and deletes what it created, so it's self-cleaning and repeatable.
