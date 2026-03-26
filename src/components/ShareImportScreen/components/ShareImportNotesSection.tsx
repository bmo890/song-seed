import { Text } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
import { styles } from "../styles";

export function ShareImportNotesSection() {
  return (
    <SurfaceCard>
      <Text style={styles.sectionTitle}>Notes</Text>
      <Text style={styles.helperText}>
        Multiple files into an existing collection can become individual clips or one new
        song project. New collection from import keeps the shared files as individual
        clips.
      </Text>
    </SurfaceCard>
  );
}
