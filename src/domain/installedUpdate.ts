/**
 * The line under the version on the About page (2026-10-14): which
 * over-the-air update this launch is running, so "do I have the latest?" is
 * one glance. Pure: the view hands in what expo-updates reports.
 */
export type InstalledUpdate = {
    /** Null on a launch from the binary's own bundle (no update applied). */
    updateId: string | null;
    createdAt: Date | null;
    isEmbeddedLaunch: boolean;
};

/** "Update 7b2c1d · Oct 14" / "Update 7b2c1d" / null for the embedded bundle. */
export function describeInstalledUpdate(
    update: InstalledUpdate,
    formatDate: (ts: number) => string
): string | null {
    if (update.isEmbeddedLaunch || !update.updateId) return null;
    const short = update.updateId.replace(/-/g, "").slice(0, 6);
    const when = update.createdAt && !Number.isNaN(update.createdAt.getTime()) ? formatDate(update.createdAt.getTime()) : null;
    return when ? `${short} · ${when}` : short;
}
