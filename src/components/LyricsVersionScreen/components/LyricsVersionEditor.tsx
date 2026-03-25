import type { ReactNode } from "react";
import type {
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  TextInputScrollEventData,
} from "react-native";
import { TextInput, View } from "react-native";
import { Button } from "../../common/Button";
import { styles } from "../styles";

type LyricsVersionEditorProps = {
  draftText: string;
  canSave: boolean;
  showSaveAsNew: boolean;
  onChangeText: (next: string) => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onCancel: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => void;
  onScroll: (event: NativeSyntheticEvent<TextInputScrollEventData>) => void;
  scrollIndicator: ReactNode;
};

export function LyricsVersionEditor({
  draftText,
  canSave,
  showSaveAsNew,
  onChangeText,
  onSave,
  onSaveAsNew,
  onCancel,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionEditorProps) {
  return (
    <View style={styles.flexFill}>
      <View style={styles.lyricsVersionTopActions}>
        <Button
          label="Save"
          disabled={!canSave}
          onPress={onSave}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
        {showSaveAsNew ? (
          <Button
            variant="secondary"
            label="Save as New"
            disabled={!canSave}
            onPress={onSaveAsNew}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        ) : null}
        <Button
          variant="secondary"
          label="Cancel"
          onPress={onCancel}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
      </View>
      <View style={[styles.lyricsVersionDocumentFill, styles.lyricsVersionDocumentFillEdit]}>
        <View style={[styles.lyricsVersionDocumentContent, styles.lyricsVersionDocumentContentEdit]}>
          <View
            style={styles.lyricsScrollableWrap}
            onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
          >
            <TextInput
              style={[styles.lyricsInput, styles.lyricsInputFill, styles.lyricsEditFieldActive]}
              multiline
              placeholder="Write your lyrics here"
              value={draftText}
              onChangeText={onChangeText}
              textAlignVertical="top"
              scrollEnabled
              onContentSizeChange={onContentSizeChange}
              onScroll={onScroll}
            />
            {scrollIndicator}
          </View>
        </View>
      </View>
    </View>
  );
}
