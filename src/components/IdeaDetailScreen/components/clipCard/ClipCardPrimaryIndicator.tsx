import { Pressable, Text } from "react-native";
import { styles } from "../../styles";

type ClipCardPrimaryIndicatorProps = {
  displayOnly?: boolean;
  isParentPickSource: boolean;
  isEditMode: boolean;
  isPrimaryCandidate: boolean;
  isPrimary: boolean;
  onSetPrimary: () => void;
};

export function ClipCardPrimaryIndicator({
  displayOnly,
  isParentPickSource,
  isEditMode,
  isPrimaryCandidate,
  isPrimary,
  onSetPrimary,
}: ClipCardPrimaryIndicatorProps) {
  if (displayOnly) return null;

  if (isParentPickSource) {
    return <Text style={styles.badge}>SOURCE</Text>;
  }

  if (isEditMode) {
    if (isPrimaryCandidate) {
      return <Text style={styles.badge}>PRIMARY</Text>;
    }

    return (
      <Pressable style={styles.songDetailVersionSetPrimaryBtn} onPress={onSetPrimary}>
        <Text style={styles.songDetailVersionSetPrimaryText}>Primary</Text>
      </Pressable>
    );
  }

  if (isPrimary) {
    return <Text style={styles.badge}>PRIMARY</Text>;
  }

  return null;
}
