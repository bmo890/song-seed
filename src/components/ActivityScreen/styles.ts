import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";
import { radii } from "../../design/tokens";

const PAPER = "#fbf9f5";

export const styles = {
  ...base,
  ...StyleSheet.create({
    screen: { ...base.screen, backgroundColor: PAPER },
    // A bare ink glyph: the header's right slot never wears a fill.
    customizeBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
};
