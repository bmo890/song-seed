import React from "react";
import { Text, View } from "react-native";
import { styles } from "../../styles";
import { type TimelineClipEntry } from "../../clipGraph";
import { ClipCard, type ClipCardSharedProps } from "./ClipCard";

type PrimaryTakeSectionProps = {
  entry: TimelineClipEntry | null;
  clipCardProps: ClipCardSharedProps;
};

export function PrimaryTakeSection({ entry, clipCardProps }: PrimaryTakeSectionProps) {
  if (!entry) return null;

  return (
    <View style={styles.songDetailClipSection}>
      <View style={styles.songDetailSectionHeader}>
        <View style={styles.songDetailSectionHeaderCopy}>
          <Text style={styles.songDetailSectionTitle}>Primary take</Text>
        </View>
      </View>
      <ClipCard entry={entry} {...clipCardProps} />
    </View>
  );
}
