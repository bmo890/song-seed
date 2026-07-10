import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ImportJob, useImportStore } from "../state/useImportStore";
import { useStore } from "../state/useStore";
import { colors, radii } from "../design/tokens";

function ImportJobRow({ job }: { job: ImportJob }) {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const target = job.total > 0 ? job.current / job.total : 0;
        Animated.timing(progressAnim, {
            toValue: target,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [job.current, job.total, progressAnim]);

    const isMulti = job.total > 1;

    let statusText: string;
    let statusColor: string;
    if (job.status === "done") {
        statusText = isMulti ? `Imported ${job.total - job.failed} of ${job.total}` : "Imported";
        statusColor = "#3F9C82";
    } else if (job.status === "error") {
        statusText = "Import failed";
        statusColor = "#B4574A";
    } else {
        statusText = isMulti ? `Importing ${job.current} of ${job.total}…` : "Importing…";
        statusColor = colors.primary;
    }

    return (
        <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_600SemiBold",
                            fontSize: 13,
                            color: colors.textPrimary,
                            lineHeight: 17,
                        }}
                        numberOfLines={1}
                    >
                        {job.label}
                    </Text>
                    <Text
                        style={{
                            fontFamily: "PlusJakartaSans_400Regular",
                            fontSize: 11,
                            color: colors.textSecondary,
                            lineHeight: 15,
                        }}
                    >
                        {statusText}
                    </Text>
                </View>
                {job.status === "done" ? <Text style={{ fontSize: 14, color: "#3F9C82" }}>✓</Text> : null}
            </View>

            <View style={{ height: 3, borderRadius: 999, backgroundColor: colors.surfaceHigh, overflow: "hidden" }}>
                <Animated.View
                    style={{
                        height: "100%",
                        backgroundColor: statusColor,
                        width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                        borderRadius: 999,
                    }}
                />
            </View>
        </View>
    );
}

export function ImportProgressBanner({ hidden = false }: { hidden?: boolean }) {
    const insets = useSafeAreaInsets();
    const jobs = useImportStore((s) => s.jobs);
    const playerDockHeight = useStore((s) => s.playerDockHeight);
    const setImportBannerHeight = useStore((s) => s.setImportBannerHeight);
    const slideAnim = useRef(new Animated.Value(0)).current;
    // Hidden while the drawer/sidenav is open so it never paints over the nav.
    const hasJobs = jobs.length > 0 && !hidden;
    const wasVisible = useRef(false);

    useEffect(() => {
        if (hasJobs && !wasVisible.current) {
            wasVisible.current = true;
            slideAnim.setValue(0);
            Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
        } else if (!hasJobs && wasVisible.current) {
            wasVisible.current = false;
            Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
    }, [hasJobs, slideAnim]);

    // Release the reserved height whenever the bar isn't showing.
    useEffect(() => {
        if (!hasJobs) setImportBannerHeight(0);
        return () => setImportBannerHeight(0);
    }, [hasJobs, setImportBannerHeight]);

    if (!hasJobs && !wasVisible.current) return null;

    const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    // Sit just above the media dock (when present) so it never covers the transport.
    const bottom = playerDockHeight > 0 ? playerDockHeight + 8 : Math.max(insets.bottom, 14);

    return (
        <Animated.View
            style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom,
                zIndex: 49,
                transform: [{ translateY }],
                pointerEvents: "none",
            }}
        >
            <View
                onLayout={(e) => {
                    // Reserve the bar height + the gap below it so bottom controls clear it.
                    if (hasJobs) setImportBannerHeight(e.nativeEvent.layout.height + 12);
                }}
                style={{
                    backgroundColor: colors.surface,
                    borderRadius: radii.xl,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 10,
                    shadowColor: "#3D3732",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 6,
                }}
            >
                {jobs.map((job) => (
                    <ImportJobRow key={job.id} job={job} />
                ))}
            </View>
        </Animated.View>
    );
}
