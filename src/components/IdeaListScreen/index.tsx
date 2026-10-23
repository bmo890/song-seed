import { CollectionScreenContent } from "./components/CollectionScreenContent";
import { CollectionScreenProvider } from "./provider/CollectionScreenProvider";
import { WorkspaceThemeProvider } from "../../context/WorkspaceThemeContext";
import { useStore } from "../../state/useStore";
import { useRoute } from "@react-navigation/native";

export function IdeaListScreen() {
  const route = useRoute<any>();
  // A visited collection (a received package) wears its own hue, not the active workspace's.
  const routeWorkspaceId = route.params?.workspaceId as string | undefined;
  const workspaceColor = useStore(
    (s) => s.workspaces.find((w) => w.id === (routeWorkspaceId ?? s.activeWorkspaceId))?.color
  );
  return (
    <WorkspaceThemeProvider color={workspaceColor}>
      <CollectionScreenProvider>
        <CollectionScreenContent />
      </CollectionScreenProvider>
    </WorkspaceThemeProvider>
  );
}
