import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../state/useStore";
import { useChartPrefsStore, useReadingChordShift } from "../../state/useChartPrefsStore";
import {
  availableViewsForSong,
  groupSongbookItems,
  songLyricVersion,
  type SongbookReaderView,
  type SongbookSong,
} from "../../domain/songbookGrouping";
import { transposeChordSheet, transposeLyricsLines } from "../../domain/transpose";
import { useMetronome } from "../../hooks/useMetronome";
import { useKeepAwakeWhileFocused } from "../../hooks/useKeepAwakeWhileFocused";
import type { ClipVersion } from "../../types";

/** The tempo a song's page keeps: the grid its take was recorded to, else a
 *  confident detected tempo. Null when the song has none. */
export function songTempo(clip: ClipVersion | null): number | null {
  if (!clip) return null;
  if (clip.recordingGrid?.bpm) return Math.round(clip.recordingGrid.bpm);
  const detected = clip.analysis?.bpm;
  return typeof detected === "number" && detected > 0 ? Math.round(detected) : null;
}

/**
 * The songbook reader — full-screen "turn the pages of my book" flow. Prev/next
 * is internal state (no navigation-stack buildup); each page renders the LIVE
 * song data, so a lyric fix made after adding the song shows up in the book.
 *
 * Stage rules (2026-10-18): the screen stays lit while the book is open, the
 * click follows each song's own tempo, and it stops when the book closes.
 * Size, chords on/off, key and capo are the shared reading preferences the
 * full player reads too.
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

  // The page is remembered by SONG, so a book edited while open keeps you on
  // the song you were reading rather than whatever slid into its slot.
  const [currentIdeaId, setCurrentIdeaId] = useState<string | null>(() => startIdeaId ?? null);
  const foundIndex = currentIdeaId ? songs.findIndex((song) => song.ideaId === currentIdeaId) : -1;
  const index = foundIndex >= 0 ? foundIndex : 0;
  const song = songs[index] ?? null;

  const views = useMemo<SongbookReaderView[]>(() => (song ? availableViewsForSong(song) : []), [song]);

  // The chosen view follows across pages when the next song offers it; else it
  // clamps to that song's first view.
  const [preferredView, setPreferredView] = useState<SongbookReaderView | null>(null);
  const view: SongbookReaderView | null =
    views.length === 0 ? null : preferredView && views.includes(preferredView) ? preferredView : views[0]!;

  const zoom = useChartPrefsStore((s) => s.readingZoom);
  const chordsHidden = useChartPrefsStore((s) => s.chordsHidden);
  const shift = useReadingChordShift(song?.ideaId);

  const lyricVersion = song ? songLyricVersion(song) : null;
  const hasLyricChords = !!lyricVersion?.document.lines.some((line) => line.chords.length > 0);
  const lyricLines = useMemo(() => {
    const lines = lyricVersion?.document.lines ?? [];
    return shift.shift && hasLyricChords ? transposeLyricsLines(lines, shift.shift) : lines;
  }, [hasLyricChords, lyricVersion, shift.shift]);
  const chordSheet = useMemo(() => {
    const sheet = song?.hasChordChart ? song.idea?.chordSheet ?? null : null;
    return sheet && shift.shift ? transposeChordSheet(sheet, shift.shift) : sheet;
  }, [shift.shift, song]);

  // Stale-route guard: if the book empties or vanishes while open, leave.
  useEffect(() => {
    if (!songbook || songs.length === 0) {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songbook, songs.length]);

  useKeepAwakeWhileFocused("songbook-reader");

  const metronome = useMetronome();
  const tempo = songTempo(song?.playableClip ?? null);
  // Each page sets the click to its song's tempo (founder, 2026-10-18). A
  // running click moves with you to the next song's tempo.
  const setBpmRef = useRef(metronome.setBpmValue);
  setBpmRef.current = metronome.setBpmValue;
  useEffect(() => {
    if (tempo != null) setBpmRef.current(tempo);
  }, [song?.ideaId, tempo]);
  // The native click runs on its own thread: closing the book must stop it,
  // or it plays on with no way to reach it.
  const clickActiveRef = useRef(false);
  clickActiveRef.current = metronome.isRunning || metronome.isCountIn || metronome.isPreparing;
  const stopRef = useRef(metronome.stop);
  stopRef.current = metronome.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        if (clickActiveRef.current) void stopRef.current();
      },
      []
    )
  );

  const nowPlayingThisSong = !!song && playerTarget?.ideaId === song.ideaId;

  const goPrevious = useCallback(() => {
    if (index > 0) setCurrentIdeaId(songs[index - 1]!.ideaId);
  }, [index, songs]);
  const goNext = useCallback(() => {
    if (index < songs.length - 1) setCurrentIdeaId(songs[index + 1]!.ideaId);
  }, [index, songs]);

  return {
    songbook,
    song,
    index,
    count: songs.length,
    previousTitle: index > 0 ? songs[index - 1]!.title : null,
    nextTitle: index < songs.length - 1 ? songs[index + 1]!.title : null,
    goPrevious,
    goNext,

    views,
    view,
    setView: setPreferredView,

    zoom,
    showChords: !chordsHidden,
    transpose: shift.transpose,
    capo: shift.capo,
    lyricLines,
    hasLyricChords,
    chordSheet,

    metronome,
    tempo,

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
  };
}
