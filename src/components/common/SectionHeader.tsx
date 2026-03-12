import { Text, View } from "react-native";
import { StyleSheet } from "react-native";
import { spacing, text } from "../../design/tokens";

type SectionHeaderProps = {
  title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={sectionHeaderStyles.wrap}>
      <Text style={sectionHeaderStyles.title}>{title}</Text>
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  title: text.sectionTitle,
});
