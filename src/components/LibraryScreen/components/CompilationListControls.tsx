import { Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FilterSortControls } from "../../common/FilterSortControls";
import { SearchField } from "../../common/SearchField";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { useReceivedPrefsStore } from "../../../state/useReceivedPrefsStore";
import type { CompilationFilter, CompilationSort } from "../../../domain/compilationListing";

const FILTER_ICONS: Record<CompilationFilter, keyof typeof Ionicons.glyphMap> = {
  all: "layers-outline",
  mine: "person-outline",
  received: "mail-open-outline",
};
const SORT_ICONS: Record<CompilationSort, keyof typeof Ionicons.glyphMap> = {
  updated: "refresh-outline",
  name: "text-outline",
  created: "calendar-outline",
};

/** One row of the popover menu — the collection's `FilterSortBar` recipe
 *  (glyph + word, terracotta + check when it is the one in force). */
function MenuRow({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      haptic="none"
      style={[styles.ideasSortMenuItem,
        active ? styles.ideasSortMenuItemActive : null]}
      onPress={onPress}
    >
      <View style={styles.ideasMenuItemLead}>
        <Ionicons name={icon} size={15} color={active ? colors.primary : colors.textSecondary} />
        <Text style={[styles.ideasSortMenuItemText, active ? styles.ideasSortMenuItemTextActive : null]}>{label}</Text>
      </View>
      {active ? <Ionicons name="checkmark" size={15} color={colors.primary} /> : null}
    </Press>
  );
}

/**
 * The hub's filter + sort — the SAME control a collection page carries
 * (`FilterSortControls`: bare glyphs, anchored popovers, the menu-row recipe),
 * fed the options that mean something for a compilation. Consistency is the
 * design (founder, 2026-10-11): never a second look for the same job.
 */
export function CompilationListControls({
  showFilter = true,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
}: {
  showFilter?: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder: string;
}) {
  const { t } = useTranslation();
  const filter = useReceivedPrefsStore((s) => s.compilationFilter);
  const sort = useReceivedPrefsStore((s) => s.compilationSort);
  const setFilter = useReceivedPrefsStore((s) => s.setCompilationFilter);
  const setSort = useReceivedPrefsStore((s) => s.setCompilationSort);

  const filterOptions: CompilationFilter[] = ["all", "mine", "received"];
  const sortOptions: CompilationSort[] = ["updated", "name", "created"];

  return (
    <FilterSortControls
      leadingSlot={
        <SearchField
          testID="compilations-search"
          value={searchQuery}
          placeholder={searchPlaceholder}
          onChangeText={onSearchQueryChange}
        />
      }
      filter={
        showFilter
          ? {
              active: filter !== "all",
              valueIcon: FILTER_ICONS[filter],
              onClear: () => setFilter("all"),
              renderMenu: ({ close }) => (
                <View style={styles.ideasDropdownSectionStack}>
                  <Text style={styles.ideasDropdownSectionToggleText}>{t("library.showTitle")}</Text>
                  {filterOptions.map((key) => (
                    <MenuRow
                      key={key}
                      icon={FILTER_ICONS[key]}
                      label={t(`library.show_${key}`)}
                      active={key === filter}
                      onPress={() => {
                        setFilter(key);
                        close();
                      }}
                    />
                  ))}
                </View>
              ),
            }
          : undefined
      }
      sort={{
        active: sort !== "updated",
        valueIcon: SORT_ICONS[sort],
        direction: "desc",
        renderMenu: ({ close }) => (
          <View style={styles.ideasDropdownSectionStack}>
            <Text style={styles.ideasDropdownSectionToggleText}>{t("library.sortTitle")}</Text>
            {sortOptions.map((key) => (
              <MenuRow
                key={key}
                icon={SORT_ICONS[key]}
                label={t(`library.sort_${key}`)}
                active={key === sort}
                onPress={() => {
                  setSort(key);
                  close();
                }}
              />
            ))}
          </View>
        ),
      }}
    />
  );
}
