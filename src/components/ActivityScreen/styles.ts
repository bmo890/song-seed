import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";
import { radii } from "../../design/tokens";

const PAPER = "#fbf9f5";

export const styles = {
  ...base,
  ...StyleSheet.create({
    screen: { ...base.screen, backgroundColor: PAPER },
    customizeBtn: {
      width: 34,
      height: 34,
      borderRadius: radii.round,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#efeeea",
    },
    intro: {
      fontSize: 13,
      lineHeight: 18,
      color: "#84736f",
      paddingTop: 2,
    },
  }),
};
