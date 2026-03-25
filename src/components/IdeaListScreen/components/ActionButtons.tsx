import { getHierarchyIconName } from "../../../hierarchy";
import { FloatingActionDock } from "../../common/FloatingActionDock";

type ActionButtonsProps = {
  onAddProject: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
  onDockLayout?: (height: number) => void;
};

export function ActionButtons({
  onAddProject,
  onQuickRecord,
  onImportAudio,
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
      ]}
    />
  );
}
