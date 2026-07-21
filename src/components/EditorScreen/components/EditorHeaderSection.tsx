import React from "react";
import { Text } from "react-native";
import { ScreenHeader } from "../../common/ScreenHeader";
import { HelpButton } from "../../common/HelpButton";
import { styles } from "../../../styles";
import type { ClipVersion } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type EditorHeaderSectionProps = {
  sourceClip: ClipVersion | null;
  onBack: () => void;
  onHelp: () => void;
};

export function EditorHeaderSection({ sourceClip, onBack, onHelp }: EditorHeaderSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <ScreenHeader
        title={t("editor.title")}
        leftIcon="back"
        onLeftPress={onBack}
        rightElement={<HelpButton onPress={onHelp} />}
      />
      {sourceClip ? (
        <UserText style={styles.subtitle} numberOfLines={1}>
          {sourceClip.title}
        </UserText>
      ) : null}
    </>
  );
}
