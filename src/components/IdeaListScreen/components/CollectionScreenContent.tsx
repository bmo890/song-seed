import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ScreenHeader } from "../../common/ScreenHeader";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { CollectionHeaderSection } from "../sections/CollectionHeaderSection";
import { CollectionFilterSection } from "../sections/CollectionFilterSection";
import { CollectionListSection } from "../sections/CollectionListSection";
import { CollectionFloatingActions } from "../sections/CollectionFloatingActions";
import { CollectionHeaderMenu } from "./CollectionHeaderMenu";
import { CollectionModals } from "./CollectionModals";
import { styles } from "../../../styles";
import { goBackFromParentStack } from "../../../navigation";

export function CollectionScreenContent() {
  const { screen } = useCollectionScreen();

  if (!screen.activeWorkspace || !screen.collectionId || !screen.currentCollection) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader
          title="Collection"
          leftIcon={screen.showBack ? "back" : "hamburger"}
          onLeftPress={
            screen.showBack
              ? () => {
                  if (!goBackFromParentStack(screen.navigation)) {
                    screen.navigateRoot("Home", { screen: "Browse" });
                  }
                }
              : undefined
          }
        />
        <Text style={styles.subtitle}>This collection could not be found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, styles.screenIdeas]}>
      <CollectionHeaderSection />
      <CollectionFilterSection />
      <CollectionModals />
      <CollectionListSection />
      <CollectionFloatingActions />
      <CollectionHeaderMenu />
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
