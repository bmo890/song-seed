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
import { useTranslation } from "react-i18next";

export function ShelfScreen() {
  const { t } = useTranslation();
  const screen = useShelfScreenModel();

  useBrowseRootBackHandler();

  function openRowMenu(row: ShelfRow) {
    AppAlert.custom(row.idea.title, undefined, [
      {
        label: t("shelf.viewInCollectionShort"),
        style: "default",
        icon: "open-outline",
        onPress: () => screen.viewRowInCollection(row),
      },
      {
        label: t("shelf.keepSeven"),
        style: "default",
        icon: "time-outline",
        onPress: () => screen.keepRowLonger(row),
      },
      // No `description` here: AppDialog renders described buttons ABOVE plain
      // ones, which would promote this removal action to the top of the menu.
      {
        label: t("shelf.leave"),
        style: "default",
        icon: "exit-outline",
        onPress: () => screen.letRowLeave(row),
      },
      {
        label: t("common.cancel"),
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
      <ScreenHeader title={t("screens.shelf")} leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shelfStyles.scrollContent}
      >
        <Text style={shelfStyles.pageDescription}>
          {t("screens.shelfIntro")}
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
              {t("shelf.onShelf")}{" "}
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
            {t("shelf.emptyBody")}
          </Text>
        ) : null}

        {screen.departedRows.length > 0 ? (
          <>
            <Text style={shelfStyles.sectionLabel}>{t("shelf.recentlyLeft")}</Text>
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
              {t("shelf.departedCaption")}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
