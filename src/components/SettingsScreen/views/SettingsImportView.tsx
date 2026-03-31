import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import type { useLibraryImportFlow } from "../hooks/useLibraryImportFlow";

type LibraryImportFlow = ReturnType<typeof useLibraryImportFlow>;

export function SettingsImportView({
    flow,
    onCancel,
}: {
    flow: LibraryImportFlow;
    onCancel: () => void;
}) {
    return (
        <ScrollView style={styles.flexFill} contentContainerStyle={settingsScreenStyles.scrollContent}>
            <PageIntro
                title="Import Song Seed Archive"
                subtitle="Bring archived Song Seed workspaces into this library. Imports are merged in as new workspaces, current main selections stay in place, and same-name copies are renamed with a counted suffix."
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
                        {flow.preview ? "Choose a different archive" : "Choose archive"}
                    </Text>
                    <Text style={styles.settingsActionCardMeta}>
                        Pick a Song Seed Archive ZIP exported from backup or export.
                    </Text>
                </View>
                {flow.isPicking ? (
                    <ActivityIndicator size="small" color="#64748b" />
                ) : (
                    <Ionicons name="folder-open-outline" size={18} color="#64748b" />
                )}
            </Pressable>

            {flow.preview ? (
                <View style={styles.settingsSection}>
                    <View style={styles.settingsSectionHeaderRow}>
                        <Text style={styles.settingsSectionLabel}>Archive</Text>
                        <Text style={styles.settingsSectionMeta}>{flow.preview.archiveName}</Text>
                    </View>
                    <Text style={styles.settingsSectionHint}>
                        Exported {new Date(flow.preview.exportedAt).toLocaleString()}.
                    </Text>

                    <View style={styles.settingsOptionStack}>
                        <View style={styles.settingsActionCard}>
                            <View style={styles.settingsActionCardCopy}>
                                <Text style={styles.settingsActionCardTitle}>
                                    {flow.preview.workspaceCount} workspace{flow.preview.workspaceCount === 1 ? "" : "s"}
                                </Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    {flow.preview.collectionCount} collections, {flow.preview.songCount} songs, and {flow.preview.standaloneClipCount} standalone clips.
                                </Text>
                            </View>
                        </View>

                        {flow.preview.primaryWorkspaceTitle ? (
                            <View style={styles.settingsActionCard}>
                                <View style={styles.settingsActionCardCopy}>
                                    <Text style={styles.settingsActionCardTitle}>Archive main workspace</Text>
                                    <Text style={styles.settingsActionCardMeta}>
                                        {flow.preview.primaryWorkspaceTitle}
                                      </Text>
                                </View>
                            </View>
                        ) : null}

                        {flow.warningSummary.length > 0 ? (
                            <View style={styles.settingsActionCard}>
                                <View style={styles.settingsActionCardCopy}>
                                    <Text style={styles.settingsActionCardTitle}>Archive warnings</Text>
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
                                <Text style={styles.settingsActionCardTitle}>Import into library</Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    Imports the archive as new workspaces and keeps your current main selections if they already exist.
                                </Text>
                            </View>
                            {flow.isImporting ? (
                                <ActivityIndicator size="small" color="#64748b" />
                            ) : (
                                <Ionicons name="download-outline" size={18} color="#64748b" />
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
                                <Text style={styles.settingsActionCardTitle}>Clear selection</Text>
                                <Text style={styles.settingsActionCardMeta}>
                                    Remove this archive from the preview without importing it.
                                </Text>
                            </View>
                            <Ionicons name="close-outline" size={18} color="#64748b" />
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
                    <Text style={styles.settingsActionCardTitle}>Back to Settings</Text>
                    <Text style={styles.settingsActionCardMeta}>
                        Return without importing an archive.
                    </Text>
                </View>
                <Ionicons name="chevron-back" size={18} color="#64748b" />
            </Pressable>
        </ScrollView>
    );
}
