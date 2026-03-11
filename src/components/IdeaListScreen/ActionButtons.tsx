import { getHierarchyIconName } from "../../hierarchy";
import { FloatingActionDock } from "../common/FloatingActionDock";

type ActionButtonsProps = {
  onAddProject: () => void;
  onAddSubcollection?: () => void;
  onQuickRecord: () => void;
  onImportAudio: () => void;
};

export function ActionButtons({
  onAddProject,
  onAddSubcollection,
  onQuickRecord,
  onImportAudio,
}: ActionButtonsProps) {
  return (
    <FloatingActionDock
      onRecord={onQuickRecord}
      menuItems={[
        {
          key: "song",
          label: "Song",
          icon: getHierarchyIconName("song"),
          onPress: onAddProject,
        },
        ...(onAddSubcollection
          ? [
              {
                key: "subcollection",
                label: "Subcollection",
                icon: getHierarchyIconName("subcollection") as React.ComponentProps<
                  typeof import("@expo/vector-icons").Ionicons
                >["name"],
                onPress: onAddSubcollection,
              },
            ]
          : []),
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
