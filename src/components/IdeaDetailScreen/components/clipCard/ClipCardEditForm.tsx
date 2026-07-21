import { TextInput, View } from "react-native";
import { Button } from "../../../common/Button";
import { TitleInput } from "../../../common/TitleInput";
import { styles } from "../../styles";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../../i18n";

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
  const { t } = useTranslation();
  return (
    <View style={styles.inputRow}>
      <TitleInput
        value={titleDraft}
        onChangeText={onChangeTitle}
        placeholder={t("songDetail.clipTitle")}
        containerStyle={{ marginHorizontal: 0, marginBottom: 8 }}
      />
      <UserTextInput
        style={styles.notesInput}
        multiline
        placeholder={t("songDetail.clipNotes")}
        value={notesDraft}
        onChangeText={onChangeNotes}
      />
      <Button variant="secondary" label={t("common.save")} onPress={onSave} />
      <Button variant="secondary" label={t("common.cancel")} onPress={onCancel} />
    </View>
  );
}
