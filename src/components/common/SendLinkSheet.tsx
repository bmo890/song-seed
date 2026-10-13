import { useEffect, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { AppAlert } from "./AppAlert";
import { toast } from "./toastStore";
import { UserText, UserTextInput } from "../../i18n/direction";
import { useSendSheetStore, type SendRequest } from "../../state/useSendSheetStore";
import { SENDER_NAME_MAX, useSendPrefsStore } from "../../state/useSendPrefsStore";
import { describeShareLinkError } from "../../services/shareLinkFlow";
import type { SentLink } from "../../domain/sentLinks";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { useTranslation } from "react-i18next";

type Phase = { kind: "form" } | { kind: "sealing" } | { kind: "done"; link: SentLink };

const TITLE_MAX = 200;
const MESSAGE_MAX = 1000;

function daysUntil(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
}

/**
 * The SongNook Send sheet — the desktop sender page, folded into the phone.
 * One request at a time (useSendSheetStore): a title, who it's from, a note
 * if you like, then one key. Sealing happens here (the sheet cannot be swiped
 * away mid-upload), and the finished link stays here with Copy and Share, so
 * nothing is lost to a toast that slid off. The From name is remembered.
 */
export function SendLinkHost() {
  const request = useSendSheetStore((s) => s.request);
  if (!request) return null;
  // Keyed by request so a new parcel always starts from a fresh form.
  return <SendLinkSheet key={request.title + request.kind} request={request} />;
}

function SendLinkSheet({ request }: { request: SendRequest }) {
  const { t } = useTranslation();
  const close = useSendSheetStore((s) => s.close);
  const rememberedName = useSendPrefsStore((s) => s.senderName);
  const setSenderName = useSendPrefsStore((s) => s.setSenderName);

  const [title, setTitle] = useState(request.title);
  const [from, setFrom] = useState(rememberedName);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [visible, setVisible] = useState(true);

  // The sheet owns its exit: BottomSheet animates out on `visible: false`,
  // then the request clears and the host unmounts us.
  const dismiss = () => {
    setVisible(false);
    setTimeout(close, 260);
  };

  useEffect(() => {
    if (phase.kind === "done") {
      // haptics vocabulary: `success` — a meaningful completion.
      haptic.success();
    }
  }, [phase.kind]);

  const seal = async () => {
    if (phase.kind !== "form") return;
    const parcelTitle = title.trim().slice(0, TITLE_MAX) || request.title;
    const senderName = from.trim().slice(0, SENDER_NAME_MAX) || null;
    setSenderName(from);
    setPhase({ kind: "sealing" });
    // haptics vocabulary: `tap` — an acknowledged press (the key itself is silent).
    haptic.tap();
    try {
      const link = await request.create({
        title: parcelTitle,
        senderName,
        message: message.trim().slice(0, MESSAGE_MAX) || null,
      });
      await Clipboard.setStringAsync(link.shareUrl).catch(() => {});
      setPhase({ kind: "done", link });
    } catch (err) {
      // haptics vocabulary: `error` — a failure the user must hear about.
      haptic.error();
      setPhase({ kind: "form" });
      const described = describeShareLinkError(err, { emptyMessage: request.emptyMessage });
      AppAlert.info(described.title, described.body);
    }
  };

  const copy = async (link: SentLink) => {
    // haptics vocabulary: `light` — a small confirmation (copy).
    haptic.light();
    await Clipboard.setStringAsync(link.shareUrl).catch(() => {});
    toast(t("sendSheet.copied"), "checkmark-outline");
  };

  const share = (link: SentLink) => {
    void Share.share({ message: link.shareUrl }).catch(() => {});
  };

  const sealing = phase.kind === "sealing";

  return (
    <BottomSheet
      visible={visible}
      onClose={dismiss}
      dismissDistance={420}
      dismissible={!sealing}
      keyboardAvoiding
    >
      <View style={local.content}>
        <View style={local.header}>
          <Ionicons name="paper-plane-outline" size={15} color={colors.primaryDeep} />
          <Text style={local.eyebrow}>{t("sendSheet.title")}</Text>
        </View>

        {phase.kind === "done" ? (
          <View style={local.done}>
            <UserText value={phase.link.title} style={local.doneTitle} numberOfLines={2}>
              {phase.link.title}
            </UserText>
            <Text style={local.doneMeta}>
              {t("sendSheet.ready")} · {t("sharing.daysLeft", { count: daysUntil(phase.link.expiresAt) })}
            </Text>
            <View style={local.linkBox}>
              <Text style={local.linkText} numberOfLines={1} selectable>
                {phase.link.shareUrl}
              </Text>
            </View>
            <View style={local.keys}>
              <Button
                variant="secondary"
                label={t("common.copy")}
                style={local.key}
                onPress={() => void copy(phase.link)}
                accessibilityLabel={t("sharing.copyLink")}
              />
              <Button
                label={t("sendSheet.share")}
                style={local.key}
                onPress={() => share(phase.link)}
              />
            </View>
            <Button variant="quiet" label={t("common.done")} onPress={dismiss} style={local.doneKey} />
          </View>
        ) : (
          <>
            <Text style={local.label}>{t("sendSheet.titleLabel")}</Text>
            <UserTextInput
              testID="send-title"
              style={local.input}
              value={title}
              onChangeText={setTitle}
              placeholder={request.title}
              placeholderTextColor={colors.textMuted}
              maxLength={TITLE_MAX}
              editable={!sealing}
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
              editable={!sealing}
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
              editable={!sealing}
              multiline
            />
            <Text style={local.hint}>{sealing ? t("sendSheet.sealingHint") : t("sendSheet.expiryHint")}</Text>
            <View style={local.keys}>
              <Button
                variant="secondary"
                label={t("common.cancel")}
                style={local.key}
                disabled={sealing}
                onPress={dismiss}
              />
              <Button
                testID="send-seal"
                label={sealing ? t("sendSheet.sealing") : t("sendSheet.seal")}
                style={local.key}
                disabled={sealing}
                hapticFeedback={false}
                onPress={() => void seal()}
              />
            </View>
            {sealing ? (
              <View style={local.sealingRow} pointerEvents="none">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
          </>
        )}
      </View>
    </BottomSheet>
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
  sealingRow: {
    alignItems: "center",
    paddingTop: spacing.sm,
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
});
