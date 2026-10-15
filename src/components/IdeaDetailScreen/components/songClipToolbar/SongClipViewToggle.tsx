import { useTranslation } from "react-i18next";
import { InkKey, inkKeyColor } from "../../../common/InkKey";
import { EvolutionGlyph } from "../../../common/EvolutionGlyph";

type SongClipViewToggleProps = {
  clipViewMode: "timeline" | "evolution";
  setClipViewMode: (mode: "timeline" | "evolution") => void;
};

/** One switch, not two tabs (2026-10-15): Evolution on stacks each take's
 *  versions under it; off, every take lies flat by date. An `InkKey` toggle,
 *  terracotta while on, muted while off. haptics.ts: light, a state flip. */
export function SongClipViewToggle({
  clipViewMode,
  setClipViewMode,
}: SongClipViewToggleProps) {
  const { t } = useTranslation();
  const on = clipViewMode === "evolution";
  const tone = on ? "active" : "off";
  return (
    <InkKey
      glyph={<EvolutionGlyph color={inkKeyColor(tone)} />}
      label={t("songDetail.viewEvolution")}
      tone={tone}
      role="switch"
      haptic="light"
      onPress={() => setClipViewMode(on ? "timeline" : "evolution")}
    />
  );
}
