import React from "react";
import { Text } from "react-native";
import { ScreenHeader } from "../../common/ScreenHeader";
import { HelpButton } from "../../common/HelpButton";
import { styles } from "../../../styles";
import type { ClipVersion } from "../../../types";

type EditorHeaderSectionProps = {
  sourceClip: ClipVersion | null;
  onBack: () => void;
  onHelp: () => void;
};

export function EditorHeaderSection({ sourceClip, onBack, onHelp }: EditorHeaderSectionProps) {
  return (
    <>
      <ScreenHeader
        title="Audio Editor"
        leftIcon="back"
        onLeftPress={onBack}
        rightElement={<HelpButton onPress={onHelp} />}
      />
      {sourceClip ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {sourceClip.title}
        </Text>
      ) : null}
    </>
  );
}
