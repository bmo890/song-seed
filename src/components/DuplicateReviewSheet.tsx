import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./common/BottomSheet";
import { buildImportedTitle } from "../services/audioStorage";
import { useDuplicateReviewStore } from "../state/useDuplicateReviewStore";
import { colors, radii } from "../design/tokens";
import type { ImportedAudioAsset } from "../services/audioStorage";
import type { DuplicateLocation } from "../services/importDuplicates";
import { useTranslation } from "react-i18next";
import { UserText } from "../i18n";

function formatSourceDate(ts: number, locale: string): string {
    return new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function LocationLine({ location }: { location: DuplicateLocation }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: location.workspaceColor ?? colors.primary,
                }}
            />
            <UserText value={location.workspaceTitle} style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 15 }} numberOfLines={1}>
                {location.workspaceTitle}
                {location.collectionTitle ? ` · ${location.collectionTitle}` : ""}
            </UserText>
        </View>
    );
}

function FileRow({
    asset,
    isDuplicate,
    location,
    excluded,
    canExclude,
    onToggleExclude,
}: {
    asset: ImportedAudioAsset;
    isDuplicate: boolean;
    location?: DuplicateLocation;
    excluded: boolean;
    canExclude: boolean;
    onToggleExclude: () => void;
}) {
    const { t, i18n } = useTranslation();
    const title = buildImportedTitle(asset.name);
    const dateLabel =
        typeof asset.sourceCreatedAt === "number"
            ? t("duplicateReview.originallyRecorded", { date: formatSourceDate(asset.sourceCreatedAt, i18n.language) })
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
                borderLeftColor: isDuplicate ? colors.primary : "transparent",
                opacity: excluded ? 0.4 : 1,
            }}
        >
            <Ionicons
                name={isDuplicate ? "documents-outline" : "add-circle-outline"}
                size={16}
                color={isDuplicate ? colors.primary : colors.textMuted}
                style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
                <UserText
                    numberOfLines={1}
                    style={{
                        fontFamily: "PlusJakartaSans_500Medium",
                        fontSize: 14,
                        color: colors.textPrimary,
                        lineHeight: 18,
                        textDecorationLine: excluded ? "line-through" : "none",
                    }}
                >
                    {title}
                </UserText>
                {location ? (
                    <LocationLine location={location} />
                ) : dateLabel ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 15, marginTop: 1 }}>
                        {dateLabel}
                    </Text>
                ) : null}
            </View>
            {canExclude ? (
                <Pressable
                    onPress={onToggleExclude}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t(excluded ? "duplicateReview.include" : "duplicateReview.exclude", { title })}
                    style={({ pressed }) => ({ padding: 2, opacity: pressed ? 0.5 : 1 })}
                >
                    <Ionicons
                        name={excluded ? "add-circle-outline" : "close-circle"}
                        size={20}
                        color={excluded ? colors.primary : colors.textMuted}
                    />
                </Pressable>
            ) : null}
        </View>
    );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
                marginBottom: 2,
            }}
        >
            <Text
                style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 10,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: colors.textSecondary,
                }}
            >
                {label}
            </Text>
            <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: radii.lg, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, color: colors.textSecondary }}>
                    {count}
                </Text>
            </View>
        </View>
    );
}

function ActionButton({
    label,
    variant,
    disabled,
    onPress,
}: {
    label: string;
    variant: "primary" | "secondary" | "ghost";
    disabled?: boolean;
    onPress: () => void;
}) {
    const bg = variant === "primary" ? colors.primary : variant === "secondary" ? colors.surfaceContainer : "transparent";
    const textColor = variant === "primary" ? colors.onPrimary : variant === "secondary" ? colors.textPrimary : colors.textSecondary;

    return (
        <Pressable
            disabled={disabled}
            style={({ pressed }) => ({
                flex: variant !== "ghost" ? 1 : undefined,
                height: 44,
                borderRadius: radii.lg,
                backgroundColor: bg,
                borderWidth: variant === "ghost" ? 1 : 0,
                borderColor: colors.borderSubtle,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
            })}
            onPress={onPress}
        >
            <Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: textColor }}>{label}</Text>
        </Pressable>
    );
}

export function DuplicateReviewSheet() {
    const { t } = useTranslation();
    const {
        visible,
        duplicateAssets,
        uniqueAssets,
        allAssets,
        locationsBySourceDate,
        onSkip,
        onImportAll,
        onImportSubset,
        dismiss,
    } = useDuplicateReviewStore();

    // Per-row exclusion (only when the caller supports importing an arbitrary subset).
    const canExclude = !!onImportSubset;
    const [excluded, setExcluded] = useState<Set<ImportedAudioAsset>>(new Set());
    // Reset the selection whenever a new review opens.
    useEffect(() => {
        setExcluded(new Set());
    }, [allAssets]);

    const toggleExclude = (asset: ImportedAudioAsset) => {
        setExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(asset)) next.delete(asset);
            else next.add(asset);
            return next;
        });
    };

    const isSingle = allAssets.length === 1;
    const allDuplicates = uniqueAssets.length === 0;
    const keptCount = allAssets.length - excluded.size;

    const title = t(isSingle || allDuplicates ? "duplicateReview.alreadyImported" : "duplicateReview.someImported");
    const subtitle = canExclude
        ? t("duplicateReview.subsetBody")
        : isSingle
          ? t("duplicateReview.singleBody")
          : t("duplicateReview.copiesBody");

    function handleImport() {
        if (canExclude && onImportSubset) {
            onImportSubset(allAssets.filter((asset) => !excluded.has(asset)));
        } else {
            onImportAll();
        }
        dismiss();
    }

    function handleSkip() {
        onSkip();
        dismiss();
    }

    const MAX_VISIBLE_ROWS = 6;
    const totalRows = duplicateAssets.length + uniqueAssets.length;
    const listHeight = Math.min(totalRows, MAX_VISIBLE_ROWS) * 58;

    const importLabel = canExclude
        ? keptCount === allAssets.length
            ? t("duplicateReview.importAll", { count: allAssets.length })
            : t("duplicateReview.importCount", { count: keptCount })
        : isSingle || allDuplicates
          ? t("duplicateReview.importCopy")
          : t("duplicateReview.importAllShort");

    const hasBothSections = duplicateAssets.length > 0 && uniqueAssets.length > 0;

    return (
        <BottomSheet visible={visible} onClose={dismiss}>
            <View style={{ gap: 3, marginBottom: 14 }}>
                <Text style={{ fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: colors.textPrimary, lineHeight: 24 }}>
                    {title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{subtitle}</Text>
            </View>

            <ScrollView style={{ maxHeight: listHeight }} showsVerticalScrollIndicator={false} bounces={false}>
                {duplicateAssets.length > 0 ? (
                    <View style={{ marginBottom: 10 }}>
                        <SectionHeader label={t("duplicateReview.alreadyLibrary")} count={duplicateAssets.length} />
                        {duplicateAssets.map((asset, i) => (
                            <FileRow
                                key={`d-${asset.sourceCreatedAt ?? i}`}
                                asset={asset}
                                isDuplicate
                                location={
                                    typeof asset.sourceCreatedAt === "number"
                                        ? locationsBySourceDate[asset.sourceCreatedAt]
                                        : undefined
                                }
                                excluded={excluded.has(asset)}
                                canExclude={canExclude}
                                onToggleExclude={() => toggleExclude(asset)}
                            />
                        ))}
                    </View>
                ) : null}

                {uniqueAssets.length > 0 ? (
                    <View style={{ marginBottom: 4 }}>
                        <SectionHeader label={t("duplicateReview.new")} count={uniqueAssets.length} />
                        {uniqueAssets.map((asset, i) => (
                            <FileRow
                                key={`u-${asset.sourceCreatedAt ?? i}`}
                                asset={asset}
                                isDuplicate={false}
                                excluded={excluded.has(asset)}
                                canExclude={canExclude}
                                onToggleExclude={() => toggleExclude(asset)}
                            />
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            <View style={{ gap: 8, marginTop: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionButton
                        label={t(hasBothSections ? "duplicateReview.skipDuplicates" : "duplicateReview.skip")}
                        variant="secondary"
                        onPress={handleSkip}
                    />
                    <ActionButton
                        label={importLabel}
                        variant="primary"
                        disabled={canExclude && keptCount === 0}
                        onPress={handleImport}
                    />
                </View>
                <ActionButton label={t("duplicateReview.cancel")} variant="ghost" onPress={dismiss} />
            </View>
        </BottomSheet>
    );
}
