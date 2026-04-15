import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import {
  buildGlobalSearchResults,
  getSearchResultKindLabel,
  type GlobalSearchResult,
  type GlobalSearchResultKind,
  GLOBAL_SEARCH_KIND_ORDER,
} from "../../../search";

type SearchResultGroup = {
  kind: GlobalSearchResultKind;
  label: string;
  items: GlobalSearchResult[];
};

function navigateToRoute(navigation: any, routeName: string, params?: Record<string, unknown>) {
  let current = navigation;

  while (current) {
    const routeNames = current.getState?.()?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes(routeName)) {
      current.navigate(routeName, params);
      return true;
    }
    current = current.getParent?.();
  }

  return false;
}

export function useSearchScreenModel() {
  const navigation = useNavigation<any>();
  const workspaces = useStore((state) => state.workspaces);
  const notes = useStore((state) => state.notes);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 140);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const results = useMemo(
    () => buildGlobalSearchResults(workspaces, notes, debouncedSearchQuery),
    [debouncedSearchQuery, notes, workspaces]
  );

  const resultGroups = useMemo<SearchResultGroup[]>(
    () =>
      GLOBAL_SEARCH_KIND_ORDER.map((kind) => ({
        kind,
        label: getSearchResultKindLabel(kind),
        items: results.filter((result) => result.kind === kind),
      })).filter((group) => group.items.length > 0),
    [results]
  );

  const openResult = (result: GlobalSearchResult) => {
    if (result.workspaceId) {
      setActiveWorkspaceId(result.workspaceId);
    }

    switch (result.kind) {
      case "workspace":
        navigation.navigate("WorkspaceStack", { screen: "Browse" });
        return;
      case "collection":
        navigation.navigate("WorkspaceStack", {
          screen: "CollectionDetail",
          params: {
            collectionId: result.collectionId,
            workspaceId: result.workspaceId,
          },
        });
        return;
      case "song":
      case "clip":
        navigateToRoute(navigation, "IdeaDetail", { ideaId: result.ideaId });
        return;
      case "note":
        navigation.navigate("NotepadHome", { noteId: result.noteId, openToken: Date.now() });
        return;
      default:
        return;
    }
  };

  const resultCount = results.length;
  const hasQuery = debouncedSearchQuery.trim().length > 0;

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    resultGroups,
    resultCount,
    hasQuery,
    openResult,
  };
}
