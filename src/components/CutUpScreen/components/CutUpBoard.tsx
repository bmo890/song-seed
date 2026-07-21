import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import { UserText, UserTextInput } from "../../../i18n";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { BottomSheet } from "../../common/BottomSheet";
import { boardItemText } from "../../../domain/cutUp";
import type { CutUpBoardItem, CutUpChunk, CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

const STRIP_BG = "#FBF6EC";

// A small deterministic tilt per strip — the hand-cut-paper feel.
function tiltFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const deg = ((Math.abs(hash) % 5) - 2) * 0.7; // -1.4°..+1.4°
  return `${deg}deg`;
}

export function CutUpBoard({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const { t } = useTranslation();
  const [menuItem, setMenuItem] = useState<CutUpBoardItem | null>(null);

  const active = useMemo(
    () => spark.boardItems.filter((item) => !item.removed).slice().sort((a, b) => a.order - b.order),
    [spark.boardItems]
  );
  const removed = useMemo(() => spark.boardItems.filter((item) => item.removed), [spark.boardItems]);

  return (
    <View style={styles.body}>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, styles.controlPrimary, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.light();
            model.shuffle();
          }}
          hitSlop={6}
        >
          <Ionicons name="shuffle" size={15} color={colors.onPrimary} />
          <Text style={styles.controlTextPrimary}>{t("cutUp.shuffle")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            model.resetOrder();
          }}
          hitSlop={6}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.controlText}>{t("cutUp.sourceOrder")}</Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={active}
        keyExtractor={(item) => item.id}
        onDragBegin={haptic.grab}
        onDragEnd={({ data }) => model.reorder(data.map((item) => item.id))}
        containerStyle={styles.listFill}
        contentContainerStyle={active.length === 0 ? styles.listEmptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        activationDistance={12}
        ListEmptyComponent={<Text style={styles.empty}>{t("cutUp.boardEmpty")}</Text>}
        renderItem={({ item, drag, isActive }: RenderItemParams<CutUpBoardItem>) => (
          <ScaleDecorator activeScale={1.04}>
            <StripRow
              item={item}
              text={boardItemText(item, spark.chunks)}
              isActive={isActive}
              onDrag={drag}
              onEdit={(text) => model.editStripText(item.id, text)}
              onMenu={() => {
                haptic.grab();
                setMenuItem(item);
              }}
            />
          </ScaleDecorator>
        )}
      />

      {removed.length > 0 ? (
        <View style={styles.removedSection}>
          <Text style={styles.removedLabel}>{t("cutUp.setAside", { count: removed.length })}</Text>
          <ScrollView style={styles.removedScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.removedWrap}>
              {removed.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.removedChip, pressed ? appStyles.pressDown : null]}
                  onPress={() => {
                    haptic.tap();
                    model.restoreStrip(item.id);
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={12} color={colors.textSecondary} />
                  <UserText style={styles.removedChipText} numberOfLines={1}>
                    {boardItemText(item, spark.chunks)}
                  </UserText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <StripMenu
        item={menuItem}
        chunks={spark.chunks}
        onClose={() => setMenuItem(null)}
        model={model}
      />
    </View>
  );
}

const StripRow = memo(function StripRow({
  item,
  text,
  isActive,
  onDrag,
  onEdit,
  onMenu,
}: {
  item: CutUpBoardItem;
  text: string;
  isActive: boolean;
  onDrag: () => void;
  onEdit: (text: string) => void;
  onMenu: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return (
    <View
      style={[
        styles.strip,
        { transform: [{ rotate: isActive ? "0deg" : tiltFor(item.id) }] },
        item.locked ? styles.stripLocked : null,
        isActive ? styles.stripActive : null,
      ]}
    >
      <Pressable onLongPress={onDrag} delayLongPress={150} hitSlop={8} style={styles.handle} accessibilityLabel="Hold to reorder">
        <Ionicons name="reorder-two-outline" size={18} color={colors.textMuted} />
      </Pressable>

      {isEditing ? (
        <UserTextInput
          ref={inputRef}
          style={styles.stripInput}
          value={text}
          onChangeText={onEdit}
          onBlur={() => setIsEditing(false)}
          onSubmitEditing={() => setIsEditing(false)}
          returnKeyType="done"
          multiline
        />
      ) : (
        <Pressable style={styles.stripTextWrap} onPress={() => setIsEditing(true)} onLongPress={onMenu} delayLongPress={280}>
          <UserText style={styles.stripText}>{text}</UserText>
        </Pressable>
      )}

      {item.locked ? <Ionicons name="lock-closed" size={13} color={colors.primaryDeep} style={styles.lockBadge} /> : null}
      <Pressable onPress={onMenu} hitSlop={8} style={styles.menuBtn} accessibilityLabel="Strip actions">
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
});

function StripMenu({
  item,
  chunks,
  onClose,
  model,
}: {
  item: CutUpBoardItem | null;
  chunks: CutUpChunk[];
  onClose: () => void;
  model: Model;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={item !== null} onClose={onClose}>
      {item ? (
        <>
          <UserText style={styles.menuPreview} numberOfLines={2}>
            {boardItemText(item, chunks)}
          </UserText>
          <View style={styles.menuList}>
            <MenuRow
              icon={item.locked ? "lock-open-outline" : "lock-closed-outline"}
              label={item.locked ? t("cutUp.unlock") : t("cutUp.lock")}
              onPress={() => {
                haptic.light();
                model.toggleStripLock(item.id);
              }}
            />
            <MenuRow
              icon="copy-outline"
              label={t("cutUp.duplicate")}
              onPress={() => {
                haptic.light();
                model.duplicateStrip(item.id);
              }}
            />
            <MenuRow
              icon="trash-outline"
              label={t("cutUp.removeStrip")}
              danger
              onPress={() => {
                model.removeStrip(item.id);
                onClose();
              }}
            />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

function MenuRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed ? appStyles.pressDown : null]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.textStrong} />
      <Text style={[styles.menuRowText, danger ? styles.menuRowDanger : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  controls: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  controlPrimary: { backgroundColor: colors.primaryDeep },
  controlText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.textSecondary },
  controlTextPrimary: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.onPrimary },

  listFill: { flex: 1 },
  listContent: { paddingBottom: spacing.sm, paddingTop: 2 },
  listEmptyContent: { paddingVertical: spacing.xl },
  empty: { ...textTokens.supporting, fontSize: 13, textAlign: "center" },

  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: STRIP_BG,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
    marginHorizontal: 2,
    ...shadows.card,
  },
  stripLocked: { backgroundColor: colors.surfaceHigh },
  stripActive: { ...shadows.drawer, backgroundColor: colors.surface },
  handle: { width: 28, height: 40, alignItems: "center", justifyContent: "center" },
  stripTextWrap: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 2 },
  stripText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 16, lineHeight: 22, color: colors.textPrimary },
  stripInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  lockBadge: { marginRight: 2 },
  menuBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },

  removedSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
  removedLabel: { ...textTokens.annotation, marginBottom: spacing.xs },
  removedScroll: { maxHeight: 88 },
  removedWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  removedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  removedChipText: { fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: colors.textSecondary, flexShrink: 1 },

  menuPreview: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  menuList: {},
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  menuRowText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14.5, color: colors.textPrimary },
  menuRowDanger: { color: colors.danger },
});
