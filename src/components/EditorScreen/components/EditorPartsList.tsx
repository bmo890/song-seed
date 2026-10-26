import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserTextInput, playRowFrame, playRowRest } from "../../../i18n/direction";
import { fmtDuration } from "../../../utils";
import { colors } from "../../../design/tokens";
import { Press } from "../../common/Press";
import { SpanGlyph } from "../../common/SpanGlyph";
import { pd } from "../../PlayerScreen/components/practiceDrawerStyles";
import { CUT_COLOR, KEEP_COLOR, type EditableSelection } from "../helpers";
import { useTranslation } from "react-i18next";

/**
 * The parts of the clip as the player's own mark rows (2026-10-16, founder:
 * "mimic the section/looper exactly"): a leading play glyph, the span glyph in
 * the keep or remove ink, the name, and the times. Tapping a row holds it: the
 * row sits on the player's tonal wash with the shared span inspector beneath
 * (`renderInspector`), exactly as a held section does. Same styles (`pd`), so
 * the two rooms cannot drift.
 */
export function EditorPartsList({
  parts,
  intent,
  heldId,
  suggestedTitleFor,
  showNames,
  onHold,
  onRename,
  onRemove,
  onPlayFrom,
  renderInspector,
}: {
  parts: EditableSelection[];
  intent: "keep" | "remove";
  heldId: string | null;
  /** The name a kept part gets when none is typed — the placeholder. */
  suggestedTitleFor: (index: number) => string;
  /** Only kept parts become clips, so only they take a name. */
  showNames: boolean;
  onHold: (part: EditableSelection | null) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
  onPlayFrom: (ms: number) => void;
  renderInspector: (part: EditableSelection) => ReactNode;
}) {
  const { t } = useTranslation();
  const ink = intent === "keep" ? KEEP_COLOR : CUT_COLOR;
  const ordered = [...parts].sort((a, b) => a.start - b.start);

  return (
    <View>
      {ordered.map((part, index) => {
        const held = part.id === heldId;
        const name = showNames
          ? part.title?.trim() || suggestedTitleFor(index)
          : t("editor.partLabel", { n: index + 1 });
        const row = (
          <Press
            style={[pd.markRow, playRowFrame]}
            onPress={() => onHold(held ? null : part)}
            accessibilityRole="button"
            accessibilityState={{ selected: held, expanded: held }}
            accessibilityLabel={`${name}, ${fmtDuration(part.start)}–${fmtDuration(part.end)}`}
          >
            {/* Cue + start, the player's leading glyph; holding the row is a
                separate wish and never moves the playhead. */}
            <Press
              feel="glyph"
              style={pd.headIconBtn}
              onPress={() => onPlayFrom(part.start)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("player.playFrom", { name })}
            >
              <Ionicons name="play" size={15} color={colors.textSecondary} />
            </Press>
            {/* After the play key, the row follows the language. */}
            <View style={[playRowRest, { gap: 8 }]}>
            <View style={pd.markGlyph}>
              <SpanGlyph color={ink} />
            </View>
            <View style={pd.markNameWrap}>
              {held && showNames ? (
                <UserTextInput
                  style={[pd.markName, pd.markNameSelected, local.nameInput]}
                  value={part.title ?? ""}
                  onChangeText={(value) => onRename(part.id, value)}
                  placeholder={suggestedTitleFor(index)}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  accessibilityLabel={t("editor.partName")}
                />
              ) : (
                <Text
                  style={[pd.markName, held ? pd.markNameSelected : null, part.title ? null : local.nameQuiet]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              )}
            </View>
            {/* The trailing seat: the times at rest, the part's removal while held. */}
            {held ? (
              <Press
                feel="glyph"
                style={pd.headIconBtn}
                onPress={() => onRemove(part.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t("editor.deletePart")}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
              </Press>
            ) : (
              <View style={pd.markTrailing}>
                <Text style={pd.markTime}>{`${fmtDuration(part.start)}–${fmtDuration(part.end)}`}</Text>
              </View>
            )}
            </View>
          </Press>
        );
        if (!held) {
          return (
            <React.Fragment key={part.id}>
              {index > 0 ? <View style={pd.markDivider} /> : null}
              {row}
            </React.Fragment>
          );
        }
        return (
          <View key={part.id} style={pd.selectedCard}>
            {row}
            {renderInspector(part)}
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  // A suggested name is the app's, not yours: it recedes until you type one.
  nameQuiet: {
    color: colors.textSecondary,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  nameInput: {
    padding: 0,
  },
});
