import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  meta?: string | null;
  summary?: string | null;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
  children?: ReactNode;
};

export function PlayerSupportPanel({
  title,
  meta,
  summary,
  expanded,
  defaultExpanded = false,
  onToggleExpanded,
  children,
}: Props) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;

  function handleToggle() {
    const nextExpanded = !isExpanded;
    if (expanded === undefined) {
      setUncontrolledExpanded(nextExpanded);
    }
    onToggleExpanded?.(nextExpanded);
  }

  return (
    <View style={styles.panel}>
      <Pressable style={styles.header} onPress={handleToggle}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          {!isExpanded && summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={styles.toggle}>
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
        </View>
      </Pressable>

      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#f6f7f9",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e3e6eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#111827",
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    color: "#6b7280",
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
  toggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dde3ea",
  },
  body: {
    gap: 8,
  },
});
