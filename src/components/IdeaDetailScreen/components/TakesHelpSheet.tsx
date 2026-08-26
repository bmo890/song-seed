import { useTranslation } from "react-i18next";
import { HelpSheet } from "../../common/HelpSheet";

/**
 * The Takes tab legend — versioning is taught here, where it happens, not in
 * the welcome wizard (the wizard carries the nouns; the verbs live in help
 * sheets). Claims describe real behavior — verify against the takes flow when
 * it changes.
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
      title={t("takesHelp.title")}
      intro={t("takesHelp.intro")}
      items={[
        {
          icon: "mic-outline",
          label: t("takesHelp.takesLabel"),
          description: t("takesHelp.takesBody"),
        },
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
