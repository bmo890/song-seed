import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./common/BottomSheet";
import { Button } from "./common/Button";
import { Press } from "./common/Press";
import { buildImportedTitle } from "../services/audioStorage";
import { useDuplicateReviewStore } from "../state/useDuplicateReviewStore";
import { colors, radii, spacing, text as textTokens } from "../design/tokens";
import { looksMachineNamed } from "../domain/titleNaming";
import type { ImportedAudioAsset } from "../services/audioStorage";
import type { DuplicateLocation } from "../services/importDuplicates";
import { UserText } from "../i18n";

/**
 * Some of what you're importing is already in your library (rebuilt 2026-10-18 to the
 * design system: rows on paper, an ink tick per file, one primary).
 *
 * Where the flow can import any subset, every file is a row with a tick: files you
 * already have start UNticked (skipped), new ones ticked, and "Import N" imports what is
 * ticked. Tick a duplicate to import a copy anyway, so no choice is lost. Flows that can
 * only import all or the new ones (a single song) keep that one choice: Skip, or Import
 * copy. Swiping the sheet away cancels the import, as before.
 */

const ROW_HEIGHT = 56;
const EMPTY_FLIPS: ReadonlySet<ImportedAudioAsset> = new Set();
const MAX_VISIBLE_ROWS = 6;

function formatSourceDate(ts: number, locale: string): string {
    return new Date(ts).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function FileRow({
    asset,
    location,
    ticked,
    tickable,
    onToggle,
}: {
    asset: ImportedAudioAsset;
    /** Where your copy already lives, for a duplicate. */
    location?: DuplicateLocation;
    ticked: boolean;
    tickable: boolean;
    onToggle: () => void;
}) {
    const { t, i18n } = useTranslation();
    const title = buildImportedTitle(asset.name);
    const machine = looksMachineNamed(title);
    const meta = location
        ? location.collectionTitle
            ? t("duplicateReview.livesIn", { collection: location.collectionTitle, workspace: location.workspaceTitle })
            : t("duplicateReview.livesInWorkspace", { workspace: location.workspaceTitle })
        : typeof asset.sourceCreatedAt === "number"
          ? t("duplicateReview.originallyRecorded", { date: formatSourceDate(asset.sourceCreatedAt, i18n.language) })
          : null;

    const body = (
        <>
            {tickable ? <View style={[s.dot, ticked ? s.dotOn : null]} /> : null}
            <View style={s.rowCopy}>
                <UserText
                    value={title}
                    numberOfLines={1}
                    style={[s.title, machine ? s.titleMachine : null, tickable && !ticked ? s.titleOff : null]}
                >
                    {title}
                </UserText>
                {meta ? (
                    <UserText value={meta} numberOfLines={1} style={s.meta}>
                        {meta}
                    </UserText>
                ) : null}
            </View>
        </>
    );

    if (!tickable) return <View style={s.row}>{body}</View>;
    return (
        <Press
            feel="surface"
            // haptics.ts: light → a small state flip (a tick in a set).
            haptic="light"
            style={s.row}
            onPress={onToggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ticked }}
            accessibilityLabel={t(ticked ? "duplicateReview.exclude" : "duplicateReview.include", { title })}
        >
            {body}
        </Press>
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

    const tickable = !!onImportSubset;
    // What gets imported. Files you already have start unticked: the common intent is
    // "bring in what's new", and a copy is one tick away. Kept as the rows the person
    // FLIPPED, tied to the review they belong to, and derived in render, so a fresh review
    // opens with the right ticks on its first frame (never seeded from an effect).
    const [flips, setFlips] = useState<{ review: ImportedAudioAsset[]; assets: Set<ImportedAudioAsset> }>(() => ({
        review: allAssets,
        assets: new Set(),
    }));
    const flipped = flips.review === allAssets ? flips.assets : EMPTY_FLIPS;
    const uniqueSet = useMemo(() => new Set(uniqueAssets), [uniqueAssets]);
    const isTicked = (asset: ImportedAudioAsset) => uniqueSet.has(asset) !== flipped.has(asset);

    const toggle = (asset: ImportedAudioAsset) =>
        setFlips((previous) => {
            const next = new Set(previous.review === allAssets ? previous.assets : EMPTY_FLIPS);
            if (next.has(asset)) next.delete(asset);
            else next.add(asset);
            return { review: allAssets, assets: next };
        });

    const isSingle = allAssets.length === 1;
    const allDuplicates = uniqueAssets.length === 0;
    const tickedCount = allAssets.filter(isTicked).length;

    const title = t(isSingle || allDuplicates ? "duplicateReview.alreadyImported" : "duplicateReview.someImported");
    const body = tickable
        ? t("duplicateReview.subsetBody")
        : isSingle
          ? t("duplicateReview.singleBody")
          : t("duplicateReview.copiesBody");

    const rowCount = duplicateAssets.length + uniqueAssets.length;
    const sectionCount = (duplicateAssets.length > 0 ? 1 : 0) + (uniqueAssets.length > 0 ? 1 : 0);
    const listHeight = Math.min(rowCount, MAX_VISIBLE_ROWS) * ROW_HEIGHT + sectionCount * 34;

    function importTicked() {
        onImportSubset?.(allAssets.filter(isTicked));
        dismiss();
    }
    function skip() {
        onSkip();
        dismiss();
    }
    function importAll() {
        onImportAll();
        dismiss();
    }

    const renderRows = (assets: ImportedAudioAsset[], duplicates: boolean) =>
        assets.map((asset, index) => (
            <FileRow
                key={`${duplicates ? "d" : "n"}-${index}-${asset.uri}`}
                asset={asset}
                location={
                    duplicates && typeof asset.sourceCreatedAt === "number"
                        ? locationsBySourceDate[asset.sourceCreatedAt]
                        : undefined
                }
                ticked={isTicked(asset)}
                tickable={tickable}
                onToggle={() => toggle(asset)}
            />
        ));

    return (
        <BottomSheet visible={visible} onClose={dismiss}>
            <View style={s.head}>
                <Text style={s.heading}>{title}</Text>
                <Text style={s.body}>{body}</Text>
            </View>

            <ScrollView style={{ maxHeight: listHeight }} showsVerticalScrollIndicator={false} bounces={false}>
                {duplicateAssets.length > 0 ? (
                    <>
                        <Text style={s.sectionLabel}>{t("duplicateReview.alreadyLibrary")}</Text>
                        <View style={s.rows}>{renderRows(duplicateAssets, true)}</View>
                    </>
                ) : null}
                {uniqueAssets.length > 0 ? (
                    <>
                        <Text style={s.sectionLabel}>{t("duplicateReview.new")}</Text>
                        <View style={s.rows}>{renderRows(uniqueAssets, false)}</View>
                    </>
                ) : null}
            </ScrollView>

            {tickable ? (
                <View style={s.actions}>
                    <Button
                        // Nothing ticked reads "Import", not "Import 0".
                        label={tickedCount > 0 ? t("duplicateReview.importCount", { count: tickedCount }) : t("duplicateReview.import")}
                        disabled={tickedCount === 0}
                        onPress={importTicked}
                    />
                    <Button variant="quiet" label={t("duplicateReview.cancel")} onPress={dismiss} />
                </View>
            ) : (
                <View style={[s.actions, s.actionsRow]}>
                    <Button
                        variant="secondary"
                        style={s.flex}
                        label={t(isSingle || allDuplicates ? "duplicateReview.importCopy" : "duplicateReview.importAllShort")}
                        onPress={importAll}
                    />
                    <Button
                        style={s.flex}
                        label={t(allDuplicates ? "duplicateReview.skip" : "duplicateReview.skipDuplicates")}
                        onPress={skip}
                    />
                </View>
            )}
        </BottomSheet>
    );
}

const s = StyleSheet.create({
    head: {
        gap: 4,
        marginBottom: spacing.sm,
    },
    heading: {
        ...textTokens.headerTitle,
        fontSize: 19,
    },
    body: {
        ...textTokens.supporting,
        color: colors.textSecondary,
    },
    sectionLabel: {
        ...textTokens.annotation,
        color: colors.textSecondary,
        marginTop: spacing.md,
        marginBottom: 2,
    },
    rows: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.borderMuted,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: ROW_HEIGHT,
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderMuted,
    },
    // The ink tick (InkOption's dot): hollow = left out, terracotta = imported.
    dot: {
        width: 10,
        height: 10,
        borderRadius: radii.round,
        borderWidth: 1.5,
        borderColor: colors.textMuted,
    },
    dotOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    rowCopy: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    title: {
        fontFamily: "Lora_600SemiBold",
        fontSize: 16,
        color: colors.textPrimary,
    },
    titleMachine: {
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 15,
        color: colors.textStrong,
        fontVariant: ["tabular-nums"],
    },
    titleOff: {
        color: colors.textMuted,
    },
    meta: {
        ...textTokens.caption,
        color: colors.textSecondary,
    },
    actions: {
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    actionsRow: {
        flexDirection: "row",
    },
    flex: {
        flex: 1,
    },
});
