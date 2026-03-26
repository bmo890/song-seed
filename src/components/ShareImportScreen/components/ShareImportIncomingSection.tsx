import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import { colors } from "../../../design/tokens";
import { styles } from "../styles";

type Props = {
  importedAssetCount: number;
  previewNames: string[];
  isResolvingShareAssets: boolean;
  unsupportedOnly: boolean;
  rejectedCount: number;
};

export function ShareImportIncomingSection({
  importedAssetCount,
  previewNames,
  isResolvingShareAssets,
  unsupportedOnly,
  rejectedCount,
}: Props) {
  return (
    <SurfaceCard>
      <Text style={styles.sectionTitle}>Incoming audio</Text>
      {importedAssetCount > 0 ? (
        <>
          {previewNames.map((name, index) => (
            <View key={`${name}-${index}`} style={styles.previewRow}>
              <Ionicons
                name="musical-notes-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.previewText} numberOfLines={1}>
                {name}
              </Text>
            </View>
          ))}
          {importedAssetCount > previewNames.length ? (
            <Text style={styles.helperText}>
              +{importedAssetCount - previewNames.length} more shared audio files
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.helperText}>
          {isResolvingShareAssets
            ? "Preparing the shared audio so Song Seed can import it."
            : unsupportedOnly
              ? "Song Seed can import shared audio files, but the current share payload does not contain supported audio."
              : "Nothing is waiting to be imported right now."}
        </Text>
      )}
      {rejectedCount > 0 ? (
        <Text style={styles.warningText}>
          {rejectedCount} shared item{rejectedCount === 1 ? "" : "s"} will be skipped
          because they are not supported audio files.
        </Text>
      ) : null}
    </SurfaceCard>
  );
}
