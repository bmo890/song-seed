import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../../common/BottomSheet";
import { IconButton } from "../../common/IconButton";
import { SegmentedControl } from "../../common/SegmentedControl";
import { styles } from "../../../styles";
import { colors, spacing } from "../../../design/tokens";
import { useReceivedPrefsStore } from "../../../state/useReceivedPrefsStore";
import {
  COMPILATION_FILTERS,
  COMPILATION_SORTS,
  type CompilationFilter,
  type CompilationSort,
} from "../../../domain/compilationListing";

/**
 * The hub's filter + sort glyphs, the pair a collection page carries, sitting
 * where the tab hint used to be. Each opens a small sheet with one
 * single-select (SegmentedControl, per the selection law). The funnel reads
 * terracotta while a filter is narrowing the list — the only colour here.
 */
export function CompilationListControls({ showFilter = true }: { showFilter?: boolean }) {
  const { t } = useTranslation();
  const filter = useReceivedPrefsStore((s) => s.compilationFilter);
  const sort = useReceivedPrefsStore((s) => s.compilationSort);
  const setFilter = useReceivedPrefsStore((s) => s.setCompilationFilter);
  const setSort = useReceivedPrefsStore((s) => s.setCompilationSort);
  const [open, setOpen] = useState<"filter" | "sort" | null>(null);

  return (
    <View style={local.row}>
      {/* IconButton ticks on press — haptics vocabulary: `tap`. */}
      {showFilter ? (
        <IconButton
          testID="compilations-filter"
          icon="filter-outline"
          tone="muted"
          color={filter === "all" ? undefined : colors.primary}
          size={20}
          onPress={() => setOpen("filter")}
          accessibilityLabel={t("library.filterA11y")}
        />
      ) : null}
      <IconButton
        testID="compilations-sort"
        icon="swap-vertical-outline"
        tone="muted"
        size={20}
        onPress={() => setOpen("sort")}
        accessibilityLabel={t("library.sortA11y")}
      />

      <BottomSheet visible={open === "filter"} onClose={() => setOpen(null)}>
        <View style={styles.selectionSheetHeader}>
          <Text style={styles.selectionSheetTitle}>{t("library.showTitle")}</Text>
        </View>
        <SegmentedControl<CompilationFilter>
          options={COMPILATION_FILTERS.map((key) => ({ key, label: t(`library.show_${key}`) }))}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setOpen(null);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={open === "sort"} onClose={() => setOpen(null)}>
        <View style={styles.selectionSheetHeader}>
          <Text style={styles.selectionSheetTitle}>{t("library.sortTitle")}</Text>
        </View>
        <SegmentedControl<CompilationSort>
          options={COMPILATION_SORTS.map((key) => ({ key, label: t(`library.sort_${key}`) }))}
          value={sort}
          onChange={(value) => {
            setSort(value);
            setOpen(null);
          }}
        />
      </BottomSheet>
    </View>
  );
}

const local = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.xs,
  },
});
