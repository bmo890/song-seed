import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../clipGraph";
import { FilterSortControls } from "../common/FilterSortControls";
import {
    getSongClipTagFilterSummary,
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
    visibleIdeaCount,
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
    visibleIdeaCount: number;
}) {
    const clipSelectionMode = useStore((s) => s.clipSelectionMode);

    const selectedIdea = useStore((s) => {
        const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
        return ws?.ideas.find((i) => i.id === s.selectedIdeaId);
    });

    if (!selectedIdea || clipSelectionMode) return null;

    const sectionTitle = selectedIdea.kind === "project" ? "Ideas" : "Replies";
    const sectionCount = visibleIdeaCount;

    return (
        <View style={styles.songDetailSectionHeaderStack}>
            <View style={styles.songDetailSectionHeader}>
                <View style={styles.songDetailSectionHeaderCopy}>
                    <Text style={styles.songDetailSectionTitle}>{sectionTitle}</Text>
                    <Text style={styles.songDetailSectionMeta}>{sectionCount}</Text>
                </View>
                {selectedIdea.kind === "project" ? (
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
                ) : null}
            </View>
            {selectedIdea.kind === "project" ? (
                <FilterSortControls
                    filter={{
                        active: clipTagFilter !== "all",
                        valueIcon: "pricetag-outline",
                        onClear: () => setClipTagFilter("all"),
                        renderMenu: ({ close }) => (
                            <View style={styles.ideasDropdownSectionStack}>
                                <View style={styles.ideasDropdownSectionToggle}>
                                    <Text style={styles.ideasDropdownSectionToggleText}>Tags</Text>
                                    <View style={styles.ideasDropdownSectionMeta}>
                                        <Text style={styles.ideasDropdownSectionMetaText}>
                                            {getSongClipTagFilterSummary(clipTagFilter)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.ideasStageChipsWrap}>
                                    {([
                                        { key: "all", label: "All" },
                                        { key: "untagged", label: "Untagged" },
                                        ...SONG_CLIP_TAG_OPTIONS,
                                    ] as const).map((option) => {
                                        const active = clipTagFilter === option.key;
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
                                                    close();
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
                            </View>
                        ),
                    }}
                    sort={
                        clipViewMode === "timeline"
                            ? {
                                active:
                                    timelineSortMetric !== "created" ||
                                    timelineSortDirection !== "asc",
                                valueIcon: getSongTimelineSortMetricIcon(timelineSortMetric),
                                direction: timelineSortDirection,
                                renderMenu: ({ close }) => (
                                    <>
                                        <View style={styles.ideasSortDirectionRow}>
                                            <Text style={styles.ideasDropdownSectionToggleText}>Direction</Text>
                                            <View style={styles.ideasSortDirectionControls}>
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.ideasSortDirectionChip,
                                                        timelineSortDirection === "asc"
                                                            ? styles.ideasSortDirectionChipActive
                                                            : null,
                                                        pressed ? styles.pressDown : null,
                                                    ]}
                                                    onPress={() => setTimelineSortDirection("asc")}
                                                >
                                                    <Ionicons
                                                        name="arrow-up"
                                                        size={14}
                                                        color={
                                                            timelineSortDirection === "asc"
                                                                ? "#ffffff"
                                                                : "#475569"
                                                        }
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.ideasSortDirectionChipText,
                                                            timelineSortDirection === "asc"
                                                                ? styles.ideasSortDirectionChipTextActive
                                                                : null,
                                                        ]}
                                                    >
                                                        Asc
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.ideasSortDirectionChip,
                                                        timelineSortDirection === "desc"
                                                            ? styles.ideasSortDirectionChipActive
                                                            : null,
                                                        pressed ? styles.pressDown : null,
                                                    ]}
                                                    onPress={() => setTimelineSortDirection("desc")}
                                                >
                                                    <Ionicons
                                                        name="arrow-down"
                                                        size={14}
                                                        color={
                                                            timelineSortDirection === "desc"
                                                                ? "#ffffff"
                                                                : "#475569"
                                                        }
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.ideasSortDirectionChipText,
                                                            timelineSortDirection === "desc"
                                                                ? styles.ideasSortDirectionChipTextActive
                                                                : null,
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
                                                        close();
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
                                    </>
                                ),
                            }
                            : undefined
                    }
                />
            ) : null}
        </View>
    );
}
