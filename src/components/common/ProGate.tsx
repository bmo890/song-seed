import type { ReactNode } from "react";
import { useHasProAccess, type ProFeature } from "../../domain/entitlements";

/**
 * Renders `children` when the user can access `feature`, otherwise `fallback`. While all
 * features are free, children always render — this is the seam for gating cloud/auto-backup
 * (and future pro features) once billing exists, without touching call sites.
 *
 * Built, deliberately unused until phase 6 (docs/product-plan/phase-6-monetization.md
 * names this file as the gate primitive) — do NOT remove as dead code.
 */
export function ProGate({
    feature,
    children,
    fallback = null,
}: {
    feature?: ProFeature;
    children: ReactNode;
    fallback?: ReactNode;
}) {
    const allowed = useHasProAccess(feature);
    return <>{allowed ? children : fallback}</>;
}
