type InputLike = { id: string; type: string };

/**
 * The input a take records from. The writer's own choice always wins. With no
 * choice made, Android records from a wired headset's own mic the moment one
 * is plugged in; the headset is there to listen through, so the phone's mic
 * records instead (founder, 2026-10-26). Bluetooth needs no rule: Android only
 * takes a headset's mic when asked.
 */
export function effectiveRecordingInputId(
  preferredId: string | null,
  devices: readonly InputLike[],
  platform: string
): string | null {
  if (preferredId) return preferredId;
  if (platform !== "android") return null;
  if (!devices.some((device) => device.type === "wired_headset")) return null;
  return devices.find((device) => device.type === "builtin_mic")?.id ?? null;
}
