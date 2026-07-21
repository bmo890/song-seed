import { getHierarchyIconName } from "../../../domain/hierarchy";
import { FloatingActionDock } from "../../common/FloatingActionDock";
import { useTranslation } from "react-i18next";

type ActionButtonsProps = {
  onAddProject: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
  onImportDevSamples?: () => void;
  onImportDevSong?: () => void;
  onDockLayout?: (height: number) => void;
};

export function ActionButtons({
  onAddProject,
  onQuickRecord,
  onImportAudio,
  onImportDevSamples,
  onImportDevSong,
  onDockLayout,
}: ActionButtonsProps) {
  const { t } = useTranslation();
  return (
    <FloatingActionDock
      onDockLayout={onDockLayout}
      onRecord={onQuickRecord}
      menuItems={[
        {
          key: "song",
          label: t("collection.song"),
          icon: getHierarchyIconName("song"),
          onPress: onAddProject,
        },
        {
          key: "import",
          label: t("collection.import"),
          icon: "download-outline",
          onPress: onImportAudio,
        },
        // Dev-only: import the Documents/dev-samples/ audio through the real
        // pipeline so automated tests can create clips without the OS picker.
        ...(__DEV__ && onImportDevSamples
          ? [
              {
                key: "devsamples",
                label: t("collection.importSamplesDev"),
                icon: "flask-outline" as const,
                onPress: onImportDevSamples,
              },
            ]
          : []),
        ...(__DEV__ && onImportDevSong
          ? [
              {
                key: "devsong",
                label: t("collection.importSongDev"),
                icon: "flask-outline" as const,
                onPress: onImportDevSong,
              },
            ]
          : []),
      ]}
    />
  );
}
