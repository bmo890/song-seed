import { useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import ReAnimated from "react-native-reanimated";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useTranslation } from "react-i18next";
import { BottomSheet, type BottomSheetRef } from "./BottomSheet";
import { Button } from "./Button";
import { InkLink } from "./InkLink";
import { toast } from "./toastStore";
import { closeFeedbackSheet, setFeedbackDraft, setFeedbackEmail, useFeedbackSheetState } from "./feedbackSheetStore";
import { UserTextInput } from "../../i18n/direction";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { collapseIn } from "../../design/motion";
import { styles } from "../../styles";
import { SONGNOOK_EMAIL } from "../../config/legalLinks";
import { describeInstalledUpdate } from "../../domain/installedUpdate";
import { formatClipDate } from "../../utils";
import { FEEDBACK_EMAIL_MAX, FEEDBACK_NOTE_MAX, FEEDBACK_NOTE_MIN, feedbackEmailOk, sendFeedbackNote } from "../../services/feedback";

/**
 * A note to the people who make SongNook, sent without leaving it (founder,
 * 2026-11-11: feedback must not depend on a mail app). No name travels with it; an
 * email goes only when typed in the optional line beneath, so the founder can answer
 * (2026-11-15: "I can't write them back"). Words typed are kept if the sheet is
 * swiped away; the note clears once sent, the email stays for the next one.
 */
function FeedbackSheetBody({ draft, email, onDone }: { draft: string; email: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  // A toast would draw beneath this sheet's Modal, so a failure is said in the sheet.
  const [problem, setProblem] = useState<"send" | "mail" | "email" | null>(null);
  const ready = draft.trim().length >= FEEDBACK_NOTE_MIN && !sending;

  const send = async () => {
    if (!ready) return;
    if (!feedbackEmailOk(email)) {
      haptic.error();
      setProblem("email");
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      await sendFeedbackNote(draft, email);
      setFeedbackDraft("");
      haptic.success();
      toast(t("feedbackSheet.sent"), "checkmark-circle-outline");
      onDone();
    } catch {
      haptic.error();
      setProblem("send");
      setSending(false);
    }
  };

  // The mail this row always wrote, now carrying whatever was typed here.
  const emailInstead = () => {
    haptic.tap();
    const version = Constants.expoConfig?.version ?? "—";
    const installedUpdate = describeInstalledUpdate(
      { updateId: Updates.updateId, createdAt: Updates.createdAt, isEmbeddedLaunch: Updates.isEmbeddedLaunch },
      formatClipDate
    );
    const subject = encodeURIComponent(`SongNook feedback (v${version}${installedUpdate ? ` · ${installedUpdate}` : ""})`);
    const body = draft.trim() ? `&body=${encodeURIComponent(draft.trim())}` : "";
    void Linking.openURL(`mailto:${SONGNOOK_EMAIL}?subject=${subject}${body}`).catch(() => {
      haptic.error();
      setProblem("mail");
    });
  };

  return (
    <ScrollView
      style={styles.clipNotesSheetScroll}
      contentContainerStyle={styles.clipNotesSheetContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.clipNotesSheetHeading}>{t("settings.feedback")}</Text>
      <UserTextInput
        testID="feedback-note-input"
        style={styles.clipNotesSheetTextInput}
        multiline
        maxLength={FEEDBACK_NOTE_MAX}
        placeholder={t("feedbackSheet.placeholder")}
        placeholderTextColor={colors.textMuted}
        value={draft}
        onChangeText={(next) => {
          setFeedbackDraft(next);
          if (problem) setProblem(null);
        }}
        autoFocus
      />
      <UserTextInput
        testID="feedback-email-input"
        style={styles.clipNotesSheetLineInput}
        value={email}
        onChangeText={(next) => {
          setFeedbackEmail(next);
          if (problem === "email") setProblem(null);
        }}
        placeholder={t("feedbackSheet.emailPlaceholder")}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("feedbackSheet.emailPlaceholder")}
        maxLength={FEEDBACK_EMAIL_MAX}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      <Text style={s.hint}>{t("feedbackSheet.hint")}</Text>
      {problem ? (
        <ReAnimated.Text entering={collapseIn} style={s.problem} accessibilityRole="alert">
          {problem === "send"
            ? t("feedbackSheet.failed")
            : problem === "email"
              ? t("feedbackSheet.badEmail")
              : t("feedbackSheet.noMail", { email: SONGNOOK_EMAIL })}
        </ReAnimated.Text>
      ) : null}
      <View style={s.actions}>
        <InkLink label={t("feedbackSheet.emailInstead")} onPress={emailInstead} testID="feedback-email-instead" />
        <Button label={t("feedbackSheet.send")} disabled={!ready} onPress={() => void send()} />
      </View>
    </ScrollView>
  );
}

export function FeedbackHost() {
  const { visible, draft, email } = useFeedbackSheetState();
  const sheetRef = useRef<BottomSheetRef>(null);
  return (
    <BottomSheet ref={sheetRef} visible={visible} onClose={closeFeedbackSheet} dismissDistance={420} keyboardAvoiding>
      {visible ? <FeedbackSheetBody draft={draft} email={email} onDone={() => sheetRef.current?.close()} /> : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  hint: {
    ...textTokens.supporting,
    paddingHorizontal: 2,
    marginTop: -spacing.xs,
  },
  problem: {
    ...textTokens.supporting,
    color: colors.danger,
    paddingHorizontal: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
