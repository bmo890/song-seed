import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  onClose: () => void;
  onNewWordLadder: () => void;
  onNewCutUp: () => void;
  onNewMagpie: () => void;
};

/**
 * "New spark" (2026-10-17): the canon menu, rows on paper, a bare glyph and
 * one short line each (was grey boxes with icon discs and two-line pitches).
 * Each row opens the spark, so each carries the chevron.
 */
export function LyricsSparkSheet({ visible, onClose, onNewWordLadder, onNewCutUp, onNewMagpie }: Props) {
  const { t } = useTranslation();
  return (
    <SelectionActionSheet
      visible={visible}
      onClose={onClose}
      title={t("notepad.startSpark")}
      actions={[
        {
          key: "ladder",
          label: t("brand.wordLadder"),
          icon: "shuffle-outline",
          hint: t("wordSparks.wordLadderDesc"),
          opens: true,
          onPress: onNewWordLadder,
        },
        {
          key: "cutup",
          label: t("brand.cutUp"),
          icon: "cut-outline",
          hint: t("wordSparks.cutUpDesc"),
          opens: true,
          onPress: onNewCutUp,
        },
        {
          key: "magpie",
          label: t("brand.magpie"),
          icon: "book-outline",
          hint: t("wordSparks.magpieDesc"),
          opens: true,
          onPress: onNewMagpie,
        },
      ]}
    />
  );
}
