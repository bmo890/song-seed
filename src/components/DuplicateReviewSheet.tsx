import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./common/BottomSheet";
import { buildImportedTitle } from "../services/audioStorage";
import { useDuplicateReviewStore } from "../state/useDuplicateReviewStore";
import type { ImportedAudioAsset } from "../services/audioStorage";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatSourceDate(ts: number): string {
    return new Date(ts).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// ─── file row ────────────────────────────────────────────────────────────────

function FileRow({
    asset,
    isDuplicate,
}: {
    asset: ImportedAudioAsset;
    isDuplicate: boolean;
}) {
    const title = buildImportedTitle(asset.name);
    const dateLabel =
        typeof asset.sourceCreatedAt === "number"
            ? `Originally recorded ${formatSourceDate(asset.sourceCreatedAt)}`
            : null;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingVertical: 8,
                paddingLeft: isDuplicate ? 10 : 0,
                borderLeftWidth: isDuplicate ? 2 : 0,
                borderLeftColor: isDuplicate ? "#f59e0b" : "transparent",
            }}
        >
            <Ionicons
                name={isDuplicate ? "warning-outline" : "checkmark-circle-outline"}
                size={16}
                color={isDuplicate ? "#f59e0b" : "#64748b"}
                style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: isDuplicate ? "#92400e" : "#0f172a",
                        lineHeight: 18,
                    }}
                >
                    {title}
                </Text>
                {dateLabel ? (
                    <Text
                        style={{
                            fontSize: 11,
                            color: isDuplicate ? "#b45309" : "#64748b",
                            lineHeight: 15,
                            marginTop: 1,
                        }}
                    >
                        {dateLabel}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

// ─── section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, amber }: { label: string; count: number; amber: boolean }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: "#f1f5f9",
                marginBottom: 2,
            }}
        >
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: amber ? "#b45309" : "#64748b",
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    backgroundColor: amber ? "#fef3c7" : "#f1f5f9",
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                }}
            >
                <Text style={{ fontSize: 11, fontWeight: "600", color: amber ? "#92400e" : "#64748b" }}>
                    {count}
                </Text>
            </View>
        </View>
    );
}

// ─── action button ────────────────────────────────────────────────────────────

function ActionButton({
    label,
    variant,
    onPress,
}: {
    label: string;
    variant: "primary" | "secondary" | "ghost";
    onPress: () => void;
}) {
    const bg =
        variant === "primary"
            ? "#0f172a"
            : variant === "secondary"
              ? "#f1f5f9"
              : "transparent";
    const textColor =
        variant === "primary" ? "#f8fafc" : variant === "secondary" ? "#0f172a" : "#64748b";
    const borderColor =
        variant === "ghost" ? "#e2e8f0" : "transparent";

    return (
        <Pressable
            style={({ pressed }) => ({
                flex: variant !== "ghost" ? 1 : undefined,
                height: 44,
                borderRadius: 12,
                backgroundColor: pressed ? (variant === "primary" ? "#1e293b" : "#e2e8f0") : bg,
                borderWidth: variant === "ghost" ? 1 : 0,
                borderColor,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
            })}
            onPress={onPress}
        >
            <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{label}</Text>
        </Pressable>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export function DuplicateReviewSheet() {
    const { visible, duplicateAssets, uniqueAssets, allAssets, onSkip, onImportAll, dismiss } =
        useDuplicateReviewStore();

    const isSingle = allAssets.length === 1;
    const allDuplicates = uniqueAssets.length === 0;

    const title = isSingle || allDuplicates ? "Already Imported" : "Some Files Already Imported";
    const subtitle = isSingle
        ? "Import it again as a copy, or skip it?"
        : allDuplicates
          ? "Import them again as copies, or skip?"
          : 'Tap "Import All" to add copies of the duplicates.';

    const skipLabel = isSingle ? "Skip" : "Skip Duplicates";
    const importLabel = isSingle || allDuplicates ? "Import as Copy" : "Import All";

    function handleSkip() {
        onSkip();
        dismiss();
    }

    function handleImportAll() {
        onImportAll();
        dismiss();
    }

    function handleCancel() {
        dismiss();
    }

    const showDuplicateSection = duplicateAssets.length > 0;
    const showUniqueSection = uniqueAssets.length > 0;

    // Limit visible rows to avoid an extremely tall sheet; user can scroll.
    const MAX_VISIBLE_ROWS = 6;
    const totalRows = duplicateAssets.length + uniqueAssets.length;
    const listHeight = Math.min(totalRows, MAX_VISIBLE_ROWS) * 52;

    return (
        <BottomSheet visible={visible} onClose={handleCancel}>
            {/* Title + subtitle */}
            <View style={{ gap: 3, marginBottom: 14 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#0f172a", lineHeight: 24 }}>
                    {title}
                </Text>
                <Text style={{ fontSize: 13, color: "#64748b", lineHeight: 18 }}>{subtitle}</Text>
            </View>

            {/* File list */}
            <ScrollView
                style={{ maxHeight: listHeight }}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {showDuplicateSection && (
                    <View style={{ marginBottom: 10 }}>
                        <SectionHeader
                            label="Already imported"
                            count={duplicateAssets.length}
                            amber
                        />
                        {duplicateAssets.map((asset, i) => (
                            <FileRow key={asset.sourceCreatedAt ?? i} asset={asset} isDuplicate />
                        ))}
                    </View>
                )}

                {showUniqueSection && (
                    <View style={{ marginBottom: 4 }}>
                        <SectionHeader label="New" count={uniqueAssets.length} amber={false} />
                        {uniqueAssets.map((asset, i) => (
                            <FileRow
                                key={asset.sourceCreatedAt ?? `u-${i}`}
                                asset={asset}
                                isDuplicate={false}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Action buttons */}
            <View style={{ gap: 8, marginTop: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionButton label={skipLabel} variant="secondary" onPress={handleSkip} />
                    <ActionButton label={importLabel} variant="primary" onPress={handleImportAll} />
                </View>
                <ActionButton label="Cancel" variant="ghost" onPress={handleCancel} />
            </View>
        </BottomSheet>
    );
}
