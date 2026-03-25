import { TextInput, View } from "react-native";
import { Button } from "../../../common/Button";
import { TitleInput } from "../../../common/TitleInput";
import { styles } from "../../styles";

type ClipCardEditFormProps = {
  titleDraft: string;
  notesDraft: string;
  onChangeTitle: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ClipCardEditForm({
  titleDraft,
  notesDraft,
  onChangeTitle,
  onChangeNotes,
  onSave,
  onCancel,
}: ClipCardEditFormProps) {
  return (
    <View style={styles.inputRow}>
      <TitleInput
        value={titleDraft}
        onChangeText={onChangeTitle}
        placeholder="Clip title"
        containerStyle={{ marginHorizontal: 0, marginBottom: 8 }}
      />
      <TextInput
        style={styles.notesInput}
        multiline
        placeholder="Clip notes"
        value={notesDraft}
        onChangeText={onChangeNotes}
      />
      <Button variant="secondary" label="Save" onPress={onSave} />
      <Button variant="secondary" label="Cancel" onPress={onCancel} />
    </View>
  );
}
