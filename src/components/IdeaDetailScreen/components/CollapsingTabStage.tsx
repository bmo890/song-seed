import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedScrollHandler } from "react-native-reanimated";
import { useSongScreen } from "../provider/SongScreenProvider";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { SongCollapsibleHeader } from "./SongCollapsibleHeader";

const DEFAULT_HEADER_HEIGHT = 130;

type CollapsingTabStageProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * A scrollable tab body (Lyrics / Notes) with the collapsing song header overlaid
 * on top. Same mechanism as the takes stage: content scrolls 1:1, the header
 * translates up via transform, no pinned toolbar here.
 */
export function CollapsingTabStage({ children, contentContainerStyle }: CollapsingTabStageProps) {
  const { screen } = useSongScreen();
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);

  // Fresh mount (tab just became active) starts at the top, header expanded.
  useEffect(() => {
    screen.scrollY.value = 0;
    return () => {
      screen.scrollY.value = 0;
    };
  }, [screen.scrollY]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      screen.scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, overflow: "hidden" }}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingTop: headerHeight }, contentContainerStyle]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
      <CollapsingHeaderOverlay
        scrollY={screen.scrollY}
        collapsibleHeight={screen.collapsibleHeaderHeight}
        onHeaderHeight={setHeaderHeight}
        collapsible={<SongCollapsibleHeader />}
      />
    </View>
  );
}
