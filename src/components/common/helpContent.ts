import type { HelpItem } from "./HelpSheet";

/**
 * Help-sheet copy for the audio flows that had no help before. Kept as data so
 * every sheet renders through the shared HelpSheet. Claims here describe real
 * behavior — verify against the flow when it changes.
 */

export type HelpContent = { title: string; intro: string; items: HelpItem[] };

export const RECORDING_HELP: HelpContent = {
  title: "Recording",
  intro: "Capture a take — with a click to keep you steady.",
  items: [
    {
      icon: "mic-outline",
      label: "Record & pause",
      description: "Tap the mic to start, tap again to pause. Save keeps the take in this collection; the trash discards it.",
    },
    {
      icon: "timer-outline",
      label: "Count-in",
      description: "Play 1, 2, or 4 bars of clicks before recording starts. Open the metronome to set it.",
    },
    {
      icon: "musical-notes-outline",
      label: "Metronome",
      description: "A click while you record — as a beep, a screen flash, a haptic pulse, or all three. It guides you but is never recorded into the take.",
    },
    {
      icon: "create-outline",
      label: "Naming",
      description: "Name each take when you save it, or turn that off in Settings to auto-name and keep the ideas flowing.",
    },
    {
      icon: "bluetooth-outline",
      label: "Bluetooth latency",
      description: "Monitoring through wireless headphones? Calibrate once so overdubs line up with what you heard.",
    },
    {
      icon: "phone-portrait-outline",
      label: "Keeps going",
      description: "Recording continues if the screen locks or you switch apps.",
    },
  ],
};

export const PRACTICE_HELP: HelpContent = {
  title: "Practice tools",
  intro: "Slow it down, loop the hard part, learn the song.",
  items: [
    {
      icon: "repeat-outline",
      label: "Loop",
      description: "Set a start and end and the section repeats, so you can drill one phrase until it sticks.",
    },
    {
      icon: "pin-outline",
      label: "Pins",
      description: "Drop a marker at any moment, then jump straight back to it later.",
    },
    {
      icon: "albums-outline",
      label: "Sections",
      description: "Label verse, chorus, and the rest to navigate — and loop — by part.",
    },
    {
      icon: "speedometer-outline",
      label: "Speed",
      description: "Play slower or faster without changing the pitch.",
    },
    {
      icon: "swap-vertical-outline",
      label: "Pitch",
      description: "Shift up or down in semitones to match your instrument or voice.",
    },
    {
      icon: "sparkles-outline",
      label: "Non-destructive",
      description: "Speed and pitch here only change playback — the saved clip is never altered.",
    },
    {
      icon: "stats-chart-outline",
      label: "Key & tempo",
      description: "Detect the clip's key and BPM. A helpful estimate, not the final word.",
    },
  ],
};

export const OVERDUB_HELP: HelpContent = {
  title: "Overdub layers",
  intro: "Stack a harmony, a second part, a clap — over the take you already have.",
  items: [
    {
      icon: "layers-outline",
      label: "Layers ride the take",
      description: "Each layer plays over the root clip. The root itself stays untouched.",
    },
    {
      icon: "options-outline",
      label: "Levels",
      description: "Set each layer's volume, or add a low cut to clean up rumble and handling noise.",
    },
    {
      icon: "git-compare-outline",
      label: "Timing",
      description: "Nudge a layer earlier or later by milliseconds while it plays, until it locks into the groove.",
    },
    {
      icon: "headset-outline",
      label: "Solo & mute",
      description: "Play one layer alone, or mute it, to check how the parts sit together.",
    },
    {
      icon: "save-outline",
      label: "Editing a layered clip",
      description: "To trim or change the speed of a clip that has layers, save a combined mix first — timing edits on the root would break the alignment.",
    },
  ],
};

export const EDITOR_HELP: HelpContent = {
  title: "Editing audio",
  intro: "Trim the take, or change its speed and pitch — the result is saved as a new clip.",
  items: [
    {
      icon: "cut-outline",
      label: "Keep or remove",
      description: "Choose regions to KEEP (everything else is trimmed away) or to REMOVE (those parts are cut out).",
    },
    {
      icon: "add-outline",
      label: "Regions",
      description: "Add a region at the playhead, drag its edges to fit, or remove it. Add several to keep or cut multiple parts at once.",
    },
    {
      icon: "save-outline",
      label: "Saving",
      description: "The edit saves as a new clip, so the original is safe. Turn on 'remove original' when you're sure you won't want it back.",
    },
    {
      icon: "speedometer-outline",
      label: "Speed & pitch",
      description: "Bake a permanent speed or pitch change into a new clip — unlike the practice tools, this one sticks.",
    },
  ],
};
