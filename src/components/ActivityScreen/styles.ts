import { StyleSheet } from "react-native";
import { styles as base } from "../../styles";

const PAPER = "#fbf9f5";

export const styles = {
  ...base,
  ...StyleSheet.create({
    screen: { ...base.screen, backgroundColor: PAPER },
  }),
};
