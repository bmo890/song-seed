import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import {
  CollectionHeaderSection,
  CollectionContextReturnChip,
  CollectionCollapsibleIdentity,
  CollectionSearchSection,
} from "../sections/CollectionHeaderSection";
import { CollectionFilterSection } from "../sections/CollectionFilterSection";
import { CollectionListSection } from "../sections/CollectionListSection";
import { CollectionFloatingActions } from "../sections/CollectionFloatingActions";
import { CollectionHeaderMenu } from "./CollectionHeaderMenu";
import { CollectionModals } from "./CollectionModals";
import { IdeaListNestedCollectionsSection } from "./IdeaListNestedCollectionsSection";
import { styles } from "../../../styles";
import { goBackFromParentStack, openCollectionInBrowse } from "../../../navigation";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { useStore } from "../../../state/useStore";
import { useStickyDayLabel, useStickyDayChipVisible } from "../stickyDayStore";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

// Reasonable first-paint estimate for the header height; corrected on measure.
const DEFAULT_HEADER_HEIGHT = 230;

/** Floating "Today / Yesterday / …" chip. Subscribes to the sticky-day store
 *  directly so label changes during scroll re-render only this component. */
function StickyDayChip({ visible }: { visible: boolean }) {
  const label = useStickyDayLabel();
  const pastTopCohort = useStickyDayChipVisible();
  if (!visible || !label || !pastTopCohort) return null;
  return (
    <View style={[styles.ideasStickyDayWrap, { top: "100%", marginTop: 6 }]} pointerEvents="none">
      <View style={styles.ideasStickyDayChip}>
        <Text style={styles.ideasStickyDayChipText}>{label}</Text>
      </View>
    </View>
  );
}

function CollectionNestedCollectionsContent() {
  const { screen, management } = useCollectionScreen();

  return (
    <IdeaListNestedCollectionsSection
      childCollections={screen.childCollections}
      expanded={screen.nestedCollectionsExpanded}
      onToggleExpanded={() => screen.setNestedCollectionsExpanded((prev) => !prev)}
      onOpenCollection={(nextCollectionId) =>
        openCollectionInBrowse(screen.navigation, {
          collectionId: nextCollectionId,
          ...screen.collectionRouteParams,
        })
      }
      onOpenCollectionActions={management.openCollectionActions}
    />
  );
}

export function CollectionScreenContent() {
  const { t } = useTranslation();
  const { screen } = useCollectionScreen();
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const selectedListIdeaIds = useStore((s) => s.selectedListIdeaIds);
  const selectableListIdeaIds = screen.listEntries
    .filter((e): e is Extract<typeof e, { type: "idea" }> => e.type === "idea")
    .map((e) => e.idea.id);
  const allListSelected =
    selectableListIdeaIds.length > 0 &&
    selectableListIdeaIds.every((id) => selectedListIdeaIds.includes(id));

  if (!screen.activeWorkspace || !screen.collectionId || !screen.currentCollection) {
    // The screen model redirects to Browse when the collection is gone; this is a
    // brief fallback for that frame. Keep it escapable either way — the left icon
    // works (back, or open the drawer), plus a direct "Go to your library" button —
    // so the user is never stranded here.
    const goToLibrary = () => {
      if (!goBackFromParentStack(screen.navigation)) {
        screen.navigateRoot("Home", {
          screen: "WorkspaceStack",
          params: { screen: "Browse" },
        });
      }
    };
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader
          title={t("collection.title")}
          leftIcon={screen.showBack ? "back" : "hamburger"}
          onLeftPress={screen.showBack ? goToLibrary : screen.openDrawer}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
          <Text style={styles.subtitle}>{t("collection.missing")}</Text>
          <Text
            onPress={goToLibrary}
            accessibilityRole="button"
            style={{ fontSize: 15, fontWeight: "600", color: colors.primaryDeep }}
          >
            {t("collection.goToLibrary")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.screenIdeas]}>
      {/* Fixed nav row — compact identity fades in here as the block collapses */}
      <CollectionHeaderSection />

      {/* Dismissible "‹ Back to Search/Activity/Revisit" chip for contextual opens */}
      <CollectionContextReturnChip />

      {/* Stage: clips the identity block as it slides up under the nav. Bleeds out
          to the screen's true edges so the selection bar can render full width;
          everything else gets its horizontal padding back individually. */}
      <View style={{ flex: 1, overflow: "hidden", marginHorizontal: -14 }}>
        <CollectionListSection
          contentPaddingTop={headerHeight}
          topContent={<CollectionNestedCollectionsContent />}
        />
        <CollapsingHeaderOverlay
          scrollY={screen.scrollY}
          collapsibleHeight={screen.collapsibleHeaderHeight}
          onHeaderHeight={setHeaderHeight}
          collapsible={<CollectionCollapsibleIdentity />}
          pinned={
            <View style={{ backgroundColor: colors.page }} pointerEvents="box-none">
              <View style={{ paddingHorizontal: 14 }}>
                <CollectionSearchSection />
                <CollectionFilterSection />
              </View>
              {screen.listSelectionMode ? (
                <SelectionTopBar
                  count={selectedListIdeaIds.length}
                  allSelected={allListSelected}
                  onSelectAll={() =>
                    useStore.getState().replaceListSelection(selectableListIdeaIds)
                  }
                  onCancel={() => useStore.getState().cancelListSelection()}
                />
              ) : null}
              {/* Floating day chip: hangs just below the pinned block (top: "100%"),
                  so it automatically shifts down when the selection bar is open. */}
              <StickyDayChip visible={screen.showDateDividers} />
            </View>
          }
        />
      </View>

      <CollectionModals />
      <CollectionFloatingActions />
      <CollectionHeaderMenu />
    </SafeAreaView>
  );
}
