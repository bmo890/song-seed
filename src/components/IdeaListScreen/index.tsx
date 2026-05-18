import { CollectionScreenContent } from "./components/CollectionScreenContent";
import { CollectionScreenProvider } from "./provider/CollectionScreenProvider";
import { WorkspaceThemeProvider } from "../../context/WorkspaceThemeContext";
import { useStore } from "../../state/useStore";

export function IdeaListScreen() {
  const workspaceColor = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.color);
  return (
    <WorkspaceThemeProvider color={workspaceColor}>
      <CollectionScreenProvider>
        <CollectionScreenContent />
      </CollectionScreenProvider>
    </WorkspaceThemeProvider>
  );
}
