import { useCallback } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getDrawerStatusFromState } from "@react-navigation/drawer";
import { BackHandler, Platform } from "react-native";

function findOpenDrawerNavigation(navigation: any) {
  let currentNavigation = navigation;

  while (currentNavigation) {
    try {
      const state = currentNavigation.getState?.();
      if (
        typeof currentNavigation.closeDrawer === "function" &&
        state &&
        getDrawerStatusFromState(state) === "open"
      ) {
        return currentNavigation;
      }
    } catch {
      // Ignore non-drawer navigators while climbing the tree.
    }

    currentNavigation = currentNavigation.getParent?.();
  }

  return null;
}

type BrowseRootBackOptions = {
  enabled?: boolean;
  onBack?: () => void;
};

export function useBrowseRootBackHandler(enabled: boolean | BrowseRootBackOptions = true) {
  const navigation = useNavigation();
  const onBack =
    typeof enabled === "object" && enabled !== null && "onBack" in enabled
      ? enabled.onBack
      : undefined;
  const isEnabled = typeof enabled === "boolean" ? enabled : enabled.enabled ?? true;

  useFocusEffect(
    useCallback(() => {
      if (!isEnabled || Platform.OS !== "android") {
        return undefined;
      }

      const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (event: any) => {
        const actionType = event.data?.action?.type;
        if (actionType !== "GO_BACK" && actionType !== "POP" && actionType !== "POP_TO_TOP") {
          return;
        }

        const drawerNavigation = findOpenDrawerNavigation(navigation);
        if (drawerNavigation) {
          return;
        }

        event.preventDefault();
        if (onBack) {
          onBack();
          return;
        }
        BackHandler.exitApp();
      });

      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        const drawerNavigation = findOpenDrawerNavigation(navigation);
        if (drawerNavigation) {
          drawerNavigation.closeDrawer();
          return true;
        }

        if (onBack) {
          onBack();
          return true;
        }

        // Top-level browse roots exit the app when they have no higher browse
        // destination. Screens that sit under Home in the browse hierarchy pass
        // an explicit `onBack` handler instead of walking the raw stack.
        BackHandler.exitApp();
        return true;
      });

      return () => {
        unsubscribeBeforeRemove();
        handler.remove();
      };
    }, [isEnabled, navigation, onBack])
  );
}
