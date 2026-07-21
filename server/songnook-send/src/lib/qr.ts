/**
 * Inline SVG QR codes — no image asset, no external service, CSP-safe.
 * Rendered as one <path> (all dark modules combined), same technique the
 * gallery waveforms use, so it inherits `currentColor` and themes for free.
 */
import qrcode from "qrcode-generator";

export function qrSvgPath(text: string): { d: string; modules: number } {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 2;
  let d = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        const x = col + quiet;
        const y = row + quiet;
        d += `M${x} ${y}h1v1h-1z`;
      }
    }
  }
  return { d, modules: count + quiet * 2 };
}
