import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button } from "../../common/Button";
import { styles } from "../styles";

type LyricsVersionPreviewProps = {
  sourceText: string;
  showNewDraft: boolean;
  onEdit: () => void;
  onNewDraft: () => void;
  onCopy: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (height: number) => void;
  onScroll: (nextY: number) => void;
  scrollIndicator: ReactNode;
};

export function LyricsVersionPreview({
  sourceText,
  showNewDraft,
  onEdit,
  onNewDraft,
  onCopy,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionPreviewProps) {
  return (
    <View style={styles.lyricsVersionScreenBody}>
      <View style={styles.lyricsVersionTopActions}>
        <Button
          label={showNewDraft ? "Edit" : "Edit as New"}
          onPress={onEdit}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
        {showNewDraft ? (
          <Button
            variant="secondary"
            label="New Draft"
            onPress={onNewDraft}
            style={styles.lyricsActionBtn}
            textStyle={styles.lyricsActionBtnText}
          />
        ) : null}
        <Button
          variant="secondary"
          label="Copy"
          onPress={onCopy}
          style={styles.lyricsActionBtn}
          textStyle={styles.lyricsActionBtnText}
        />
      </View>
      <View style={styles.lyricsVersionDocumentFill}>
        <View
          style={[
            styles.lyricsPreviewWrap,
            styles.lyricsPreviewWrapExpanded,
            styles.lyricsPreviewWrapDocument,
            styles.lyricsScrollableWrap,
          ]}
          onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
        >
          <ScrollView
            style={styles.flexFill}
            contentContainerStyle={styles.lyricsVersionPreviewContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(_, height) => onContentSizeChange(height)}
            onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            <Text style={styles.lyricsPreviewText}>{sourceText || "No lyrics in this version."}</Text>
          </ScrollView>
          {scrollIndicator}
        </View>
      </View>
    </View>
  );
}
