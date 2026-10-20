import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { UserText } from "../../../i18n";
import { settingsScreenStyles, styles } from "../styles";
import type { useLibraryImportFlow } from "../hooks/useLibraryImportFlow";
import { useTranslation } from "react-i18next";

type LibraryImportFlow = ReturnType<typeof useLibraryImportFlow>;

/**
 * Import an archive (2026-10-20): one primary key at a time. Choose a file;
 * once one is read, what it holds is said on paper and Import becomes the
 * key, with Choose another and Clear as quiet words. The header's back
 * chevron leaves (the old "Back to Settings" card said it twice).
 */
export function SettingsImportView({
    flow,
}: {
    flow: LibraryImportFlow;
    onCancel?: () => void;
}) {
    const { t } = useTranslation();
    const preview = flow.preview;
    return (
        <ScrollView style={styles.flexFill} contentContainerStyle={settingsScreenStyles.scrollContent}>
            <PageIntro title={t("settingsImport.title")} />

            <Text style={styles.settingsSectionHint}>{t("settingsImport.chooseHint")}</Text>

            {!preview ? (
                <View style={styles.settingsActionRow}>
                    <Button
                        label={t("settingsImport.chooseShort")}
                        onPress={flow.chooseArchive}
                        disabled={flow.isPicking || flow.isImporting}
                        style={styles.settingsPrimaryAction}
                    />
                </View>
            ) : (
                <View style={styles.settingsSection}>
                    <View style={styles.settingsSectionHeaderRow}>
                        <Text style={styles.settingsSectionLabel}>{t("settingsImport.archive")}</Text>
                    </View>
                    <View style={styles.settingsFactRow}>
                        <UserText style={styles.settingsChoiceTitle} numberOfLines={1}>
                            {preview.archiveName}
                        </UserText>
                        <Text style={styles.settingsChoiceMeta}>
                            {t("settingsImport.exported", { date: new Date(preview.exportedAt).toLocaleString() })}
                        </Text>
                    </View>
                    <View style={styles.settingsFactRow}>
                        <Text style={styles.settingsChoiceTitle}>
                            {t("settingsImport.workspaces", { count: preview.workspaceCount })}
                        </Text>
                        <Text style={styles.settingsChoiceMeta}>
                            {t("settingsImport.contents", {
                                collections: preview.collectionCount,
                                songs: preview.songCount,
                                clips: preview.standaloneClipCount,
                                notes: preview.notepadNoteCount,
                            })}
                        </Text>
                    </View>
                    {preview.primaryWorkspaceTitle ? (
                        <View style={styles.settingsFactRow}>
                            <Text style={styles.settingsChoiceMeta}>{t("settingsImport.mainWorkspace")}</Text>
                            <UserText style={styles.settingsChoiceTitle}>{preview.primaryWorkspaceTitle}</UserText>
                        </View>
                    ) : null}
                    {flow.warningSummary.length > 0 ? (
                        <View style={styles.settingsFactRow}>
                            <Text style={styles.settingsChoiceTitle}>{t("settingsImport.warnings")}</Text>
                            <Text style={styles.settingsChoiceMeta}>{flow.warningSummary.join("\n")}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.settingsSectionHint}>{t("settingsImport.importHint")}</Text>
                    <View style={styles.settingsActionRow}>
                        <Button
                            label={flow.isImporting ? t("settingsImport.importing") : t("settingsImport.importShort")}
                            onPress={flow.importArchive}
                            disabled={flow.isImporting}
                            style={styles.settingsPrimaryAction}
                        />
                        <Button
                            label={t("settingsImport.chooseAnother")}
                            variant="quiet"
                            onPress={flow.chooseArchive}
                            disabled={flow.isPicking || flow.isImporting}
                        />
                        <Button
                            label={t("settingsImport.clearShort")}
                            variant="quiet"
                            onPress={flow.clearArchive}
                            disabled={flow.isImporting}
                        />
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
