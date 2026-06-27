import React from "react";
import { Text } from "react-native";
import { ScreenHeader } from "../common/ScreenHeader";
import { styles } from "../../styles";
import type { ClipVersion } from "../../types";

type EditorHeaderSectionProps = {
  sourceClip: ClipVersion | null;
  onBack: () => void;
};

export function EditorHeaderSection({ sourceClip, onBack }: EditorHeaderSectionProps) {
  return (
    <>
      <ScreenHeader title="Audio Editor" leftIcon="back" onLeftPress={onBack} />
      {sourceClip ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {sourceClip.title}
        </Text>
      ) : null}
    </>
  );
}
