import ReAnimated from "react-native-reanimated";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppBreadcrumbs } from "../../common/AppBreadcrumbs";
import { ScreenHeader } from "../../common/ScreenHeader";
import { IdeaListHeaderSection } from "../components/IdeaListHeaderSection";
import { styles } from "../../../styles";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { appActions } from "../../../state/actions";
import { useStore } from "../../../state/useStore";

export function CollectionHeaderSection() {
  const { screen } = useCollectionScreen();
  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  return (
    <>
      <ScreenHeader
        title="Ideas"
        leftIcon={screen.showBack ? "back" : "hamburger"}
        onLeftPress={screen.onBack}
        rightElement={
          !screen.listSelectionMode ? (
            <Pressable
              style={({ pressed }) => [styles.ideasHeaderMenuBtn, pressed ? styles.pressDown : null]}
              onPress={() => screen.setHeaderMenuOpen((prev) => !prev)}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#334155" />
            </Pressable>
          ) : (
            <View style={styles.ideasHeaderMenuBtnPlaceholder} />
          )
        }
      />

      <ReAnimated.View style={screen.headerCollapseAnimStyle}>
        <AppBreadcrumbs items={screen.breadcrumbs} />
        <IdeaListHeaderSection
          currentCollection={screen.currentCollection!}
          ideasHeaderMeta={screen.ideasHeaderMeta}
          searchQuery={screen.searchQuery}
          hasActivityRangeFilter={screen.hasActivityRangeFilter}
          activityLabel={screen.activityLabel}
          collectionId={screen.collectionId!}
          clipClipboard={screen.clipClipboard}
          duplicateWarningText={screen.duplicateWarningText}
          onSearchQueryChange={screen.setSearchQuery}
          onClearActivityRange={() => {
            (screen.navigation as any).setParams({
              activityRangeStartTs: undefined,
              activityRangeEndTs: undefined,
              activityMetricFilter: undefined,
              activityLabel: undefined,
            });
          }}
          onPasteClipboard={() => {
            void appActions.pasteClipboardToCollection(screen.collectionId!);
          }}
          onCancelClipboard={cancelClipboard}
        />
      </ReAnimated.View>
    </>
  );
}
