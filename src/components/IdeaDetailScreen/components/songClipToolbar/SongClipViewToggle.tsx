import { SegmentedControl } from "../../../common/SegmentedControl";
import { useTranslation } from "react-i18next";

type SongClipViewToggleProps = {
  clipViewMode: "timeline" | "evolution";
  setClipViewMode: (mode: "timeline" | "evolution") => void;
};

/** Single-select view switch — canon SegmentedControl (sliding thumb). */
export function SongClipViewToggle({
  clipViewMode,
  setClipViewMode,
}: SongClipViewToggleProps) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      options={[
        { key: "evolution", label: t("songDetail.viewEvolution") },
        { key: "timeline", label: t("songDetail.viewTimeline") },
      ]}
      value={clipViewMode}
      onChange={setClipViewMode}
    />
  );
}
