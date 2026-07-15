import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../../design/tokens";

type Props = {
  size?: number;
  color?: string;
};

export function MetronomeIcon({ size = 20, color = colors.textStrong }: Props) {
  return <MaterialCommunityIcons name="metronome" size={size} color={color} />;
}
