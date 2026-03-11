import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import { TitleInput } from "../common/TitleInput";

type Props = {
    visible: boolean;
    title?: string;
    draftValue: string;
    placeholderValue?: string;
    onChangeDraft: (val: string) => void;
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
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <Text style={styles.title}>{title}</Text>
                    <TitleInput
                        value={draftValue}
                        onChangeText={onChangeDraft}
                        placeholder={placeholderValue}
                        autoFocus
                    />
                    <Text style={styles.cardMeta}>{helperText}</Text>
                    {onChangeIsPrimary !== undefined ? (
                        <Pressable
                            style={{ flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 4 }}
                            onPress={() => onChangeIsPrimary(!isPrimary)}
                        >
                            <Ionicons
                                name={isPrimary ? "checkbox" : "square-outline"}
                                size={20}
                                color={isPrimary ? "#2563eb" : "#9ca3af"}
                            />
                            <Text style={{ marginLeft: 8, fontSize: 14, color: "#4b5563" }}>Make primary clip</Text>
                        </Pressable>
                    ) : null}
                    <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 8 }]}>
                        <Button
                            variant="secondary"
                            label="Cancel"
                            disabled={cancelDisabled}
                            onPress={onCancel}
                        />
                        <Button
                            variant="primary"
                            label={saveLabel}
                            disabled={isSaveDisabled}
                            onPress={onSave}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
