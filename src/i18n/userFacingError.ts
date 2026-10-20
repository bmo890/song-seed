/**
 * What a failure dialog may say (overnight check 2026-10-20). A raw `error.message` is
 * usually English and often a native exception ("Error Domain=NSOSStatusErrorDomain…"),
 * so dialogs show their own translated sentence instead and the raw text goes to the
 * log. A thrown error whose message was written for people says so by being a
 * `UserFacingError`.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** The sentence to show for `error`: its own if it was written for people, else `fallback`.
 *  In development the raw message rides along, so a failure stays debuggable. */
export function userFacingMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error != null) console.warn("[failure]", error);
  if (__DEV__ && error instanceof Error && error.message) return `${fallback}\n\n${error.message}`;
  return fallback;
}
