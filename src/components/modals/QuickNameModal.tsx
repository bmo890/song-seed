import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WarmModal } from "../common/WarmModal";
import { genIdea } from "../../utils";
import { colors, radii } from "../../design/tokens";

type Props = {
    visible: boolean;
    title?: string;
    draftValue: string;
    placeholderValue?: string;
    onChangeDraft: (val: string) => void;
    /** Optional autocomplete corpus shown as tappable chips under the name field. */
    suggestions?: string[];
    /** Tapping a suggestion calls this (e.g. to finish immediately); falls back to filling the field. */
    onSelectSuggestion?: (value: string) => void;
    descriptionValue?: string;
    onChangeDescription?: (val: string) => void;
    isPrimary?: boolean;
    onChangeIsPrimary?: (val: boolean) => void;
    onCancel: () => void;
    onSave: () => void;
    helperText?: string;
    saveLabel?: string;
    disableSaveWhenEmpty?: boolean;
    saveDisabled?: boolean;
    cancelDisabled?: boolean;
    /** Save is in flight: shows a spinner and locks both buttons against a double-tap. */
    saving?: boolean;
    destinationWorkspaceTitle?: string;
    destinationCollectionLabel?: string;
    onPressDestination?: () => void;
};

export function QuickNameModal({
    visible,
    title = "Save clip as",
    draftValue,
    placeholderValue,
    onChangeDraft,
    suggestions,
    onSelectSuggestion,
    descriptionValue,
    onChangeDescription,
    isPrimary,
    onChangeIsPrimary,
    onCancel,
    onSave,
    helperText = "Leave empty to use the suggested title.",
    saveLabel = "Save",
    disableSaveWhenEmpty = false,
    saveDisabled = false,
    cancelDisabled = false,
    saving = false,
    destinationWorkspaceTitle,
    destinationCollectionLabel,
    onPressDestination,
}: Props) {
    const isSaveDisabled =
        saving || saveDisabled || (disableSaveWhenEmpty && draftValue.trim().length === 0);
    const isCancelDisabled = saving || cancelDisabled;

    // Autocomplete: match the corpus against what's typed (prefix matches first),
    // hiding an exact match since there's nothing left to complete.
    const query = draftValue.trim().toLowerCase();
    const suggestionMatches = (suggestions ?? [])
        .filter((s) => {
            const sl = s.trim().toLowerCase();
            if (!sl) return false;
            return query ? sl.includes(query) && sl !== query : true;
        })
        .sort((a, b) => {
            if (!query) return 0;
            const rank = (x: string) => (x.toLowerCase().startsWith(query) ? 0 : 1);
            return rank(a) - rank(b);
        })
        .slice(0, 8);

    return (
        <WarmModal visible={visible} onRequestClose={onCancel} title={title}>
            {/* ── Name input with sparkle + clear ── */}
            <View style={qStyles.inputWrap}>
                <TextInput
                    testID="quickname-input"
                    style={qStyles.input}
                    value={draftValue}
                    onChangeText={onChangeDraft}
                    placeholder={placeholderValue}
                    placeholderTextColor="#B8A8A3"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={isSaveDisabled ? undefined : onSave}
                    blurOnSubmit
                />
                <View style={qStyles.inputBtns}>
                    <Pressable
                        style={({ pressed }) => [qStyles.inputIconBtn, pressed ? qStyles.pressDown : null]}
                        onPress={() => onChangeDraft(genIdea())}
                        hitSlop={6}
                    >
                        <Ionicons name="sparkles" size={14} color="#B8A8A3" />
                    </Pressable>
                    {draftValue.length > 0 ? (
                        <Pressable
                            style={({ pressed }) => [qStyles.inputIconBtn, pressed ? qStyles.pressDown : null]}
                            onPress={() => onChangeDraft("")}
                            hitSlop={6}
                        >
                            <Ionicons name="close" size={14} color="#B8A8A3" />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* ── Autocomplete suggestions ── */}
            {suggestions && suggestionMatches.length > 0 ? (
                <View style={qStyles.suggestRow}>
                    {suggestionMatches.map((s) => (
                        <Pressable
                            key={s}
                            style={({ pressed }) => [qStyles.suggestChip, pressed ? qStyles.pressDown : null]}
                            onPress={() => (onSelectSuggestion ? onSelectSuggestion(s) : onChangeDraft(s))}
                        >
                            <Text style={qStyles.suggestChipText}>{s}</Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            {/* ── Optional description input ── */}
            {onChangeDescription !== undefined ? (
                <TextInput
                    style={[qStyles.input, qStyles.descriptionInput]}
                    value={descriptionValue ?? ""}
                    onChangeText={onChangeDescription}
                    placeholder="Description (optional)"
                    placeholderTextColor="#B8A8A3"
                    multiline
                    returnKeyType="default"
                />
            ) : null}

            <Text style={qStyles.helperText}>{helperText}</Text>

            {onPressDestination ? (
                <>
                    <Text style={qStyles.destinationLabel}>Save to</Text>
                    <Pressable
                        style={({ pressed }) => [
                            qStyles.destinationRow,
                            pressed ? qStyles.pressDown : null,
                        ]}
                        onPress={onPressDestination}
                    >
                        <Ionicons name="folder-outline" size={18} color={colors.primary} />
                        <View style={qStyles.destinationCopy}>
                            {destinationWorkspaceTitle ? (
                                <Text style={qStyles.destinationWorkspace}>{destinationWorkspaceTitle}</Text>
                            ) : null}
                            <Text style={qStyles.destinationCollection} numberOfLines={1}>
                                {destinationCollectionLabel ?? "Choose a collection"}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                </>
            ) : null}

            {onChangeIsPrimary !== undefined ? (
                <Pressable
                    style={qStyles.checkRow}
                    onPress={() => onChangeIsPrimary(!isPrimary)}
                >
                    <Ionicons
                        name={isPrimary ? "checkbox" : "square-outline"}
                        size={20}
                        color={isPrimary ? colors.primary : colors.borderMuted}
                    />
                    <Text style={qStyles.checkLabel}>Make primary clip</Text>
                </Pressable>
            ) : null}

            <View style={qStyles.btnRow}>
                <Pressable
                    testID="quickname-cancel"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    style={({ pressed }) => [
                        qStyles.cancelBtn,
                        isCancelDisabled ? qStyles.btnDisabled : null,
                        pressed && !isCancelDisabled ? qStyles.pressDown : null,
                    ]}
                    disabled={isCancelDisabled}
                    onPress={onCancel}
                >
                    <Text style={qStyles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                    testID="quickname-save"
                    accessibilityRole="button"
                    accessibilityLabel={saveLabel}
                    style={({ pressed }) => [
                        qStyles.saveBtn,
                        isSaveDisabled ? qStyles.btnDisabled : null,
                        pressed && !isSaveDisabled ? qStyles.pressDown : null,
                    ]}
                    disabled={isSaveDisabled}
                    onPress={onSave}
                >
                    {saving ? (
                        <View style={qStyles.saveBtnBusy}>
                            <ActivityIndicator size="small" color={colors.surface} />
                            <Text style={qStyles.saveBtnText}>Saving…</Text>
                        </View>
                    ) : (
                        <Text style={qStyles.saveBtnText}>{saveLabel}</Text>
                    )}
                </Pressable>
            </View>
        </WarmModal>
    );
}

const qStyles = StyleSheet.create({
    inputWrap: {
        position: "relative",
    },
    input: {
        borderWidth: 1,
        borderColor: "rgba(215,194,189,0.6)",
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingLeft: 14,
        paddingRight: 72,
        paddingVertical: 10,
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 16,
        lineHeight: 22,
        color: "#1C1C19",
    },
    descriptionInput: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        minHeight: 60,
        paddingRight: 14,
    },
    inputBtns: {
        position: "absolute",
        right: 10,
        top: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    inputIconBtn: {
        width: 26,
        height: 26,
        borderRadius: radii.round,
        backgroundColor: colors.surfaceContainer,
        alignItems: "center",
        justifyContent: "center",
    },
    suggestRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 10,
    },
    suggestChip: {
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.xl,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    suggestChipText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.textStrong,
    },
    helperText: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        lineHeight: 18,
        color: colors.textSecondary,
        marginTop: 8,
    },
    destinationLabel: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 11,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 14,
        marginBottom: 6,
    },
    destinationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        borderWidth: 1,
        borderColor: "rgba(215,194,189,0.6)",
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    destinationCopy: {
        flex: 1,
        gap: 1,
    },
    destinationWorkspace: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 11,
        color: colors.textMuted,
    },
    destinationCollection: {
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 14,
        color: colors.textPrimary,
    },
    checkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
    },
    checkLabel: {
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 14,
        color: colors.textStrong,
    },
    btnRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 20,
    },
    cancelBtn: {
        height: 42,
        paddingHorizontal: 18,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: "rgba(215,194,189,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtnText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: colors.textSecondary,
    },
    saveBtn: {
        height: 42,
        minWidth: 92,
        paddingHorizontal: 20,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    saveBtnBusy: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    saveBtnText: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 13,
        color: colors.surface,
    },
    btnDisabled: {
        opacity: 0.45,
    },
    pressDown: {
        opacity: 0.8,
        transform: [{ scale: 0.97 }],
    },
});
