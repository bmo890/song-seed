import { ReactNode, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { styles } from "../../styles";
import Animated, { FadeIn } from "react-native-reanimated";
import { durations } from "../../design/motion";
import { colors } from "../../design/tokens";
import { IconButton } from "./IconButton";
import { useTranslation } from "react-i18next";

type FilterMenuRenderContext = {
  close: () => void;
};

type FilterConfig = {
  active: boolean;
  valueIcon: string;
  onClear?: () => void;
  renderMenu: (ctx: FilterMenuRenderContext) => ReactNode;
};

type SortConfig = {
  active: boolean;
  valueIcon: string;
  direction: "asc" | "desc";
  renderMenu: (ctx: FilterMenuRenderContext) => ReactNode;
};

type FilterSortControlsProps = {
  filter?: FilterConfig;
  sort?: SortConfig;
  /** Fills the row's leading stretch (the search field on the collection
   *  screen); the filter/sort glyphs sit quietly to its right. */
  leadingSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Mutual-exclusivity signal: when this value changes, both popovers close
   *  (e.g. an overflow menu elsewhere just opened). */
  closeSignal?: number;
  /** Fired whenever a filter/sort popover opens — lets a parent close its own
   *  competing menu so only one is ever open. */
  onMenuOpen?: () => void;
};

/**
 * One quiet toolbar row: leading slot (search) stretched, then bare glyph
 * controls — filter, optional clear, sort. Glyphs, not chips: active state is
 * told by the filled glyph + terracotta ink, never by a border or fill. Both
 * popover menus hang from the row's trailing edge.
 */
export function FilterSortControls({ filter, sort, leadingSlot, rightSlot, closeSignal, onMenuOpen }: FilterSortControlsProps) {
  const { t } = useTranslation();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const closeMenus = () => {
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  };

  // An external menu (e.g. the collection overflow) opened — fold ours away.
  useEffect(() => {
    if (closeSignal === undefined) return;
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  }, [closeSignal]);

  return (
    <View style={styles.ideasToolbar}>
      {filterMenuOpen || sortMenuOpen ? (
        <Pressable style={styles.ideasToolbarBackdrop} onPress={closeMenus} />
      ) : null}

      <View style={styles.ideasUtilityRow}>
        {leadingSlot ? <View style={styles.ideasUtilityRowLead}>{leadingSlot}</View> : null}

        {filter ? (
          <IconButton
            icon={filter.active || filterMenuOpen ? "funnel" : "funnel-outline"}
            tone="muted"
            color={filter.active ? colors.primaryDeep : undefined}
            size={18}
            onPress={() => {
              if (!filterMenuOpen) onMenuOpen?.();
              setFilterMenuOpen((prev) => !prev);
              setSortMenuOpen(false);
            }}
            accessibilityLabel={t("common.filtersMenu")}
          />
        ) : null}

        {filter?.active && filter.onClear ? (
          <IconButton
            icon="close"
            tone="muted"
            size={14}
            hitSlop={13}
            onPress={filter.onClear}
            accessibilityLabel={t("common.clearFilters")}
          />
        ) : null}

        {sort ? (
          <IconButton
            icon="swap-vertical"
            tone="muted"
            color={sort.active || sortMenuOpen ? colors.primaryDeep : undefined}
            size={18}
            onPress={() => {
              if (!sortMenuOpen) onMenuOpen?.();
              setSortMenuOpen((prev) => !prev);
              setFilterMenuOpen(false);
            }}
            accessibilityLabel={t("common.sortMenu")}
          />
        ) : null}

        {rightSlot ? <View style={styles.ideasUtilityRowRight}>{rightSlot}</View> : null}
      </View>

      {filter && filterMenuOpen ? (
        <Animated.View
          entering={FadeIn.duration(durations.fast)}
          style={[styles.ideasSortMenu, styles.ideasPopoverMenu, styles.ideasPopoverMenuEnd]}
        >
          {filter.renderMenu({ close: () => setFilterMenuOpen(false) })}
        </Animated.View>
      ) : null}

      {sort && sortMenuOpen ? (
        <Animated.View
          entering={FadeIn.duration(durations.fast)}
          style={[styles.ideasSortMenu, styles.ideasPopoverMenu, styles.ideasPopoverMenuEnd]}
        >
          {sort.renderMenu({ close: () => setSortMenuOpen(false) })}
        </Animated.View>
      ) : null}
    </View>
  );
}
