import { Pressable, Text, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RenderItemParams } from "react-native-draggable-flatlist";
import { styles } from "../../styles";
import { MiniProgress } from "../MiniProgress";
import { InlineTarget, SongIdea, ClipVersion, InlinePlayer } from "../../types";
import { fmtDuration } from "../../utils";
import { useNavigation } from "@react-navigation/native";
import { getIdeaCreatedAt, getIdeaUpdatedAt, type IdeaSortMetric } from "../../ideaSort";
import { getHierarchyIconColor, getHierarchyIconName, getIdeaHierarchyLevel } from "../../hierarchy";

import { useStore } from "../../state/useStore";
import { StatusBadge } from "../common/StatusBadge";

type IdeaListItemProps = RenderItemParams<SongIdea> & {
    hoveredIdeaId: string | null;
    dropIntent: "between" | "inside";
    rowLayoutsRef: React.MutableRefObject<Record<string, { y: number; height: number }>>;
    highlightMapRef: React.MutableRefObject<Record<string, Animated.Value>>;
    inlinePlayer: InlinePlayer,
    playIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    openIdeaFromList: (ideaId: string, clip: ClipVersion) => Promise<void> | void,
    onLongPressActions: (idea: SongIdea) => void,
    onUnhide: (idea: SongIdea) => void,
    onHideDay?: () => void,
    hidden?: boolean,
    ideaSizeLabel: string,
    dayDividerLabel?: string | null,
    searchNeedle: string,
    notesMatched: boolean,
    lyricsMatched: boolean,
    listDensity: "comfortable" | "compact",
    sortMetric: IdeaSortMetric,
    lyricsFilterMode: "all" | "with" | "without",
};

function renderHighlightedTitle(
    title: string,
    searchNeedle: string,
    baseStyle: object,
    hitStyle: object,
    numberOfLines?: number
) {
    if (!searchNeedle) {
        return <Text style={baseStyle} numberOfLines={numberOfLines}>{title}</Text>;
    }

    const lowerTitle = title.toLowerCase();
    const lowerNeedle = searchNeedle.toLowerCase();
    const startIndex = lowerTitle.indexOf(lowerNeedle);

    if (startIndex === -1 || lowerNeedle.length === 0) {
        return <Text style={baseStyle} numberOfLines={numberOfLines}>{title}</Text>;
    }

    const endIndex = startIndex + lowerNeedle.length;
    const before = title.slice(0, startIndex);
    const hit = title.slice(startIndex, endIndex);
    const after = title.slice(endIndex);

    return (
        <Text style={baseStyle} numberOfLines={numberOfLines}>
            {before}
            <Text style={hitStyle}>{hit}</Text>
            {after}
        </Text>
    );
}

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
    onLongPressActions,
    onUnhide,
    onHideDay,
    hidden = false,
    ideaSizeLabel,
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

    const navigation = useNavigation();
    const rootNavigation = (navigation as any).getParent?.();
    const navigateRoot = (route: string) => (rootNavigation ?? navigation).navigate(route as never);

    const primaryClip = item.clips.find((c) => c.isPrimary);
    const playClip =
        item.kind === "clip"
            ? item.clips.find((c) => !!c.audioUri) ?? null
            : item.clips.find((c) => c.isPrimary && !!c.audioUri) ?? item.clips.find((c) => !!c.audioUri) ?? null;
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
    const showExpandedStaticDuration = !compact && !inlineActive;
    const hasExpandedProjectIndicators = item.kind === "project" && (hasProjectLyrics || hasProjectClipCount);
    const hasDistinctUpdatedAt = getIdeaUpdatedAt(item) !== getIdeaCreatedAt(item);
    const showUpdatedMetaRow = item.kind === "project" && hasDistinctUpdatedAt;
    const expandedUpdatedLabel = showUpdatedMetaRow && sortMetric !== "updated" ? `Updated ${updatedAtLabel}` : null;
    const expandedCreatedLabel = sortMetric !== "created" ? `Created ${createdAtLabel}` : null;
    const showExpandedProjectContextRow = item.kind === "project" && (!!expandedUpdatedLabel || hasExpandedProjectIndicators);
    const projectProgressLabel = item.kind === "project" && !compact ? `${Math.max(0, Math.min(100, Math.round(item.completionPct)))}%` : null;
    const compactProjectProgressLabel = item.kind === "project" && compact && sortMetric === "progress"
        ? `${Math.max(0, Math.min(100, Math.round(item.completionPct)))}%`
        : null;

    const handleLeadPress = (evt: any) => {
        evt.stopPropagation();
        if (listSelectionMode) {
            useStore.getState().toggleListSelection(item.id);
            return;
        }
        if (!playClip) return;
        void Haptics.selectionAsync();
        void playIdeaFromList(item.id, playClip);
    };

    const handleLeadLongPress = () => {
        if (listSelectionMode) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPressActions(item);
    };

    const renderProjectRightMeta = () => (
        <View style={styles.ideasListMetaRightCluster}>
            {hasProjectLyrics ? (
                <View style={styles.ideasListMetaToken}>
                    <View style={styles.ideasListMetaIconWrap}>
                        <Ionicons name="document-text-outline" size={12} color="#64748b" />
                    </View>
                </View>
            ) : null}
            {hasProjectLyrics && hasProjectClipCount ? (
                <Text style={styles.ideasListMetaSeparator}>•</Text>
            ) : null}
            {hasProjectClipCount ? (
                <View style={styles.ideasListMetaToken}>
                    <View style={styles.ideasListMetaIconWrap}>
                        <Ionicons name={getHierarchyIconName("clip")} size={12} color="#64748b" />
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
                            <Ionicons name="document-text-outline" size={12} color="#64748b" />
                        </View>
                    </View>
                ) : null}
                {showLyricsIndicator && showClipCount ? (
                    <Text style={styles.ideasListMetaSeparator}>•</Text>
                ) : null}
                {showClipCount ? (
                    <View style={styles.ideasListMetaToken}>
                        <View style={styles.ideasListMetaIconWrap}>
                            <Ionicons name={getHierarchyIconName("clip")} size={12} color="#64748b" />
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

    const titleBlock = (
        <View style={styles.ideasListCardTop}>
            <View style={[styles.ideasListCardTitleRow, !compact ? styles.ideasListCardTitleRowExpanded : null]}>
                <View style={styles.ideasListTitleIconWrap}>
                    <Ionicons
                        name={getHierarchyIconName(getIdeaHierarchyLevel(item))}
                        size={compact ? 12 : 13}
                        color={getHierarchyIconColor(getIdeaHierarchyLevel(item))}
                    />
                </View>
                <View style={styles.cardFlex}>
                    {renderHighlightedTitle(
                        item.title,
                        searchNeedle,
                        [
                            styles.ideasListCardTitle,
                            compact ? styles.ideasListCardTitleCompact : null,
                        ] as any,
                        styles.ideasListCardTitleHighlight,
                        compact ? 1 : undefined
                    )}
                </View>
            </View>
            <View style={styles.ideasListCardTrailing}>
                {item.kind === "project" ? (
                    <StatusBadge status={item.status} style={styles.ideasListStatusBadgeText} />
                ) : null}
                {projectProgressLabel ? (
                    <Text style={styles.ideasListProgressText}>
                        {projectProgressLabel}
                    </Text>
                ) : null}
                <Pressable
                    onPress={(e) => {
                        e.stopPropagation();
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        useStore.getState().toggleIdeaFavorite(item.id);
                    }}
                    hitSlop={8}
                    style={styles.ideasListFavoriteBtn}
                >
                    <Ionicons
                        name={item.isFavorite ? "star" : "star-outline"}
                        size={15}
                        color={item.isFavorite ? "#f59e0b" : "#cbd5e1"}
                    />
                </Pressable>
            </View>
        </View>
    );

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
                    {showSelectionIndicator ? (
                        <View style={styles.selectionIndicatorCol} pointerEvents="none">
                            <View style={[styles.selectionIndicatorCircle, isSelected ? styles.selectionIndicatorActive : null]}>
                                {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
                            </View>
                        </View>
                    ) : null}
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
                                        name={getHierarchyIconName(getIdeaHierarchyLevel(item))}
                                        size={13}
                                        color={getHierarchyIconColor(getIdeaHierarchyLevel(item))}
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
                            <Ionicons name="chevron-down" size={12} color="#64748b" />
                        </Pressable>
                    ) : null}
                    <View style={styles.ideasDayDividerLine} />
                </View>
            ) : null}

            {hidden ? hiddenRow : (
            <View style={styles.listRowWrap}>
                <View style={styles.cardFlex}>
                    <View
                        onLayout={(evt) => {
                            rowLayoutsRef.current[item.id] = {
                                y: evt.nativeEvent.layout.y,
                                height: evt.nativeEvent.layout.height,
                            };
                        }}
                        style={[
                            styles.cardFlex,
                            styles.ideasListCard,
                            compact ? styles.ideasListCardCompact : null,
                            item.kind === "project" ? styles.ideasListProjectCard : null,
                            isSelected || isActive ? styles.ideasListCardSelected : null,
                            inlineActive ? styles.ideasListCardNowPlaying : null,
                            isInsideTarget ? styles.cardInsideHover : null,
                            isActive && dropIntent === "inside" ? styles.cardActiveInside : null,
                        ]}
                    >
                        <View style={styles.clipRowWrap}>
                            {showSelectionIndicator ? (
                                <View style={styles.selectionIndicatorCol} pointerEvents="none">
                                    <View style={[styles.selectionIndicatorCircle, isSelected ? styles.selectionIndicatorActive : null]}>
                                        {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
                                    </View>
                                </View>
                            ) : null}
                            <Pressable
                                style={({ pressed }) => [
                                    styles.clipRowCard,
                                    pressed ? styles.pressDown : null,
                                ]}
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
                                navigateRoot("IdeaDetail");
                                }}
                                onLongPress={() => {
                                if (listSelectionMode) {
                                    useStore.getState().toggleListSelection(item.id);
                                    return;
                                }
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                onLongPressActions(item);
                                }}
                                delayLongPress={250}
                            >
                                {highlightMapRef.current[item.id] ? (
                                    <Animated.View style={[styles.ideasListCardHighlightOverlay, { opacity: highlightMapRef.current[item.id] }]} pointerEvents="none" />
                                ) : null}
                                {inlineActive ? (
                                    <View style={[styles.ideasListLeadHotzone, styles.ideasListLeadHotzoneInline]}>
                                        <Pressable
                                            style={styles.ideasListLeadHotzoneTop}
                                            onPress={(evt) => {
                                                evt.stopPropagation();
                                                void Haptics.selectionAsync();
                                                if (playClip) void playIdeaFromList(item.id, playClip);
                                            }}
                                        />
                                        <Pressable
                                            style={styles.ideasListLeadHotzoneBottom}
                                            onPress={(evt) => {
                                                evt.stopPropagation();
                                                void Haptics.selectionAsync();
                                                void inlinePlayer.resetInlinePlayer();
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <Pressable
                                        style={[
                                            styles.ideasListLeadHotzone,
                                            compact ? styles.ideasListLeadHotzoneCompact : null,
                                            !compact ? styles.ideasListLeadHotzoneExpanded : null,
                                        ]}
                                        onPress={handleLeadPress}
                                        onLongPress={handleLeadLongPress}
                                        delayLongPress={250}
                                        disabled={!playClip && !listSelectionMode}
                                    />
                                )}
                                {!compact && !inlineActive ? (
                                    <View style={styles.ideasListExpandedStaticWrap}>
                                        <View style={styles.ideasListExpandedHeaderRow}>
                                            <View style={styles.ideasListExpandedHeaderLead}>
                                                <View style={styles.ideasInlinePlayBtn}>
                                                    <Ionicons
                                                        name="play"
                                                        size={15}
                                                        color={!playClip ? "#9ca3af" : "#111827"}
                                                        style={{ marginLeft: 2 }}
                                                    />
                                                </View>
                                            </View>

                                            <View style={styles.ideasListExpandedHeaderMain}>
                                                {titleBlock}
                                                {searchTagsBlock}
                                            </View>
                                        </View>

                                        <View style={styles.ideasListExpandedMetaRows}>
                                            {showExpandedProjectContextRow ? (
                                                <View style={styles.ideasListExpandedMetaGridRow}>
                                                    <View style={styles.ideasListExpandedMetaLeadSpacer} />
                                                    <View style={styles.ideasListExpandedMetaCenterCol}>
                                                        {expandedUpdatedLabel ? (
                                                            <View style={styles.ideasListMetaRow}>
                                                                <View style={styles.ideasListMetaLeftCluster}>
                                                                    <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                                                        {expandedUpdatedLabel}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                    <View style={styles.ideasListExpandedMetaRightCol}>
                                                        <View style={styles.ideasListMetaRow}>
                                                            <View style={styles.ideasListMetaRightColInner}>
                                                                {hasExpandedProjectIndicators ? renderProjectRightMeta() : null}
                                                            </View>
                                                        </View>
                                                    </View>
                                                </View>
                                            ) : null}

                                            <View style={styles.ideasListExpandedMetaGridRow}>
                                                <View style={styles.ideasListExpandedMetaLeftCol}>
                                                    <Text style={styles.ideasListLeadDurationText}>
                                                        {item.kind === "project" ? projectPrimaryDurationLabel : clipDurationLabel}
                                                    </Text>
                                                </View>

                                                <View style={styles.ideasListExpandedMetaCenterCol}>
                                                    <View style={styles.ideasListMetaRow}>
                                                        <View style={styles.ideasListMetaLeftCluster}>
                                                            <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                                                {expandedCreatedLabel}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                <View style={styles.ideasListExpandedMetaRightCol}>
                                                    <View style={styles.ideasListMetaRow}>
                                                        <View style={styles.ideasListMetaRightColInner}>
                                                            <Text style={styles.ideasListDateSizeText}>
                                                                {ideaSizeLabel}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.ideasListCardRow}>
                                        <View style={[styles.ideasListLeadCol, inlineActive ? styles.ideasListLeadColInlineActive : null]}>
                                            <View
                                                style={[
                                                    styles.ideasInlinePlayBtn,
                                                    compact ? styles.ideasInlinePlayBtnCompact : null,
                                                ]}
                                            >
                                                <Ionicons
                                                    name={inlineActive && inlinePlayer.isInlinePlaying ? "pause" : "play"}
                                                    size={15}
                                                    color={!playClip ? "#9ca3af" : "#111827"}
                                                    style={inlineActive && inlinePlayer.isInlinePlaying ? undefined : { marginLeft: 2 }}
                                                />
                                            </View>
                                            {inlineActive ? (
                                                <View style={styles.ideasInlineCloseBtn}>
                                                    <Ionicons name="stop-circle-outline" size={14} color="#64748b" />
                                                </View>
                                            ) : null}
                                            {showExpandedStaticDuration ? (
                                                <View style={styles.ideasListLeadDurationSlot}>
                                                    <Text style={styles.ideasListLeadDurationText}>
                                                        {item.kind === "project" ? projectPrimaryDurationLabel : clipDurationLabel}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <View style={[styles.ideasListCardMain, compact ? styles.ideasListCardMainCompact : null]}>
                                            <View style={styles.ideasListCardTopBlock}>
                                                {titleBlock}
                                                {searchTagsBlock}
                                            </View>

                                            <View style={styles.ideasListCardBottomBlock}>
                                                {!compact ? (
                                                    <View style={styles.ideasListExpandedMetaStack}>
                                                        {showExpandedProjectContextRow ? (
                                                            <View style={styles.ideasListMetaRow}>
                                                                <View style={styles.ideasListMetaLeftCluster}>
                                                                    {expandedUpdatedLabel ? (
                                                                        <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                                                            {expandedUpdatedLabel}
                                                                        </Text>
                                                                    ) : null}
                                                                </View>
                                                                <View style={styles.ideasListMetaRightCol}>
                                                                    {hasExpandedProjectIndicators ? renderProjectRightMeta() : null}
                                                                </View>
                                                            </View>
                                                        ) : null}

                                                        <View style={styles.ideasListMetaRow}>
                                                            <View style={styles.ideasListMetaLeftCluster}>
                                                                <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                                                    {expandedCreatedLabel}
                                                                </Text>
                                                            </View>
                                                            <View style={styles.ideasListMetaRightCol}>
                                                                <Text style={styles.ideasListDateSizeText}>
                                                                    {ideaSizeLabel}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ) : null}

                                                {compact && item.kind === "project" ? (
                                                    <View style={styles.ideasListMetaRow}>
                                                        <View style={styles.ideasListMetaLeftCluster}>
                                                            <Text style={[styles.ideasListMetaDurationText, compact ? styles.ideasListMetaDurationTextCompact : null]}>
                                                                {projectPrimaryDurationLabel}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.ideasListMetaRightCol}>
                                                            {renderCompactProjectRightMeta()}
                                                        </View>
                                                    </View>
                                                ) : compact && !inlineActive ? (
                                                    <View style={styles.ideasListMetaRow}>
                                                        <View style={styles.ideasListMetaLeftCluster}>
                                                            <Text style={[styles.ideasListMetaDurationText, compact ? styles.ideasListMetaDurationTextCompact : null]}>
                                                                {item.kind === "project" ? projectPrimaryDurationLabel : clipDurationLabel}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ) : null}

                                                {inlineActive ? (
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
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
            )}
        </View>
    );
}
