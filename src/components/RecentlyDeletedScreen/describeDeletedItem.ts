import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { TFunction } from "i18next";
import type { DeletedItem } from "../../types";
import { getHierarchyIconName } from "../../domain/hierarchy";
import { isTitleAutoNamed } from "../../domain/titleNaming";
import { deletedItemDaysLeft } from "../../state/recentlyDeleted";
import { formatBytes } from "../../utils";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** A Recently deleted row: its glyph, its kind in a word, and its meta line
 *  (kind · days left · the space its audio takes). */
export function describeDeletedItem(
    item: DeletedItem,
    t: TFunction,
    opts: { bytes?: number; now?: number } = {}
): { icon: IconName; kind: string; meta: string; title: string; serifTitle: boolean } {
    const idea = item.ideas?.[0];
    let icon: IconName = "document-outline";
    let kind = "";
    let serifTitle = true;
    switch (item.kind) {
        case "idea":
            if (idea?.kind === "project") {
                icon = getHierarchyIconName("song");
                kind = t("recentlyDeleted.kindSketch");
            } else {
                icon = getHierarchyIconName("clip");
                kind = t("recentlyDeleted.kindClip");
            }
            // Machine names stay in quiet Jakarta (earned-serif rule).
            serifTitle = idea ? !isTitleAutoNamed(idea) : false;
            break;
        case "takes": {
            const count = item.clips?.length ?? 0;
            icon = getHierarchyIconName("clip");
            kind = count === 1 ? t("recentlyDeleted.kindTake") : t("recentlyDeleted.kindTakes", { count });
            const clip = item.clips?.[0];
            serifTitle = count === 1 && clip ? !isTitleAutoNamed(clip) : true;
            break;
        }
        case "collection":
            icon = "folder-outline";
            kind = t("recentlyDeleted.kindCollection");
            break;
        case "workspace":
            if (item.workspace?.origin === "received") {
                icon = "mail-open-outline";
                kind = t("recentlyDeleted.kindParcel");
            } else {
                icon = "file-tray-stacked-outline";
                kind = t("recentlyDeleted.kindWorkspace");
            }
            break;
        case "setlist":
            icon = "albums-outline";
            kind = t("recentlyDeleted.kindSetlist");
            break;
        case "songbook":
            icon = "book-outline";
            kind = t("recentlyDeleted.kindSongbook");
            break;
        case "playlist":
            icon = "musical-notes-outline";
            kind = t("recentlyDeleted.kindPlaylist");
            break;
        case "note":
            icon = "document-text-outline";
            kind = t("recentlyDeleted.kindNote");
            break;
        case "spark":
            icon = "sparkles-outline";
            kind = t("recentlyDeleted.kindSpark");
            break;
    }
    const parts = [kind, t("recentlyDeleted.daysLeft", { count: deletedItemDaysLeft(item, opts.now) })];
    if (opts.bytes && opts.bytes > 0) parts.push(formatBytes(opts.bytes));
    const title = item.title.trim() || t("common.untitled");
    return { icon, kind, meta: parts.join(" · "), title, serifTitle };
}
