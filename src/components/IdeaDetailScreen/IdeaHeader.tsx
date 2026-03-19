import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { TitleInput } from "../common/TitleInput";
import { getCollectionAncestors, getCollectionById } from "../../utils";
import { AppBreadcrumbs, type AppBreadcrumbItem } from "../common/AppBreadcrumbs";
import { getCollectionHierarchyLevel, getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import { openCollectionFromContext } from "../../navigation";

type IdeaHeaderProps = {
    isEditMode: boolean;
    setIsEditMode: (v: boolean) => void;
    draftTitle: string;
    setDraftTitle: (v: string) => void;
    compactTitleMode?: boolean;
    onSave: () => void;
    onCancel: (onDiscard?: () => void) => void;
    onBack: () => void;
    onPlayAll: () => void;
    playAllDisabled?: boolean;
    onImportAudio: () => void;
};

export function IdeaHeader({
    isEditMode,
    setIsEditMode,
    draftTitle,
    setDraftTitle,
    compactTitleMode = false,
    onSave,
    onCancel,
    onBack,
    onPlayAll,
    playAllDisabled,
    onImportAudio,
}: IdeaHeaderProps) {
    const navigation = useNavigation();
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const rootNavigation = (navigation as any).getParent?.();
    const navigateRoot = (route: string, params?: object) =>
        (rootNavigation ?? navigation).navigate(route as never, params as never);

    const workspaces = useStore((s) => s.workspaces);
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
    const selectedIdeaId = useStore((s) => s.selectedIdeaId);
    // Keep zustand subscriptions on stable primitives only. Deriving workspace/idea objects inside
    // the selector can create unstable references during hydration and replay empty state into persist.
    const activeWorkspace = useMemo(
        () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
        [activeWorkspaceId, workspaces]
    );
    const selectedIdea = useMemo(
        () => activeWorkspace?.ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
        [activeWorkspace, selectedIdeaId]
    );

    const isNewProjectDraft = selectedIdea?.isDraft;

    if (!selectedIdea) return null;

    const ideaLevel = selectedIdea.kind === "project" ? "song" : "clip";
    const titleIcon = getHierarchyIconName(ideaLevel);
    const titleIconColor = getHierarchyIconColor(ideaLevel);

    const currentCollection =
        activeWorkspace && selectedIdea
            ? getCollectionById(activeWorkspace, selectedIdea.collectionId)
            : null;
    const collectionAncestors =
        currentCollection && activeWorkspace
            ? getCollectionAncestors(activeWorkspace, currentCollection.id)
            : [];
    const breadcrumbItems = useMemo<Array<AppBreadcrumbItem>>(() => {
        if (!selectedIdea) return [];

        return [
            ...(activeWorkspace
                ? [
                    {
                        key: `workspace-${activeWorkspace.id}`,
                        label: activeWorkspace.title,
                        level: "workspace" as const,
                        onPress: () => navigateRoot("Home", { screen: "Browse" }),
                        active: !currentCollection,
                    },
                ]
                : []),
            ...collectionAncestors.map((collection) => ({
                key: collection.id,
                label: collection.title,
                level: getCollectionHierarchyLevel(collection),
                onPress: () =>
                    openCollectionFromContext(navigation, {
                        collectionId: collection.id,
                        source: "detail",
                    }),
            })),
            ...(currentCollection
                ? [
                    {
                        key: currentCollection.id,
                        label: currentCollection.title,
                        level: getCollectionHierarchyLevel(currentCollection),
                        onPress: () =>
                            openCollectionFromContext(navigation, {
                                collectionId: currentCollection.id,
                                source: "detail",
                            }),
                    },
                ]
                : []),
        ];
    }, [activeWorkspace, collectionAncestors, currentCollection, navigation, navigateRoot, selectedIdea]);
    const titleLabel = selectedIdea.kind === "project" ? "SONG" : "CLIP";
    const isProject = selectedIdea.kind === "project";
    const showCompactTitle = compactTitleMode && !isEditMode;

    const titleBlockHeight = useSharedValue(0);
    const progress = useSharedValue(showCompactTitle ? 1 : 0);

    useEffect(() => {
        progress.value = withTiming(showCompactTitle ? 1 : 0, { duration: 200 });
    }, [showCompactTitle]);

    const breadcrumbsAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.5], [1, 0]),
        position: "absolute" as const,
        left: 0,
        right: 0,
    }));

    const compactTitleAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0.5, 1], [0, 1]),
    }));

    const titleBlockAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.5], [1, 0]),
        height: titleBlockHeight.value > 0
            ? interpolate(progress.value, [0.3, 1], [titleBlockHeight.value, 0])
            : undefined,
        overflow: "hidden" as const,
    }));

    return (
        <View style={styles.songDetailHeader}>
            <View style={styles.songDetailNavRow}>
                <View style={styles.songDetailNavLead}>
                    <Pressable
                        style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]}
                        onPress={onBack}
                    >
                        <Text style={styles.backBtnText}>Back</Text>
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Animated.View style={breadcrumbsAnimStyle} pointerEvents={showCompactTitle ? "none" : "auto"}>
                            <AppBreadcrumbs
                                items={breadcrumbItems}
                                containerStyle={styles.songDetailInlineBreadcrumbs}
                            />
                        </Animated.View>
                        <Animated.View style={[styles.songDetailCompactTitleWrap, compactTitleAnimStyle]} pointerEvents={showCompactTitle ? "auto" : "none"}>
                            <Ionicons name={titleIcon} size={15} color={titleIconColor} />
                            <Text style={styles.songDetailNavCompactTitle} numberOfLines={1}>
                                {selectedIdea.title}
                            </Text>
                        </Animated.View>
                    </View>
                </View>

                {isEditMode ? (
                    <View style={styles.songDetailNavEditActions}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.songDetailNavTextAction,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={() => {
                                void Haptics.selectionAsync();
                                onCancel();
                            }}
                        >
                            <Text style={styles.songDetailNavTextActionText}>
                                {selectedIdea.isDraft ? "Discard" : "Cancel"}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                styles.songDetailNavTextAction,
                                styles.songDetailNavTextActionPrimary,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={() => {
                                void Haptics.selectionAsync();
                                onSave();
                            }}
                        >
                            <Text style={styles.songDetailNavTextActionPrimaryText}>Save</Text>
                        </Pressable>
                    </View>
                ) : (
                    <Pressable
                        style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
                        onPress={() => setHeaderMenuOpen((prev) => !prev)}
                    >
                        <Ionicons name="ellipsis-horizontal" size={16} color="#334155" />
                    </Pressable>
                )}
            </View>

            <Animated.View
                style={[styles.songDetailTitleBlock, titleBlockAnimStyle]}
                onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0 && titleBlockHeight.value === 0) {
                        titleBlockHeight.value = h;
                    }
                }}
            >
                {isEditMode ? (
                    <>
                        <Text style={styles.songDetailTypeLabel}>Editing {titleLabel}</Text>
                        <TitleInput
                            value={draftTitle}
                            onChangeText={setDraftTitle}
                            placeholder={`${isProject ? "Song" : "Clip"} title`}
                            containerStyle={styles.songDetailTitleInputWrap}
                            minHeight={40}
                            maxHeight={92}
                            showGenerator={false}
                        />
                    </>
                ) : (
                    <>
                        <View style={styles.songDetailPageTitleWithIcon}>
                            <Ionicons name={titleIcon} size={14} color={titleIconColor} />
                            <Text style={styles.songDetailPageTitleLarge} numberOfLines={3}>
                                {selectedIdea.title}
                            </Text>
                        </View>
                        {isProject ? (
                            <View style={styles.songDetailProgressStrip}>
                                <Text style={styles.songDetailProgressStripLabel}>Progress:</Text>
                                <Text style={styles.songDetailProgressStripPercent}>
                                    {selectedIdea.completionPct}%
                                </Text>
                                <Text style={
                                    selectedIdea.status === "song"
                                        ? [styles.badge, styles.statusSong, styles.statusSongText]
                                        : selectedIdea.status === "semi"
                                            ? [styles.badge, styles.statusSemi, styles.statusSemiText]
                                            : selectedIdea.status === "sprout"
                                                ? [styles.badge, styles.statusSprout, styles.statusSproutText]
                                                : [styles.badge, styles.statusSeed, styles.statusSeedText]
                                }>
                                    {selectedIdea.status === "song" ? "SONG" : selectedIdea.status.toUpperCase()}
                                </Text>
                            </View>
                        ) : null}
                    </>
                )}
            </Animated.View>

            {headerMenuOpen ? (
                <View style={styles.ideasHeaderMenuLayer} pointerEvents="box-none">
                    <Pressable
                        style={styles.ideasHeaderMenuBackdrop}
                        onPress={() => setHeaderMenuOpen(false)}
                    />
                    <View style={[styles.ideasSortMenu, styles.ideasHeaderOverflowMenu]}>
                        <Pressable
                            style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                            onPress={() => {
                                setHeaderMenuOpen(false);
                                void Haptics.selectionAsync();
                                setIsEditMode(true);
                            }}
                        >
                            <Text style={styles.ideasSortMenuItemText}>
                                {isProject ? "Edit song" : "Edit clip"}
                            </Text>
                            <Ionicons name="create-outline" size={15} color="#334155" />
                        </Pressable>
                        {isProject ? (
                            <>
                                <View style={styles.ideasDropdownDivider} />
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.ideasToggleRow,
                                        playAllDisabled ? styles.btnDisabled : null,
                                        pressed ? styles.pressDown : null,
                                    ]}
                                    disabled={!!playAllDisabled}
                                    onPress={() => {
                                        setHeaderMenuOpen(false);
                                        void Haptics.selectionAsync();
                                        onPlayAll();
                                    }}
                                >
                                    <Text style={styles.ideasSortMenuItemText}>Play all</Text>
                                    <Ionicons name="play-outline" size={15} color="#334155" />
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                                    onPress={() => {
                                        setHeaderMenuOpen(false);
                                        void Haptics.selectionAsync();
                                        onImportAudio();
                                    }}
                                >
                                    <Text style={styles.ideasSortMenuItemText}>Import audio</Text>
                                    <Ionicons name="download-outline" size={15} color="#334155" />
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <View style={styles.ideasDropdownDivider} />
                                <Pressable
                                    style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                                    onPress={() => {
                                        setHeaderMenuOpen(false);
                                        void Haptics.selectionAsync();
                                        appActions.convertSelectedClipIdeaToProject();
                                    }}
                                >
                                    <Text style={styles.ideasSortMenuItemText}>Make song</Text>
                                    <Ionicons name="albums-outline" size={15} color="#334155" />
                                </Pressable>
                            </>
                        )}
                        {!isNewProjectDraft ? (
                            <>
                                <View style={styles.ideasDropdownDivider} />
                                <Pressable
                                    style={({ pressed }) => [styles.ideasToggleRow, pressed ? styles.pressDown : null]}
                                    onPress={() => {
                                        setHeaderMenuOpen(false);
                                        Alert.alert(
                                            isProject ? "Delete song?" : "Delete clip?",
                                            isProject
                                                ? `Delete "${selectedIdea.title}" and all its clips?`
                                                : `Delete "${selectedIdea.title}"?`,
                                            [
                                                { text: "Cancel", style: "cancel" },
                                                {
                                                    text: "Delete",
                                                    style: "destructive",
                                                    onPress: () => {
                                                        appActions.deleteSelectedIdea();
                                                        navigation.goBack();
                                                    },
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.songDetailDangerMenuText}>
                                        {isProject ? "Delete song" : "Delete clip"}
                                    </Text>
                                    <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                                </Pressable>
                            </>
                        ) : null}
                    </View>
                </View>
            ) : null}
        </View>
    );
}
