import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { PageIntro } from "../../common/PageIntro";
import { AppAlert } from "../../common/AppAlert";
import { styles } from "../styles";
import { useSentLinksStore } from "../../../state/useSentLinksStore";
import { isSentLinkExpired, type SentLink } from "../../../domain/sentLinks";
import { toast } from "../../common/toastStore";
import { haptic } from "../../../design/haptics";
import { colors, radii, text as textTokens } from "../../../design/tokens";
import type { ShareKind } from "../../../types";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText } from "../../../i18n";

const KIND_ICONS: Record<ShareKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  setlist: "albums-outline",
  songbook: "book-outline",
  collection: "folder-outline",
  workspace: "file-tray-stacked-outline",
  clips: "musical-notes-outline",
  library: "library-outline",
};

function statusLabel(link: SentLink, now: number, t: TFunction): string {
  if (isSentLinkExpired(link, now)) return t("sharing.expired");
  const days = Math.max(1, Math.ceil((link.expiresAt - now) / 86400000));
  return t("sharing.daysLeft", { count: days });
}

/**
 * The humble outbox: every Songnook Send link this device created, with its
 * countdown. Copy re-shares; Forget only drops the local record (links expire
 * on their own server-side — revoke arrives with accounts). The list is
 * self-cleaning: expired entries grey out, then prune after a grace window.
 */
export function SettingsSharingView() {
  const { t } = useTranslation();
  const links = useSentLinksStore((s) => s.links);
  const forgetLink = useSentLinksStore((s) => s.forgetLink);

  // Tidy on open so the list mirrors reality without ever needing maintenance.
  useEffect(() => {
    useSentLinksStore.getState().prune();
  }, []);

  const now = Date.now();
  const sorted = links.slice().sort((a, b) => b.createdAt - a.createdAt);

  const copy = async (link: SentLink) => {
    await Clipboard.setStringAsync(link.shareUrl);
    haptic.light();
    toast(t("sharing.linkCopied"), "link-outline");
  };

  const confirmForget = (link: SentLink) => {
    AppAlert.confirm(
      t("sharing.forgetTitle"),
      t("sharing.forgetBody"),
      () => forgetLink(link.transferId),
      { confirmLabel: t("sharing.forget") }
    );
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={sharingStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("sharing.title")}
        subtitle={t("sharing.subtitle")}
      />

      <View style={sharingStyles.list}>
        {sorted.map((link) => {
          const expired = isSentLinkExpired(link, now);
          return (
            <View key={link.transferId} style={[sharingStyles.row, expired ? sharingStyles.rowExpired : null]}>
              <View style={sharingStyles.icon}>
                <Ionicons
                  name={KIND_ICONS[link.kind] ?? "link-outline"}
                  size={16}
                  color={expired ? colors.textMuted : colors.primaryDeep}
                />
              </View>
              <View style={sharingStyles.main}>
                <UserText
                  style={[sharingStyles.title, expired ? sharingStyles.titleExpired : null]}
                  numberOfLines={1}
                >
                  {link.title}
                </UserText>
                <Text style={sharingStyles.meta} numberOfLines={1}>
                  {statusLabel(link, now, t)} · {t("sharing.itemCount", { count: link.itemCount })}
                </Text>
              </View>
              {!expired ? (
                <Pressable
                  onPress={() => void copy(link)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("sharing.copyA11y", { title: link.title })}
                  style={({ pressed }) => [sharingStyles.actionBtn, pressed ? { opacity: 0.6 } : null]}
                >
                  <Ionicons name="copy-outline" size={15} color={colors.textStrong} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => confirmForget(link)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("sharing.forgetA11y", { title: link.title })}
                style={({ pressed }) => [sharingStyles.actionBtn, pressed ? { opacity: 0.6 } : null]}
              >
                <Ionicons name="close" size={15} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
      </View>

      {sorted.length === 0 ? (
        <View style={sharingStyles.emptyWrap}>
          <Ionicons name="link-outline" size={24} color={colors.textMuted} />
          <Text style={sharingStyles.emptyTitle}>{t("sharing.emptyTitle")}</Text>
          <Text style={sharingStyles.emptyBody}>
            {t("sharing.emptyBody")}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const sharingStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  rowExpired: {
    opacity: 0.55,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  titleExpired: {
    color: colors.textSecondary,
  },
  meta: {
    ...textTokens.caption,
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
});
