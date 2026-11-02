import React, { useEffect, useState } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../styles";
import { appActions } from "../../../state/actions";
import { SongNotesEditor } from "./SongNotesEditor";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";
import { useStore } from "../../../state/useStore";
import { readOnlyLabelKey, useReadOnlyIdeaReason } from "../../../hooks/useReadOnly";

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
    const { t } = useTranslation();
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    // The notes belong to the selected idea; read-only there means read, not write.
    const selectedIdeaId = useStore((s) => s.selectedIdeaId);
    const readOnlyReason = useReadOnlyIdeaReason(selectedIdeaId);
    const readOnly = readOnlyReason !== null;
    // The editor saves to the idea it opened on, whatever is selected by then.
    const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
    const openEditor = () => {
        setEditingIdeaId(selectedIdeaId);
        setIsEditingNotes(true);
    };

    // Editing isn't available while the song itself is being edited.
    useEffect(() => {
        if (isEditMode) setIsEditingNotes(false);
    }, [isEditMode]);

    // A focused, keyboard-safe editor replaces the old in-place textareas.
    const editor = (
        <SongNotesEditor
            visible={isEditingNotes}
            ideaId={editingIdeaId}
            initialNotes={notes}
            onSave={(text) => {
                appActions.setIdeaNotes(text, editingIdeaId ?? undefined);
                setIsEditingNotes(false);
            }}
            onClose={() => setIsEditingNotes(false)}
        />
    );

    // -- Tab mode (2026-10-15): the notes ARE the page. No heading under the
    // Notes tab, no EDIT key: the words sit on the paper, and a tap anywhere
    // on the page opens the same keyboard-safe editor. Empty, the page shows
    // a quiet line where the writing will go.
    if (tabMode && !isEditMode) {
        const text = notes.trim();
        return (
            <>
                <Pressable
                    style={({ pressed }) => [styles.songNotesTabPage, cardStyle, pressed && !readOnly ? styles.pressDown : null]}
                    disabled={readOnly}
                    onPress={openEditor}
                    accessibilityRole="button"
                    accessibilityLabel={t("songDetail.notes")}
                    accessibilityHint={t("songDetail.notesEmptyPlaceholder")}
                >
                    {text ? (
                        <UserText align="content" value={text} style={styles.songNotesTabText}>
                            {text}
                        </UserText>
                    ) : readOnlyReason ? (
                        <Text style={styles.songNotesTabPlaceholder}>{t(readOnlyLabelKey(readOnlyReason))}</Text>
                    ) : (
                        <Text style={styles.songNotesTabPlaceholder}>{t("songDetail.notesEmptyPlaceholder")}</Text>
                    )}
                </Pressable>
                {editor}
            </>
        );
    }

    const actionLabel = isEditMode ? t("songDetail.locked") : notes.trim() ? t("songDetail.edit") : t("songDetail.add");

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
                    onPress={openEditor}
                >
                    <View style={styles.songDetailSummaryLinkHeader}>
                        <View style={styles.songDetailSummaryLinkLead}>
                            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.songDetailSummaryLinkTitle}>{t("songDetail.notes")}</Text>
                        </View>
                        <View style={styles.songDetailSummaryLinkMetaWrap}>
                            <Text style={styles.songDetailSummaryLinkMetaText}>{actionLabel}</Text>
                            {!isEditMode ? (
                                <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
                            ) : null}
                        </View>
                    </View>
                    <UserText align="content" value={notes.trim()} style={styles.songDetailSummaryLinkBody} numberOfLines={1}>
                        {notes.trim() || t("songDetail.noNotes")}
                    </UserText>
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
                    pressed && !isEditMode && !readOnly ? styles.pressDown : null,
                ]}
                disabled={isEditMode || readOnly}
                onPress={openEditor}
            >
                <View style={styles.songDetailMiniCardHeader}>
                    <View style={styles.songDetailMiniCardTitleWrap}>
                        <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.songDetailMiniCardTitle}>{t("songDetail.notes")}</Text>
                    </View>
                    <View style={styles.songDetailMiniCardActionWrap}>
                        <Text style={styles.songDetailMiniCardActionText}>{actionLabel}</Text>
                        {!isEditMode ? (
                            <Ionicons name={dirIcon("chevron-forward")} size={14} color={colors.textMuted} />
                        ) : null}
                    </View>
                </View>
                <UserText align="content" value={notes.trim()} style={styles.songDetailMiniCardBody} numberOfLines={previewLines}>
                    {notes.trim() || t("songDetail.noNotesPeriod")}
                </UserText>
            </Pressable>
            {editor}
        </>
    );
}
