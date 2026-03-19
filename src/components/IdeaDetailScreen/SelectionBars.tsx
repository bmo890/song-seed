import React, { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { shareAudioClips } from "../../services/audioStorage";
import type { SongIdea } from "../../types";

const EMPTY_IDEAS: SongIdea[] = [];

type SelectionBarsProps = {
    onStartSetParent: (clipIds: string[]) => void;
    onMakeRoot: (clipIds: string[]) => void;
};

export function SelectionBars({ onStartSetParent, onMakeRoot }: SelectionBarsProps) {
    const navigation = useNavigation();
    const clipSelectionMode = useStore((s) => s.clipSelectionMode);
    const selectedClipIds = useStore((s) => s.selectedClipIds);
    const replaceClipSelection = useStore((s) => s.replaceClipSelection);
    const movingClipId = useStore((s) => s.movingClipId);
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
    const selectedIdeaId = useStore((s) => s.selectedIdeaId);
    const workspaces = useStore((s) => s.workspaces);
    const ideas = React.useMemo(
        () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas ?? EMPTY_IDEAS,
        [workspaces, activeWorkspaceId]
    );
    const selectedIdea = React.useMemo(
        () => ideas.find((i) => i.id === selectedIdeaId),
        [ideas, selectedIdeaId]
    );
    const [isSharing, setIsSharing] = useState(false);

    const shareableClips = (selectedIdea?.clips ?? [])
        .filter((clip) => selectedClipIds.includes(clip.id) && !!clip.audioUri)
        .map((clip) => ({
            title: clip.title,
            audioUri: clip.audioUri!,
        }));
    const selectableClipIds = (selectedIdea?.clips ?? []).map((clip) => clip.id);
    const allSelectableSelected =
        selectableClipIds.length > 0 && selectableClipIds.every((id) => selectedClipIds.includes(id));
    const canDeselectAll = allSelectableSelected || (selectableClipIds.length === 0 && selectedClipIds.length > 0);

    const targetProjects = ideas.filter((i) => i.kind === "project" && i.id !== selectedIdea?.id);
    const playableSelectedCount = (selectedIdea?.clips ?? []).filter((clip) => selectedClipIds.includes(clip.id) && !!clip.audioUri).length;

    function handlePlaySelected() {
        if (!selectedIdea) return;
        const queue = selectedIdea.clips
            .filter((clip) => selectedClipIds.includes(clip.id) && !!clip.audioUri)
            .map((clip) => ({
                ideaId: selectedIdea.id,
                clipId: clip.id,
            }));
        if (queue.length === 0) {
            Alert.alert("Nothing to play", "None of the selected clips have playable audio yet.");
            return;
        }
        useStore.getState().setPlayerQueue(queue, 0, true);
        navigation.navigate("Player" as never);
    }

    async function handleShareSelected() {
        if (shareableClips.length === 0 || isSharing) return;

        try {
            setIsSharing(true);
            await shareAudioClips(
                shareableClips,
                selectedIdea ? `${selectedIdea.title} Clips` : "SongSeed Clips"
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not share the selected clips.";
            Alert.alert("Share failed", message);
        } finally {
            setIsSharing(false);
        }
    }

    function handleClipboardAction(mode: "copy" | "move") {
        appActions.startClipboardFromProject(mode);
        Alert.alert(
            mode === "copy" ? "Copy ready" : "Move ready",
            mode === "copy"
                ? "Tap \"Paste clips here\" in this song to duplicate them, or open another song and paste there."
                : "Open the destination song and tap \"Paste clips here\" to finish moving these clips."
        );
    }

    return (
        <>
            {clipSelectionMode ? (
                <View style={styles.songSelectionBar}>
                    <View style={styles.songSelectionBarHeader}>
                        <Text style={styles.selectionText}>{selectedClipIds.length} selected</Text>
                    </View>
                    <View style={styles.songSelectionBarActions}>
                        <Button
                            variant="secondary"
                            label={`Play selected (${playableSelectedCount})`}
                            disabled={playableSelectedCount === 0}
                            onPress={handlePlaySelected}
                        />
                        <Button
                            variant="secondary"
                            label={canDeselectAll ? "Deselect all" : "Select all"}
                            disabled={!canDeselectAll && selectableClipIds.length === 0}
                            onPress={() => replaceClipSelection(canDeselectAll ? [] : selectableClipIds)}
                        />
                        <Button
                            variant="secondary"
                            label={isSharing ? "Sharing..." : `Share (${shareableClips.length})`}
                            disabled={isSharing || shareableClips.length === 0}
                            onPress={() => {
                                void handleShareSelected();
                            }}
                        />
                        <Button
                            variant="secondary"
                            label="Set parent..."
                            onPress={() => onStartSetParent(selectedClipIds)}
                        />
                        <Button
                            variant="secondary"
                            label="Make root"
                            onPress={() => onMakeRoot(selectedClipIds)}
                        />
                        <Button
                            variant="secondary"
                            label="Copy"
                            onPress={() => handleClipboardAction("copy")}
                        />
                        <Button
                            variant="secondary"
                            label="Move"
                            onPress={() => handleClipboardAction("move")}
                        />
                        <Pressable
                            style={styles.dangerBtn}
                            onPress={() => {
                                Alert.alert(
                                    "Delete clips?",
                                    "Are you sure you want to remove these clips from the song?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Delete", style: "destructive", onPress: appActions.deleteSelectedClips }
                                    ]
                                );
                            }}
                        >
                            <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                        </Pressable>
                        <Button variant="secondary" label="Done" onPress={() => useStore.getState().cancelClipSelection()} />
                    </View>
                </View>
            ) : null}

            {movingClipId ? (
                <View style={styles.songSelectionBar}>
                    <View style={styles.songSelectionBarHeader}>
                        <Text style={styles.selectionText}>Move clip to:</Text>
                    </View>
                    <View style={styles.songSelectionBarActions}>
                        {targetProjects.map((project) => (
                            <Button
                                key={project.id}
                                variant="secondary"
                                label={project.title}
                                onPress={() => appActions.moveClipToProject(project.id)}
                            />
                        ))}
                        <Button variant="secondary" label="Cancel" onPress={() => useStore.getState().setMovingClipId(null)} />
                    </View>
                </View>
            ) : null}
        </>
    );
}
