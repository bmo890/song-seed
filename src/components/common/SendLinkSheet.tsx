import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Press } from "./Press";
import { BackgroundPill, BACKGROUND_PILL_STACK } from "./BackgroundPill";
import { toast } from "./toastStore";
import { UserText, UserTextInput } from "../../i18n/direction";
import { useSendSheetStore, type SendRequest } from "../../state/useSendSheetStore";
import { useSendJobStore, type SendJob } from "../../state/useSendJobStore";
import { SENDER_NAME_MAX, useSendPrefsStore } from "../../state/useSendPrefsStore";
import { useProcessStore } from "../../state/useProcessStore";
import { useStore } from "../../state/useStore";
import type { SentLink } from "../../domain/sentLinks";
import { moveParcelItem, sortParcelItemsAz, type ParcelItem } from "../../domain/parcelOrder";
import { formatEta, sendEtaSeconds, sendOverallFraction } from "../../domain/sendProgress";
import { formatBytes } from "../../utils";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { useTranslation } from "react-i18next";

const TITLE_MAX = 200;
const MESSAGE_MAX = 1000;
/** BottomSheet's exit animation; the store clears after it. */
const SHEET_EXIT_MS = 260;

function daysUntil(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
}

/**
 * The SongNook Send sheet — the desktop sender page, folded into the phone.
 * One request at a time (useSendSheetStore): a title, who it's from, a note
 * if you like, then one key. The key hands the parcel to the seal job
 * (useSendJobStore) and the sheet folds away; the seal runs behind the app
 * under a pill, and the link waits there. The From name is remembered.
 */
export function SendLinkHost() {
  const request = useSendSheetStore((s) => s.request);
  const seq = useSendSheetStore((s) => s.seq);
  if (!request) return null;
  // Keyed per open so a new parcel always starts from a fresh form.
  return <SendLinkSheet key={seq} request={request} />;
}

function SendLinkSheet({ request }: { request: SendRequest }) {
  const { t } = useTranslation();
  const close = useSendSheetStore((s) => s.close);
  const startJob = useSendJobStore((s) => s.start);
  const rememberedName = useSendPrefsStore((s) => s.senderName);
  const setSenderName = useSendPrefsStore((s) => s.setSenderName);

  const [title, setTitle] = useState(request.title);
  const [from, setFrom] = useState(rememberedName);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<ParcelItem[]>(request.items ?? []);
  const [visible, setVisible] = useState(true);

  // The sheet owns its exit: BottomSheet animates out on `visible: false`,
  // then the request clears and the host unmounts us.
  const dismiss = () => {
    setVisible(false);
    setTimeout(close, SHEET_EXIT_MS);
  };

  const seal = () => {
    const parcelTitle = title.trim().slice(0, TITLE_MAX) || request.title;
    const senderName = from.trim().slice(0, SENDER_NAME_MAX) || null;
    setSenderName(from);
    // haptics vocabulary: `tap` — an acknowledged press (the key itself is silent).
    haptic.tap();
    startJob(request, {
      title: parcelTitle,
      senderName,
      message: message.trim().slice(0, MESSAGE_MAX) || null,
      order: items.length > 0 ? items.map((item) => item.key) : undefined,
    });
    // The seal is the pill's now; the form has nothing left to say.
    dismiss();
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss} dismissDistance={420} keyboardAvoiding>
      <View style={local.content}>
        <SheetEyebrow />
        {items.length > 1 ? (
          // The parcel's running order: the receiver gets the clips in this
          // order, so it is decided here, not by how they were tapped.
          <>
            <View style={local.orderHead}>
              <Text style={local.label}>{t("sendSheet.orderLabel")}</Text>
              {/* Haptics (Press): `light` — the order changed, a small state flip. */}
              <Press
                feel="glyph"
                haptic="light"
                onPress={() => setItems((prev) => sortParcelItemsAz(prev))}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={local.sortLink}>{t("sendSheet.sortAz")}</Text>
              </Press>
            </View>
            <ScrollView style={local.orderList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {items.map((item, index) => (
                <View key={item.key} style={local.orderRow}>
                  <Text style={local.orderIndex}>{index + 1}</Text>
                  <UserText value={item.title} style={local.orderTitle} numberOfLines={1}>
                    {item.title}
                  </UserText>
                  {/* Press dims a disabled key itself: no btnDisabled on top. */}
                  <Press
                    haptic="light"
                    onPress={() => setItems((prev) => moveParcelItem(prev, index, index - 1))}
                    disabled={index === 0}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("sendSheet.moveUp", { title: item.title })}
                    style={local.nudge}
                  >
                    <Ionicons name="chevron-up" size={15} color={colors.textStrong} />
                  </Press>
                  <Press
                    haptic="light"
                    onPress={() => setItems((prev) => moveParcelItem(prev, index, index + 1))}
                    disabled={index === items.length - 1}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t("sendSheet.moveDown", { title: item.title })}
                    style={local.nudge}
                  >
                    <Ionicons name="chevron-down" size={15} color={colors.textStrong} />
                  </Press>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
        <Text style={local.label}>{t("sendSheet.titleLabel")}</Text>
        <UserTextInput
          testID="send-title"
          style={local.input}
          value={title}
          onChangeText={setTitle}
          placeholder={request.title}
          placeholderTextColor={colors.textMuted}
          maxLength={TITLE_MAX}
          returnKeyType="next"
        />
        <Text style={local.label}>{t("sendSheet.fromLabel")}</Text>
        <UserTextInput
          testID="send-from"
          style={local.input}
          value={from}
          onChangeText={setFrom}
          placeholder={t("sendSheet.fromPlaceholder")}
          placeholderTextColor={colors.textMuted}
          maxLength={SENDER_NAME_MAX}
          autoFocus={!rememberedName}
          returnKeyType="next"
        />
        <Text style={local.label}>{t("sendSheet.noteLabel")}</Text>
        <UserTextInput
          testID="send-note"
          style={[local.input, local.noteInput]}
          value={message}
          onChangeText={setMessage}
          placeholder={t("sendSheet.notePlaceholder")}
          placeholderTextColor={colors.textMuted}
          maxLength={MESSAGE_MAX}
          multiline
        />
        <Text style={local.hint}>{t("sendSheet.expiryHint")}</Text>
        <View style={local.keys}>
          <Button variant="secondary" label={t("common.cancel")} style={local.key} onPress={dismiss} />
          <Button
            testID="send-seal"
            label={t("sendSheet.seal")}
            style={local.key}
            hapticFeedback={false}
            onPress={seal}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function SheetEyebrow() {
  const { t } = useTranslation();
  return (
    <View style={local.header}>
      <Ionicons name="paper-plane-outline" size={15} color={colors.primaryDeep} />
      <Text style={local.eyebrow}>{t("sendSheet.title")}</Text>
    </View>
  );
}

/** Re-render once a second while uploading, so the time left keeps moving. */
function useSecondTick(enabled: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [enabled]);
}

function phaseLabel(job: SendJob, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (job.progress.phase === "packing") {
    // The bar only moves per take; the count is what moves during a long song.
    const encoding = job.progress.encoding;
    return encoding && encoding.count > 1
      ? t("sendSheet.packingOf", { index: encoding.index, count: encoding.count })
      : t("sendSheet.packing");
  }
  if (job.progress.phase === "uploading") return t("sendSheet.uploading");
  return t("sendSheet.sealing");
}

/**
 * The seal's own sheet: progress with Hide and Cancel while it runs, the link
 * with Copy and Share once it is ready, the reason and Try again if it fails.
 * Opened from the pill; Hide folds it back into the pill.
 */
function SendJobSheet({ job }: { job: SendJob }) {
  const { t } = useTranslation();
  const setExpanded = useSendJobStore((s) => s.setExpanded);
  const cancel = useSendJobStore((s) => s.cancel);
  const retry = useSendJobStore((s) => s.retry);
  const dismissJob = useSendJobStore((s) => s.dismiss);
  const [visible, setVisible] = useState(true);
  const running = job.status === "running";
  useSecondTick(running && job.progress.phase === "uploading");

  const fold = (after: () => void) => {
    setVisible(false);
    setTimeout(after, SHEET_EXIT_MS);
  };
  const hide = () => fold(() => setExpanded(false));

  const copy = async (link: SentLink) => {
    // haptics vocabulary: `light` — a small confirmation (copy).
    haptic.light();
    await Clipboard.setStringAsync(link.shareUrl).catch(() => {});
    toast(t("sendSheet.copied"), "checkmark-outline");
  };
  const share = (link: SentLink) => {
    void Share.share({ message: link.shareUrl }).catch(() => {});
  };

  const fraction = sendOverallFraction(job.progress, job.hasPacking);
  const percent = Math.round(fraction * 100);
  const eta = sendEtaSeconds(job.progress, job.uploadStartedAt, Date.now());
  const bytes =
    job.progress.phase === "uploading" && job.progress.totalBytes > 0
      ? t("sendSheet.bytesOf", {
          sent: formatBytes(job.progress.completedBytes),
          total: formatBytes(job.progress.totalBytes),
        })
      : null;
  const supporting = [bytes, eta != null ? t("sendSheet.timeLeft", { eta: formatEta(eta) }) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <BottomSheet visible={visible} onClose={hide} dismissDistance={420}>
      <View style={local.content}>
        <SheetEyebrow />
        <UserText value={job.title} style={local.doneTitle} numberOfLines={2}>
          {job.title}
        </UserText>

        {job.status === "ready" && job.link ? (
          <View style={local.done}>
            <Text style={local.doneMeta}>
              {t("sendSheet.ready")} · {t("sharing.daysLeft", { count: daysUntil(job.link.expiresAt) })}
            </Text>
            <View style={local.linkBox}>
              <Text style={local.linkText} numberOfLines={1} selectable>
                {job.link.shareUrl}
              </Text>
            </View>
            <View style={local.keys}>
              <Button
                variant="secondary"
                label={t("common.copy")}
                style={local.key}
                onPress={() => void copy(job.link!)}
                accessibilityLabel={t("sharing.copyLink")}
              />
              <Button label={t("sendSheet.share")} style={local.key} onPress={() => share(job.link!)} />
            </View>
            <Button
              variant="quiet"
              label={t("common.done")}
              onPress={() => fold(dismissJob)}
              style={local.doneKey}
            />
          </View>
        ) : job.status === "error" ? (
          <View style={local.done}>
            <Text style={local.errorTitle}>{job.errorTitle}</Text>
            <Text style={local.errorBody}>{job.errorBody}</Text>
            <View style={local.keys}>
              <Button
                variant="secondary"
                label={t("common.dismiss")}
                style={local.key}
                onPress={() => fold(dismissJob)}
              />
              <Button label={t("sendSheet.tryAgain")} style={local.key} onPress={retry} />
            </View>
          </View>
        ) : (
          <View style={local.done}>
            <View style={local.stepRow}>
              <Text style={local.stepLabel}>{phaseLabel(job, t)}</Text>
              <Text style={local.stepPercent}>{percent}%</Text>
            </View>
            <View style={local.track}>
              <View style={[local.fill, { width: `${Math.max(2, percent)}%` }]} />
            </View>
            <Text style={local.doneMeta}>{supporting || " "}</Text>
            <Text style={local.hint}>{t("sendSheet.sealingHint")}</Text>
            <View style={local.keys}>
              <Button
                variant="secondary"
                label={t("common.cancel")}
                style={local.key}
                hapticFeedback={false}
                onPress={() => fold(cancel)}
                testID="send-cancel"
              />
              <Button label={t("sendSheet.hide")} style={local.key} onPress={hide} testID="send-hide" />
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

/**
 * Root-mounted: the seal as a pill above the dock, or as its sheet when
 * opened. Sits above the library-process pill when both are up (a backup and
 * a send at once is rare, but two pills on one spot is a bug).
 */
export function SendJobHost({ drawerOpen = false }: { drawerOpen?: boolean }) {
  const { t } = useTranslation();
  const job = useSendJobStore((s) => s.job);
  const setExpanded = useSendJobStore((s) => s.setExpanded);
  const processPillUp = useProcessStore((s) => !!s.process?.minimized);
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const importBannerHeight = useStore((s) => s.importBannerHeight);
  const insets = useSafeAreaInsets();

  if (!job) return null;
  if (job.expanded) return <SendJobSheet key={job.id} job={job} />;
  // The pill paints above the navigator, so it would sit on the side menu.
  if (drawerOpen) return null;

  const base = playerDockHeight > 0 ? playerDockHeight + 8 : Math.max(insets.bottom, 14);
  const bottom = base + importBannerHeight + (processPillUp ? BACKGROUND_PILL_STACK : 0);
  const fraction = sendOverallFraction(job.progress, job.hasPacking);
  const subtitle =
    job.status === "ready"
      ? t("sendSheet.readyPill")
      : job.status === "error"
        ? t("sendSheet.failedPill")
        : job.progress.phase === "sealing"
          ? t("sendSheet.sealingDots")
          : `${phaseLabel(job, t)} · ${Math.round(fraction * 100)}%`;

  return (
    <BackgroundPill
      title={job.title}
      subtitle={subtitle}
      fraction={fraction}
      terminal={job.status === "ready" ? "success" : job.status === "error" ? "error" : null}
      bottom={bottom}
      onPress={() => setExpanded(true)}
      accessibilityLabel={`${t("sendSheet.title")}. ${t("sendSheet.openSeal")}`}
      testID="send-pill"
    />
  );
}

const local = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  label: {
    ...textTokens.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  noteInput: {
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: "top",
  },
  orderHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sortLink: {
    ...textTokens.caption,
    color: colors.primaryDeep,
  },
  orderList: {
    maxHeight: 176,
    marginTop: 2,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
  },
  orderIndex: {
    ...textTokens.caption,
    color: colors.textMuted,
    width: 18,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  orderTitle: {
    ...textTokens.body,
    flex: 1,
    minWidth: 0,
  },
  nudge: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    ...textTokens.supporting,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  keys: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  key: {
    flex: 1,
  },
  done: {
    gap: spacing.xs,
  },
  doneTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  doneMeta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  linkBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textStrong,
  },
  doneKey: {
    alignSelf: "center",
    marginTop: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  stepLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  stepPercent: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 4,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 6,
  },
  fill: {
    height: "100%",
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  errorTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.danger,
    marginTop: spacing.sm,
  },
  errorBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
});
