import { getHierarchyIconName } from "../../../hierarchy";
import { FloatingActionDock } from "../../common/FloatingActionDock";

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
  return (
    <FloatingActionDock
      onDockLayout={onDockLayout}
      onRecord={onQuickRecord}
      menuItems={[
        {
          key: "song",
          label: "Song",
          icon: getHierarchyIconName("song"),
          onPress: onAddProject,
        },
        {
          key: "import",
          label: "Import",
          icon: "download-outline",
          onPress: onImportAudio,
        },
        // Dev-only: import the Documents/dev-samples/ audio through the real
        // pipeline so automated tests can create clips without the OS picker.
        ...(__DEV__ && onImportDevSamples
          ? [
              {
                key: "devsamples",
                label: "Import samples (dev)",
                icon: "flask-outline" as const,
                onPress: onImportDevSamples,
              },
            ]
          : []),
        ...(__DEV__ && onImportDevSong
          ? [
              {
                key: "devsong",
                label: "Import as song (dev)",
                icon: "flask-outline" as const,
                onPress: onImportDevSong,
              },
            ]
          : []),
      ]}
    />
  );
}
