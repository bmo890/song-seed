import { useCallback, useState } from "react";
import type { ClipSection, ClipSectionKind } from "../../../types";
import { useStore } from "../../../state/useStore";
import {
  defaultSectionEndMs,
  getSectionPreset,
  isDefaultSectionLabel,
  MIN_SECTION_LENGTH_MS,
  normalizeSections,
  resolveSectionEdit,
} from "../../../domain/playerSections";

type UsePlayerSectionsArgs = {
  playerIdeaId: string | null | undefined;
  playerClipId: string | null | undefined;
  sections: ClipSection[];
  displayDuration: number;
  playerPosition: number;
};

/** Optional custom descriptor (title + colour) when adding/retyping a custom section. */
export type SectionCustomInput = { label: string; color: string };

export function usePlayerSections({
  playerIdeaId,
  playerClipId,
  sections,
  displayDuration,
  playerPosition,
}: UsePlayerSectionsArgs) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const persist = useCallback(
    (next: ClipSection[]) => {
      if (!playerIdeaId || !playerClipId) return;
      useStore
        .getState()
        .setClipSections(playerIdeaId, playerClipId, normalizeSections(next, displayDuration));
    },
    [displayDuration, playerClipId, playerIdeaId]
  );

  const handleAddSection = useCallback(
    (kind: ClipSectionKind, custom?: SectionCustomInput) => {
      if (!playerIdeaId || !playerClipId) return;
      const preset = getSectionPreset(kind);
      const duration = Math.max(0, Math.round(displayDuration || playerPosition));
      const playhead = Math.round(Math.max(0, Math.min(duration || playerPosition, playerPosition)));

      const isOccupied = (ms: number) =>
        sections.some((section) => Math.abs(section.startMs - ms) <= MIN_SECTION_LENGTH_MS);

      // Drop the new section at the playhead. While paused the playhead doesn't move, so when
      // that spot is taken we append after the last section instead, keeping taps in order.
      let startMs = playhead;
      if (isOccupied(playhead) && duration > 0) {
        const lastStartMs = sections.reduce((max, section) => Math.max(max, section.startMs), 0);
        startMs = Math.round((lastStartMs + duration) / 2);
      }
      if (isOccupied(startMs)) return;

      const section: ClipSection = {
        id: `sec-${Date.now()}`,
        startMs,
        endMs: defaultSectionEndMs(sections, startMs, duration),
        kind,
        label: custom?.label ?? preset.label,
        color: kind === "custom" ? custom?.color ?? preset.color : undefined,
      };
      persist([...sections, section]);
    },
    [displayDuration, persist, playerClipId, playerIdeaId, playerPosition, sections]
  );

  const handleRepositionSectionEdge = useCallback(
    (sectionId: string, edge: "start" | "end", ms: number) => {
      const patch = edge === "start" ? { startMs: ms } : { endMs: ms };
      persist(resolveSectionEdit(sections, sectionId, patch, displayDuration));
    },
    [displayDuration, persist, sections]
  );

  const handleToggleEdit = useCallback((section: ClipSection) => {
    setEditingSectionId((prev) => (prev === section.id ? null : section.id));
    setDraftLabel(section.label);
  }, []);

  const handleChangeSectionKind = useCallback(
    (sectionId: string, kind: ClipSectionKind, custom?: SectionCustomInput) => {
      const preset = getSectionPreset(kind);
      persist(
        sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                kind,
                // A custom retype carries its own title; otherwise keep a user-renamed label
                // and only the default preset name tracks the new kind.
                label:
                  custom?.label ?? (isDefaultSectionLabel(section) ? preset.label : section.label),
                color: kind === "custom" ? custom?.color ?? section.color ?? preset.color : undefined,
              }
            : section
        )
      );
    },
    [persist, sections]
  );

  const handleEditSection = useCallback(
    (sectionId: string, edits: { label: string; color: string }) => {
      const label = edits.label.trim();
      persist(
        sections.map((section) =>
          section.id === sectionId
            ? { ...section, label: label || section.label, color: edits.color }
            : section
        )
      );
    },
    [persist, sections]
  );

  const handleCommitRename = useCallback(
    (sectionId: string) => {
      const label = draftLabel.trim();
      if (!label) return;
      persist(sections.map((section) => (section.id === sectionId ? { ...section, label } : section)));
    },
    [draftLabel, persist, sections]
  );

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      persist(sections.filter((section) => section.id !== sectionId));
      setEditingSectionId((prev) => (prev === sectionId ? null : prev));
    },
    [persist, sections]
  );

  return {
    editingSectionId,
    draftLabel,
    setDraftLabel,
    handleAddSection,
    handleRepositionSectionEdge,
    handleToggleEdit,
    handleChangeSectionKind,
    handleEditSection,
    handleCommitRename,
    handleDeleteSection,
  };
}
