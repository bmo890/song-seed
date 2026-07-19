import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import {
  cleanupReceiveCache,
  downloadTransferItem,
  fetchTransfer,
  isArchiveItem,
  TransferGoneError,
  type TransferPayload,
} from "../../services/receiveTransfer";
import { readSongNookArchive } from "../../services/libraryImport";
import { enrichImportedAudioAsset, importAudioAssets } from "../../services/audioStorage";
import { createClipImportBatcher } from "../../services/clipImportBatcher";
import { enqueueMissingMetadataBackfill } from "../../services/backgroundWaveformHydration";
import { resolveImportedEntityRoute } from "../../domain/receiveRouting";
import { toast } from "../common/toastStore";
import { haptic } from "../../design/haptics";
import { colors, radii, text as textTokens } from "../../design/tokens";
import type { ShareKind } from "../../types";

type Phase =
  | { kind: "loading" }
  | { kind: "gone" }
  | { kind: "error"; message: string }
  | { kind: "already-saved" }
  | { kind: "ready"; transfer: TransferPayload }
  | { kind: "saving"; transfer: TransferPayload; itemIndex: number; itemFraction: number }
  | { kind: "done"; transfer: TransferPayload };

function formatBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/**
 * The in-app landing for a Songnook Send link: the parcel — sender, note,
 * items — with one Save action. Archives run the received-import pipeline;
 * loose audio becomes a received "files" package. Deduped by transferId.
 * Tone follows the web pages' letterpress-parcel look, in app tokens.
 */
export function TransferReceiveScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const transferId = route.params?.transferId as string | undefined;

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const startedRef = useRef(false);

  const alreadyReceived = useCallback(
    (id: string) =>
      useStore.getState().workspaces.some((workspace) => workspace.received?.transferId === id),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!transferId) {
        setPhase({ kind: "gone" });
        return;
      }
      if (alreadyReceived(transferId)) {
        setPhase({ kind: "already-saved" });
        return;
      }
      try {
        const transfer = await fetchTransfer(transferId);
        if (!cancelled) setPhase({ kind: "ready", transfer });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof TransferGoneError) setPhase({ kind: "gone" });
        else setPhase({ kind: "error", message: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadyReceived, transferId]);

  const goToReceived = () =>
    navigation.navigate("Home", { screen: "ReceivedHome" });

  async function save(transfer: TransferPayload) {
    if (startedRef.current) return;
    startedRef.current = true;
    haptic.tap();

    const receivedMeta = {
      senderName: transfer.sender.name,
      senderUserId: transfer.sender.userId,
      transferId: transfer.transferId,
      receivedAt: Date.now(),
      shareKind: "clips" as ShareKind,
      shareTitle: transfer.title ?? "Received files",
    };

    try {
      const audioUris: Array<{ uri: string; name: string; mimeType: string }> = [];
      let entityRoute: ReturnType<typeof resolveImportedEntityRoute> = null;
      let importedAnything = false;

      for (let index = 0; index < transfer.items.length; index++) {
        const item = transfer.items[index]!;
        setPhase({ kind: "saving", transfer, itemIndex: index, itemFraction: 0 });
        const localUri = await downloadTransferItem(item, (fraction) =>
          setPhase({ kind: "saving", transfer, itemIndex: index, itemFraction: fraction })
        );

        if (isArchiveItem(item)) {
          const parsed = await readSongNookArchive(localUri, item.fileName);
          const result = await appActions.importLibraryArchiveIntoLibrary(parsed, {
            origin: "received",
            receivedOverrides: {
              transferId: transfer.transferId,
              senderName: transfer.sender.name,
            },
          });
          importedAnything = true;
          entityRoute =
            entityRoute ??
            resolveImportedEntityRoute({
              shareKind: parsed.manifest.share?.kind,
              importedSongbookIds: result.importedSongbookIds,
              importedSetlistIds: result.importedSetlistIds,
            });
        } else {
          audioUris.push({ uri: localUri, name: item.fileName, mimeType: item.mimeType });
        }
      }

      if (audioUris.length > 0) {
        const { workspaceId, collectionId } = useStore
          .getState()
          .addReceivedFilesPackage(receivedMeta.shareTitle, receivedMeta);
        const assets = await Promise.all(
          audioUris.map((file) =>
            enrichImportedAudioAsset({ uri: file.uri, name: file.name, mimeType: file.mimeType })
          )
        );
        const batcher = createClipImportBatcher({ collectionId, workspaceId });
        const audioImport = await importAudioAssets(
          assets,
          (_asset, idx) => `audio-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`,
          undefined,
          {
            lightweight: true,
            onImported: (asset) =>
              batcher.add({
                title: asset.name ?? "Received clip",
                audioUri: asset.audioUri,
                durationMs: asset.durationMs,
                waveformPeaks: asset.waveformPeaks,
                importedAt: Date.now(),
              }),
          }
        );
        batcher.flush();
        if (audioImport.failed.length > 0) {
          throw new Error(
            `Couldn't import ${audioImport.failed.length} ${audioImport.failed.length === 1 ? "file" : "files"}.`
          );
        }
        if (audioImport.imported.length === 0) {
          throw new Error("No audio files could be imported.");
        }
        importedAnything = true;
      }

      if (!importedAnything) throw new Error("Nothing in this transfer could be imported.");

      enqueueMissingMetadataBackfill(useStore.getState().workspaces);
      await cleanupReceiveCache();
      haptic.success();
      setPhase({ kind: "done", transfer });

      if (entityRoute) {
        toast(
          entityRoute.kind === "songbook" ? "Songbook saved" : "Setlist saved",
          entityRoute.kind === "songbook" ? "book-outline" : "albums-outline"
        );
        navigation.navigate("Home", {
          screen: "LibraryHome",
          params: {
            openCollectionKind: entityRoute.kind,
            openCollectionId: entityRoute.id,
            openToken: Date.now(),
          },
        });
      } else {
        toast("Saved to Received", "mail-open-outline");
        goToReceived();
      }
    } catch (error) {
      startedRef.current = false;
      await cleanupReceiveCache();
      const partialIds = new Set(
        useStore
          .getState()
          .workspaces.filter((workspace) => workspace.received?.transferId === transfer.transferId)
          .map((workspace) => workspace.id)
      );
      for (const workspaceId of partialIds) {
        useStore.getState().deleteWorkspace(workspaceId);
      }
      setPhase({
        kind: "error",
        message: (error as Error).message || "Something went wrong saving this transfer.",
      });
    }
  }

  const renderBody = () => {
    switch (phase.kind) {
      case "loading":
        return (
          <View style={parcelStyles.centerWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={parcelStyles.centerText}>Opening the parcel…</Text>
          </View>
        );
      case "gone":
        return (
          <View style={parcelStyles.centerWrap}>
            <Ionicons name="time-outline" size={26} color={colors.textMuted} />
            <Text style={parcelStyles.centerTitle}>This link has expired</Text>
            <Text style={parcelStyles.centerText}>
              Transfers live for a limited time. Ask the sender for a fresh link.
            </Text>
          </View>
        );
      case "already-saved":
        return (
          <View style={parcelStyles.centerWrap}>
            <Ionicons name="checkmark-circle-outline" size={26} color={colors.primary} />
            <Text style={parcelStyles.centerTitle}>Already saved</Text>
            <Text style={parcelStyles.centerText}>This transfer is in your library.</Text>
            <Pressable style={parcelStyles.primaryBtn} onPress={goToReceived}>
              <Text style={parcelStyles.primaryLabel}>Open Received</Text>
            </Pressable>
          </View>
        );
      case "error":
        return (
          <View style={parcelStyles.centerWrap}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.textMuted} />
            <Text style={parcelStyles.centerTitle}>Couldn't open the transfer</Text>
            <Text style={parcelStyles.centerText}>{phase.message}</Text>
            <Pressable
              style={parcelStyles.primaryBtn}
              onPress={() => {
                startedRef.current = false;
                setPhase({ kind: "loading" });
                if (transferId) {
                  fetchTransfer(transferId)
                    .then((transfer) => setPhase({ kind: "ready", transfer }))
                    .catch((error) =>
                      setPhase(
                        error instanceof TransferGoneError
                          ? { kind: "gone" }
                          : { kind: "error", message: (error as Error).message }
                      )
                    );
                }
              }}
            >
              <Text style={parcelStyles.primaryLabel}>Try again</Text>
            </Pressable>
          </View>
        );
      case "ready":
      case "saving":
      case "done": {
        const transfer = phase.transfer;
        const saving = phase.kind === "saving";
        const done = phase.kind === "done";
        const senderLine = [
          `From ${transfer.sender.name ?? "someone"}`,
          `${transfer.items.length} ${transfer.items.length === 1 ? "item" : "items"}`,
          `expires in ${daysUntil(transfer.expiresAt)}d`,
        ].join(" · ");

        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={parcelStyles.scrollContent}
          >
            <View style={parcelStyles.header}>
              <Text style={parcelStyles.eyebrow}>A parcel for you</Text>
              <Text style={parcelStyles.title} numberOfLines={2}>
                {transfer.title || "Someone sent you music"}
              </Text>
              <Text style={parcelStyles.meta}>{senderLine}</Text>
            </View>

            {transfer.message ? (
              <View style={parcelStyles.noteCard}>
                <Text style={parcelStyles.noteText}>{transfer.message}</Text>
              </View>
            ) : null}

            <View style={parcelStyles.list}>
              {transfer.items.map((item, index) => {
                const active = saving && phase.itemIndex === index;
                const complete = done || (saving && phase.itemIndex > index);
                return (
                  <View key={item.itemId} style={parcelStyles.itemRow}>
                    <View style={parcelStyles.itemIcon}>
                      <Ionicons
                        name={isArchiveItem(item) ? "albums-outline" : "musical-notes-outline"}
                        size={16}
                        color={colors.primaryDeep}
                      />
                    </View>
                    <View style={parcelStyles.itemMain}>
                      <Text style={parcelStyles.itemName} numberOfLines={1}>
                        {item.fileName}
                      </Text>
                      <Text style={parcelStyles.itemMeta}>
                        {active
                          ? `Downloading… ${Math.round(phase.itemFraction * 100)}%`
                          : formatBytes(item.size)}
                      </Text>
                    </View>
                    {complete ? (
                      <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
                    ) : active ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                parcelStyles.primaryBtn,
                saving || done ? parcelStyles.primaryBtnDisabled : null,
                pressed && !saving && !done ? { opacity: 0.85 } : null,
              ]}
              onPress={() => void save(transfer)}
              disabled={saving || done}
              accessibilityRole="button"
              accessibilityLabel="Save to SongNook"
            >
              <Text style={parcelStyles.primaryLabel}>
                {done ? "Saved" : saving ? "Saving…" : "Save to SongNook"}
              </Text>
            </Pressable>
            <Text style={parcelStyles.footnote}>
              Lands in Received, kept apart from your own work — move it into your
              workspaces whenever you like.
            </Text>
          </ScrollView>
        );
      }
    }
  };

  return (
    <SafeAreaView style={parcelStyles.screen}>
      <ScreenHeader title="Songnook Send" leftIcon="back" />
      {renderBody()}
    </SafeAreaView>
  );
}

const parcelStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbf9f5",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  noteCard: {
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  noteText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textStrong,
  },
  list: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  itemMeta: {
    ...textTokens.caption,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
  footnote: {
    ...textTokens.caption,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 10,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 36,
  },
  centerTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  centerText: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
});
