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

export function useBrowseRootBackHandler(enabled = true) {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!enabled || Platform.OS !== "android") {
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
        BackHandler.exitApp();
      });

      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        const drawerNavigation = findOpenDrawerNavigation(navigation);
        if (drawerNavigation) {
          drawerNavigation.closeDrawer();
          return true;
        }

        if (typeof (navigation as any).goBack === "function" && (navigation as any).canGoBack?.()) {
          (navigation as any).goBack();
          return true;
        }

        BackHandler.exitApp();
        return true;
      });

      return () => {
        unsubscribeBeforeRemove();
        handler.remove();
      };
    }, [enabled, navigation])
  );
}
