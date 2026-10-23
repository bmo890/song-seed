import { returnHome } from "../../navigation";
import { reportUnsupportedImports } from "../common/importFeedback";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Spinner } from "../common/Spinner";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { SurfaceCard } from "../common/SurfaceCard";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import {
  cleanupReceiveCache,
  downloadTransferItem,
  fetchTransfer,
  isArchiveItem,
  TransferGoneError,
  type TransferItemPayload,
  type TransferPayload,
} from "../../services/receiveTransfer";
import { readSongNookArchive } from "../../services/libraryImport";
import { enrichImportedAudioAsset, importAudioAssets } from "../../services/audioStorage";
import { createClipImportBatcher } from "../../services/clipImportBatcher";
import { enqueueMissingMetadataBackfill } from "../../services/backgroundWaveformHydration";
import { resolveImportedEntityRoute } from "../../domain/receiveRouting";
import { titleFromFileName } from "../../domain/fileTitle";
import { getPlayableClipForIdea } from "../../domain/clipPresentation";
import { useParcelPreview } from "../../hooks/useParcelPreview";
import { toast } from "../common/toastStore";
import { haptic } from "../../design/haptics";
import { styles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ShareKind } from "../../types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText } from "../../i18n";
import { UserFacingError, userFacingMessage } from "../../i18n/userFacingError";

type Phase =
  | { kind: "loading" }
  | { kind: "gone" }
  | { kind: "error"; message: string }
  | { kind: "already-saved" }
  | { kind: "ready"; transfer: TransferPayload }
  | { kind: "saving"; transfer: TransferPayload; itemIndex: number; itemFraction: number }
  | { kind: "done"; transfer: TransferPayload };

/** Kinds whose .songnook file lands as a received package (vs. a compilation). */
const PACKAGE_KINDS: ReadonlySet<ShareKind> = new Set<ShareKind>(["sketch", "collection", "workspace", "library"]);

/** Where Save lands, said before the tap. A running order or a chart book
 *  becomes a compilation; a collection or a workspace becomes a package in
 *  Received; loose files become a package named after the parcel. */
function destinationLine(
  transfer: TransferPayload,
  hasArchive: boolean,
  title: string,
  t: TFunction
): string {
  switch (transfer.kind) {
    case "playlist":
      return t("transferReceive.savesToPlaylist");
    case "setlist":
      return t("transferReceive.savesToSetlist");
    case "songbook":
      return hasArchive ? t("transferReceive.savesToSongbook") : t("transferReceive.savesToReceived", { title });
    case "sketch":
    case "collection":
    case "workspace":
      return hasArchive
        ? t("transferReceive.savesToReceivedKind", { kind: t(`received.${transfer.kind}`) })
        : t("transferReceive.savesToReceived", { title });
    default:
      // A .songnook file with no declared kind: its manifest decides on save,
      // so promise only the safe landing.
      return hasArchive ? t("transferReceive.savesToReceivedPlain") : t("transferReceive.savesToReceived", { title });
  }
}

/** Above this, saving asks first — a phone on cellular deserves the number. */
const BIG_PARCEL_BYTES = 150 * 1024 * 1024;

function formatBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** "A War In Me.wav" reads as a song, not a file (domain/fileTitle). */
const displayName = titleFromFileName;

/**
 * The in-app landing for a SongNook Send link: the parcel — who, what, how
 * big, how long it lasts — each file playable before anything is saved, where
 * it will land said above the one key. Archives (a setlist, a chart book) run
 * the received-import pipeline and land on the thing they are; loose audio
 * becomes a received package and lands inside it. Deduped by transferId.
 */
export function TransferReceiveScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const transferId = route.params?.transferId as string | undefined;

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedRef = useRef(false);
  const abortRef = useRef(false);
  // Stop cancels the download in flight, not just the loop after it (sweep #12).
  const abortControllerRef = useRef<AbortController | null>(null);
  const preview = useParcelPreview();

  const alreadyReceived = useCallback(
    (id: string) =>
      useStore.getState().workspaces.some((workspace) => workspace.received?.transferId === id),
    []
  );

  useEffect(() => {
    let cancelled = false;
    // A second link opens in the same mounted screen (navigate to the same
    // route swaps params) — the guards belong to the parcel, not the screen.
    startedRef.current = false;
    abortRef.current = false;
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
        else setPhase({ kind: "error", message: t("transferReceive.openFailed") });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alreadyReceived, transferId, t]);

  // Leaving mid-save is a decision, not a slip: back asks, and a yes aborts
  // the download loop so nothing half-saved survives.
  useEffect(() => {
    return navigation.addListener("beforeRemove", (event: any) => {
      if (phaseRef.current.kind !== "saving") return;
      event.preventDefault();
      AppAlert.confirm(
        t("transferReceive.stopSavingTitle"),
        t("transferReceive.stopSavingBody"),
        () => {
          abortRef.current = true;
          abortControllerRef.current?.abort();
          navigation.dispatch(event.data.action);
        },
        { confirmLabel: t("transferReceive.stop") }
      );
    });
  }, [navigation, t]);

  const goToReceived = (packageId?: string) =>
    returnHome(navigation, {
      screen: "ReceivedHome",
      params: packageId ? { packageId, openToken: Date.now() } : undefined,
    });

  async function save(transfer: TransferPayload) {
    if (startedRef.current) return;
    startedRef.current = true;
    abortRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    preview.stop();
    haptic.tap();

    const receivedMeta = {
      senderName: transfer.sender.name,
      senderUserId: transfer.sender.userId,
      transferId: transfer.transferId,
      receivedAt: Date.now(),
      // Loose audio: the parcel's declared running order (or plain clips). A
      // .songnook item carries its own manifest, which the importer trusts instead.
      shareKind: (transfer.kind === "playlist" || transfer.kind === "setlist" ? transfer.kind : "clips") as ShareKind,
      shareTitle: transfer.title ?? t("transferReceive.receivedFiles"),
    };

    try {
      const audioUris: Array<{ uri: string; name: string; mimeType: string }> = [];
      // Where Save lands: the entity it made (a setlist, a chart book, a playlist), else the package.
      let entityRoute: { kind: "songbook" | "setlist" | "playlist"; id: string } | null = null;
      let importedAnything = false;
      let packageId: string | null = null;

      for (let index = 0; index < transfer.items.length; index++) {
        const item = transfer.items[index]!;
        setPhase({ kind: "saving", transfer, itemIndex: index, itemFraction: 0 });
        const localUri = await downloadTransferItem(
          item,
          (fraction) => setPhase({ kind: "saving", transfer, itemIndex: index, itemFraction: fraction }),
          { signal: abortController.signal }
        );
        if (abortRef.current) throw new Error("aborted");

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
          // A collection or a workspace lands as a package: Save opens it, not the list.
          packageId = packageId ?? result.importedWorkspaceIds[0] ?? null;
          entityRoute =
            entityRoute ??
            resolveImportedEntityRoute({
              shareKind: parsed.manifest.share?.kind,
              importedSongbookIds: result.importedSongbookIds,
              importedSetlistIds: result.importedSetlistIds,
              importedPlaylistIds: result.importedPlaylistIds,
            });
        } else {
          audioUris.push({ uri: localUri, name: item.fileName, mimeType: item.mimeType });
        }
      }

      if (audioUris.length > 0) {
        const { workspaceId, collectionId } = useStore
          .getState()
          .addReceivedFilesPackage(receivedMeta.shareTitle, receivedMeta);
        packageId = workspaceId;
        const assets = await Promise.all(
          audioUris.map((file) =>
            enrichImportedAudioAsset({ uri: file.uri, name: file.name, mimeType: file.mimeType })
          )
        );
        const batcher = createClipImportBatcher({ collectionId, workspaceId });
        // Downloads run one after another, but the import batch finishes in
        // any order; the parcel's order is the sender's order (a set, a running
        // order), so clips are added by parcel index after the batch, each
        // stamped one tick apart — a whole chunk used to share one millisecond
        // and land shuffled.
        const audioImport = await importAudioAssets(
          assets,
          (_asset, idx) => `audio-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`,
          undefined,
          { lightweight: true }
        );
        const receivedAt = Date.now();
        audioImport.imported.forEach((asset, index) =>
          batcher.add({
            title: displayName(asset.name ?? t("transferReceive.receivedClip")),
            audioUri: asset.audioUri,
            durationMs: asset.durationMs,
            waveformPeaks: asset.waveformPeaks,
            createdAt: receivedAt + index,
            importedAt: receivedAt + index,
          })
        );
        batcher.flush();
        reportUnsupportedImports(audioImport.failed);
        if (audioImport.failed.length > 0) {
          throw new Error(
            t("transferReceive.importFailed", { count: audioImport.failed.length })
          );
        }
        if (audioImport.imported.length === 0) {
          throw new UserFacingError(t("transferReceive.noAudio"));
        }
        importedAnything = true;

        // The sender said what this is: a running order arrives as that.
        if (transfer.kind === "playlist" || transfer.kind === "setlist") {
          const state = useStore.getState();
          const pkg = state.workspaces.find((workspace) => workspace.id === workspaceId);
          const ideas = [...(pkg?.ideas ?? [])].sort((a, b) => a.createdAt - b.createdAt);
          if (transfer.kind === "playlist") {
            const playlistId = state.addPlaylist(receivedMeta.shareTitle);
            state.addItemsToPlaylist(
              playlistId,
              ideas.map((idea) => ({
                kind: "clip" as const,
                workspaceId,
                collectionId,
                ideaId: idea.id,
                clipId: getPlayableClipForIdea(idea)?.id ?? null,
              }))
            );
            entityRoute = { kind: "playlist", id: playlistId };
          } else {
            const setlistId = state.addSetlist(receivedMeta.shareTitle);
            for (const idea of ideas) {
              const clip = getPlayableClipForIdea(idea);
              state.addSetlistEntry(setlistId, {
                workspaceId,
                ideaId: idea.id,
                clipIds: clip ? [clip.id] : [],
                lyricVersionIds: [],
                includeChordSheet: false,
                includeSongNotes: false,
              });
            }
            entityRoute = { kind: "setlist", id: setlistId };
          }
        }
      }

      if (!importedAnything) throw new UserFacingError(t("transferReceive.nothingImported"));

      enqueueMissingMetadataBackfill(useStore.getState().workspaces);
      await cleanupReceiveCache();
      // haptics vocabulary: `success` — a meaningful completion, paired with a toast.
      haptic.success();
      const donePhase: Phase = { kind: "done", transfer };
      setPhase(donePhase);
      // The leave below runs before React re-renders; the back guard reads the
      // ref, so it must already say "done" or it would ask "Stop saving?".
      phaseRef.current = donePhase;

      if (entityRoute) {
        toast(
          t(
            entityRoute.kind === "songbook"
              ? "transferReceive.songbookSaved"
              : entityRoute.kind === "playlist"
                ? "transferReceive.playlistSaved"
                : "transferReceive.setlistSaved"
          ),
          entityRoute.kind === "songbook" ? "book-outline" : entityRoute.kind === "playlist" ? "musical-notes-outline" : "albums-outline"
        );
        returnHome(navigation, {
          screen: "LibraryHome",
          params: {
            openCollectionKind: entityRoute.kind,
            openCollectionId: entityRoute.id,
            openToken: Date.now(),
          },
        });
      } else {
        toast(t("transferReceive.savedReceived"), "mail-open-outline");
        goToReceived(packageId ?? undefined);
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
      // A compilation an earlier .songnook item in this parcel created (a setlist,
      // a chart book, a playlist) goes too: deleteWorkspace only prunes playlist
      // ITEMS of the removed workspace, never the compilation itself.
      const state = useStore.getState();
      const fromThisParcel = (entity: { received?: { transferId?: string | null } }) =>
        entity.received?.transferId === transfer.transferId;
      state.setlists.filter(fromThisParcel).forEach((setlist) => state.deleteSetlist(setlist.id));
      state.songbooks.filter(fromThisParcel).forEach((songbook) => state.deleteSongbook(songbook.id));
      state.playlists.filter(fromThisParcel).forEach((playlist) => state.deletePlaylist(playlist.id));
      if (abortRef.current) return; // the user chose to leave; no failure to report
      // The reason goes to the console (and to the diagnostics bundle's log);
      // the page keeps its one calm sentence.
      console.warn("[receive] save failed", error);
      // haptics vocabulary: `error` — a failure the user must hear about.
      haptic.error();
      setPhase({
        kind: "error",
        message: userFacingMessage(error, t("transferReceive.saveFailed")),
      });
    }
  }

  const confirmThenSave = (transfer: TransferPayload) => {
    const totalBytes = transfer.items.reduce((sum, item) => sum + item.size, 0);
    if (totalBytes < BIG_PARCEL_BYTES) {
      void save(transfer);
      return;
    }
    AppAlert.confirm(
      t("transferReceive.bigParcelTitle", { size: formatBytes(totalBytes) }),
      t("transferReceive.bigParcelBody"),
      () => void save(transfer),
      { confirmLabel: t("transferReceive.save") }
    );
  };

  const renderItem = (transfer: TransferPayload, item: TransferItemPayload, index: number) => {
    const saving = phase.kind === "saving";
    const done = phase.kind === "done";
    const active = saving && phase.itemIndex === index;
    const complete = done || (saving && phase.itemIndex > index);
    const archive = isArchiveItem(item);
    const previewing = preview.activeItemId === item.itemId;
    // An archive row wears the parcel's name, not its timestamped file name,
    // and says what it is when the sender said so (a collection, a workspace).
    const name = archive ? transfer.title || t("transferReceive.songnookFile") : displayName(item.fileName);
    const archiveLabel = PACKAGE_KINDS.has(transfer.kind)
      ? t(`received.${transfer.kind}`)
      : t("transferReceive.songnookFile");
    const meta = active
      ? t("transferReceive.downloading", { percent: Math.round(phase.itemFraction * 100) })
      : archive
        ? `${archiveLabel} · ${formatBytes(item.size)}`
        : formatBytes(item.size);
    return (
      <SurfaceCard key={item.itemId} style={local.row}>
        {archive ? (
          <View style={local.lead}>
            <Ionicons name="albums-outline" size={16} color={colors.textStrong} />
          </View>
        ) : (
          // The lead plays the file from the link — hear it before you keep it.
          <Pressable
            style={({ pressed }) => [local.lead, previewing ? local.leadActive : null, pressed ? styles.pressDown : null]}
            onPress={() => {
              // haptics vocabulary: `tap` — an acknowledged press.
              haptic.tap();
              preview.toggle(item);
            }}
            disabled={saving || done}
            accessibilityRole="button"
            accessibilityLabel={t(previewing && preview.playing ? "transferReceive.pause" : "transferReceive.play", { name })}
          >
            {previewing && preview.loading ? (
              <Spinner size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons
                name={previewing && preview.playing ? "pause" : "play"}
                size={16}
                color={previewing ? colors.onPrimary : colors.textStrong}
                style={previewing && preview.playing ? undefined : local.playGlyph}
              />
            )}
          </Pressable>
        )}
        <View style={local.rowMain}>
          <UserText value={name} style={local.rowTitle} numberOfLines={1}>
            {name}
          </UserText>
          <Text style={local.rowMeta}>{meta}</Text>
        </View>
        {complete ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        ) : active ? (
          <Spinner size="small" color={colors.primary} />
        ) : null}
      </SurfaceCard>
    );
  };

  const renderBody = () => {
    switch (phase.kind) {
      case "loading":
        return (
          <View style={local.centerWrap}>
            <Spinner color={colors.primary} />
            <Text style={local.centerText}>{t("transferReceive.opening")}</Text>
          </View>
        );
      case "gone":
        return (
          <View style={local.centerWrap}>
            <Ionicons name="time-outline" size={26} color={colors.textMuted} />
            <Text style={local.centerTitle}>{t("transferReceive.expired")}</Text>
            <Text style={local.centerText}>{t("transferReceive.expiredBody")}</Text>
          </View>
        );
      case "already-saved":
        return (
          <View style={local.centerWrap}>
            <Ionicons name="checkmark-circle-outline" size={26} color={colors.primary} />
            <Text style={local.centerTitle}>{t("transferReceive.alreadySaved")}</Text>
            <Text style={local.centerText}>{t("transferReceive.alreadySavedBody")}</Text>
            <Button label={t("transferReceive.openReceived")} onPress={() => goToReceived()} style={local.centerKey} />
          </View>
        );
      case "error":
        return (
          <View style={local.centerWrap}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.textMuted} />
            <Text style={local.centerTitle}>{t("transferReceive.openFailed")}</Text>
            <Text style={local.centerText}>{phase.message}</Text>
            <Button
              label={t("transferReceive.tryAgain")}
              variant="secondary"
              style={local.centerKey}
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
                          : { kind: "error", message: t("transferReceive.openFailed") }
                      )
                    );
                }
              }}
            />
          </View>
        );
      case "ready":
      case "saving":
      case "done": {
        const transfer = phase.transfer;
        const saving = phase.kind === "saving";
        const done = phase.kind === "done";
        const totalBytes = transfer.items.reduce((sum, item) => sum + item.size, 0);
        const hasArchive = transfer.items.some(isArchiveItem);
        const title = transfer.title || t("transferReceive.sentMusic");
        const metaLine = [
          t("transferReceive.from", { name: transfer.sender.name || t("transferReceive.someone") }),
          t("transferReceive.fileCount", { count: transfer.items.length }),
          formatBytes(totalBytes),
          t("transferReceive.daysLeft", { count: daysUntil(transfer.expiresAt) }),
        ].join("  ·  ");
        const keyLabel = done
          ? t("transferReceive.saved")
          : saving
            ? t("transferReceive.saving")
            : transfer.items.length > 1
              ? t("transferReceive.saveAll")
              : t("transferReceive.save");

        return (
          <View style={local.fill}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={local.scrollContent}>
            <View style={local.header}>
              <Text style={local.eyebrow}>{t("transferReceive.parcel")}</Text>
              <UserText value={title} style={local.title} numberOfLines={2}>
                {title}
              </UserText>
              <Text style={local.meta}>{metaLine}</Text>
            </View>

            {transfer.message ? (
              <SurfaceCard style={local.noteCard}>
                <UserText value={transfer.message} align="content" style={local.noteText}>
                  {transfer.message}
                </UserText>
              </SurfaceCard>
            ) : null}

            <View style={local.list}>{transfer.items.map((item, index) => renderItem(transfer, item, index))}</View>
          </ScrollView>

          {/* The key never scrolls away: the list scrolls, the decision stays. */}
          <View style={local.footer}>
            {/* Where it lands — said before the tap, not after. */}
            <Text style={local.destination}>{destinationLine(transfer, hasArchive, title, t)}</Text>
            <Button
              testID="transfer-save"
              label={keyLabel}
              onPress={() => confirmThenSave(transfer)}
              disabled={saving || done}
              hapticFeedback={false}
              accessibilityLabel={keyLabel}
            />
          </View>
          </View>
        );
      }
    }
  };

  return (
    <SafeAreaView style={local.screen}>
      <ScreenHeader title={t("transferReceive.header")} leftIcon="back" />
      {renderBody()}
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.page,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.eyebrow,
    marginBottom: spacing.xs,
  },
  // The setlist page's title size — a parcel is a peer of a set, not a hub.
  title: {
    ...textTokens.pageTitle,
    fontSize: 32,
    lineHeight: 38,
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  noteCard: {
    backgroundColor: colors.primarySurface,
    marginBottom: spacing.md,
  },
  noteText: {
    fontFamily: "Lora_500Medium",
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textStrong,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  lead: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  leadActive: {
    backgroundColor: colors.primary,
  },
  playGlyph: {
    marginLeft: 2,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  destination: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: 36,
  },
  centerTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
  },
  centerText: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  centerKey: {
    marginTop: spacing.sm,
  },
});
