import { CommonActions, StackRouter } from "@react-navigation/native";
import {
  openCollectionInBrowse,
  openParentCollection,
  openWorkspaceBrowseRoot,
  returnHome,
  visitCollection,
} from "../navigation";
import { decodeOriginRoute, encodeOriginRoute, resolveOriginLabel } from "../domain/originLabel";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Drives the REAL StackRouter with the actions our helpers emit, so these tests
// pin the stack shapes the navigation law promises (2026-09-16): one Home, ever;
// a visit is a push over its origin; up pops when the target is beneath.
function createStackHarness(routeNames: string[], initialRoutes: Array<{ name: string; params?: object }>) {
  const router = StackRouter({});
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  let state = router.getRehydratedState(
    { routes: initialRoutes, index: initialRoutes.length - 1 } as any,
    options as any
  );
  const navigation: any = {
    getState: () => state,
    getParent: () => undefined,
    dispatch: (action: any) => {
      const next = router.getStateForAction(state, action, options as any);
      if (next) state = next as typeof state;
    },
    navigate: (name: string, params?: object) => navigation.dispatch(CommonActions.navigate(name, params)),
    canGoBack: () => state.index > 0,
    goBack: () => navigation.dispatch(CommonActions.goBack()),
  };
  return {
    navigation,
    names: () => state.routes.map((route) => route.name),
    top: () => state.routes[state.index],
    get state() {
      return state;
    },
  };
}

const ROOT = ["Home", "IdeaDetail", "CollectionVisit", "Activity", "Recording", "Editor"];
const WORKSPACE_STACK = ["Browse", "CollectionDetail"];

describe("visitCollection", () => {
  it("pushes the visit over its origin instead of a second Home", () => {
    const h = createStackHarness(ROOT, [{ name: "Home", params: { screen: "ActivityHome" } }]);
    visitCollection(h.navigation, { collectionId: "c1", workspaceId: "w1", focusIdeaId: "i1" });
    expect(h.names()).toEqual(["Home", "CollectionVisit"]);
    expect(h.top().params).toMatchObject({ collectionId: "c1", focusIdeaId: "i1" });
  });

  it("re-visiting the visited collection refreshes params rather than stacking a copy", () => {
    const h = createStackHarness(ROOT, [{ name: "Home" }, { name: "CollectionVisit", params: { collectionId: "c1" } }]);
    visitCollection(h.navigation, { collectionId: "c1", focusIdeaId: "i2", focusToken: 7 });
    expect(h.names()).toEqual(["Home", "CollectionVisit"]);
    expect(h.top().params).toMatchObject({ collectionId: "c1", focusIdeaId: "i2", focusToken: 7 });
  });

  it("a different collection is one more visit (a child collection inside a visit)", () => {
    const h = createStackHarness(ROOT, [{ name: "Home" }, { name: "CollectionVisit", params: { collectionId: "c1" } }]);
    openCollectionInBrowse(h.navigation, { collectionId: "c2" });
    expect(h.names()).toEqual(["Home", "CollectionVisit", "CollectionVisit"]);
  });
});

describe("returnHome", () => {
  it("pops to the one Home from deep in the root stack and hands it the nested target", () => {
    const h = createStackHarness(ROOT, [
      { name: "Home" },
      { name: "CollectionVisit", params: { collectionId: "c1" } },
      { name: "IdeaDetail", params: { ideaId: "i1" } },
    ]);
    returnHome(h.navigation, { screen: "ShelfHome" });
    expect(h.names()).toEqual(["Home"]);
    expect(h.top().params).toEqual({ screen: "ShelfHome" });
  });

  it("never pushes a duplicate Home when Home is already on top", () => {
    const h = createStackHarness(ROOT, [{ name: "Home", params: { screen: "SearchHome" } }]);
    returnHome(h.navigation, { screen: "ReceivedHome" });
    expect(h.names()).toEqual(["Home"]);
    expect(h.top().params).toEqual({ screen: "ReceivedHome" });
  });

  it("up to the workspace hub asks the workspace stack to POP to Browse", () => {
    const h = createStackHarness(ROOT, [{ name: "Home" }, { name: "CollectionVisit", params: { collectionId: "c1" } }]);
    openWorkspaceBrowseRoot(h.navigation, "w1");
    expect(h.names()).toEqual(["Home"]);
    expect(h.top().params).toEqual({
      screen: "WorkspaceStack",
      params: { screen: "Browse", params: { workspaceId: "w1" }, pop: true },
    });
  });
});

describe("workspace stack: up follows hierarchy", () => {
  it("a nested navigate with pop:true collapses Collection, Browse, Collection back to Browse", () => {
    // The action React Navigation dispatches for the nested params returnHome sets.
    const h = createStackHarness(WORKSPACE_STACK, [
      { name: "CollectionDetail", params: { collectionId: "primary" } },
      { name: "Browse" },
      { name: "CollectionDetail", params: { collectionId: "c2" } },
    ]);
    h.navigation.dispatch(CommonActions.navigate({ name: "Browse", params: { workspaceId: "w1" }, pop: true }));
    expect(h.names()).toEqual(["CollectionDetail", "Browse"]);
    // …and without pop it would have grown the trail (the RN7 default this guards against).
    const g = createStackHarness(WORKSPACE_STACK, [{ name: "CollectionDetail" }, { name: "Browse" }, { name: "CollectionDetail" }]);
    g.navigation.dispatch(CommonActions.navigate({ name: "Browse" }));
    expect(g.names()).toEqual(["CollectionDetail", "Browse", "CollectionDetail", "Browse"]);
  });

  it("opening a collection from Browse pushes it; the parent up-link pops back to it", () => {
    const h = createStackHarness(WORKSPACE_STACK, [{ name: "Browse" }]);
    openCollectionInBrowse(h.navigation, { collectionId: "parent" });
    openCollectionInBrowse(h.navigation, { collectionId: "child" });
    expect(h.names()).toEqual(["Browse", "CollectionDetail", "CollectionDetail"]);
    openParentCollection(h.navigation, { collectionId: "parent" });
    expect(h.names()).toEqual(["Browse", "CollectionDetail"]);
    expect(h.top().params).toMatchObject({ collectionId: "parent" });
  });

  it("the parent up-link swaps in place when the parent is not beneath", () => {
    const h = createStackHarness(WORKSPACE_STACK, [{ name: "CollectionDetail", params: { collectionId: "child" } }]);
    openParentCollection(h.navigation, { collectionId: "parent" });
    expect(h.names()).toEqual(["CollectionDetail"]);
    expect(h.top().params).toMatchObject({ collectionId: "parent" });
  });
});

describe("origin labels: the back button names where back lands", () => {
  const t = (key: string) => key;
  const workspaces = [
    {
      id: "w1",
      title: "My Songs",
      collections: [{ id: "c1", title: "Ideas" }],
      ideas: [{ id: "i1", title: "Porch swing melody" }],
    },
  ];
  const context = { workspaces, activeWorkspaceId: "w1", t };

  it("names the collection when the sketch was opened from it", () => {
    expect(
      resolveOriginLabel({ name: "Home", deepestName: "CollectionDetail", params: { collectionId: "c1" } }, context)
    ).toBe("Ideas");
  });

  it("names the drawer page when the sketch was opened from Activity, Search or the Shelf", () => {
    expect(resolveOriginLabel({ name: "Home", deepestName: "ActivityHome" }, context)).toBe("navigation.activity");
    expect(resolveOriginLabel({ name: "Activity", deepestName: "Activity" }, context)).toBe("navigation.activity");
    expect(resolveOriginLabel({ name: "Home", deepestName: "SearchHome" }, context)).toBe("search.title");
    expect(resolveOriginLabel({ name: "Home", deepestName: "ShelfHome" }, context)).toBe("navigation.shelf");
    expect(resolveOriginLabel({ name: "Home", deepestName: "Browse" }, context)).toBe("My Songs");
  });

  it("names the idea beneath a visit opened from a sketch, and stays quiet for unknown routes", () => {
    expect(resolveOriginLabel({ name: "IdeaDetail", deepestName: "IdeaDetail", params: { ideaId: "i1" } }, context)).toBe(
      "Porch swing melody"
    );
    expect(resolveOriginLabel({ name: "Editor", deepestName: "Editor" }, context)).toBeNull();
    expect(resolveOriginLabel(null, context)).toBeNull();
  });

  it("survives the primitive round trip used by the navigation-state selector", () => {
    const origin = { name: "Home", deepestName: "CollectionDetail", params: { collectionId: "c1", workspaceId: "w1" } };
    expect(decodeOriginRoute(encodeOriginRoute(origin))).toEqual(origin);
    expect(encodeOriginRoute(null)).toBeNull();
  });
});
