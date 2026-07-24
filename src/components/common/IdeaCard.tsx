import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";
import { NowPlayingIndicator } from "./NowPlayingIndicator";
import { WaveformStrip } from "./WaveformStrip";
import { ScrubBar } from "./ScrubBar";
import { IconButton } from "./IconButton";
import { UserText } from "../../i18n";

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
        return <UserText value={text} style={textStyle} numberOfLines={numberOfLines}>{text}</UserText>;
    }
    const lower = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    const start = lower.indexOf(lowerNeedle);
    if (start === -1 || lowerNeedle.length === 0) {
        return <UserText value={text} style={textStyle} numberOfLines={numberOfLines}>{text}</UserText>;
    }
    const end = start + needle.length;
    return (
        <UserText value={text} style={textStyle} numberOfLines={numberOfLines}>
            {text.slice(0, start)}
            <Text style={hitStyle}>{text.slice(start, end)}</Text>
            {text.slice(end)}
        </UserText>
    );
}

export type IdeaCardProps = {
    // Container visual state
    selected?: boolean;
    /** True while this card is being dragged (activates selected border) */
    isActive?: boolean;
    /** Inline audio is playing for this card */
    inlineActive?: boolean;
    /** Show warm border + terracotta title + EQ indicator when this card's clip
     *  is the active playback (inline preview OR the dock/full-player session). */
    nowPlaying?: boolean;
    /** Whether that active playback is actually playing (EQ animates) vs paused
     *  (EQ freezes to a pause glyph). */
    nowPlayingIsPlaying?: boolean;
    /** Songs (multi-take projects) get a small disc glyph before the title so
     *  they read as "a song that opens to a page", distinct from a clip. */
    isSong?: boolean;
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
    /** Earned serif: named titles get Lora; auto-named (timestamp) titles stay in
     *  quiet tabular Jakarta. Defaults to a named (serif) title. */
    titleIsAuto?: boolean;
    searchNeedle?: string;
    /** Trailing area: status badge + bookmark (list) or primary/reply/overdub (detail) */
    trailing?: ReactNode;

    // Content rows below title
    /** Sidecar peaks for the resting waveform strip (visual identity only — never
     *  a control). Pass null to show the aligned placeholder while peaks are
     *  pending; omit entirely to render no strip. Skipped in compact/denseRow. */
    waveformPeaks?: number[] | null;
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

    // Inline preview — new strip-player wiring (full-card path). While
    // inlineActive AND onInlineScrub is provided, the waveform strip itself is
    // the player (progress tint + drag-to-scrub) and the footer position shows
    // a compact control row: elapsed time left · ✕ close right. Nothing else.
    /** Live inline position as a 0..1 fraction of the clip. */
    inlineProgress?: number;
    /** Elapsed-time caption for the compact inline control row ("0:12"). */
    inlineElapsedLabel?: string;
    /** Scrub commit — final fraction on drag release. */
    onInlineScrub?: (fraction: number) => void;
    onInlineScrubStart?: () => void;
    onInlineScrubCancel?: () => void;
    /** ✕ — stop the preview. */
    onInlineClose?: () => void;

    // Inline player (legacy slider row) — still used by denseRow, and by
    // full-card callers that don't pass the strip-player props above.
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
    nowPlayingIsPlaying,
    isSong,
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
    titleIsAuto,
    searchNeedle,
    trailing,
    waveformPeaks,
    searchTagsContent,
    bodyContent,
    editContent,
    footerDate,
    footerRightContent,
    footerContent,
    inlineProgress,
    inlineElapsedLabel,
    onInlineScrub,
    onInlineScrubStart,
    onInlineScrubCancel,
    onInlineClose,
    inlinePlayerContent,
}: IdeaCardProps) {
    const { t } = useTranslation();
    // The strip is the inline player only when the caller wired the new props;
    // otherwise (InlineIdeaCard et al.) the legacy slider row still renders.
    const stripIsInlinePlayer = inlineActive && onInlineScrub != null;
    if (denseRow) {
        // Compact exists to scan and audition many clips fast — subtraction, but
        // still a real player: while this row is the active preview it EXTENDS to
        // reveal an on-brand scrub line (terracotta track + thumb) so you can move
        // through the clip without leaving the list. Play flips to pause, title
        // goes terracotta, elapsed / duration flank the draggable line, ✕ ends it.
        const denseScrubActive = inlineActive && onInlineScrub != null;
        const denseTitleActive = nowPlaying || inlineActive;
        const denseProgress = inlineActive && inlineProgress != null
            ? Math.max(0, Math.min(1, inlineProgress))
            : 0;
        return (
            <View
                style={[
                    styles.ideaDenseRow,
                    accentBorderColor
                        ? { borderLeftWidth: 3, borderLeftColor: accentBorderColor, paddingLeft: 8 }
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
                    {/* Bare play/pause glyph — no circle, no border. The 44pt hit
                        area lives in the Pressable's hitSlop. */}
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
                        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                    >
                        <Ionicons
                            name={inlineActive && isInlinePlaying ? "pause" : "play"}
                            size={15}
                            color={!canPlay ? colors.textMuted : colors.textStrong}
                            style={inlineActive && isInlinePlaying ? undefined : { marginStart: 2 }}
                        />
                    </Pressable>
                    {/* The main pressable spans title AND the meta cluster: the meta
                        (duration/badges) used to sit outside every pressable, so
                        the right half of a dense row was a dead zone — especially bad
                        in selection mode, where a tap "didn't register". Interactive
                        trailing bits (bookmark) keep their own nested Pressables. */}
                    <Pressable
                        style={[styles.ideaDenseMain, { flexDirection: "row", alignItems: "center" }]}
                        onPress={() => { void onPress(); }}
                        onLongPress={onLongPress}
                        delayLongPress={delayLongPress}
                        hitSlop={{ top: 4, bottom: 4 }}
                    >
                        {nowPlaying ? (
                            <View style={{ marginRight: 6 }}>
                                <NowPlayingIndicator playing={!!nowPlayingIsPlaying} color={colors.primary} size={12} />
                            </View>
                        ) : null}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <HighlightedText
                                text={title}
                                needle={searchNeedle}
                                textStyle={[
                                    styles.ideaDenseTitle,
                                    titleSemiBold ? styles.ideaDenseTitleProject : null,
                                    denseTitleActive ? { color: colors.primary } : null,
                                ]}
                                hitStyle={styles.ideasListCardTitleHighlight}
                                numberOfLines={1}
                            />
                        </View>
                        {denseScrubActive ? null : (
                            // Right cluster, right edge = duration. Compact keeps only
                            // the bookmark (when set), a small dot divider, then the
                            // clip length — all other metadata is dropped for density.
                            <View style={styles.ideaDenseMeta}>
                                {trailing ?? null}
                                {trailing != null ? <View style={styles.ideaDenseDot} /> : null}
                                <Text style={styles.ideaDenseDuration}>{durationLabel}</Text>
                            </View>
                        )}
                    </Pressable>
                </View>
                {denseScrubActive ? (
                    // The extend: the row grows to hold a real, draggable scrub line.
                    <View style={styles.ideaDenseScrubRow}>
                        <Text style={styles.ideaDenseDuration}>{inlineElapsedLabel ?? ""}</Text>
                        <View style={{ flex: 1 }}>
                            <ScrubBar
                                progress={denseProgress}
                                onScrub={onInlineScrub}
                                onScrubStart={onInlineScrubStart}
                                onScrubCancel={onInlineScrubCancel}
                            />
                        </View>
                        <Text style={styles.ideaDenseDuration}>{durationLabel}</Text>
                        {onInlineClose != null ? (
                            <IconButton
                                icon="close"
                                tone="muted"
                                size={15}
                                hitSlop={12}
                                onPress={onInlineClose}
                                stopPropagation
                                accessibilityLabel={t("common.stopPreview")}
                            />
                        ) : null}
                    </View>
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
                {/* Lead column: bare play/pause glyph + optional accessory */}
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
                        // 32pt glyph box + 6pt slop = 44pt effective target.
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <Ionicons
                            name={inlineActive && isInlinePlaying ? "pause" : "play"}
                            size={18}
                            color={!canPlay ? colors.textMuted : colors.textStrong}
                            style={inlineActive && isInlinePlaying ? undefined : { marginStart: 2 }}
                        />
                    </Pressable>
                    {leadAccessory ?? null}
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
                            {/* Title row: title + duration ONLY — badges live in the meta row.
                                No disc marker: a sketch is identified by its spine + ♪ N alone. */}
                            <View style={styles.ideasListCardTitleRow}>
                                {nowPlaying ? (
                                    <View style={{ marginRight: 7 }}>
                                        <NowPlayingIndicator playing={!!nowPlayingIsPlaying} color={colors.primary} size={13} />
                                    </View>
                                ) : null}
                                <HighlightedText
                                    text={title}
                                    needle={searchNeedle}
                                    textStyle={[
                                        styles.ideasListCardTitle,
                                        // Earned serif: named → Lora_500Medium (one weight for
                                        // every named title); auto-named → tabular Jakarta.
                                        titleIsAuto
                                            ? styles.ideasListCardTitleAuto
                                            : styles.ideasListCardTitleSerif,
                                        compact ? styles.ideasListCardTitleCompact : null,
                                        nowPlaying ? { color: colors.primary } : null,
                                    ]}
                                    hitStyle={styles.ideasListCardTitleHighlight}
                                    numberOfLines={1}
                                />
                                {durationLabel ? (
                                    <Text style={styles.ideasListTitleDurationText}>
                                        {durationLabel}
                                    </Text>
                                ) : null}
                            </View>

                            {/* Waveform strip — resting identity (taps fall through), OR the
                                live inline player (progress tint + drag-to-scrub) while this
                                card is the active preview. Compact cards skip the resting
                                strip but still surface it while previewing, so scrubbing is
                                never lost. */}
                            {waveformPeaks !== undefined && (!compact || stripIsInlinePlayer) ? (
                                // Fixed-geometry zone, identical at rest and while
                                // previewing: strip (flex) · reserved right slot. The slot
                                // holds the ✕ during preview and stays an empty spacer at
                                // rest, so the strip's width — and the bar pitch derived
                                // from it — never changes, and the card keeps one height.
                                <View style={styles.ideaCardStripZone}>
                                    <View style={styles.ideaCardStripFlex}>
                                        <WaveformStrip
                                            peaks={waveformPeaks}
                                            progress={
                                                inlineActive && inlineProgress != null
                                                    ? Math.max(0, Math.min(1, inlineProgress))
                                                    : undefined
                                            }
                                            onScrub={stripIsInlinePlayer ? onInlineScrub : undefined}
                                            onScrubStart={stripIsInlinePlayer ? onInlineScrubStart : undefined}
                                            onScrubCancel={stripIsInlinePlayer ? onInlineScrubCancel : undefined}
                                        />
                                    </View>
                                    <View style={styles.ideaCardStripCloseSlot}>
                                        {stripIsInlinePlayer && onInlineClose != null ? (
                                            // Same visual size/tone as the play glyph; 18pt glyph
                                            // + 13pt slop = 44pt effective target.
                                            <IconButton
                                                icon="close"
                                                tone="strong"
                                                size={18}
                                                hitSlop={13}
                                                onPress={onInlineClose}
                                                stopPropagation
                                                accessibilityLabel={t("common.stopPreview")}
                                            />
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}

                            {searchTagsContent ?? null}
                            {bodyContent ?? null}

                            {/* Meta row / inline control row */}
                            {stripIsInlinePlayer ? (
                                // The strip above is the player (✕ lives on its axis) —
                                // down here just the elapsed caption on the left.
                                <View style={styles.ideaCardInlineControlRow}>
                                    <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                        {inlineElapsedLabel ?? ""}
                                    </Text>
                                </View>
                            ) : inlineActive ? (
                                inlinePlayerContent ?? null
                            ) : footerContent != null ? (
                                trailing != null ? (
                                    <View style={styles.ideasListMetaRow}>
                                        <View style={{ flex: 1, minWidth: 0 }}>{footerContent}</View>
                                        <View style={styles.ideasListCardTrailing}>{trailing}</View>
                                    </View>
                                ) : (
                                    footerContent
                                )
                            ) : (footerDate != null || footerRightContent != null || trailing != null) ? (
                                <View style={styles.ideasListMetaRow}>
                                    {footerDate != null ? (
                                        <Text style={styles.ideasListCreatedAtText} numberOfLines={1}>
                                            {footerDate}
                                        </Text>
                                    ) : (
                                        // Keeps the right cluster pinned right when dateless.
                                        <View style={{ flex: 1 }} />
                                    )}
                                    <View style={styles.ideasListCardTrailing}>
                                        {footerRightContent ?? null}
                                        {trailing ?? null}
                                    </View>
                                </View>
                            ) : null}
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}
