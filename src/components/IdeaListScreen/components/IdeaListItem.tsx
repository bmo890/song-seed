import { Pressable, Text, View, Animated } from "react-native";
import ReAnimated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../../styles";
import { MiniProgress } from "../../MiniProgress";
import { SongIdea, ClipVersion, InlinePlayerControls } from "../../../types";
import { fmtDuration, formatClipDate } from "../../../utils";
import { getDateBucketLabel } from "../../../dateBuckets";
import { useNavigation } from "@react-navigation/native";
import { getIdeaCreatedAt, getIdeaUpdatedAt, type IdeaSortMetric } from "../../../ideaSort";
import { getHierarchyIconName } from "../../../hierarchy";
import { getPlayableClipForIdea } from "../../../clipPresentation";
import type { IdeaListItemMeta } from "../types";

import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { StatusBadge } from "../../common/StatusBadge";
import { IdeaCard } from "../../common/IdeaCard";
import { AppAlert } from "../../common/AppAlert";
import { useWorkspaceTheme } from "../../../context/WorkspaceThemeContext";

function IdeaListInlineProgress({
    inlinePlayer,
    fallbackDurationMs,
}: {
    inlinePlayer: InlinePlayerControls;
    fallbackDurationMs: number;
}) {
    const inlinePosition = useStore((s) => s.inlinePositionMs);
    const inlineDuration = useStore((s) => s.inlineDurationMs);

    return (
        // entering only: exiting animations inside recycled list rows misbehave.
        <ReAnimated.View entering={FadeIn.duration(160)}>
            <MiniProgress
                currentMs={inlinePosition}
                durationMs={inlineDuration || fallbackDurationMs}
                showTopDivider
                extraBottomMargin={8}
                captureWholeLane
                onSeek={(ms) => {
                    void inlinePlayer.endInlineScrub(ms);
                }}
                onSeekStart={() => {
                    void inlinePlayer.beginInlineScrub();
                }}
                onSeekCancel={() => {
                    void inlinePlayer.cancelInlineScrub();
                }}
            />
        </ReAnimated.View>
    );
}

const formatIdeaTimestamp = (timestamp: number) => {
    const dateValue = new Date(timestamp);
    const date = dateValue.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const time = dateValue.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
    return `${date} • ${time}`;
};

const buildFallbackIdeaListItemMeta = (idea: SongIdea): IdeaListItemMeta => {
    const primaryClip = idea.clips.find((clip) => clip.isPrimary) ?? null;
    const playClip = getPlayableClipForIdea(idea) ?? null;
    const hasProjectLyrics =
        idea.kind === "project" &&
        (idea.lyrics?.versions ?? []).some((version) =>
            version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
        );
    const hasProjectClipCount = idea.kind === "project" && idea.clips.length > 0;
    const projectProgressPct =
        idea.kind === "project" ? Math.max(0, Math.min(100, Math.round(idea.completionPct))) : null;

    return {
        playClip,
        clipDurationLabel: playClip?.durationMs ? fmtDuration(playClip.durationMs) : "0:00",
        projectPrimaryDurationLabel: primaryClip?.durationMs ? fmtDuration(primaryClip.durationMs) : "0:00",
        projectClipCount: idea.kind === "project" ? idea.clips.length : 0,
        hasProjectLyrics,
        hasProjectClipCount,
        hasExpandedProjectIndicators: idea.kind === "project" && (hasProjectLyrics || hasProjectClipCount),
        createdAtLabel: formatIdeaTimestamp(getIdeaCreatedAt(idea)),
        updatedAtLabel: formatIdeaTimestamp(getIdeaUpdatedAt(idea)),
        projectProgressPct,
    };
};

type IdeaListItemProps = {
    item: SongIdea;
    itemMeta?: IdeaListItemMeta;
    rowLayoutsRef: React.MutableRefObject<Record<string, { y: number; height: number }>>;
    highlightMapRef: React.MutableRefObject<Record<string, Animated.Value>>;
    inlinePlayer: InlinePlayerControls,
    playIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    openIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    onHideDay?: () => void,
    dayDividerLabel?: string | null,
    searchNeedle: string,
    notesMatched: boolean,
    lyricsMatched: boolean,
    listDensity: "comfortable" | "compact",
    showDateDividers: boolean,
    sortMetric: IdeaSortMetric,
    lyricsFilterMode: "all" | "with" | "without",
};

export function IdeaListItem({
    item,
    itemMeta,
    rowLayoutsRef,
    highlightMapRef,
    inlinePlayer,
    playIdeaFromList,
    openIdeaFromList,
    onHideDay,
    dayDividerLabel,
    searchNeedle,
    notesMatched,
    lyricsMatched,
    listDensity,
    showDateDividers,
    sortMetric,
    lyricsFilterMode,
}: IdeaListItemProps) {
    const listSelectionMode = useStore((s) => s.listSelectionMode);
    const songTargetPicker = useStore((s) => s.songTargetPicker);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
    const { accent: workspaceAccent } = useWorkspaceTheme();

    const navigation = useNavigation();
    const rootNavigation = (navigation as any).getParent?.();
    const navigateRoot = (route: string, params?: object) =>
        (rootNavigation ?? navigation).navigate(route as never, params as never);

    const fallbackMeta = itemMeta ?? buildFallbackIdeaListItemMeta(item);
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
        projectProgressPct,
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

    const isSelected = useStore((s) => s.selectedListIdeaIds.includes(item.id));
    const showSelectionIndicator = listSelectionMode;
    const compact = listDensity === "compact";
    const sortTs = sortMetric === "updated" ? getIdeaUpdatedAt(item) : getIdeaCreatedAt(item);
    // Metadata only: one cohesive relative date. When the timeline is grouped it
    // dovetails with the section divider (never echoing it) instead of repeating
    // the day. The title is always the clip's own title — for unnamed clips that's
    // the auto date/time plug (e.g. "10:43 AM Jun 28th"); the relative date is the
    // footer's job, never the headline's.
    const dateLabel = formatClipDate(sortTs, showDateDividers ? getDateBucketLabel(sortTs) : undefined);
    const displayTitle = item.title;
    const compactProjectProgressLabel = projectProgressPct !== null && compact && sortMetric === "progress"
        ? `${projectProgressPct}%`
        : null;

    const beginSelection = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        useStore.getState().startListSelection(item.id);
    };

    const confirmPickAsSongTarget = () => {
        if (!songTargetPicker) return;
        const count = songTargetPicker.noteIds.length;
        void Haptics.selectionAsync();
        AppAlert.confirm(
            "Add to this song?",
            `Add ${count} page${count === 1 ? "" : "s"} of lyrics to "${item.title}" as new lyrics version${count === 1 ? "" : "s"}?`,
            () => {
                const result = appActions.completeSongTargetPicking(item.id);
                AppAlert.info(
                    "Added to song",
                    `${result.count} page${result.count === 1 ? "" : "s"} added to "${result.songTitle}" as new lyrics.`
                );
            },
            { confirmLabel: "Add" }
        );
    };

    const renderProjectRightMeta = () => (
        <View style={styles.ideasListMetaRightCluster}>
            {hasProjectLyrics ? (
                <View style={styles.ideasListMetaToken}>
                    <View style={styles.ideasListMetaIconWrap}>
                        <Ionicons name="document-text-outline" size={12} color="#84736f" />
                    </View>
                </View>
            ) : null}
            {hasProjectLyrics && hasProjectClipCount ? (
                <Text style={styles.ideasListMetaSeparator}>•</Text>
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

    const renderCompactProjectRightMeta = () => {
        const showLyricsIndicator = hasProjectLyrics && (lyricsFilterMode === "with" || hasProjectClipCount || !!compactProjectProgressLabel);
        const showClipCount = hasProjectClipCount;
        const showProgress = !!compactProjectProgressLabel;

        if (!showLyricsIndicator && !showClipCount && !showProgress) {
            return null;
        }

        return (
            <View style={styles.ideasListMetaRightCluster}>
                {showLyricsIndicator ? (
                    <View style={styles.ideasListMetaToken}>
                        <View style={styles.ideasListMetaIconWrap}>
                            <Ionicons name="document-text-outline" size={12} color="#84736f" />
                        </View>
                    </View>
                ) : null}
                {showLyricsIndicator && showClipCount ? (
                    <Text style={styles.ideasListMetaSeparator}>•</Text>
                ) : null}
                {showClipCount ? (
                    <View style={styles.ideasListMetaToken}>
                        <View style={styles.ideasListMetaIconWrap}>
                            <Ionicons name={getHierarchyIconName("clip")} size={12} color="#84736f" />
                        </View>
                        <Text style={styles.ideasListMetaText}>{projectClipCount}</Text>
                    </View>
                ) : null}
                {(showLyricsIndicator || showClipCount) && showProgress ? (
                    <Text style={styles.ideasListMetaSeparator}>•</Text>
                ) : null}
                {showProgress ? (
                    <Text style={styles.ideasListCompactProgressText}>{compactProjectProgressLabel}</Text>
                ) : null}
            </View>
        );
    };

    const searchTagsBlock = searchNeedle && (notesMatched || lyricsMatched) ? (
        <View style={styles.ideasSearchTagRow}>
            {notesMatched ? (
                <View style={styles.ideasSearchTag}>
                    <Text style={styles.ideasSearchTagText}>Notes match</Text>
                </View>
            ) : null}
            {lyricsMatched ? (
                <View style={styles.ideasSearchTag}>
                    <Text style={styles.ideasSearchTagText}>Lyrics match</Text>
                </View>
            ) : null}
        </View>
    ) : null;

    const confirmHideSection = () => {
        if (!onHideDay) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        AppAlert.confirm(
            dayDividerLabel ? `Collapse "${dayDividerLabel}"?` : "Collapse this day?",
            "These items fold away under the day. Tap the day to bring them back.",
            onHideDay,
            { confirmLabel: "Collapse" }
        );
    };

    return (
        <View style={styles.ideasListItemWrap}>
            {dayDividerLabel ? (
                <Pressable
                    style={[styles.ideasDayDividerRow, compact ? styles.ideasDayDividerRowDense : null]}
                    onLongPress={onHideDay ? confirmHideSection : undefined}
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
                                confirmHideSection();
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
                            nowPlaying={inlineActive}
                            accentBorderColor={item.kind === "project" ? workspaceAccent : null}
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
                                void Haptics.selectionAsync();
                                void playIdeaFromList(item.id, playClip);
                            }}
                            onLongPressLead={() => {
                                if (listSelectionMode || songTargetPicker) return;
                                beginSelection();
                            }}
                            leadAccessory={inlineActive ? (
                                <Pressable
                                    style={({ pressed }) => [styles.ideasInlineCloseBtn, pressed ? styles.pressDown : null]}
                                    onPress={(evt) => {
                                        evt.stopPropagation();
                                        void inlinePlayer.resetInlinePlayer();
                                    }}
                                >
                                    <Ionicons name="stop-circle-outline" size={14} color="#84736f" />
                                </Pressable>
                            ) : null}
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
                            searchNeedle={searchNeedle}
                            trailing={
                                <>
                                    {item.kind === "project" ? (
                                        <StatusBadge
                                            status={item.status}
                                            pct={!compact ? projectProgressPct : undefined}
                                            dense={compact}
                                            style={styles.ideasListStatusBadgeText}
                                        />
                                    ) : null}
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            useStore.getState().toggleIdeaBookmark(item.id);
                                        }}
                                        hitSlop={8}
                                        style={styles.ideasListFavoriteBtn}
                                    >
                                        <Ionicons
                                            name={item.isBookmarked ? "bookmark" : "bookmark-outline"}
                                            size={15}
                                            color={item.isBookmarked ? "#B87D6B" : "rgba(215,194,189,0.7)"}
                                        />
                                    </Pressable>
                                </>
                            }
                            searchTagsContent={searchTagsBlock}
                            footerDate={dateLabel}
                            footerRightContent={
                                compact && item.kind === "project"
                                    ? renderCompactProjectRightMeta()
                                    : !compact && hasExpandedProjectIndicators
                                        ? renderProjectRightMeta()
                                        : null
                            }
                            inlinePlayerContent={
                                <IdeaListInlineProgress
                                    inlinePlayer={inlinePlayer}
                                    fallbackDurationMs={playClip?.durationMs || 0}
                                />
                            }
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

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
                accessibilityLabel={`Expand ${label}, ${count} hidden`}
            >
                <View style={styles.ideasDayDividerLine} />
                <Ionicons name="chevron-forward" size={12} color="#84736f" />
                <Text style={styles.ideasDayDividerText}>{label}</Text>
                <View style={styles.ideasCollapsedDayCountPill}>
                    <Text style={styles.ideasCollapsedDayCountText}>{count} hidden</Text>
                </View>
                <View style={styles.ideasDayDividerLine} />
            </Pressable>
        </View>
    );
}
