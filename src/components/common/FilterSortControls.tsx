import { ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

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
};

export function FilterSortControls({ filter, sort }: FilterSortControlsProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [filterAnchorX, setFilterAnchorX] = useState(0);
  const [sortAnchorX, setSortAnchorX] = useState(96);

  const closeMenus = () => {
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  };

  return (
    <View style={styles.ideasToolbar}>
      {filterMenuOpen || sortMenuOpen ? (
        <Pressable style={styles.ideasToolbarBackdrop} onPress={closeMenus} />
      ) : null}

      <View style={styles.ideasUtilityRow}>
        <View style={styles.ideasUtilityRowLeft}>
          {filter ? (
            <>
              <View
                onLayout={(event) => {
                  setFilterAnchorX(event.nativeEvent.layout.x);
                }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasUtilityChip,
                    styles.ideasUtilityChipFilterOnly,
                    filterMenuOpen ? styles.ideasUtilityChipOpen : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setFilterMenuOpen((prev) => !prev);
                    setSortMenuOpen(false);
                  }}
                >
                  <Ionicons
                    name={(filter.active ? "funnel" : "funnel-outline") as any}
                    size={15}
                    color={filter.active ? "#0f172a" : "#475569"}
                  />
                  <View
                    style={[
                      styles.ideasUtilityChipDivider,
                      filter.active ? styles.ideasUtilityChipDividerActive : null,
                    ]}
                  />
                  <Ionicons name={filter.valueIcon as any} size={16} color="#475569" />
                </Pressable>
              </View>

              {filter.active && filter.onClear ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasUtilityClearIconBtn,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={filter.onClear}
                  accessibilityRole="button"
                  accessibilityLabel="Clear filters"
                >
                  <Ionicons name="close" size={12} color="#64748b" />
                </Pressable>
              ) : null}
            </>
          ) : null}

          {sort ? (
            <View
              onLayout={(event) => {
                setSortAnchorX(event.nativeEvent.layout.x);
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.ideasUtilityChip,
                  styles.ideasUtilityChipSortOnly,
                  sortMenuOpen ? styles.ideasUtilityChipOpen : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => {
                  setSortMenuOpen((prev) => !prev);
                  setFilterMenuOpen(false);
                }}
              >
                <View style={styles.ideasSortChipIconStack}>
                  <Ionicons
                    name="arrow-up"
                    size={11}
                    color={sort.direction === "asc" ? "#0f172a" : "#94a3b8"}
                  />
                  <Ionicons
                    name="arrow-down"
                    size={11}
                    color={sort.direction === "desc" ? "#0f172a" : "#94a3b8"}
                  />
                </View>
                <View
                  style={[
                    styles.ideasUtilityChipDivider,
                    sort.active || sortMenuOpen ? styles.ideasUtilityChipDividerActive : null,
                  ]}
                />
                <Ionicons
                  name={sort.valueIcon as any}
                  size={14}
                  color={sort.active ? "#0f172a" : "#475569"}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {filter && filterMenuOpen ? (
        <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: filterAnchorX }]}>
          {filter.renderMenu({ close: () => setFilterMenuOpen(false) })}
        </View>
      ) : null}

      {sort && sortMenuOpen ? (
        <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: sortAnchorX }]}>
          {sort.renderMenu({ close: () => setSortMenuOpen(false) })}
        </View>
      ) : null}
    </View>
  );
}
