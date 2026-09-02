import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../../../styles";
import { SongIdea, ClipVersion, InlinePlayerControls } from "../../../types";
import { fmtCardDuration, formatClipCardTime, formatClipDate, isIdeaTitleAutoNamed } from "../../../utils";
import { getDateBucket, getDateBucketLabel } from "../../../domain/dateBuckets";
import { useNavigation } from "@react-navigation/native";
import { getIdeaCreatedAt, getIdeaUpdatedAt, type IdeaSortMetric } from "../../../domain/ideaSort";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { isClipWaveformSynthetic } from "../../../domain/clipPresentation";
import { buildIdeaListItemMeta } from "../ideaListItemMeta";
import type { IdeaListItemMeta } from "../types";

import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { StageInk } from "../../common/StageMark";
import { IdeaCard } from "../../common/IdeaCard";
import { AppAlert } from "../../common/AppAlert";
import { colors } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { toast } from "../../common/toastStore";
import { useTranslation } from "react-i18next";

type IdeaListItemProps = {
    item: SongIdea;
    itemMeta?: IdeaListItemMeta;
    rowLayoutsRef: React.MutableRefObject<Record<string, { y: number; height: number }>>;
    highlightMapRef: React.MutableRefObject<Record<string, Animated.Value>>;
    inlinePlayer: InlinePlayerControls,
    playIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    openIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    /** Stable fn + primitives (instead of a per-render closure) so the row's memo
     *  holds; the hide-day closure is built inside the row. */
    hideTimelineDay?: (metric: "created" | "updated", dayStartTs: number) => Promise<void> | void,
    activeTimelineMetric: "created" | "updated" | null,
    dayStartTs?: number | null,
    dayDividerLabel?: string | null,
    searchNeedle: string,
    notesMatched: boolean,
    lyricsMatched: boolean,
    /** The matched line to show under the card (glyph + snippet), null for title-only. */
    matchSnippet: string | null,
    matchField: "notes" | "lyrics" | null,
    listDensity: "comfortable" | "compact",
    showDateDividers: boolean,
    sortMetric: IdeaSortMetric,
    lyricsFilterMode: "all" | "with" | "without",
};

function IdeaListItemInner({
    item,
    itemMeta,
    rowLayoutsRef,
    highlightMapRef,
    inlinePlayer,
    playIdeaFromList,
    openIdeaFromList,
    hideTimelineDay,
    activeTimelineMetric,
    dayStartTs,
    dayDividerLabel,
    searchNeedle,
    notesMatched,
    lyricsMatched,
    matchSnippet,
    matchField,
    listDensity,
    showDateDividers,
    sortMetric,
    lyricsFilterMode,
}: IdeaListItemProps) {
    const { t } = useTranslation();
    const listSelectionMode = useStore((s) => s.listSelectionMode);
    const songTargetPicker = useStore((s) => s.songTargetPicker);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);

    const navigation = useNavigation();
    const rootNavigation = (navigation as any).getParent?.();
    const navigateRoot = (route: string, params?: object) =>
        (rootNavigation ?? navigation).navigate(route as never, params as never);

    const fallbackMeta = itemMeta ?? buildIdeaListItemMeta(item);
    const {
        playClip,
        clipDurationLabel,
        projectPrimaryDurationLabel,
        projectClipCount,
        hasProjectLyrics,
        hasProjectClipCount,
        hasExpandedProjectIndicators,
        createdAtLabel,
        updatedAtLabel,
    } = fallbackMeta;
    const inlineActive = useStore(
        (s) => !!playClip && s.inlineTarget?.ideaId === item.id && s.inlineTarget.clipId === playClip.id
    );
    const isInlinePlaying = useStore(
        (s) =>
            !!playClip &&
            s.inlineTarget?.ideaId === item.id &&
            s.inlineTarget.clipId === playClip.id &&
            s.inlineIsPlaying
    );
    // Live inline preview position — subscribed only while this card is the
    // active preview target, so the 5Hz position commits re-render one row.
    const inlinePositionMs = useStore((s) => (inlineActive ? s.inlinePositionMs : 0));
    const inlineDurationMs = useStore((s) => (inlineActive ? s.inlineDurationMs : 0));
    // This idea is the active dock / full-player session (any of its clips) —
    // idea-level, so a song card lights up whichever take is playing.
    const sessionActive = useStore((s) => s.playerTarget?.ideaId === item.id);
    const sessionPlaying = useStore((s) => s.playerIsPlaying);
    // "Now playing" (EQ indicator + terracotta title) is reserved for the durable
    // dock / full-player session. A clip-card inline PREVIEW keeps its own plain
    // presentation (its own play/pause button + scrubber) — it must not borrow the
    // now-playing treatment.
    const nowPlaying = sessionActive;
    const nowPlayingIsPlaying = sessionActive && sessionPlaying;
    const inlineTotalMs = inlineDurationMs || playClip?.durationMs || 0;

    const isSelected = useStore((s) => s.selectedListIdeaIds.includes(item.id));
    const showSelectionIndicator = listSelectionMode;
    const compact = listDensity === "compact";
    const sortTs = sortMetric === "updated" ? getIdeaUpdatedAt(item) : getIdeaCreatedAt(item);
    // Rebuilt from stable pieces here (not passed as a closure) so memo props stay flat.
    // Grouped timeline entries always carry dayStartTs; the sortTs bucket is a fallback.
    const onHideDay =
        hideTimelineDay && activeTimelineMetric && showDateDividers && dayDividerLabel
            ? () => void hideTimelineDay(activeTimelineMetric, dayStartTs ?? getDateBucket(sortTs).startTs)
            : undefined;
    // Metadata only: one cohesive relative date. When the timeline is grouped it
    // dovetails with the section divider (never echoing it) instead of repeating
    // the day. The title is always the clip's own title — for unnamed clips that's
    // the auto date/time plug (e.g. "10:43 AM Jun 28th"); the relative date is the
    // footer's job, never the headline's.
    const displayTitle = item.title;
    // Earned serif: only titles the user actually named get Lora. Unedited
    // auto-timestamps AND imports still wearing their filename stay in quiet
    // tabular Jakarta until renamed.
    const titleIsAuto = isIdeaTitleAutoNamed({
        title: item.title,
        createdAt: getIdeaCreatedAt(item),
        importedAt: item.importedAt,
        isTitleAutoGenerated: item.isTitleAutoGenerated,
    });
    // Auto-named cards already carry the absolute time in their title, so the
    // meta row shows relative recency ("12m ago") instead of echoing it. Named
    // cards keep the time-of-day voice.
    const dateLabel = titleIsAuto
        ? formatClipDate(sortTs, showDateDividers ? getDateBucketLabel(sortTs) : undefined)
        : formatClipCardTime(sortTs, showDateDividers ? getDateBucketLabel(sortTs) : undefined);
    const beginSelection = () => {
        haptic.grab();
        useStore.getState().startListSelection(item.id);
    };

    const confirmPickAsSongTarget = () => {
        if (!songTargetPicker) return;
        const count = songTargetPicker.noteIds.length;
        haptic.tap();
        AppAlert.confirm(
            t("collection.addToSongTitle"),
            t("collection.addToSongBody", { count, title: item.title }),
            () => {
                const result = appActions.completeSongTargetPicking(item.id);
                haptic.success();
                toast(
                    t("collection.pagesAdded", { count: result.count, title: result.songTitle }),
                    "musical-notes-outline"
                );
            },
            { confirmLabel: t("collection.add") }
        );
    };

    // Full-card meta cluster: bare caption-scale glyphs on a consistent 10pt
    // rhythm — no separators, no pills.
    const renderProjectRightMeta = () => (
        <View style={styles.ideasListMetaRightCluster}>
            {hasProjectLyrics ? (
                <View style={styles.ideasListMetaToken}>
                    <View style={styles.ideasListMetaIconWrap}>
                        <Ionicons name="document-text-outline" size={12} color="#84736f" />
                    </View>
                </View>
            ) : null}
            {hasProjectClipCount ? (
                <View style={styles.ideasListMetaToken}>
                    <View style={styles.ideasListMetaIconWrap}>
                        <Ionicons name={getHierarchyIconName("clip")} size={12} color="#84736f" />
                    </View>
                    <Text style={styles.ideasListMetaText}>{projectClipCount}</Text>
                </View>
            ) : null}
        </View>
    );

    // (Compact intentionally shows no take/lyrics meta — only the bookmark + duration.)
    // Search matches now surface the matched LINE (see matchSnippet → IdeaCard),
    // not a "match" chip — the snippet shows why the card surfaced.

    // Collapsing is instant and reversible (tap the day marker to expand), so no
    // confirm — just fold it with a light haptic.
    const collapseSection = () => {
        if (!onHideDay) return;
        haptic.grab();
        onHideDay();
    };

    return (
        <View style={styles.ideasListItemWrap}>
            {dayDividerLabel ? (
                <Pressable
                    style={[styles.ideasDayDividerRow, compact ? styles.ideasDayDividerRowDense : null]}
                    onLongPress={onHideDay ? collapseSection : undefined}
                    delayLongPress={350}
                >
                    <View style={styles.ideasDayDividerLine} />
                    <Text style={styles.ideasDayDividerText}>{dayDividerLabel}</Text>
                    {onHideDay ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.ideasDayDividerHideBtn,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={(evt) => {
                                evt.stopPropagation();
                                collapseSection();
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={dayDividerLabel ? `Hide ${dayDividerLabel}` : "Hide section"}
                        >
                            <Ionicons name="eye-off-outline" size={13} color="#84736f" />
                        </Pressable>
                    ) : null}
                    <View style={styles.ideasDayDividerLine} />
                </Pressable>
            ) : null}

            {(
                <View
                    onLayout={(evt) => {
                        rowLayoutsRef.current[item.id] = {
                            y: evt.nativeEvent.layout.y,
                            height: evt.nativeEvent.layout.height,
                        };
                    }}
                    style={styles.listRowWrap}
                >
                    <View style={styles.cardFlex}>
                        <IdeaCard
                            selected={isSelected}
                            inlineActive={inlineActive}
                            isInlinePlaying={isInlinePlaying}
                            nowPlaying={nowPlaying}
                            nowPlayingIsPlaying={nowPlayingIsPlaying}
                            isSong={item.kind === "project"}
                            accentBorderColor={item.kind === "project" ? colors.primary : null}
                            compact={compact}
                            denseRow={compact}
                            containerStyle={[
                                songTargetPicker && item.kind !== "project" ? { opacity: 0.4 } : null,
                            ]}
                            highlightValue={highlightMapRef.current[item.id] ?? null}
                            canPlay={!!playClip}
                            durationLabel={item.kind === "project" ? projectPrimaryDurationLabel : clipDurationLabel}
                            onPressLead={() => {
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                if (!playClip) {
                                    return;
                                }
                                haptic.tap();
                                void playIdeaFromList(item.id, playClip);
                            }}
                            onLongPressLead={() => {
                                if (listSelectionMode || songTargetPicker) return;
                                beginSelection();
                            }}
                            onPress={async () => {
                                if (songTargetPicker) {
                                    if (item.kind === "project") confirmPickAsSongTarget();
                                    return;
                                }
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                if (item.kind === "clip") {
                                    if (playClip) {
                                        await openIdeaFromList(item.id, playClip);
                                    }
                                    return;
                                }
                                await inlinePlayer.resetInlinePlayer();
                                setSelectedIdeaId(item.id);
                                navigateRoot("IdeaDetail", { ideaId: item.id });
                            }}
                            onLongPress={() => {
                                if (songTargetPicker) {
                                    if (item.kind === "project") confirmPickAsSongTarget();
                                    return;
                                }
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                beginSelection();
                            }}
                            title={displayTitle}
                            titleSemiBold={item.kind === "project"}
                            titleIsAuto={titleIsAuto}
                            waveformPeaks={playClip?.waveformPeaks ?? null}
                            waveformSynthetic={playClip ? isClipWaveformSynthetic(playClip) : undefined}
                            searchNeedle={searchNeedle}
                            // Stage rides the title row (like PRIMARY on a clip) — the
                            // most-read line, so it lands without adding a surface.
                            // Compact drops it: the sketch spine + weight already signal it.
                            titleAccessory={
                                !compact && item.kind === "project" ? (
                                    <StageInk status={item.status} />
                                ) : null
                            }
                            trailing={
                                <>
                                    {item.isBookmarked ? (
                                        // Non-interactive indicator — toggling lives in the
                                        // selection flow (long-press → Bookmark).
                                        <Ionicons name="bookmark" size={13} color={colors.primary} />
                                    ) : null}
                                </>
                            }
                            matchSnippet={matchSnippet}
                            matchField={matchField}
                            // Compact has no date grouping, so a time-created is contextless —
                            // dropped entirely there; comfortable keeps its relative date.
                            footerDate={compact ? undefined : dateLabel}
                            footerRightContent={
                                // Compact keeps only the bookmark (in `trailing`) — the
                                // take-count and other metadata are dropped for density.
                                !compact && hasExpandedProjectIndicators
                                    ? renderProjectRightMeta()
                                    : null
                            }
                            // The waveform strip is the inline player (full card):
                            // progress + scrub map straight onto the existing inline
                            // preview state — no engine changes.
                            inlineProgress={
                                inlineTotalMs > 0 ? Math.min(1, inlinePositionMs / inlineTotalMs) : 0
                            }
                            inlineElapsedLabel={fmtCardDuration(inlinePositionMs)}
                            inlineClock={inlinePlayer.clock}
                            onInlineScrubStart={() => {
                                void inlinePlayer.beginInlineScrub();
                            }}
                            onInlineScrub={(fraction) => {
                                void inlinePlayer.endInlineScrub(fraction * inlineTotalMs);
                            }}
                            onInlineScrubCancel={() => {
                                void inlinePlayer.cancelInlineScrub();
                            }}
                            onInlineClose={() => {
                                void inlinePlayer.resetInlinePlayer();
                            }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

/**
 * Memoized: the collection screen re-renders on every selection toggle / store
 * change, and re-rendering every mounted row (each with ~8 store subscriptions
 * and a heavy card tree) made selection taps visibly lag on large libraries.
 * All props are stable refs, stable callbacks, or primitives; per-row live state
 * (selected, now-playing, inline preview) comes from the row's own store
 * subscriptions, which re-render just that row.
 */
export const IdeaListItem = React.memo(IdeaListItemInner);

/**
 * A folded day group: a labelled divider standing in for all of a day's items,
 * with a count of what's tucked inside. Tap to expand the whole day back into
 * the list. Atomic — there's no reaching inside a collapsed day.
 */
export function CollapsedDayRow({
    label,
    count,
    compact,
    onExpand,
}: {
    label: string;
    count: number;
    compact?: boolean;
    onExpand?: () => void;
}) {
    const { t } = useTranslation();
    return (
        <View style={styles.ideasListItemWrap}>
            <Pressable
                style={({ pressed }) => [
                    styles.ideasDayDividerRow,
                    compact ? styles.ideasDayDividerRowDense : null,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={onExpand}
                accessibilityRole="button"
                accessibilityLabel={t("common.expandDayA11y", { label, count })}
            >
                <View style={styles.ideasDayDividerLine} />
                <Ionicons name={dirIcon("chevron-forward")} size={12} color="#84736f" />
                <Text style={styles.ideasDayDividerText}>{label}</Text>
                <View style={styles.ideasCollapsedDayCountPill}>
                    <Text style={styles.ideasCollapsedDayCountText}>{count} hidden</Text>
                </View>
                <View style={styles.ideasDayDividerLine} />
            </Pressable>
        </View>
    );
}
