import { Text, View } from "react-native";
import { styles } from "../../styles";

type ClipCardSelectionRailProps = {
  visible: boolean;
  selected: boolean;
};

export function ClipCardSelectionRail({ visible, selected }: ClipCardSelectionRailProps) {
  return (
    <View
      style={[
        styles.selectionIndicatorCol,
        visible ? null : styles.selectionIndicatorHidden,
      ]}
    >
      {visible ? (
        <View
          style={[
            styles.selectionIndicatorCircle,
            selected ? styles.selectionIndicatorActive : null,
          ]}
        >
          {selected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
