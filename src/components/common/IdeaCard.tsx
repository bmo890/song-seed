import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

/** Renders title text with optional search-needle highlighting */
function HighlightedText({
    text,
    needle,
    textStyle,
    hitStyle,
    numberOfLines,
}: {
    text: string;
    needle?: string;
    textStyle: any;
    hitStyle: any;
    numberOfLines?: number;
}) {
    if (!needle) {
        return <Text style={textStyle} numberOfLines={numberOfLines}>{text}</Text>;
    }
    const lower = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    const start = lower.indexOf(lowerNeedle);
    if (start === -1 || lowerNeedle.length === 0) {
        return <Text style={textStyle} numberOfLines={numberOfLines}>{text}</Text>;
    }
    const end = start + needle.length;
    return (
        <Text style={textStyle} numberOfLines={numberOfLines}>
            {text.slice(0, start)}
            <Text style={hitStyle}>{text.slice(start, end)}</Text>
            {text.slice(end)}
        </Text>
    );
}

export type IdeaCardProps = {
    // Container visual state
    selected?: boolean;
    /** True while this card is being dragged (activates selected border) */
    isActive?: boolean;
    /** Inline audio is playing for this card */
    inlineActive?: boolean;
    /** Show warm border when a clip is currently playing */
    nowPlaying?: boolean;
    /** Drag-over inside target — scale up slightly */
    isInsideTarget?: boolean;
    /** Drag active inside — scale down slightly */
    isDragActiveInside?: boolean;
    /** Left accent bar color (workspace color for song cards) */
    accentBorderColor?: string | null;
    compact?: boolean;
    /** Flush, single-line dense row (collection "compact" density). Replaces the
     * whole card shell — small play, inline meta, hairline divider. */
    denseRow?: boolean;
    highlightValue?: Animated.Value | null;
    /** Extra styles on the outer container (e.g. parent-pick tints) */
    containerStyle?: StyleProp<ViewStyle>;
    /** Non-interactive marker pinned to the card corner, e.g. bookmarked clip. */
    cornerBadge?: ReactNode;

    // Lead column (play button + duration)
    canPlay: boolean;
    isInlinePlaying?: boolean;
    durationLabel: string;
    /** Called when the play/pause button is pressed */
    onPressLead: () => void;
    onLongPressLead?: () => void;
    /** Extra element in the lead column (e.g. stop button when inline active) */
    leadAccessory?: ReactNode;

    // Main content interaction
    onPress: () => void | Promise<void>;
    onLongPress: () => void;
    delayLongPress?: number;

    // Title area
    title: string;
    /** Use semibold weight (songs vs clips) */
    titleSemiBold?: boolean;
    searchNeedle?: string;
    /** Trailing area: status badge + bookmark (list) or primary/reply/overdub (detail) */
    trailing?: ReactNode;

    // Content rows below title
    /** Contextual tags shown below title (search match badges) */
    searchTagsContent?: ReactNode;
    /**
     * Extra body content between title and footer.
     * Used by ClipCard for notes preview and tag badges.
     * When editContent is provided, bodyContent is ignored.
     */
    bodyContent?: ReactNode;
    /**
     * When set, replaces the entire main column content (title, body, footer,
     * inline player) with this node. Used by ClipCard in edit mode.
     */
    editContent?: ReactNode;

    // Footer row
    footerDate?: string;
    footerRightContent?: ReactNode;
    /** Replaces the whole footer row (date + right content) with custom content,
     * e.g. an Activity card's action label + inline "view in collection" link. */
    footerContent?: ReactNode;

    // Inline player (shown in place of footer when inlineActive)
    inlinePlayerContent?: ReactNode;
};

/**
 * Shared card shell used by both IdeaListItem (collection page) and ClipCard
 * (song detail page). Provides a consistent warm-palette look: same outer
 * container, same lead column (play button + duration), same title typography,
 * same meta footer.
 */
export function IdeaCard({
    selected,
    isActive,
    inlineActive,
    nowPlaying,
    isInsideTarget,
    isDragActiveInside,
    accentBorderColor,
    compact,
    denseRow,
    highlightValue,
    containerStyle,
    cornerBadge,
    canPlay,
    isInlinePlaying,
    durationLabel,
    onPressLead,
    onLongPressLead,
    leadAccessory,
    onPress,
    onLongPress,
    delayLongPress = 250,
    title,
    titleSemiBold,
    searchNeedle,
    trailing,
    searchTagsContent,
    bodyContent,
    editContent,
    footerDate,
    footerRightContent,
    footerContent,
    inlinePlayerContent,
}: IdeaCardProps) {
    if (denseRow) {
        return (
            <View
                style={[
                    styles.ideaDenseRow,
                    accentBorderColor
                        ? { borderLeftWidth: 2, borderLeftColor: accentBorderColor, paddingLeft: 8 }
                        : null,
                    (selected || isActive) ? styles.ideaDenseRowSelected : null,
                    nowPlaying ? styles.ideaDenseRowNowPlaying : null,
                    containerStyle ?? null,
                ]}
            >
                {highlightValue != null ? (
                    <Animated.View
                        style={[styles.ideasListCardHighlightOverlay, { opacity: highlightValue }]}
                        pointerEvents="none"
                    />
                ) : null}
                <View style={styles.ideaDenseInner}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.ideaDensePlay,
                            pressed && canPlay ? styles.pressDown : null,
                        ]}
                        onPress={(evt) => {
                            evt.stopPropagation();
                            onPressLead();
                        }}
                        onLongPress={onLongPressLead}
                    >
                        <Ionicons
                            name={inlineActive && isInlinePlaying ? "pause" : "play"}
                            size={13}
                            color={!canPlay ? "#9ca3af" : "#111827"}
                            style={inlineActive && isInlinePlaying ? undefined : { marginLeft: 2 }}
                        />
                    </Pressable>
                    <Pressable
                        style={styles.ideaDenseMain}
                        onPress={() => { void onPress(); }}
                        onLongPress={onLongPress}
                        delayLongPress={delayLongPress}
                    >
                        <HighlightedText
                            text={title}
                            needle={searchNeedle}
                            textStyle={[
                                styles.ideaDenseTitle,
                                titleSemiBold ? styles.ideaDenseTitleProject : null,
                            ]}
                            hitStyle={styles.ideasListCardTitleHighlight}
                            numberOfLines={1}
                        />
                    </Pressable>
                    {inlineActive ? (
                        leadAccessory ?? null
                    ) : (
                        <View style={styles.ideaDenseMeta}>
                            {footerDate ? <Text style={styles.ideaDenseDate}>{footerDate}</Text> : null}
                            {footerRightContent ?? null}
                            <Text style={styles.ideaDenseDuration}>{durationLabel}</Text>
                            {trailing ?? null}
                        </View>
                    )}
                </View>
                {inlineActive ? (
                    <View style={styles.ideaDenseScrubber}>{inlinePlayerContent ?? null}</View>
                ) : null}
            </View>
        );
    }

    return (
        <View
            style={[
                styles.ideasListCard,
                compact ? styles.ideasListCardCompact : null,
                accentBorderColor ? styles.ideasListProjectCard : null,
                accentBorderColor ? { borderLeftColor: accentBorderColor } : null,
                (selected || isActive) ? styles.ideasListCardSelected : null,
                nowPlaying ? styles.ideasListCardNowPlaying : null,
                isInsideTarget ? styles.cardInsideHover : null,
                isDragActiveInside ? styles.cardActiveInside : null,
                containerStyle ?? null,
            ]}
        >
            {highlightValue != null ? (
                <Animated.View
                    style={[
                        styles.ideasListCardHighlightOverlay,
                        {
                            opacity: highlightValue,
                            transform: [
                                {
                                    scale: highlightValue.interpolate({
                                        inputRange: [0, 0.9],
                                        outputRange: [0.97, 1.05],
                                    }),
                                },
                            ],
                        },
                    ]}
                    pointerEvents="none"
                />
            ) : null}
            {cornerBadge != null ? (
                <View style={styles.ideasListCardCornerBadge} pointerEvents="none">
                    {cornerBadge}
                </View>
            ) : null}

            <View style={styles.ideasListCardRow}>
                {/* Lead column: play/pause button + optional accessory + duration */}
                <View style={styles.ideaCardLeadCol}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.ideasInlinePlayBtn,
                            pressed && canPlay ? styles.pressDown : null,
                        ]}
                        onPress={(evt) => {
                            evt.stopPropagation();
                            onPressLead();
                        }}
                        onLongPress={onLongPressLead}
                    >
                        <Ionicons
                            name={inlineActive && isInlinePlaying ? "pause" : "play"}
                            size={15}
                            color={!canPlay ? "#9ca3af" : "#111827"}
                            style={inlineActive && isInlinePlaying ? undefined : { marginLeft: 2 }}
                        />
                    </Pressable>
                    {leadAccessory ?? null}
                    {!inlineActive ? (
                        <View style={styles.ideasListLeadDurationSlot}>
                            <Text style={styles.ideasListLeadDurationText}>{durationLabel}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Main content column */}
                <Pressable
                    style={styles.ideasListCardMain}
                    onPress={() => { void onPress(); }}
                    onLongPress={onLongPress}
                    delayLongPress={delayLongPress}
                >
                    {editContent != null ? (
                        editContent
                    ) : (
                        <>
                            {/* Title row */}
                            <View style={styles.ideasListCardTop}>
                                <View style={styles.ideasListCardTopBlock}>
                                    <View style={styles.ideasListCardTitleRow}>
                                        <HighlightedText
                                            text={title}
                                            needle={searchNeedle}
                                            textStyle={[
                                                styles.ideasListCardTitle,
                                                titleSemiBold ? styles.ideasListCardTitleProject : null,
                                                compact ? styles.ideasListCardTitleCompact : null,
                                            ]}
                                            hitStyle={styles.ideasListCardTitleHighlight}
                                            numberOfLines={compact ? 1 : undefined}
                                        />
                                    </View>
                                </View>
                                {trailing != null ? (
                                    <View style={styles.ideasListCardTrailing}>{trailing}</View>
                                ) : null}
                            </View>

                            {searchTagsContent ?? null}
                            {bodyContent ?? null}

                            {/* Footer or inline player */}
                            {inlineActive ? (
                                inlinePlayerContent ?? null
                            ) : footerContent != null ? (
                                footerContent
                            ) : (footerDate != null || footerRightContent != null) ? (
                                <View style={styles.ideasListMetaRow}>
                                    {footerDate != null ? (
                                        <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                            {footerDate}
                                        </Text>
                                    ) : null}
                                    {footerRightContent ?? null}
                                </View>
                            ) : null}
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}
