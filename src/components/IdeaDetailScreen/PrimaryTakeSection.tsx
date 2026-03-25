import React from "react";
import { Text, View } from "react-native";
import { styles } from "./styles";
import { type TimelineClipEntry } from "../../clipGraph";
import { type ClipCardContextProps } from "./ClipCard";
import { SongClipCard } from "./components/SongClipCard";

type PrimaryTakeSectionProps = {
  entry: TimelineClipEntry | null;
  clipCardContext: ClipCardContextProps;
};

export function PrimaryTakeSection({ entry, clipCardContext }: PrimaryTakeSectionProps) {
  if (!entry) return null;

  return (
    <View style={styles.songDetailClipSection}>
      <View style={styles.songDetailSectionHeader}>
        <View style={styles.songDetailSectionHeaderCopy}>
          <Text style={styles.songDetailSectionTitle}>Primary take</Text>
        </View>
      </View>
      <SongClipCard entry={entry} context={clipCardContext} displayOnly />
    </View>
  );
}
