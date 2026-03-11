import React, { useEffect, useState } from "react";
import { Pressable, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import { appActions } from "../../state/actions";

type IdeaNotesProps = {
    isEditMode: boolean;
    notes: string;
    cardStyle?: StyleProp<ViewStyle>;
    previewLines?: number;
    compactRow?: boolean;
};

export function IdeaNotes({
    isEditMode,
    notes,
    cardStyle,
    previewLines = 3,
    compactRow = false,
}: IdeaNotesProps) {
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [draftNotes, setDraftNotes] = useState(notes);

    useEffect(() => {
        if (!isEditingNotes) {
            setDraftNotes(notes);
        }
    }, [isEditingNotes, notes]);

    useEffect(() => {
        if (isEditMode) {
            setIsEditingNotes(false);
        }
    }, [isEditMode]);

    if (isEditingNotes && !isEditMode) {
        return (
            <View style={[styles.card, styles.songDetailEditorCard, styles.songDetailNotesEditorCard, cardStyle]}>
                <View style={styles.songDetailMiniCardHeader}>
                    <View style={styles.songDetailMiniCardTitleWrap}>
                        <Ionicons name="create-outline" size={14} color="#64748b" />
                        <Text style={styles.songDetailMiniCardTitle}>Notes</Text>
                    </View>
                    <Text style={styles.songDetailMiniCardMetaText}>Editing</Text>
                </View>
                <TextInput
                    style={styles.notesInput}
                    multiline
                    placeholder="Song notes"
                    value={draftNotes}
                    onChangeText={setDraftNotes}
                    editable
                />
                <View style={styles.songDetailMiniCardButtons}>
                    <Button
                        variant="secondary"
                        label="Cancel"
                        style={styles.songDetailMiniCardButton}
                        textStyle={styles.songDetailMiniCardButtonText}
                        onPress={() => {
                            setDraftNotes(notes);
                            setIsEditingNotes(false);
                        }}
                    />
                    <Button
                        label="Save"
                        style={styles.songDetailMiniCardButton}
                        textStyle={styles.songDetailMiniCardButtonText}
                        onPress={() => {
                            appActions.setIdeaNotes(draftNotes);
                            setIsEditingNotes(false);
                        }}
                    />
                </View>
            </View>
        );
    }

    const actionLabel = isEditMode ? "Locked" : notes.trim() ? "Edit" : "Add";

    if (compactRow && !isEditingNotes) {
        return (
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
                        <Ionicons name="create-outline" size={14} color="#64748b" />
                        <Text style={styles.songDetailSummaryLinkTitle}>Notes</Text>
                    </View>
                    <View style={styles.songDetailSummaryLinkMetaWrap}>
                        <Text style={styles.songDetailSummaryLinkMetaText}>{actionLabel}</Text>
                        {!isEditMode ? (
                            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                        ) : null}
                    </View>
                </View>
                <Text style={styles.songDetailSummaryLinkBody} numberOfLines={1}>
                    {notes.trim() || "No notes yet"}
                </Text>
            </Pressable>
        );
    }

    return (
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
                    <Ionicons name="create-outline" size={14} color="#64748b" />
                    <Text style={styles.songDetailMiniCardTitle}>Notes</Text>
                </View>
                <View style={styles.songDetailMiniCardActionWrap}>
                    <Text style={styles.songDetailMiniCardActionText}>
                        {actionLabel}
                    </Text>
                    {!isEditMode ? (
                        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                    ) : null}
                </View>
            </View>
            <Text style={styles.songDetailMiniCardBody} numberOfLines={previewLines}>
                {notes.trim() || "No notes yet."}
            </Text>
        </Pressable>
    );
}
