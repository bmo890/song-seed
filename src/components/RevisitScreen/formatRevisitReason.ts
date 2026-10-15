import type { TFunction } from "i18next";
import type { RevisitReason, RevisitSpan } from "../../domain/revisit";

function span(t: TFunction, value: RevisitSpan): string {
  return t(`revisit.span.${value.unit}`, { count: value.count });
}

/** A resurfaced card's "why", as a short label in the app's language. */
export function formatRevisitReason(t: TFunction, reason: RevisitReason): string {
  switch (reason.kind) {
    case "sessions":
      return t("revisit.reason.sessions", { count: reason.count });
    case "variations":
      return t("revisit.reason.variations", { count: reason.count });
    case "lyrics":
      return t("revisit.reason.lyrics");
    case "notes":
      return t("revisit.reason.notes");
    case "untouched":
      return t("revisit.reason.untouched", { span: span(t, reason.span) });
    case "oneTake":
      return t("revisit.reason.oneTake");
    case "raw":
      return t("revisit.reason.raw");
    case "recorded":
      return t("revisit.reason.recorded", { span: span(t, reason.span) });
    case "made":
      return t("revisit.reason.made", { span: span(t, reason.span) });
    case "season":
      return t("revisit.reason.season", { season: t(`revisit.season.${reason.season}`), year: reason.year });
    case "yearAgoThisWeek":
      return t("revisit.reason.yearAgoThisWeek");
    case "thisWeekIn":
      return t("revisit.reason.thisWeekIn", { year: reason.year });
  }
}
