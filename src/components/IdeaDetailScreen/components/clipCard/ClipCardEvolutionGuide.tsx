import { View } from "react-native";
import { styles } from "../../styles";
import type { EvolutionListClipEntry } from "../../../../clipGraph";

type ClipCardEvolutionGuideProps = {
  entry: EvolutionListClipEntry | null;
};

export function ClipCardEvolutionGuide({ entry }: ClipCardEvolutionGuideProps) {
  if (!entry?.indented) return null;

  return (
    <View style={styles.songDetailEvolutionGuideWrap}>
      {entry.continuesThreadBelow ? (
        <View style={styles.songDetailThreadSpine} />
      ) : null}
      <View style={styles.songDetailThreadCurve} />
    </View>
  );
}
