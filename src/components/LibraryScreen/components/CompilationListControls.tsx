import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FilterSortControls } from "../../common/FilterSortControls";
import { SearchField } from "../../common/SearchField";
import { SegmentedControl } from "../../common/SegmentedControl";
import { PopoverMenuLabel, PopoverMenuSection, PopoverRadioRow } from "../../common/PopoverMenu";
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
              renderMenu: () => (
                // One of three: ink tabs, the same as the Ideas filter's Show.
                <>
                  <PopoverMenuLabel>{t("library.showTitle")}</PopoverMenuLabel>
                  <PopoverMenuSection>
                    <SegmentedControl
                      options={filterOptions.map((key) => ({ key, label: t(`library.show_${key}`) }))}
                      value={filter}
                      onChange={setFilter}
                    />
                  </PopoverMenuSection>
                </>
              ),
            }
          : undefined
      }
      sort={{
        active: sort !== "updated",
        valueIcon: SORT_ICONS[sort],
        direction: "desc",
        renderMenu: ({ close }) => (
          <>
            <PopoverMenuLabel>{t("library.sortTitle")}</PopoverMenuLabel>
            {sortOptions.map((key) => (
              <PopoverRadioRow
                key={key}
                label={t(`library.sort_${key}`)}
                selected={key === sort}
                onPress={() => {
                  setSort(key);
                  close();
                }}
              />
            ))}
          </>
        ),
      }}
    />
  );
}
