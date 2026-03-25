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
      <View
        style={[
          styles.songDetailEvolutionStem,
          !entry.continuesThreadBelow ? styles.songDetailEvolutionStemEnd : null,
        ]}
      />
      <View style={styles.songDetailEvolutionElbow}>
        <View style={styles.songDetailEvolutionDot} />
      </View>
    </View>
  );
}
