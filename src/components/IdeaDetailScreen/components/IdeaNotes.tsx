import React, { useEffect, useState } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { SongNotesEditor } from "./SongNotesEditor";
import { colors } from "../../../design/tokens";

type IdeaNotesProps = {
    isEditMode: boolean;
    notes: string;
    cardStyle?: StyleProp<ViewStyle>;
    previewLines?: number;
    compactRow?: boolean;
    tabMode?: boolean;
};

export function IdeaNotes({
    isEditMode,
    notes,
    cardStyle,
    previewLines = 3,
    compactRow = false,
    tabMode = false,
}: IdeaNotesProps) {
    const [isEditingNotes, setIsEditingNotes] = useState(false);

    // Editing isn't available while the song itself is being edited.
    useEffect(() => {
        if (isEditMode) setIsEditingNotes(false);
    }, [isEditMode]);

    // A focused, keyboard-safe editor replaces the old in-place textareas.
    const editor = (
        <SongNotesEditor
            visible={isEditingNotes}
            initialNotes={notes}
            onSave={(text) => {
                appActions.setIdeaNotes(text);
                setIsEditingNotes(false);
            }}
            onClose={() => setIsEditingNotes(false)}
        />
    );

    // -- Tab mode: full-width layout for the Notes tab --
    if (tabMode && !isEditMode) {
        if (!notes.trim()) {
            return (
                <>
                    <Pressable
                        style={[styles.songNotesTabEmpty, cardStyle]}
                        onPress={() => setIsEditingNotes(true)}
                    >
                        <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
                        <Text style={styles.songNotesTabEmptyTitle}>No notes yet</Text>
                        <Text style={styles.songNotesTabEmptySubtitle}>Tap to start writing</Text>
                    </Pressable>
                    {editor}
                </>
            );
        }

        return (
            <>
                <Pressable
                    style={({ pressed }) => [
                        styles.songDetailTabPanelWrap,
                        cardStyle,
                        pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => setIsEditingNotes(true)}
                >
                    <View style={styles.songDetailMiniCardHeader}>
                        <View style={styles.songDetailMiniCardTitleWrap}>
                            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.songDetailMiniCardTitle}>Notes</Text>
                        </View>
                        <View style={styles.songDetailMiniCardActionWrap}>
                            <Text style={styles.songDetailMiniCardActionText}>Edit</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                        </View>
                    </View>
                    <Text style={styles.songNotesTabBody}>{notes.trim()}</Text>
                </Pressable>
                {editor}
            </>
        );
    }

    const actionLabel = isEditMode ? "Locked" : notes.trim() ? "Edit" : "Add";

    if (compactRow) {
        return (
            <>
                <Pressable
                    style={({ pressed }) => [
                        styles.card,
                        styles.songDetailSummaryLinkCard,
                        cardStyle,
                        isEditMode ? styles.btnDisabled : null,
                        pressed && !isEditMode ? styles.pressDown : null,
                    ]}
                    disabled={isEditMode}
                    onPress={() => setIsEditingNotes(true)}
                >
                    <View style={styles.songDetailSummaryLinkHeader}>
                        <View style={styles.songDetailSummaryLinkLead}>
                            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.songDetailSummaryLinkTitle}>Notes</Text>
                        </View>
                        <View style={styles.songDetailSummaryLinkMetaWrap}>
                            <Text style={styles.songDetailSummaryLinkMetaText}>{actionLabel}</Text>
                            {!isEditMode ? (
                                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                            ) : null}
                        </View>
                    </View>
                    <Text style={styles.songDetailSummaryLinkBody} numberOfLines={1}>
                        {notes.trim() || "No notes yet"}
                    </Text>
                </Pressable>
                {editor}
            </>
        );
    }

    return (
        <>
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    styles.songDetailMiniCard,
                    cardStyle,
                    isEditMode ? styles.btnDisabled : null,
                    pressed && !isEditMode ? styles.pressDown : null,
                ]}
                disabled={isEditMode}
                onPress={() => setIsEditingNotes(true)}
            >
                <View style={styles.songDetailMiniCardHeader}>
                    <View style={styles.songDetailMiniCardTitleWrap}>
                        <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.songDetailMiniCardTitle}>Notes</Text>
                    </View>
                    <View style={styles.songDetailMiniCardActionWrap}>
                        <Text style={styles.songDetailMiniCardActionText}>{actionLabel}</Text>
                        {!isEditMode ? (
                            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                        ) : null}
                    </View>
                </View>
                <Text style={styles.songDetailMiniCardBody} numberOfLines={previewLines}>
                    {notes.trim() || "No notes yet."}
                </Text>
            </Pressable>
            {editor}
        </>
    );
}
