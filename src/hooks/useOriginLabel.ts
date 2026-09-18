import { useMemo } from "react";
import { useNavigationState, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useStore } from "../state/useStore";
import { getDeepestRouteOf } from "../navigation";
import {
  decodeOriginRoute,
  encodeOriginRoute,
  resolveOriginLabel,
  type OriginRoute,
} from "../domain/originLabel";

/**
 * The name of the place BACK lands on from this screen — read from the route
 * beneath it in the nearest stack. Meant for root-stack pages (sketch, visited
 * collection). Returns null when there is nothing beneath, or when disabled.
 */
/** The route BACK lands on (root name, focused leaf, its ids) — or null. */
export function useOriginRoute(enabled: boolean = true): OriginRoute | null {
  const originKey = useOriginKey(enabled);
  return useMemo(() => decodeOriginRoute(originKey), [originKey]);
}

function useOriginKey(enabled: boolean): string | null {
  const route = useRoute();
  return useNavigationState((state) => {
    // Only a STACK has a "route beneath" in the history sense. Inside the drawer
    // the sibling tab is not where back lands, so no label there.
    if (!enabled || state?.type !== "stack" || !state?.routes?.length) return null;
    const index = state.routes.findIndex((candidate) => candidate.key === route.key);
    if (index <= 0) return null;
    const previous = state.routes[index - 1];
    const deepest = getDeepestRouteOf(previous);
    return encodeOriginRoute({ name: previous.name, deepestName: deepest.name, params: deepest.params });
  });
}

export function useOriginLabel(enabled: boolean = true): string | null {
  const { t } = useTranslation();
  const originKey = useOriginKey(enabled);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);

  return useMemo(
    () => resolveOriginLabel(decodeOriginRoute(originKey), { workspaces, activeWorkspaceId, t }),
    [activeWorkspaceId, originKey, t, workspaces]
  );
}
