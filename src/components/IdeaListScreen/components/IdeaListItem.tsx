import { Pressable, Text, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RenderItemParams } from "react-native-draggable-flatlist";
import { styles } from "../../../styles";
import { MiniProgress } from "../../MiniProgress";
import { InlineTarget, SongIdea, ClipVersion, InlinePlayer } from "../../../types";
import { fmtDuration } from "../../../utils";
import { useNavigation } from "@react-navigation/native";
import { getIdeaCreatedAt, getIdeaUpdatedAt, type IdeaSortMetric } from "../../../ideaSort";
import { getHierarchyIconName } from "../../../hierarchy";
import { getPlayableClipForIdea } from "../../../clipPresentation";

import { useStore } from "../../../state/useStore";
import { StatusBadge } from "../../common/StatusBadge";
import { IdeaCard } from "../../common/IdeaCard";
import { useWorkspaceTheme } from "../../../context/WorkspaceThemeContext";

type IdeaListItemProps = RenderItemParams<SongIdea> & {
    hoveredIdeaId: string | null;
    dropIntent: "between" | "inside";
    rowLayoutsRef: React.MutableRefObject<Record<string, { y: number; height: number }>>;
    highlightMapRef: React.MutableRefObject<Record<string, Animated.Value>>;
    inlinePlayer: InlinePlayer,
    playIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    openIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    onUnhide: (idea: SongIdea) => void,
    onHideDay?: () => void,
    hidden?: boolean,
    dayDividerLabel?: string | null,
    searchNeedle: string,
    notesMatched: boolean,
    lyricsMatched: boolean,
    listDensity: "comfortable" | "compact",
    sortMetric: IdeaSortMetric,
    lyricsFilterMode: "all" | "with" | "without",
};

export function IdeaListItem({
    item,
    isActive,
    hoveredIdeaId,
    dropIntent,
    rowLayoutsRef,
    highlightMapRef,
    inlinePlayer,
    playIdeaFromList,
    openIdeaFromList,
    onUnhide,
    onHideDay,
    hidden = false,
    dayDividerLabel,
    searchNeedle,
    notesMatched,
    lyricsMatched,
    listDensity,
    sortMetric,
    lyricsFilterMode,
}: IdeaListItemProps) {
    const listSelectionMode = useStore((s) => s.listSelectionMode);
    const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
    const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
    const { accent: workspaceAccent } = useWorkspaceTheme();

    const navigation = useNavigation();
    const rootNavigation = (navigation as any).getParent?.();
    const navigateRoot = (route: string, params?: object) =>
        (rootNavigation ?? navigation).navigate(route as never, params as never);

    const primaryClip = item.clips.find((c) => c.isPrimary);
    const playClip = getPlayableClipForIdea(item);
    const inlineTarget: InlineTarget = inlinePlayer.inlineTarget;
    const inlineActive = !!playClip && inlineTarget?.ideaId === item.id && inlineTarget.clipId === playClip.id;

    const isInsideTarget = hoveredIdeaId === item.id && dropIntent === "inside";
    const isSelected = selectedListIdeaIds.includes(item.id);
    const showSelectionIndicator = listSelectionMode;
    const clipDurationLabel = playClip?.durationMs ? fmtDuration(playClip.durationMs) : "0:00";
    const projectPrimaryDurationLabel = primaryClip?.durationMs ? fmtDuration(primaryClip.durationMs) : "0:00";
    const hasProjectLyrics = item.kind === "project" && (item.lyrics?.versions ?? []).some((version) =>
        version.document.lines.some((line) => line.text.trim().length > 0 || line.chords.length > 0)
    );
    const hasProjectClipCount = item.kind === "project" && item.clips.length > 0;
    const compact = listDensity === "compact";
    const createdAtLabel = (() => {
        const createdAt = new Date(getIdeaCreatedAt(item));
        const date = createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        const time = createdAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
        return `${date} • ${time}`;
    })();
    const updatedAtLabel = (() => {
        const updatedAt = new Date(getIdeaUpdatedAt(item));
        const date = updatedAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        const time = updatedAt.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
        return `${date} • ${time}`;
    })();
    const hasExpandedProjectIndicators = item.kind === "project" && (hasProjectLyrics || hasProjectClipCount);
    const footerDateLabel = sortMetric === "updated" ? updatedAtLabel : createdAtLabel;
    const projectProgressPct = item.kind === "project" ? Math.max(0, Math.min(100, Math.round(item.completionPct))) : null;
    const compactProjectProgressLabel = projectProgressPct !== null && compact && sortMetric === "progress"
        ? `${projectProgressPct}%`
        : null;

    const beginSelection = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        useStore.getState().startListSelection(item.id);
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
                    <Text style={styles.ideasListMetaText}>{item.clips.length}</Text>
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
                        <Text style={styles.ideasListMetaText}>{item.clips.length}</Text>
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

    const hiddenRow = (
        <View style={styles.listRowWrap}>
            <View
                style={[
                    styles.cardFlex,
                    styles.ideasHiddenCard,
                    isSelected || isActive ? styles.ideasListCardSelected : null,
                ]}
            >
                <View style={styles.clipRowWrap}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.clipRowCard,
                            styles.ideasHiddenCardPressable,
                            pressed && !listSelectionMode ? styles.pressDown : null,
                        ]}
                        onPress={() => {
                            if (!listSelectionMode) return;
                            useStore.getState().toggleListSelection(item.id);
                        }}
                        onLongPress={() => {
                            if (!listSelectionMode) {
                                useStore.getState().startListSelection(item.id);
                            }
                        }}
                        delayLongPress={250}
                    >
                        {highlightMapRef.current[item.id] ? (
                            <Animated.View style={[styles.ideasListCardHighlightOverlay, { opacity: highlightMapRef.current[item.id] }]} pointerEvents="none" />
                        ) : null}
                        <View style={styles.ideasHiddenRowInner}>
                            <View style={styles.ideasHiddenTitleWrap}>
                                <View style={styles.ideasListTitleIconWrap}>
                                    <Ionicons
                                        name="eye-off-outline"
                                        size={13}
                                        color="#B8A8A3"
                                    />
                                </View>
                                <Text style={styles.ideasHiddenTitle} numberOfLines={1}>
                                    {item.title}
                                </Text>
                            </View>
                            <Pressable
                                style={({ pressed }) => [styles.ideasHiddenUnhideBtn, pressed ? styles.pressDown : null]}
                                onPress={(evt) => {
                                    evt.stopPropagation();
                                    onUnhide(item);
                                }}
                            >
                                <Text style={styles.ideasHiddenUnhideBtnText}>Unhide</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.ideasListItemWrap}>
            {dayDividerLabel ? (
                <View style={styles.ideasDayDividerRow}>
                    <View style={styles.ideasDayDividerLine} />
                    <Text style={styles.ideasDayDividerText}>{dayDividerLabel}</Text>
                    {onHideDay ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.ideasDayDividerActionBtn,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={(evt) => {
                                evt.stopPropagation();
                                onHideDay();
                            }}
                        >
                            <Ionicons name="eye-off-outline" size={12} color="#84736f" />
                        </Pressable>
                    ) : null}
                    <View style={styles.ideasDayDividerLine} />
                </View>
            ) : null}

            {hidden ? hiddenRow : (
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
                            selected={isSelected || isActive}
                            isActive={isActive && dropIntent === "inside"}
                            inlineActive={inlineActive}
                            isInlinePlaying={inlinePlayer.isInlinePlaying}
                            nowPlaying={inlineActive}
                            isInsideTarget={isInsideTarget}
                            accentBorderColor={item.kind === "project" ? workspaceAccent : null}
                            compact={compact}
                            highlightValue={highlightMapRef.current[item.id] ?? null}
                            canPlay={!!playClip}
                            durationLabel={item.kind === "project" ? projectPrimaryDurationLabel : clipDurationLabel}
                            onPressLead={() => {
                                console.log("[inline-debug:idea-list-item]", "lead-press", {
                                    ideaId: item.id,
                                    kind: item.kind,
                                    hasPlayClip: !!playClip,
                                    playClipId: playClip?.id ?? null,
                                    inlineActive,
                                    inlineTarget,
                                    isInlinePlaying: inlinePlayer.isInlinePlaying,
                                    inlinePositionMs: inlinePlayer.inlinePosition,
                                    inlineDurationMs: inlinePlayer.inlineDuration,
                                    listSelectionMode,
                                });
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                if (!playClip) {
                                    console.log("[inline-debug:idea-list-item]", "lead-press-no-play-clip", { ideaId: item.id });
                                    return;
                                }
                                void Haptics.selectionAsync();
                                void playIdeaFromList(item.id, playClip);
                            }}
                            onLongPressLead={() => {
                                if (listSelectionMode) return;
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
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                beginSelection();
                            }}
                            title={item.title}
                            titleSemiBold={item.kind === "project"}
                            searchNeedle={searchNeedle}
                            trailing={
                                <>
                                    {item.kind === "project" ? (
                                        <StatusBadge
                                            status={item.status}
                                            pct={!compact ? projectProgressPct : undefined}
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
                            footerDate={!compact ? footerDateLabel : undefined}
                            footerRightContent={
                                compact && item.kind === "project"
                                    ? renderCompactProjectRightMeta()
                                    : !compact && hasExpandedProjectIndicators
                                        ? renderProjectRightMeta()
                                        : null
                            }
                            inlinePlayerContent={
                                <MiniProgress
                                    currentMs={inlinePlayer.inlinePosition}
                                    durationMs={inlinePlayer.inlineDuration || playClip?.durationMs || 0}
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
                            }
                        />
                    </View>
                </View>
            )}
        </View>
    );
}
