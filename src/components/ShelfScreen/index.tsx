import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../common/ScreenHeader";
import { EmptyState } from "../common/EmptyState";
import { Ledger } from "../common/Ledger";
import { AppAlert } from "../common/AppAlert";
import { IconButton } from "../common/IconButton";
import { HelpSheet } from "../common/HelpSheet";
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
  // Why the shelf exists and the rules a row can't show (founder, 2026-10-27):
  // how ideas get here, the 7-day stay, and that leaving never deletes.
  const [helpOpen, setHelpOpen] = useState(false);

  useBrowseRootBackHandler();

  function openRowMenu(row: ShelfRow) {
    AppAlert.menu(row.idea.title, [
      { key: "keep", label: t("shelf.keepSeven"), icon: "time-outline", onPress: () => screen.keepRowLonger(row) },
      { key: "view", label: t("shelf.viewInCollectionShort"), icon: "open-outline", onPress: () => screen.viewRowInCollection(row) },
      { key: "leave", label: t("shelf.leave"), icon: "exit-outline", onPress: () => screen.letRowLeave(row) },
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
      <ScreenHeader
        title={t("screens.shelf")}
        variant="place"
        leftIcon="hamburger"
        rightElement={
          // IconButton ticks on press — haptics vocabulary: `tap`.
          <IconButton
            testID="shelf-help"
            icon="help-circle-outline"
            tone="muted"
            onPress={() => setHelpOpen(true)}
            accessibilityLabel={t("shelf.helpA11y")}
          />
        }
      />
      <HelpSheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        thesis={t("shelf.helpThesis")}
        items={[
          { icon: "file-tray-outline", label: t("shelf.helpAddLabel"), description: t("shelf.helpAdd") },
          { icon: "time-outline", label: t("shelf.helpStayLabel"), description: t("shelf.helpStay") },
          { icon: "folder-outline", label: t("shelf.helpSafeLabel"), description: t("shelf.helpSafe") },
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={shelfStyles.scrollContent}
      >
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
            <Ledger
              label={t("shelf.onShelf")}
              count={screen.restingRows.length}
              style={shelfStyles.ledger}
            />
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
          <EmptyState
            variant="ledger"
            title={t("shelf.emptyTitle")}
            body={t("shelf.emptyBody")}
            linkLabel={t("shelf.browseIdeas")}
            onLink={screen.browseIdeas}
            testID="shelf-empty"
          />
        ) : null}

        {screen.departedRows.length > 0 ? (
          <>
            <Ledger label={t("shelf.recentlyLeft")} lip={false} style={shelfStyles.ledger} />
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
