import { useTranslation } from "react-i18next";
import { HelpSheet } from "../../common/HelpSheet";

/**
 * The Takes tab legend — versioning is taught here, where it happens, not in
 * the welcome wizard (the wizard carries the nouns; the verbs live in help
 * sheets). Only the invisible rules: what a version thread is, which take
 * speaks for the song, what the two views sort by, what Branch and Split do.
 * Claims describe real behavior — verify against the takes flow when it changes.
 */
export function TakesHelpSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <HelpSheet
      visible={visible}
      onClose={onClose}
      thesis={t("takesHelp.thesis")}
      items={[
        {
          icon: "git-branch-outline",
          label: t("takesHelp.versionsLabel"),
          description: t("takesHelp.versionsBody"),
        },
        {
          icon: "star-outline",
          label: t("takesHelp.primaryLabel"),
          description: t("takesHelp.primaryBody"),
        },
        {
          icon: "git-network-outline",
          label: t("takesHelp.viewsLabel"),
          description: t("takesHelp.viewsBody"),
        },
        {
          icon: "git-compare-outline",
          label: t("takesHelp.branchLabel"),
          description: t("takesHelp.branchBody"),
        },
      ]}
    />
  );
}
