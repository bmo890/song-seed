import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../../../clipGraph";
import { songClipToolbarStyles } from "./styles";

type SongClipSortMenuProps = {
  timelineSortMetric: SongTimelineSortMetric;
  setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
  timelineSortDirection: SongTimelineSortDirection;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  onClose: () => void;
};

export function SongClipSortMenu({
  timelineSortMetric,
  setTimelineSortMetric,
  timelineSortDirection,
  setTimelineSortDirection,
  onClose,
}: SongClipSortMenuProps) {
  return (
    <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffset]}>
      <View style={styles.ideasSortDirectionRow}>
        <Text style={styles.ideasDropdownSectionToggleText}>Direction</Text>
        <View style={styles.ideasSortDirectionControls}>
          <Pressable
            style={({ pressed }) => [
              styles.ideasSortDirectionChip,
              timelineSortDirection === "asc" ? styles.ideasSortDirectionChipActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => setTimelineSortDirection("asc")}
          >
            <Ionicons
              name="arrow-up"
              size={14}
              color={timelineSortDirection === "asc" ? "#ffffff" : "#475569"}
            />
            <Text
              style={[
                styles.ideasSortDirectionChipText,
                timelineSortDirection === "asc"
                  ? styles.ideasSortDirectionChipTextActive
                  : null,
              ]}
            >
              Asc
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.ideasSortDirectionChip,
              timelineSortDirection === "desc" ? styles.ideasSortDirectionChipActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => setTimelineSortDirection("desc")}
          >
            <Ionicons
              name="arrow-down"
              size={14}
              color={timelineSortDirection === "desc" ? "#ffffff" : "#475569"}
            />
            <Text
              style={[
                styles.ideasSortDirectionChipText,
                timelineSortDirection === "desc"
                  ? styles.ideasSortDirectionChipTextActive
                  : null,
              ]}
            >
              Desc
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.ideasDropdownDivider} />
      {([
        { key: "created", label: "Created", icon: "calendar-outline" },
        { key: "title", label: "Title", icon: "text-outline" },
        { key: "length", label: "Length", icon: "time-outline" },
      ] as const).map((option) => {
        const active = timelineSortMetric === option.key;
        return (
          <Pressable
            key={option.key}
            style={({ pressed }) => [
              styles.ideasSortMenuItem,
              active ? styles.ideasSortMenuItemActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => {
              setTimelineSortMetric(option.key);
              onClose();
            }}
          >
            <View style={styles.ideasMenuItemLead}>
              <Ionicons
                name={option.icon as any}
                size={15}
                color={active ? "#0f172a" : "#64748b"}
              />
              <Text
                style={[
                  styles.ideasSortMenuItemText,
                  active ? styles.ideasSortMenuItemTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </View>
            {active ? <Ionicons name="checkmark" size={15} color="#0f172a" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
