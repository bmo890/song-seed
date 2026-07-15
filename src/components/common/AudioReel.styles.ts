import { StyleSheet } from "react-native";
import { colors, radii } from "../../design/tokens";

export const audioReelStyles = StyleSheet.create({
    surface: {
        overflow: "hidden",
        position: "relative",
    },
    expandButton: {
        position: "absolute",
        top: 5,
        right: 5,
        width: 32,
        height: 32,
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        borderWidth: 1,
    },
    visualizerLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    /** Sits UNDER the wave layer (which fades in over it) and never takes touches —
     *  scrub/seek belong to the visualizer even while the picture is pending. */
    pendingLayer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        zIndex: 0,
    },
    /** A broken centre line: unmistakably "nothing here yet" — no amplitude anywhere to
     *  misread as the shape of the audio. The row's own opacity stays 1; the pulse owns
     *  fading (baking a second multiplier in here is what made it barely-there). */
    pendingDashRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    pendingDash: {
        width: 4,
        height: 2.5,
        borderRadius: radii.xs,
    },
    /** Floated below the centre line rather than stacked with it, so the dashes stay
     *  exactly where the wave's baseline lands — clear of the swelling pulse. */
    pendingCaption: {
        position: "absolute",
        alignSelf: "center",
        top: "60%",
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 12.5,
        letterSpacing: 0.2,
    },
    overlayLayer: {
        zIndex: 2,
    },
    utilityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    utilityLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        flex: 1,
    },
    timingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    timingPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    timingText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    timingTextCompact: {
        fontSize: 12,
    },
    zoomOverlay: {
        position: "absolute",
        right: 6,
    },
    zoomOverlayPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        paddingHorizontal: 3,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: colors.borderMuted,
        backgroundColor: "rgba(253,251,247,0.96)",
    },
    zoomOverlayButton: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    zoomOverlayDivider: {
        width: 0.5,
        height: 16,
        backgroundColor: colors.borderMuted,
        marginHorizontal: 1,
    },
    zoomPuck: {
        width: 30,
        height: 30,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: colors.borderMuted,
        backgroundColor: "rgba(253,251,247,0.96)",
        alignItems: "center",
        justifyContent: "center",
    },
    zoomOverlayText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 11,
        color: colors.textStrong,
        minWidth: 22,
        textAlign: "center",
        fontVariant: ["tabular-nums"],
    },
    zoomRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        marginTop: 12,
    },
    zoomRowTop: {
        justifyContent: "flex-end",
        paddingHorizontal: 0,
        marginTop: 0,
    },
    zoomButton: {
        width: 32,
        height: 32,
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    zoomButtonCompact: {
        width: 28,
        height: 28,
        borderRadius: radii.round,
    },
    zoomReadout: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        paddingHorizontal: 10,
        minWidth: 76,
        height: 32,
        borderWidth: 1,
    },
    zoomReadoutCompact: {
        height: 28,
        borderRadius: 7,
        paddingHorizontal: 7,
        minWidth: 68,
    },
    zoomReadoutText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        fontVariant: ["tabular-nums"],
    },
    zoomReadoutTextCompact: {
        fontSize: 12,
    },
    minimapWrap: {
        marginTop: 12,
        paddingHorizontal: 20,
    },
    transportRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        gap: 16,
    },
    transportRowCompact: {
        marginTop: 12,
        gap: 12,
    },
    transportButton: {
        padding: 12,
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    transportButtonCompact: {
        padding: 10,
        borderRadius: 20,
    },
    playButton: {
        height: 48,
        width: 80,
        borderRadius: radii.round,
        justifyContent: "center",
        alignItems: "center",
    },
    playButtonCompact: {
        height: 42,
        width: 68,
        borderRadius: radii.round,
    },
});
