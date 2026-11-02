import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ScreenHeader } from "../common/ScreenHeader";
import { EmptyState } from "../common/EmptyState";
import { ListRow, ListRows } from "../common/ListRow";
import { SelectionTopBar } from "../common/SelectionTopBar";
import { SelectionDock } from "../common/SelectionDock";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { toast } from "../common/toastStore";
import { sayRestored } from "../common/deleteFeedback";
import { useStore } from "../../state/useStore";
import {
    deleteRecentlyDeletedPermanently,
    emptyRecentlyDeleted,
    measureRecentlyDeleted,
    restoreRecentlyDeleted,
} from "../../state/recentlyDeletedActions";
import { haptic } from "../../design/haptics";
import { LibraryBusyError, runningLibraryOperation, tellIfLibraryBusy } from "../../services/libraryOperationGate";
import { durations } from "../../design/motion";
import { colors, spacing, text as textTokens } from "../../design/tokens";
import { formatBytes } from "../../utils";
import { describeDeletedItem } from "./describeDeletedItem";

/**
 * Recently deleted (decision A, 2026-11-02): a PLACE that lists what was
 * deleted in the last 30 days, newest first. A row's menu restores it or
 * deletes it for good; a long-press selects several; Empty is the page's one
 * action and says the space it frees (people delete to make room).
 */
export function RecentlyDeletedScreen() {
    const { t } = useTranslation();
    const items = useStore((s) => s.recentlyDeleted);
    const sorted = useMemo(() => items.slice().sort((a, b) => b.deletedAt - a.deletedAt), [items]);
    const [sizes, setSizes] = useState<{ byId: Map<string, number>; totalBytes: number }>({
        byId: new Map(),
        totalBytes: 0,
    });
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const selecting = selectedIds.length > 0;

    const remeasure = useCallback(() => {
        void measureRecentlyDeleted().then(setSizes).catch(() => {});
    }, []);
    useFocusEffect(remeasure);
    useEffect(remeasure, [items, remeasure]);
    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
    }, [items]);

    const restore = async (ids: string[]) => {
        try {
            sayRestored(await restoreRecentlyDeleted(ids));
        } catch (error) {
            console.warn("[RecentlyDeleted] Restore failed", error);
            AppAlert.error(t("recentlyDeleted.restoreFailed"));
        }
        setSelectedIds([]);
    };

    const run = async (work: () => Promise<void>, doneToast: string) => {
        // Nothing goes for good while an operation holds the library (a Replace-restore
        // swaps this list; an archive leans on the trash): it waits, said calmly.
        const running = runningLibraryOperation();
        if (running) {
            tellIfLibraryBusy(new LibraryBusyError(running));
            return;
        }
        setBusy(true);
        try {
            await work();
            // haptics vocabulary: `success` — a completion the person waited for, with its toast.
            haptic.success();
            toast(doneToast, "checkmark-outline");
        } catch (error) {
            console.warn("[RecentlyDeleted] Delete failed", error);
            AppAlert.error(t("recentlyDeleted.deleteFailed"), t("recentlyDeleted.deleteFailedBody"));
        } finally {
            setBusy(false);
            setSelectedIds([]);
            remeasure();
        }
    };

    // The dialog fires `warning` as it opens (AppDialog: a destructive confirm).
    const confirmDeletePermanently = (ids: string[]) => {
        AppAlert.destructive(
            ids.length === 1 ? t("recentlyDeleted.confirmTitle") : t("recentlyDeleted.confirmManyTitle", { count: ids.length }),
            t("recentlyDeleted.confirmBody"),
            () => void run(() => deleteRecentlyDeletedPermanently(ids), t("recentlyDeleted.deletedForGood")),
            { confirmLabel: t("recentlyDeleted.deletePermanently") }
        );
    };

    const confirmEmpty = () => {
        AppAlert.destructive(
            t("recentlyDeleted.emptyConfirmTitle"),
            t("recentlyDeleted.emptyConfirmBody", { count: items.length, size: formatBytes(sizes.totalBytes) }),
            () => void run(emptyRecentlyDeleted, t("recentlyDeleted.emptied")),
            { confirmLabel: t("recentlyDeleted.empty") }
        );
    };

    const openMenu = (id: string, title: string) => {
        AppAlert.menu(title, [
            { key: "restore", label: t("recentlyDeleted.restore"), icon: "arrow-undo-outline", onPress: () => void restore([id]) },
            {
                key: "delete",
                label: t("recentlyDeleted.deletePermanently"),
                icon: "trash-outline",
                tone: "danger",
                onPress: () => confirmDeletePermanently([id]),
            },
        ]);
    };

    const toggle = (id: string) =>
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((candidate) => candidate !== id) : [...prev, id]));

    return (
        <SafeAreaView style={pageStyles.screen}>
            <View style={pageStyles.header}>
                <ScreenHeader title={t("recentlyDeleted.title")} variant="place" leftIcon="back" />
            </View>

            {selecting ? (
                <View style={pageStyles.topBar}>
                    <SelectionTopBar
                        inline
                        count={selectedIds.length}
                        allSelected={selectedIds.length === items.length}
                        onSelectAll={() => setSelectedIds(items.map((item) => item.id))}
                        onCancel={() => setSelectedIds([])}
                    />
                </View>
            ) : null}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[pageStyles.scrollContent, selecting ? pageStyles.scrollContentSelecting : null]}
            >
                {sorted.length > 0 && !selecting ? (
                    <Animated.View entering={FadeIn.duration(durations.fast)} style={pageStyles.summaryRow}>
                        <Text style={pageStyles.summary}>
                            {sizes.totalBytes > 0
                                ? t("recentlyDeleted.summary", {
                                      items: t("recentlyDeleted.count", { count: items.length }),
                                      size: formatBytes(sizes.totalBytes),
                                  })
                                : t("recentlyDeleted.count", { count: items.length })}
                        </Text>
                        <Button
                            label={t("recentlyDeleted.empty")}
                            variant="destructive-soft"
                            disabled={busy}
                            onPress={confirmEmpty}
                            accessibilityLabel={t("recentlyDeleted.emptyA11y", { size: formatBytes(sizes.totalBytes) })}
                            testID="recently-deleted-empty"
                        />
                    </Animated.View>
                ) : null}

                {sorted.length > 0 ? (
                    <ListRows>
                        {sorted.map((item) => {
                            const row = describeDeletedItem(item, t, { bytes: sizes.byId.get(item.id) });
                            const selected = selectedIds.includes(item.id);
                            return (
                                <ListRow
                                    key={item.id}
                                    icon={row.icon}
                                    title={row.title}
                                    serifTitle={row.serifTitle}
                                    meta={row.meta}
                                    // haptics vocabulary: `tap` — the row opens its menu or toggles.
                                    haptic="tap"
                                    chevron={false}
                                    selected={selecting ? selected : undefined}
                                    accessibilityLabel={
                                        selecting ? row.title : t("recentlyDeleted.openMenu", { title: row.title })
                                    }
                                    onPress={() => (selecting ? toggle(item.id) : openMenu(item.id, row.title))}
                                    onLongPress={() => {
                                        // haptics vocabulary: `grab` — entering selection mode.
                                        haptic.grab();
                                        toggle(item.id);
                                    }}
                                    testID={`recently-deleted-${item.id}`}
                                />
                            );
                        })}
                    </ListRows>
                ) : (
                    <EmptyState
                        icon="trash-outline"
                        title={t("recentlyDeleted.emptyTitle")}
                        body={t("recentlyDeleted.emptyBody")}
                        testID="recently-deleted-empty-state"
                    />
                )}
            </ScrollView>

            {selecting ? (
                <SelectionDock
                    actions={[
                        {
                            key: "restore",
                            label: t("recentlyDeleted.restore"),
                            icon: "arrow-undo-outline",
                            onPress: () => void restore(selectedIds),
                        },
                        {
                            key: "delete",
                            label: t("recentlyDeleted.deletePermanently"),
                            icon: "trash-outline",
                            tone: "danger",
                            disabled: busy,
                            onPress: () => confirmDeletePermanently(selectedIds),
                        },
                    ]}
                />
            ) : null}
        </SafeAreaView>
    );
}

const pageStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.page,
    },
    header: {
        paddingHorizontal: spacing.lg,
    },
    topBar: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    scrollContentSelecting: {
        paddingBottom: 160,
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    summary: {
        ...textTokens.supporting,
        color: colors.textSecondary,
        fontVariant: ["tabular-nums"],
        flexShrink: 1,
    },
});
