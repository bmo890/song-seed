import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WarmModal } from "../common/WarmModal";
import { genIdea } from "../../utils";

type Props = {
    visible: boolean;
    title?: string;
    draftValue: string;
    placeholderValue?: string;
    onChangeDraft: (val: string) => void;
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
};

export function QuickNameModal({
    visible,
    title = "Save clip as",
    draftValue,
    placeholderValue,
    onChangeDraft,
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
}: Props) {
    const isSaveDisabled = saveDisabled || (disableSaveWhenEmpty && draftValue.trim().length === 0);

    return (
        <WarmModal visible={visible} onRequestClose={onCancel} title={title}>
            {/* ── Name input with sparkle + clear ── */}
            <View style={qStyles.inputWrap}>
                <TextInput
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

            {onChangeIsPrimary !== undefined ? (
                <Pressable
                    style={qStyles.checkRow}
                    onPress={() => onChangeIsPrimary(!isPrimary)}
                >
                    <Ionicons
                        name={isPrimary ? "checkbox" : "square-outline"}
                        size={20}
                        color={isPrimary ? "#B87D6B" : "#D7C2BD"}
                    />
                    <Text style={qStyles.checkLabel}>Make primary clip</Text>
                </Pressable>
            ) : null}

            <View style={qStyles.btnRow}>
                <Pressable
                    style={({ pressed }) => [
                        qStyles.cancelBtn,
                        cancelDisabled ? qStyles.btnDisabled : null,
                        pressed && !cancelDisabled ? qStyles.pressDown : null,
                    ]}
                    disabled={cancelDisabled}
                    onPress={onCancel}
                >
                    <Text style={qStyles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [
                        qStyles.saveBtn,
                        isSaveDisabled ? qStyles.btnDisabled : null,
                        pressed && !isSaveDisabled ? qStyles.pressDown : null,
                    ]}
                    disabled={isSaveDisabled}
                    onPress={onSave}
                >
                    <Text style={qStyles.saveBtnText}>{saveLabel}</Text>
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
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
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
        borderRadius: 13,
        backgroundColor: "#F4F1ED",
        alignItems: "center",
        justifyContent: "center",
    },
    helperText: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 12,
        lineHeight: 18,
        color: "#84736f",
        marginTop: 8,
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
        color: "#524440",
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
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(215,194,189,0.6)",
        alignItems: "center",
        justifyContent: "center",
    },
    cancelBtnText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 13,
        color: "#84736f",
    },
    saveBtn: {
        height: 42,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: "#B87D6B",
        alignItems: "center",
        justifyContent: "center",
    },
    saveBtnText: {
        fontFamily: "PlusJakartaSans_700Bold",
        fontSize: 13,
        color: "#ffffff",
    },
    btnDisabled: {
        opacity: 0.45,
    },
    pressDown: {
        opacity: 0.8,
        transform: [{ scale: 0.97 }],
    },
});
