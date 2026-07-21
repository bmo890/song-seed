import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import { colors } from "../../../design/tokens";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

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
  const { t } = useTranslation();
  return (
    <SurfaceCard>
      <Text style={styles.sectionTitle}>{t("shareImport.incomingAudio")}</Text>
      {importedAssetCount > 0 ? (
        <>
          {previewNames.map((name, index) => (
            <View key={`${name}-${index}`} style={styles.previewRow}>
              <Ionicons
                name="musical-notes-outline"
                size={14}
                color={colors.textSecondary}
              />
              <UserText style={styles.previewText} numberOfLines={1}>
                {name}
              </UserText>
            </View>
          ))}
          {importedAssetCount > previewNames.length ? (
            <Text style={styles.helperText}>
              {t("shareImport.moreFiles", { count: importedAssetCount - previewNames.length })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.helperText}>
          {isResolvingShareAssets
            ? t("shareImport.preparingDetail")
            : unsupportedOnly
              ? t("shareImport.unsupportedOnly")
              : t("shareImport.nothingNow")}
        </Text>
      )}
      {rejectedCount > 0 ? (
        <Text style={styles.warningText}>
          {t("shareImport.skipped", { count: rejectedCount })}
        </Text>
      ) : null}
    </SurfaceCard>
  );
}
