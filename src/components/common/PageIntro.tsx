import { Text, View } from "react-native";
import { StyleSheet } from "react-native";
import { colors, spacing, text } from "../../design/tokens";

type PageIntroProps = {
  title: string;
  subtitle?: string;
  titleNumberOfLines?: number;
  subtitleNumberOfLines?: number;
};

export function PageIntro({
  title,
  subtitle,
  titleNumberOfLines = 1,
  subtitleNumberOfLines,
}: PageIntroProps) {
  return (
    <View style={pageIntroStyles.wrap}>
      <Text style={pageIntroStyles.title} numberOfLines={titleNumberOfLines}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={pageIntroStyles.subtitle} numberOfLines={subtitleNumberOfLines}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const pageIntroStyles = StyleSheet.create({
  wrap: {
    marginTop: 2,
    marginBottom: 10,
    gap: spacing.xs,
  },
  title: text.pageTitle,
  subtitle: {
    ...text.supporting,
    color: colors.textSecondary,
  },
});
