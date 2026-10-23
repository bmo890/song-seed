import type { ReceivedMeta } from "../types";
import { isFromOthers } from "./compilationsProvenance";

/** How the Compilations hub lists playlists, chart books and setlists — the
 *  same two controls a collection has (filter + sort), with the options that
 *  mean something for a compilation (2026-10-11). */
export type CompilationFilter = "all" | "mine" | "received";
export type CompilationSort = "updated" | "name" | "created";

type Listable = {
  title: string;
  createdAt: number;
  updatedAt: number;
  received?: ReceivedMeta;
};

export function listCompilations<T extends Listable>(
  items: readonly T[],
  filter: CompilationFilter,
  sort: CompilationSort
): T[] {
  const kept =
    filter === "mine"
      ? items.filter((item) => !isFromOthers(item))
      : filter === "received"
        ? items.filter((item) => isFromOthers(item))
        : items.slice();
  return kept.sort((a, b) => {
    if (sort === "name") return a.title.localeCompare(b.title) || b.updatedAt - a.updatedAt;
    if (sort === "created") return b.createdAt - a.createdAt || a.title.localeCompare(b.title);
    return b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
  });
}
