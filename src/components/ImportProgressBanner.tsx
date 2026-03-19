import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ImportJob, useImportStore } from "../state/useImportStore";

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
        statusText = isMulti
            ? `Imported ${job.total - job.failed} of ${job.total}`
            : "Imported";
        statusColor = "#4ade80";
    } else if (job.status === "error") {
        statusText = "Import failed";
        statusColor = "#f87171";
    } else {
        statusText = isMulti
            ? `Importing ${job.current} of ${job.total}…`
            : "Importing…";
        statusColor = "#fbbf24";
    }

    const progressBarColor =
        job.status === "done" ? "#4ade80" : job.status === "error" ? "#f87171" : "#fbbf24";

    return (
        <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: statusColor,
                    }}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text
                        style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#f1f5f9",
                            lineHeight: 17,
                        }}
                        numberOfLines={1}
                    >
                        {job.label}
                    </Text>
                    <Text
                        style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            lineHeight: 15,
                        }}
                    >
                        {statusText}
                    </Text>
                </View>
                {job.status === "done" && (
                    <Text style={{ fontSize: 14, color: "#4ade80" }}>✓</Text>
                )}
            </View>

            {/* Progress bar */}
            <View
                style={{
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: "#334155",
                    overflow: "hidden",
                }}
            >
                <Animated.View
                    style={{
                        height: "100%",
                        backgroundColor: progressBarColor,
                        width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                        }),
                        borderRadius: 999,
                    }}
                />
            </View>
        </View>
    );
}

export function ImportProgressBanner() {
    const insets = useSafeAreaInsets();
    const jobs = useImportStore((s) => s.jobs);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const hasJobs = jobs.length > 0;
    const wasVisible = useRef(false);

    useEffect(() => {
        if (hasJobs && !wasVisible.current) {
            wasVisible.current = true;
            slideAnim.setValue(0);
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }).start();
        } else if (!hasJobs && wasVisible.current) {
            wasVisible.current = false;
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [hasJobs, slideAnim]);

    if (!hasJobs && !wasVisible.current) return null;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [120, 0],
    });

    const bottom = Math.max(insets.bottom, 14);

    return (
        <Animated.View
            style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom,
                zIndex: 51,
                transform: [{ translateY }],
                pointerEvents: "none",
            }}
        >
            <View
                style={{
                    backgroundColor: "#1e293b",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#334155",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 10,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                {jobs.map((job) => (
                    <ImportJobRow key={job.id} job={job} />
                ))}
            </View>
        </Animated.View>
    );
}
