/**
 * The Magpie readers' typed failure, in its own file so magpie.ts and the
 * Ben-Yehuda reader can both use it without importing each other (that cycle
 * put a dev warning over every launch).
 */
export type MagpieFetchErrorKind = "offline" | "unavailable" | "empty";

/** A typed failure so the UI can distinguish "you're offline" from "that book
 * wouldn't load" and respond appropriately. */
export class MagpieFetchError extends Error {
  kind: MagpieFetchErrorKind;
  constructor(kind: MagpieFetchErrorKind, message: string) {
    super(message);
    this.name = "MagpieFetchError";
    this.kind = kind;
  }
}
