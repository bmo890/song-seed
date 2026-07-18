import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppAlert } from "../common/AppAlert";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { useShelfScreenModel, type ShelfRow } from "./hooks/useShelfScreenModel";
import { ShelfItemCard } from "./components/ShelfItemCard";
import { ShelfDecisionCard } from "./components/ShelfDecisionCard";
import { ShelfDepartedRow } from "./components/ShelfDepartedRow";
import { shelfStyles } from "./styles";

export function ShelfScreen() {
  const screen = useShelfScreenModel();

  useBrowseRootBackHandler();

  function openRowMenu(row: ShelfRow) {
    AppAlert.custom(row.idea.title, undefined, [
      {
        label: "View in collection",
        style: "default",
        icon: "open-outline",
        onPress: () => screen.viewRowInCollection(row),
      },
      {
        label: "Keep 7 more days",
        style: "default",
        icon: "time-outline",
        onPress: () => screen.keepRowLonger(row),
      },
      // No `description` here: AppDialog renders described buttons ABOVE plain
      // ones, which would promote this removal action to the top of the menu.
      {
        label: "Leave the shelf",
        style: "default",
        icon: "exit-outline",
        onPress: () => screen.letRowLeave(row),
      },
      {
        label: "Cancel",
        style: "cancel",
      },
    ]);
  }

  const cardHandlers = (row: ShelfRow) => ({
    isActive: screen.isRowActive(row),
    isPlaying: screen.isRowPlaying(row),
    onOpen: () => screen.openRow(row),
    onTogglePlay: () => screen.toggleRowPlay(row),
    onStopPlay: screen.stopRowPlay,
    onSeekStart: screen.onSeekInlineStart,
    onSeek: screen.onSeekInline,
    onSeekCancel: screen.onSeekInlineCancel,
    onOpenMenu: () => openRowMenu(row),
    onViewInCollection: () => screen.viewRowInCollection(row),
  });

  const isEmpty = screen.decidingRows.length === 0 && screen.restingRows.length === 0;

  return (
    <SafeAreaView style={shelfStyles.screen}>
      <ScreenHeader title="Shelf" leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shelfStyles.scrollContent}
      >
        <Text style={shelfStyles.pageDescription}>
          Things you set aside to come back to soon. Each stays a week — keep it longer
          anytime, or let it leave the shelf. Nothing here ever leaves its collection.
        </Text>

        {screen.decidingRows.length > 0 ? (
          <View style={shelfStyles.feedList}>
            {screen.decidingRows.map((row) => (
              <ShelfDecisionCard
                key={row.entry.key}
                row={row}
                now={screen.now}
                {...cardHandlers(row)}
                onKeep={() => screen.keepRowLonger(row)}
                onLeave={() => screen.letRowLeave(row)}
              />
            ))}
          </View>
        ) : null}

        {screen.restingRows.length > 0 ? (
          <>
            <Text style={shelfStyles.sectionLabel}>
              On the shelf{" "}
              <Text style={shelfStyles.sectionLabelCount}>· {screen.restingRows.length}</Text>
            </Text>
            <View style={shelfStyles.feedList}>
              {screen.restingRows.map((row) => (
                <ShelfItemCard
                  key={row.entry.key}
                  row={row}
                  now={screen.now}
                  {...cardHandlers(row)}
                />
              ))}
            </View>
          </>
        ) : null}

        {isEmpty ? (
          <Text style={shelfStyles.emptyLine}>
            Nothing set aside right now. Select ideas in a collection and choose
            “Set aside” to keep them close for a while — they’ll wait here, then
            quietly step back when you’re done with them.
          </Text>
        ) : null}

        {screen.departedRows.length > 0 ? (
          <>
            <Text style={shelfStyles.sectionLabel}>Recently left the shelf</Text>
            <View style={shelfStyles.feedList}>
              {screen.departedRows.map((rowData) => (
                <ShelfDepartedRow
                  key={rowData.departure.key}
                  rowData={rowData}
                  now={screen.now}
                  onReshelve={() => screen.reshelveDeparted(rowData)}
                />
              ))}
            </View>
            <Text style={shelfStyles.departedCaption}>
              These went back to everyday library life — safe in their collections,
              nothing deleted. Oldest rolls off.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
