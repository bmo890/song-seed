import { useEffect } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { isFoundingMember, isPaywallLive, proEntitlement } from "../../domain/entitlements";
import { noticeDue } from "../../domain/freeMonth";
import { isDevFreeMonthPreview, markNoticeShown, readShownNotices, syncFreeMonth } from "../../services/freeMonthClock";
import { useStore } from "../../state/useStore";
import { openProUpsell } from "./proUpsell";
import { toast } from "./toastStore";

/**
 * Keeps the free month's clock current (on launch and every return to the app) and
 * gives its quiet notes, each once: a toast a few days before it ends, one on the last
 * day, and the Pro sheet once after it has ended. Nothing shows while everything is
 * free, nor to a subscriber or a founding member. Mount once, after hydration.
 */
export function FreeMonthNotices() {
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const status = await syncFreeMonth(useStore.getState().firstLaunchAt);
      if (cancelled) return;
      if (!isPaywallLive() && !isDevFreeMonthPreview()) return;
      if (proEntitlement.get() || isFoundingMember()) return;
      const due = noticeDue(status, await readShownNotices());
      if (cancelled || !due) return;
      await markNoticeShown(due);
      const seePro = { label: t("freeMonth.seePro"), onPress: () => openProUpsell() };
      if (due === "fewDaysLeft") {
        toast(t("freeMonth.daysLeft", { count: status.daysLeft }), "time-outline", { action: seePro });
      } else if (due === "lastDay") {
        toast(t("freeMonth.endsToday"), "time-outline", { action: seePro });
      } else {
        openProUpsell();
      }
    };
    void run();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void run();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [t]);

  return null;
}
