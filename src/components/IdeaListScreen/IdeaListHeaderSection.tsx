import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { ClipboardBanner } from "../ClipboardBanner";
import { ClipClipboard, Collection } from "../../types";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

type IdeaListHeaderSectionProps = {
  currentCollection: Collection;
  ideasHeaderMeta: string;
  searchQuery: string;
  childCollections: Collection[];
  subcollectionsExpanded: boolean;
  hasActivityRangeFilter: boolean;
  activityLabel?: string;
  collectionId: string;
  clipClipboard: ClipClipboard | null;
  duplicateWarningText: string;
  onSearchQueryChange: (value: string) => void;
  onSearchFocus: () => void;
  onToggleSubcollectionsExpanded: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenCollectionActions: (collectionId: string) => void;
  onClearActivityRange: () => void;
  onPasteClipboard: () => void;
  onCancelClipboard: () => void;
};

export function IdeaListHeaderSection({
  currentCollection,
  ideasHeaderMeta,
  searchQuery,
  childCollections,
  subcollectionsExpanded,
  hasActivityRangeFilter,
  activityLabel,
  collectionId,
  clipClipboard,
  duplicateWarningText,
  onSearchQueryChange,
  onSearchFocus,
  onToggleSubcollectionsExpanded,
  onOpenCollection,
  onOpenCollectionActions,
  onClearActivityRange,
  onPasteClipboard,
  onCancelClipboard,
}: IdeaListHeaderSectionProps) {
  return (
    <>
      <View style={styles.ideasHeaderBlock}>
        <Text style={styles.ideasHeaderTitle} numberOfLines={1}>
          {currentCollection.title}
        </Text>
        <Text style={styles.ideasHeaderSubtitle} numberOfLines={1}>
          {ideasHeaderMeta}
        </Text>
      </View>

      <View style={styles.ideasSearchUtilityRow}>
        <View style={styles.ideasSearchWrapInline}>
          <View style={styles.ideasSearchWrap}>
            <Ionicons name="search" size={16} color="#64748b" />
            <TextInput
              style={styles.ideasSearchInput}
              placeholder="Search titles, notes, lyrics..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onFocus={onSearchFocus}
              onChangeText={(value) => {
                onSearchFocus();
                onSearchQueryChange(value);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable
                style={({ pressed }) => [styles.ideasSearchClear, pressed ? styles.pressDown : null]}
                onPress={() => onSearchQueryChange("")}
              >
                <Ionicons name="close" size={14} color="#64748b" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {childCollections.length > 0 ? (
          <View style={styles.subcollectionDisclosureInlineWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.subcollectionDisclosureBtn,
                styles.subcollectionDisclosureBtnInline,
                subcollectionsExpanded ? styles.subcollectionDisclosureBtnOpen : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={onToggleSubcollectionsExpanded}
            >
              <View style={styles.subcollectionDisclosureLead}>
                <Ionicons
                  name={getHierarchyIconName("subcollection")}
                  size={14}
                  color={getHierarchyIconColor("subcollection")}
                />
                <Text style={styles.subcollectionDisclosureTitle}>
                  {childCollections.length} subcollection{childCollections.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Ionicons
                name={subcollectionsExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#64748b"
              />
            </Pressable>

            {subcollectionsExpanded ? (
              <View style={styles.subcollectionDisclosureDropdown}>
                {childCollections.map((collection) => (
                  <View key={collection.id} style={styles.subcollectionDisclosureItem}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.subcollectionDisclosureItemLead,
                        styles.subcollectionDisclosureItemMain,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => onOpenCollection(collection.id)}
                    >
                      <Ionicons
                        name={getHierarchyIconName("subcollection")}
                        size={14}
                        color={getHierarchyIconColor("subcollection")}
                      />
                      <Text style={styles.subcollectionDisclosureItemText} numberOfLines={1}>
                        {collection.title}
                      </Text>
                    </Pressable>
                    <View style={styles.subcollectionDisclosureItemActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.collectionInlineActionBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => onOpenCollectionActions(collection.id)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={14} color="#64748b" />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.subcollectionDisclosureChevronBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => onOpenCollection(collection.id)}
                      >
                        <Ionicons name="chevron-forward" size={13} color="#94a3b8" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {hasActivityRangeFilter ? (
        <View style={styles.activityRangeBanner}>
          <View style={styles.activityRangeBannerCopy}>
            <Ionicons name="calendar-outline" size={15} color="#475569" />
            <Text style={styles.activityRangeBannerText} numberOfLines={1}>
              {activityLabel ?? "Activity range"}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.activityRangeBannerClear, pressed ? styles.pressDown : null]}
            onPress={onClearActivityRange}
          >
            <Ionicons name="close" size={14} color="#64748b" />
          </Pressable>
        </View>
      ) : null}

      {clipClipboard ? (
        <ClipboardBanner
          count={clipClipboard.clipIds.length}
          mode={clipClipboard.mode}
          actionLabel="Paste to collection"
          onAction={() => {
            if (clipClipboard.sourceCollectionId === collectionId) {
              if (clipClipboard.mode === "move") {
                Alert.alert(
                  "Cannot move here",
                  "You cannot move items into the same collection they are already in. To duplicate them, cancel and use Copy instead."
                );
                return;
              }
              Alert.alert("Duplicate items?", duplicateWarningText, [
                { text: "Cancel", style: "cancel" },
                { text: "Duplicate", onPress: onPasteClipboard },
              ]);
              return;
            }

            Alert.alert(
              `${clipClipboard.mode === "move" ? "Move" : "Copy"} items here?`,
              `Are you sure you want to ${clipClipboard.mode} these items into this collection?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", style: "default", onPress: onPasteClipboard },
              ]
            );
          }}
          onCancel={onCancelClipboard}
        />
      ) : null}
    </>
  );
}
