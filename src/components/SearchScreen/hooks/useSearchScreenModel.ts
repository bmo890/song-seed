import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { openCollectionFromContext } from "../../../navigation";
import {
  buildGlobalSearchResults,
  getSearchMatchFilter,
  getSearchMatchFilterLabel,
  getSearchResultKindLabel,
  type GlobalSearchResult,
  type GlobalSearchResultKind,
  type SearchMatchFilter,
  GLOBAL_SEARCH_KIND_ORDER,
  SEARCH_MATCH_FILTER_ORDER,
} from "../../../search";

type SearchResultGroup = {
  kind: GlobalSearchResultKind;
  label: string;
  items: GlobalSearchResult[];
  /** How many additional matches were cut by the render cap (0 when complete). */
  truncatedCount: number;
};

// Results render in a plain (unvirtualized) ScrollView, so a broad query against a
// large library ("a" matching hundreds of clips) would mount hundreds of result rows
// at once and visibly hang the search page. Deeper matches are reachable by typing a
// more specific query — the group notes how many were cut.
const MAX_RESULTS_PER_GROUP = 30;

type SearchMatchFilterOption = {
  key: SearchMatchFilter;
  label: string;
  count: number;
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
  const [activeMatchFilter, setActiveMatchFilter] = useState<SearchMatchFilter | null>(null);

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

  // Quick-filter options, derived from what's actually in the results — each pill
  // carries its own count, and a filter never appears unless it has matches.
  const matchFilters = useMemo<SearchMatchFilterOption[]>(() => {
    const counts = new Map<SearchMatchFilter, number>();
    for (const result of results) {
      const filter = getSearchMatchFilter(result.matchSource);
      counts.set(filter, (counts.get(filter) ?? 0) + 1);
    }
    return SEARCH_MATCH_FILTER_ORDER.filter((filter) => counts.has(filter)).map((filter) => ({
      key: filter,
      label: getSearchMatchFilterLabel(filter),
      count: counts.get(filter) ?? 0,
    }));
  }, [results]);

  // Drop the active filter whenever the query changes or the chosen bucket disappears,
  // so a stale scope can never hide every result on a fresh search.
  useEffect(() => {
    if (activeMatchFilter && !matchFilters.some((option) => option.key === activeMatchFilter)) {
      setActiveMatchFilter(null);
    }
  }, [activeMatchFilter, matchFilters]);

  const filteredResults = useMemo(
    () =>
      activeMatchFilter
        ? results.filter((result) => getSearchMatchFilter(result.matchSource) === activeMatchFilter)
        : results,
    [activeMatchFilter, results]
  );

  const resultGroups = useMemo<SearchResultGroup[]>(
    () =>
      GLOBAL_SEARCH_KIND_ORDER.map((kind) => {
        const allItems = filteredResults.filter((result) => result.kind === kind);
        return {
          kind,
          label: getSearchResultKindLabel(kind),
          items: allItems.slice(0, MAX_RESULTS_PER_GROUP),
          truncatedCount: Math.max(0, allItems.length - MAX_RESULTS_PER_GROUP),
        };
      }).filter((group) => group.items.length > 0),
    [filteredResults]
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
        // Open the idea's *home* — its collection, scrolled to and highlighting the
        // card — rather than dropping straight into the item's detail page. Opened
        // contextually so a "‹ Search" back button returns to these results intact.
        if (result.collectionId) {
          openCollectionFromContext(navigation, {
            collectionId: result.collectionId,
            workspaceId: result.workspaceId,
            focusIdeaId: result.ideaId,
            focusToken: Date.now(),
            source: "search",
            backLabel: "Search",
          });
        } else {
          navigateToRoute(navigation, "IdeaDetail", { ideaId: result.ideaId });
        }
        return;
      case "note":
        navigation.navigate("NotepadHome", { noteId: result.noteId, openToken: Date.now() });
        return;
      default:
        return;
    }
  };

  const resultCount = results.length;
  const filteredResultCount = filteredResults.length;
  const hasQuery = debouncedSearchQuery.trim().length > 0;

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    resultGroups,
    resultCount,
    filteredResultCount,
    matchFilters,
    activeMatchFilter,
    setActiveMatchFilter,
    hasQuery,
    openResult,
  };
}
