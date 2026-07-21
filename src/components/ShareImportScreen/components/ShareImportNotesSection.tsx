import { Text } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";

export function ShareImportNotesSection() {
  const { t } = useTranslation();
  return (
    <SurfaceCard>
      <Text style={styles.sectionTitle}>{t("shareImport.notes")}</Text>
      <Text style={styles.helperText}>{t("shareImport.notesBody")}</Text>
    </SurfaceCard>
  );
}
