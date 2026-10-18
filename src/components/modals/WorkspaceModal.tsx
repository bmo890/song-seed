import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../i18n/direction";
import { genIdea } from "../../utils";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { WarmModal } from "../common/WarmModal";
import { HueSlider } from "../common/HueSlider";
import { Button } from "../common/Button";
import { Press } from "../common/Press";
import { hueToAccentHex, hexToHue } from "../../domain/workspaceTheme";
import { colors, radii, spacing } from "../../design/tokens";

type Props = {
  visible: boolean;
  title: string;
  initialName?: string;
  initialDescription?: string;
  initialColor?: string;
  initialAvatarKey?: number;
  onCancel: () => void;
  onSave: (name: string, description: string, color: string, avatarKey: number) => void;
};

function randomHue() {
  return Math.floor(Math.random() * 360);
}

/**
 * Name a workspace and give it a colour (design-system pass 2026-10-18): the
 * avatar previews the colour the slider sets, fields wear the tonal fill, the
 * name field's helpers are bare ink glyphs, Save is the canon primary key.
 * Archive and delete live in each workspace's "…" menu, not here.
 */
export function WorkspaceModal({
  visible,
  title,
  initialName,
  initialDescription,
  initialColor,
  initialAvatarKey,
  onCancel,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [hue, setHue] = useState(() => (initialColor ? hexToHue(initialColor) : randomHue()));
  const [avatarKey, setAvatarKey] = useState(initialAvatarKey ?? Date.now());

  // Sync when the sheet re-opens with fresh initial values.
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setName(initialName ?? "");
      setDescription(initialDescription ?? "");
      setHue(initialColor ? hexToHue(initialColor) : randomHue());
      setAvatarKey(initialAvatarKey ?? Date.now());
    }
    prevVisible.current = visible;
  }, [visible, initialName, initialDescription, initialColor, initialAvatarKey]);

  const accentColor = hueToAccentHex(hue);

  return (
    <WarmModal visible={visible} onRequestClose={onCancel} title={title} scrollable>
      <View style={s.avatarRow}>
        <View>
          <WorkspaceAvatar color={accentColor} name={name || "?"} size={64} avatarKey={avatarKey} />
          <Press
            feel="glyph"
            // haptics.ts: tap → a control acted (a new avatar pattern).
            haptic="tap"
            style={s.refreshBadge}
            onPress={() => setAvatarKey(Date.now())}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("modals.newAvatar")}
          >
            <Ionicons name="refresh-outline" size={13} color={colors.textStrong} />
          </Press>
        </View>
      </View>

      <HueSlider hue={hue} onChange={setHue} />

      <View style={s.nameField}>
        <UserTextInput
          testID="workspace-name-input"
          style={[s.input, s.nameInput]}
          value={name}
          onChangeText={setName}
          placeholder={t("modals.workspaceName")}
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
        />
        <View style={s.nameGlyphs}>
          <Press
            feel="glyph"
            // haptics.ts: tap → a control acted (a name suggested).
            haptic="tap"
            style={s.glyph}
            onPress={() => setName(genIdea())}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("modals.randomName")}
          >
            <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
          </Press>
          {name.length > 0 ? (
            <Press
              feel="glyph"
              // haptics.ts: light → a small state flip (the field cleared).
              haptic="light"
              style={s.glyph}
              onPress={() => setName("")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("modals.clearName")}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Press>
          ) : null}
        </View>
      </View>

      <UserTextInput
        style={[s.input, s.descriptionInput]}
        value={description}
        onChangeText={setDescription}
        placeholder={t("modals.descriptionOptional")}
        placeholderTextColor={colors.textMuted}
        multiline
        returnKeyType="default"
      />

      <View style={s.actions}>
        <Button variant="quiet" label={t("common.cancel")} onPress={onCancel} />
        <Button
          label={t("common.save")}
          onPress={() => onSave(name.trim(), description.trim(), accentColor, avatarKey)}
        />
      </View>
    </WarmModal>
  );
}

const s = StyleSheet.create({
  avatarRow: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  // A small paper disc on the avatar's corner: the one control that sits on art.
  refreshBadge: {
    position: "absolute",
    bottom: -2,
    end: -2,
    width: 26,
    height: 26,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  nameField: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
  },
  // One field language: the tonal fill, no border (as the search field wears it).
  input: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  nameInput: {
    flex: 1,
    backgroundColor: "transparent",
  },
  nameGlyphs: {
    flexDirection: "row",
    alignItems: "center",
    paddingEnd: 6,
  },
  glyph: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  descriptionInput: {
    marginTop: spacing.sm,
    minHeight: 70,
    textAlignVertical: "top",
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
