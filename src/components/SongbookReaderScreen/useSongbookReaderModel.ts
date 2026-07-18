import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { useChartPrefsStore } from "../../state/useChartPrefsStore";
import {
  availableViewsForSong,
  groupSongbookItems,
  type SongbookReaderView,
  type SongbookSong,
} from "../../domain/songbookGrouping";
import { clampTransposeOffset } from "../../domain/transpose";

/** Font-zoom steps for the reading views. */
export const READER_ZOOM_STEPS = [1, 1.15, 1.3, 0.85] as const;

/**
 * The songbook reader — full-screen "turn the pages of my book" flow. Prev/next
 * is internal state (no navigation-stack buildup); each page renders the LIVE
 * song data, so a lyric fix made after adding the song shows up in the book.
 */
export function useSongbookReaderModel() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const songbookId = route.params?.songbookId as string | undefined;
  const startIdeaId = route.params?.startIdeaId as string | undefined;

  const workspaces = useStore((s) => s.workspaces);
  const songbooks = useStore((s) => s.songbooks);
  const playerTarget = useStore((s) => s.playerTarget);
  const isPlayerPlaying = useStore((s) => s.playerIsPlaying);

  const songbook = songbooks.find((candidate) => candidate.id === songbookId) ?? null;

  // Only readable songs page through the book; dead references are the detail
  // view's problem to surface, not the reader's.
  const songs = useMemo<SongbookSong[]>(() => {
    if (!songbook) return [];
    return groupSongbookItems(songbook, workspaces).filter(
      (song) => song.available && availableViewsForSong(song).length > 0
    );
  }, [songbook, workspaces]);

  const [index, setIndex] = useState(() => {
    if (!startIdeaId) return 0;
    return Math.max(0, songs.findIndex((song) => song.ideaId === startIdeaId));
  });
  const safeIndex = Math.min(index, Math.max(0, songs.length - 1));
  const song = songs[safeIndex] ?? null;

  const views = useMemo<SongbookReaderView[]>(
    () => (song ? availableViewsForSong(song) : []),
    [song]
  );

  // The chosen view follows across pages when the next song offers it; else it
  // clamps to that song's first view.
  const [preferredView, setPreferredView] = useState<SongbookReaderView | null>(null);
  const view: SongbookReaderView | null =
    views.length === 0 ? null : preferredView && views.includes(preferredView) ? preferredView : views[0]!;

  const [zoomStep, setZoomStep] = useState(0);
  const zoom = READER_ZOOM_STEPS[zoomStep % READER_ZOOM_STEPS.length]!;

  const transposeByIdeaId = useChartPrefsStore((s) => s.transposeByIdeaId);
  const transpose = song ? clampTransposeOffset(transposeByIdeaId[song.ideaId] ?? 0) : 0;

  // Stale-route guard: if the book empties or vanishes while open, leave.
  useEffect(() => {
    if (!songbook || songs.length === 0) {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songbook, songs.length]);

  const nowPlayingThisSong = !!song && playerTarget?.ideaId === song.ideaId;

  return {
    songbook,
    songs,
    song,
    index: safeIndex,
    count: songs.length,
    previousTitle: safeIndex > 0 ? songs[safeIndex - 1]!.title : null,
    nextTitle: safeIndex < songs.length - 1 ? songs[safeIndex + 1]!.title : null,
    goPrevious: () => setIndex((current) => Math.max(0, current - 1)),
    goNext: () => setIndex((current) => Math.min(songs.length - 1, current + 1)),

    views,
    view,
    setView: setPreferredView,

    zoom,
    cycleZoom: () => setZoomStep((current) => (current + 1) % READER_ZOOM_STEPS.length),

    transpose,
    nudgeTranspose: (delta: number) => {
      if (!song) return;
      useChartPrefsStore.getState().nudgeTranspose(song.ideaId, delta);
    },
    resetTranspose: () => {
      if (!song) return;
      useChartPrefsStore.getState().resetTranspose(song.ideaId);
    },

    nowPlayingThisSong,
    isPlayerPlaying,
    /** Reference audio into the dock — the reader stays up, audio underneath. */
    toggleSongAudio: () => {
      if (!song?.playableClip) return;
      const store = useStore.getState();
      if (nowPlayingThisSong) {
        store.requestPlayerToggle();
        return;
      }
      store.setPlayerQueue([{ ideaId: song.ideaId, clipId: song.playableClip.id }], 0, true);
    },

    close: () => navigation.goBack(),
  };
}
