import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../clipGraph";
import type { CustomTagDefinition } from "../../types";
import {
    getTagColor,
    getSongClipTagFilterSummary,
    getSongMainTakeFilterSummary,
    getSongTimelineSortMetricIcon,
    SONG_CLIP_TAG_OPTIONS,
    type SongClipTagFilter,
} from "./songClipControls";

export function ActionButtons({
    isEditMode,
    clipViewMode,
    setClipViewMode,
    timelineSortMetric,
    setTimelineSortMetric,
    timelineSortDirection,
    setTimelineSortDirection,
    clipTagFilter,
    setClipTagFilter,
    timelineMainTakesOnly,
    setTimelineMainTakesOnly,
    visibleIdeaCount,
    projectCustomTags,
    globalCustomTags,
}: {
    isEditMode: boolean;
    clipViewMode: "timeline" | "evolution";
    setClipViewMode: (mode: "timeline" | "evolution") => void;
    timelineSortMetric: SongTimelineSortMetric;
    setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
    timelineSortDirection: SongTimelineSortDirection;
    setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
    clipTagFilter: SongClipTagFilter;
    setClipTagFilter: (filter: SongClipTagFilter) => void;
    timelineMainTakesOnly: boolean;
    setTimelineMainTakesOnly: (value: boolean) => void;
    visibleIdeaCount: number;
    projectCustomTags?: CustomTagDefinition[];
    globalCustomTags?: CustomTagDefinition[];
}) {
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);

    const clipSelectionMode = useStore((s) => s.clipSelectionMode);
    const globalCustomTagsFromStore = useStore((s) => s.globalCustomClipTags);
    const workspaces = useStore((s) => s.workspaces);
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
    const selectedIdeaId = useStore((s) => s.selectedIdeaId);
    // Stabilize derived idea lookups outside the selector so hydration cannot churn a new object
    // here and cascade into another persist write while the store is still bootstrapping.
    const activeWorkspace = useMemo(
        () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
        [activeWorkspaceId, workspaces]
    );
    const selectedIdea = useMemo(
        () => activeWorkspace?.ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
        [activeWorkspace, selectedIdeaId]
    );

    const resolvedProjectCustomTags = projectCustomTags ?? selectedIdea?.customTags ?? [];
    const resolvedGlobalCustomTags = globalCustomTags ?? globalCustomTagsFromStore;

    if (!selectedIdea || clipSelectionMode) return null;

    const sectionTitle = selectedIdea.kind === "project" ? "Ideas" : "Replies";
    const isFilterActive = clipTagFilter !== "all" || (clipViewMode === "timeline" && timelineMainTakesOnly);
    const isSortActive = clipViewMode === "timeline" && (timelineSortMetric !== "created" || timelineSortDirection !== "desc");

    const closeMenus = () => {
        setFilterMenuOpen(false);
        setSortMenuOpen(false);
    };

    return (
        <View style={styles.songDetailSectionHeaderStack}>
            {/* Line 1: section label + count */}
            <View style={styles.songDetailSectionHeaderCopy}>
                <Text style={styles.songDetailSectionTitle}>{sectionTitle}</Text>
                <Text style={styles.songDetailSectionMeta}>{visibleIdeaCount}</Text>
            </View>

            {/* Line 2: filter chips (left) + view toggle (right) */}
            {selectedIdea.kind === "project" ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 30 }}>
                    {filterMenuOpen || sortMenuOpen ? (
                        <Pressable style={styles.ideasToolbarBackdrop} onPress={closeMenus} />
                    ) : null}

                    {/* Filter + Sort chips */}
                    <View style={styles.ideasUtilityRowLeft}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.ideasUtilityChip,
                                styles.ideasUtilityChipFilterOnly,
                                filterMenuOpen ? styles.ideasUtilityChipOpen : null,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={() => {
                                setFilterMenuOpen((prev) => !prev);
                                setSortMenuOpen(false);
                            }}
                        >
                            <Ionicons
                                name={(isFilterActive ? "funnel" : "funnel-outline") as any}
                                size={15}
                                color={isFilterActive ? "#0f172a" : "#475569"}
                            />
                            <View
                                style={[
                                    styles.ideasUtilityChipDivider,
                                    isFilterActive ? styles.ideasUtilityChipDividerActive : null,
                                ]}
                            />
                            <Ionicons name="pricetag-outline" size={16} color="#475569" />
                        </Pressable>

                        {isFilterActive ? (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.ideasUtilityClearIconBtn,
                                    pressed ? styles.pressDown : null,
                                ]}
                                onPress={() => {
                                    setClipTagFilter("all");
                                    setTimelineMainTakesOnly(false);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Clear filters"
                            >
                                <Ionicons name="close" size={12} color="#64748b" />
                            </Pressable>
                        ) : null}

                        {clipViewMode === "timeline" ? (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.ideasUtilityChip,
                                    styles.ideasUtilityChipSortOnly,
                                    sortMenuOpen ? styles.ideasUtilityChipOpen : null,
                                    pressed ? styles.pressDown : null,
                                ]}
                                onPress={() => {
                                    setSortMenuOpen((prev) => !prev);
                                    setFilterMenuOpen(false);
                                }}
                            >
                                <View style={styles.ideasSortChipIconStack}>
                                    <Ionicons
                                        name="arrow-up"
                                        size={11}
                                        color={timelineSortDirection === "asc" ? "#0f172a" : "#94a3b8"}
                                    />
                                    <Ionicons
                                        name="arrow-down"
                                        size={11}
                                        color={timelineSortDirection === "desc" ? "#0f172a" : "#94a3b8"}
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.ideasUtilityChipDivider,
                                        isSortActive || sortMenuOpen ? styles.ideasUtilityChipDividerActive : null,
                                    ]}
                                />
                                <Ionicons
                                    name={getSongTimelineSortMetricIcon(timelineSortMetric) as any}
                                    size={14}
                                    color={isSortActive ? "#0f172a" : "#475569"}
                                />
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Evolution / Timeline toggle */}
                    <View style={styles.songDetailViewToggle}>
                        <Pressable
                            style={[
                                styles.songDetailViewToggleOption,
                                clipViewMode === "evolution" ? styles.songDetailViewToggleOptionActive : null,
                            ]}
                            onPress={() => setClipViewMode("evolution")}
                        >
                            <Text
                                style={[
                                    styles.songDetailViewToggleText,
                                    clipViewMode === "evolution" ? styles.songDetailViewToggleTextActive : null,
                                ]}
                            >
                                Evolution
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.songDetailViewToggleOption,
                                clipViewMode === "timeline" ? styles.songDetailViewToggleOptionActive : null,
                            ]}
                            onPress={() => setClipViewMode("timeline")}
                        >
                            <Text
                                style={[
                                    styles.songDetailViewToggleText,
                                    clipViewMode === "timeline" ? styles.songDetailViewToggleTextActive : null,
                                ]}
                            >
                                Timeline
                            </Text>
                        </Pressable>
                    </View>

                    {/* Filter dropdown */}
                    {filterMenuOpen ? (
                        <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: 0, top: 38 }]}>
                            <View style={styles.ideasDropdownSectionToggle}>
                                <Text style={styles.ideasDropdownSectionToggleText}>Tags</Text>
                                <View style={styles.ideasDropdownSectionMeta}>
                                    <Text style={styles.ideasDropdownSectionMetaText}>
                                        {getSongClipTagFilterSummary(clipTagFilter, resolvedProjectCustomTags, resolvedGlobalCustomTags)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.ideasStageChipsWrap}>
                                {([
                                    { key: "all", label: "All" },
                                    { key: "untagged", label: "Untagged" },
                                    ...SONG_CLIP_TAG_OPTIONS,
                                    ...resolvedProjectCustomTags.map((t) => ({ key: t.key, label: t.label })),
                                    ...resolvedGlobalCustomTags.map((t) => ({ key: t.key, label: t.label })),
                                ] as { key: string; label: string }[]).map((option) => {
                                    const active = clipTagFilter === option.key;
                                    const customColor =
                                        option.key !== "all" && option.key !== "untagged"
                                            ? getTagColor(option.key, resolvedProjectCustomTags, resolvedGlobalCustomTags)
                                            : null;
                                    const isCustom =
                                        !SONG_CLIP_TAG_OPTIONS.some((t) => t.key === option.key) &&
                                        option.key !== "all" &&
                                        option.key !== "untagged";
                                    return (
                                        <Pressable
                                            key={option.key}
                                            style={({ pressed }) => [
                                                styles.ideasStageChip,
                                                active ? styles.ideasStageChipActive : null,
                                                pressed ? styles.pressDown : null,
                                            ]}
                                            onPress={() => {
                                                setClipTagFilter(option.key);
                                                setFilterMenuOpen(false);
                                            }}
                                        >
                                            {isCustom && customColor ? (
                                                <View
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: customColor.text,
                                                        marginRight: 2,
                                                    }}
                                                />
                                            ) : null}
                                            <Text
                                                style={[
                                                    styles.ideasStageChipText,
                                                    active ? styles.ideasStageChipTextActive : null,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {clipViewMode === "timeline" ? (
                                <>
                                    <View style={styles.ideasDropdownDivider} />
                                    <View style={styles.ideasDropdownSectionToggle}>
                                        <Text style={styles.ideasDropdownSectionToggleText}>Display</Text>
                                        <View style={styles.ideasDropdownSectionMeta}>
                                            <Text style={styles.ideasDropdownSectionMetaText}>
                                                {getSongMainTakeFilterSummary(timelineMainTakesOnly)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.ideasStageChipsWrap}>
                                        {([
                                            { key: "all", label: "All takes", value: false },
                                            { key: "main", label: "Main takes only", value: true },
                                        ] as const).map((option) => {
                                            const active = timelineMainTakesOnly === option.value;
                                            return (
                                                <Pressable
                                                    key={option.key}
                                                    style={({ pressed }) => [
                                                        styles.ideasStageChip,
                                                        active ? styles.ideasStageChipActive : null,
                                                        pressed ? styles.pressDown : null,
                                                    ]}
                                                    onPress={() => {
                                                        setTimelineMainTakesOnly(option.value);
                                                        setFilterMenuOpen(false);
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.ideasStageChipText,
                                                            active ? styles.ideasStageChipTextActive : null,
                                                        ]}
                                                    >
                                                        {option.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Sort dropdown */}
                    {sortMenuOpen ? (
                        <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: 0, top: 38 }]}>
                            <View style={styles.ideasSortDirectionRow}>
                                <Text style={styles.ideasDropdownSectionToggleText}>Direction</Text>
                                <View style={styles.ideasSortDirectionControls}>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.ideasSortDirectionChip,
                                            timelineSortDirection === "asc" ? styles.ideasSortDirectionChipActive : null,
                                            pressed ? styles.pressDown : null,
                                        ]}
                                        onPress={() => setTimelineSortDirection("asc")}
                                    >
                                        <Ionicons
                                            name="arrow-up"
                                            size={14}
                                            color={timelineSortDirection === "asc" ? "#ffffff" : "#475569"}
                                        />
                                        <Text
                                            style={[
                                                styles.ideasSortDirectionChipText,
                                                timelineSortDirection === "asc" ? styles.ideasSortDirectionChipTextActive : null,
                                            ]}
                                        >
                                            Asc
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.ideasSortDirectionChip,
                                            timelineSortDirection === "desc" ? styles.ideasSortDirectionChipActive : null,
                                            pressed ? styles.pressDown : null,
                                        ]}
                                        onPress={() => setTimelineSortDirection("desc")}
                                    >
                                        <Ionicons
                                            name="arrow-down"
                                            size={14}
                                            color={timelineSortDirection === "desc" ? "#ffffff" : "#475569"}
                                        />
                                        <Text
                                            style={[
                                                styles.ideasSortDirectionChipText,
                                                timelineSortDirection === "desc" ? styles.ideasSortDirectionChipTextActive : null,
                                            ]}
                                        >
                                            Desc
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                            <View style={styles.ideasDropdownDivider} />
                            {([
                                { key: "created", label: "Created", icon: "calendar-outline" },
                                { key: "title", label: "Title", icon: "text-outline" },
                                { key: "length", label: "Length", icon: "time-outline" },
                            ] as const).map((option) => {
                                const active = timelineSortMetric === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        style={({ pressed }) => [
                                            styles.ideasSortMenuItem,
                                            active ? styles.ideasSortMenuItemActive : null,
                                            pressed ? styles.pressDown : null,
                                        ]}
                                        onPress={() => {
                                            setTimelineSortMetric(option.key);
                                            setSortMenuOpen(false);
                                        }}
                                    >
                                        <View style={styles.ideasMenuItemLead}>
                                            <Ionicons
                                                name={option.icon as any}
                                                size={15}
                                                color={active ? "#0f172a" : "#64748b"}
                                            />
                                            <Text
                                                style={[
                                                    styles.ideasSortMenuItemText,
                                                    active ? styles.ideasSortMenuItemTextActive : null,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </View>
                                        {active ? (
                                            <Ionicons name="checkmark" size={15} color="#0f172a" />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
