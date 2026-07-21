import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import type { useLibraryImportFlow } from "../hooks/useLibraryImportFlow";
import { useTranslation } from "react-i18next";

type LibraryImportFlow = ReturnType<typeof useLibraryImportFlow>;

export function SettingsImportView({
    flow,
    onCancel,
}: {
    flow: LibraryImportFlow;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    return (
        <ScrollView style={styles.flexFill} contentContainerStyle={settingsScreenStyles.scrollContent}>
            <PageIntro
                title={t("settingsImport.title")}
                subtitle={t("settingsImport.subtitle")}
            />

            <Pressable
                style={({ pressed }) => [
                    styles.settingsActionCard,
                    pressed ? styles.pressDown : null,
                ]}
                onPress={flow.chooseArchive}
                disabled={flow.isPicking || flow.isImporting}
            >
                <View style={styles.settingsActionCardCopy}>
                    <Text style={styles.settingsActionCardTitle}>
                        {flow.preview ? t("settingsImport.chooseDifferent") : t("settingsImport.choose")}
                    </Text>
                    <Text style={styles.settingsActionCardMeta}>
                        {t("settingsImport.chooseHint")}
                    </Text>
                </View>
                {flow.isPicking ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                    <Ionicons name="folder-open-outline" size={18} color={colors.textSecondary} />
                )}
            </Pressable>

            {flow.preview ? (
                <View style={styles.settingsSection}>
                    <View style={styles.settingsSectionHeaderRow}>
                        <Text style={styles.settingsSectionLabel}>{t("settingsImport.archive")}</Text>
                        <Text style={styles.settingsSectionMeta}>{flow.preview.archiveName}</Text>
                    </View>
                    <Text style={styles.settingsSectionHint}>
                        {t("settingsImport.exported", { date: new Date(flow.preview.exportedAt).toLocaleString() })}
                    </Text>

                    <View style={styles.settingsOptionStack}>
                        <View style={styles.settingsActionCard}>
                            <View style={styles.settingsActionCardCopy}>
                                <Text style={styles.settingsActionCardTitle}>
                                    {t("settingsImport.workspaces", { count: flow.preview.workspaceCount })}
                                </Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    {t("settingsImport.contents", { collections: flow.preview.collectionCount, songs: flow.preview.songCount, clips: flow.preview.standaloneClipCount, notes: flow.preview.notepadNoteCount })}
                                </Text>
                            </View>
                        </View>

                        {flow.preview.primaryWorkspaceTitle ? (
                            <View style={styles.settingsActionCard}>
                                <View style={styles.settingsActionCardCopy}>
                                    <Text style={styles.settingsActionCardTitle}>{t("settingsImport.mainWorkspace")}</Text>
                                    <Text style={styles.settingsActionCardMeta}>
                                        {flow.preview.primaryWorkspaceTitle}
                                      </Text>
                                </View>
                            </View>
                        ) : null}

                        {flow.warningSummary.length > 0 ? (
                            <View style={styles.settingsActionCard}>
                                <View style={styles.settingsActionCardCopy}>
                                    <Text style={styles.settingsActionCardTitle}>{t("settingsImport.warnings")}</Text>
                                    <Text style={styles.settingsActionCardMeta}>
                                        {flow.warningSummary.join("\n")}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.settingsOptionStack}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.settingsActionCard,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={flow.importArchive}
                            disabled={flow.isImporting}
                        >
                            <View style={styles.settingsActionCardCopy}>
                                <Text style={styles.settingsActionCardTitle}>{t("settingsImport.importLibrary")}</Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    {t("settingsImport.importHint")}
                                </Text>
                            </View>
                            {flow.isImporting ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                            ) : (
                                <Ionicons name="download-outline" size={18} color={colors.textSecondary} />
                            )}
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.settingsActionCard,
                                pressed ? styles.pressDown : null,
                            ]}
                            onPress={flow.clearArchive}
                            disabled={flow.isImporting}
                        >
                            <View style={styles.settingsActionCardCopy}>
                                <Text style={styles.settingsActionCardTitle}>{t("settingsImport.clear")}</Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    {t("settingsImport.clearHint")}
                                </Text>
                            </View>
                            <Ionicons name="close-outline" size={18} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                </View>
            ) : null}

            <Pressable
                style={({ pressed }) => [styles.settingsActionCard, pressed ? styles.pressDown : null]}
                onPress={onCancel}
                disabled={flow.isImporting}
            >
                <View style={styles.settingsActionCardCopy}>
                    <Text style={styles.settingsActionCardTitle}>{t("settingsImport.back")}</Text>
                    <Text style={styles.settingsActionCardMeta}>
                        {t("settingsImport.backHint")}
                    </Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
            </Pressable>
        </ScrollView>
    );
}
