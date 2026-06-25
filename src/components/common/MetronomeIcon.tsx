import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  size?: number;
  color?: string;
};

export function MetronomeIcon({ size = 20, color = "#524440" }: Props) {
  return <MaterialCommunityIcons name="metronome" size={size} color={color} />;
}
