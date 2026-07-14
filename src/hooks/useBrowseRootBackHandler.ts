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

/**
 * What a back press should do on a browse-root screen.
 * - "close-drawer": an open drawer swallows the back press (close it).
 * - "run-on-back": the screen has a sub-state to unwind (a selection, an inline
 *   snapshot) — run its handler instead of leaving the screen.
 * - "delegate": nothing to intercept — let React Navigation / the OS handle it.
 *   This walks back through navigation history and, at the genuine home root,
 *   moves the app to the background. It MUST NEVER close the app.
 *
 * Note the deliberate absence of an "exit-app" outcome: pressing back should
 * never destroy the app. See resolveBrowseRootBackAction's tests.
 */
export type BrowseRootBackAction = "close-drawer" | "run-on-back" | "delegate";

export function resolveBrowseRootBackAction(opts: {
  drawerOpen: boolean;
  hasOnBack: boolean;
}): BrowseRootBackAction {
  if (opts.drawerOpen) return "close-drawer";
  if (opts.hasOnBack) return "run-on-back";
  return "delegate";
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

        const action = resolveBrowseRootBackAction({
          drawerOpen: !!findOpenDrawerNavigation(navigation),
          hasOnBack: !!onBack,
        });

        // "close-drawer": let the drawer swallow the back press (don't preventDefault).
        // "delegate": let React Navigation perform the back — this returns to the
        //   previous screen, or backgrounds the app at the true root. Never exit here.
        // "run-on-back": keep the user on this screen and unwind its sub-state.
        if (action === "run-on-back" && onBack) {
          event.preventDefault();
          onBack();
        }
      });

      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        const drawerNavigation = findOpenDrawerNavigation(navigation);
        const action = resolveBrowseRootBackAction({
          drawerOpen: !!drawerNavigation,
          hasOnBack: !!onBack,
        });

        if (action === "close-drawer") {
          drawerNavigation?.closeDrawer();
          return true;
        }

        if (action === "run-on-back" && onBack) {
          onBack();
          return true;
        }

        // Delegate: returning false lets React Navigation walk back through the
        // navigation history and, at the genuine home root, hand off to the OS,
        // which moves the app to the background. Back must never close the app.
        return false;
      });

      return () => {
        unsubscribeBeforeRemove();
        handler.remove();
      };
    }, [isEnabled, navigation, onBack])
  );
}
