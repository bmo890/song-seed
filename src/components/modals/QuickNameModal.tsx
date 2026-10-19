import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UserText, UserTextInput } from "../../i18n/direction";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { WarmModal } from "../common/WarmModal";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { Button } from "../common/Button";
import { InkOption } from "../common/InkOption";
import { Press } from "../common/Press";
import { fmtDuration, genIdea } from "../../utils";
import { colors, radii, text } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { PIN_ICON } from "../../design/markIcons";

type Props = {
    visible: boolean;
    title?: string;
    draftValue: string;
    placeholderValue?: string;
    onChangeDraft: (val: string) => void;
    /** Optional autocomplete corpus shown as tappable chips under the name field. */
    suggestions?: string[];
    /** Tapping a suggestion calls this (e.g. to finish immediately); falls back to filling the field. */
    onSelectSuggestion?: (value: string) => void;
    descriptionValue?: string;
    onChangeDescription?: (val: string) => void;
    isPrimary?: boolean;
    onChangeIsPrimary?: (val: boolean) => void;
    /** Label for the make-primary checkbox — pass the take variant inside a sketch. */
    primaryLabel?: string;
    onCancel: () => void;
    onSave: () => void;
    helperText?: string;
    saveLabel?: string;
    disableSaveWhenEmpty?: boolean;
    saveDisabled?: boolean;
    cancelDisabled?: boolean;
    /** Save is in flight: shows a spinner and locks both buttons against a double-tap. */
    saving?: boolean;
    destinationWorkspaceTitle?: string;
    destinationCollectionLabel?: string;
    /** Destination workspace identity — the row wears its avatar so you can tell
     *  workspaces apart at a glance, not just by reading. */
    destinationWorkspaceColor?: string;
    destinationWorkspaceAvatarKey?: number;
    onPressDestination?: () => void;
    /** Pins dropped during the take: named here, or left as plain pins. */
    pins?: { id: string; atMs: number; label: string }[];
    onChangePinLabel?: (pinId: string, label: string) => void;
    /** Sheets this dialog opens (the save-to picker) render INSIDE it: iOS will
     *  not present a second Modal over this one, and the refused sheet left the
     *  recorder deaf to touches until a restart (audit 2026-10-18). */
    children?: ReactNode;
};

export function QuickNameModal({
    visible,
    title,
    draftValue,
    placeholderValue,
    onChangeDraft,
    suggestions,
    onSelectSuggestion,
    descriptionValue,
    onChangeDescription,
    isPrimary,
    onChangeIsPrimary,
    primaryLabel,
    onCancel,
    onSave,
    helperText,
    saveLabel,
    disableSaveWhenEmpty = false,
    saveDisabled = false,
    cancelDisabled = false,
    saving = false,
    destinationWorkspaceTitle,
    destinationCollectionLabel,
    destinationWorkspaceColor,
    destinationWorkspaceAvatarKey,
    onPressDestination,
    pins,
    onChangePinLabel,
    children,
}: Props) {
    const { t } = useTranslation();
    const resolvedTitle = title ?? t("modals.saveClipAs");
    const resolvedHelperText = helperText ?? t("modals.suggestedTitle");
    const resolvedSaveLabel = saveLabel ?? t("common.save");
    const isSaveDisabled =
        saving || saveDisabled || (disableSaveWhenEmpty && draftValue.trim().length === 0);
    const isCancelDisabled = saving || cancelDisabled;

    // Autocomplete: match the corpus against what's typed (prefix matches first),
    // hiding an exact match since there's nothing left to complete.
    const query = draftValue.trim().toLowerCase();
    const suggestionMatches = (suggestions ?? [])
        .filter((s) => {
            const sl = s.trim().toLowerCase();
            if (!sl) return false;
            return query ? sl.includes(query) && sl !== query : true;
        })
        .sort((a, b) => {
            if (!query) return 0;
            const rank = (x: string) => (x.toLowerCase().startsWith(query) ? 0 : 1);
            return rank(a) - rank(b);
        })
        .slice(0, 8);

    return (
        <WarmModal visible={visible} onRequestClose={onCancel} title={resolvedTitle}>
            {/* ── Name: the tonal field, its helpers bare ink glyphs ── */}
            <View style={qStyles.nameField}>
                <UserTextInput
                    testID="quickname-input"
                    style={[qStyles.input, qStyles.nameInput]}
                    value={draftValue}
                    onChangeText={onChangeDraft}
                    placeholder={placeholderValue}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={isSaveDisabled ? undefined : onSave}
                    blurOnSubmit
                />
                <View style={qStyles.nameGlyphs}>
                    <Press
                        feel="glyph"
                        // haptics.ts: tap → a control acted (a name suggested).
                        haptic="tap"
                        style={qStyles.glyph}
                        onPress={() => onChangeDraft(genIdea())}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("modals.randomName")}
                    >
                        <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
                    </Press>
                    {draftValue.length > 0 ? (
                        <Press
                            feel="glyph"
                            // haptics.ts: light → a small state flip (the field cleared).
                            haptic="light"
                            style={qStyles.glyph}
                            onPress={() => onChangeDraft("")}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={t("modals.clearName")}
                        >
                            <Ionicons name="close" size={16} color={colors.textSecondary} />
                        </Press>
                    ) : null}
                </View>
            </View>

            {/* ── Autocomplete: names in ink, tap to use ── */}
            {suggestions && suggestionMatches.length > 0 ? (
                <View style={qStyles.suggestRow}>
                    {suggestionMatches.map((s) => (
                        <Press
                            key={s}
                            feel="glyph"
                            style={qStyles.suggestWord}
                            onPress={() => (onSelectSuggestion ? onSelectSuggestion(s) : onChangeDraft(s))}
                            accessibilityRole="button"
                            accessibilityLabel={s}
                        >
                            <UserText style={qStyles.suggestWordText}>{s}</UserText>
                        </Press>
                    ))}
                </View>
            ) : null}

            {/* ── Optional description input ── */}
            {onChangeDescription !== undefined ? (
                <UserTextInput
                    style={[qStyles.input, qStyles.descriptionInput]}
                    value={descriptionValue ?? ""}
                    onChangeText={onChangeDescription}
                    placeholder={t("modals.descriptionOptional")}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    returnKeyType="default"
                />
            ) : null}

            <Text style={qStyles.helperText}>{resolvedHelperText}</Text>

            {/* ── Pins dropped during the take: a time and a name, nothing else ── */}
            {pins && pins.length > 0 && onChangePinLabel ? (
                <>
                    <Text style={qStyles.sectionLabel}>{t("modals.pinsDropped", { count: pins.length })}</Text>
                    <View style={qStyles.pinList}>
                        {pins.map((pin) => (
                            <View key={pin.id} style={qStyles.pinRow}>
                                <Ionicons name={PIN_ICON} size={14} color={colors.textStrong} />
                                <Text style={qStyles.pinTime}>{fmtDuration(pin.atMs)}</Text>
                                <UserTextInput
                                    style={[qStyles.input, qStyles.pinInput]}
                                    value={pin.label}
                                    onChangeText={(value) => onChangePinLabel(pin.id, value)}
                                    placeholder={t("modals.pinNamePlaceholder")}
                                    placeholderTextColor={colors.textMuted}
                                    returnKeyType="done"
                                />
                            </View>
                        ))}
                    </View>
                </>
            ) : null}

            {onPressDestination ? (
                <>
                    <Text style={qStyles.sectionLabel}>{t("modals.saveTo")}</Text>
                    <Press
                        // Opens a sheet of places: navigation is silent.
                        haptic="navigate"
                        style={qStyles.destinationRow}
                        onPress={onPressDestination}
                        accessibilityRole="button"
                        accessibilityLabel={[t("modals.saveTo"), destinationWorkspaceTitle, destinationCollectionLabel]
                            .filter(Boolean)
                            .join(", ")}
                    >
                        {destinationWorkspaceTitle ? (
                            <WorkspaceAvatar
                                color={destinationWorkspaceColor}
                                name={destinationWorkspaceTitle}
                                avatarKey={destinationWorkspaceAvatarKey}
                                size={22}
                            />
                        ) : (
                            <Ionicons name="folder-outline" size={18} color={colors.textStrong} />
                        )}
                        <View style={qStyles.destinationCopy}>
                            {destinationWorkspaceTitle ? (
                                <UserText style={qStyles.destinationWorkspace} numberOfLines={1}>
                                    {destinationWorkspaceTitle}
                                </UserText>
                            ) : null}
                            <Text style={qStyles.destinationCollection} numberOfLines={1}>
                                {destinationCollectionLabel ?? t("modals.chooseCollection")}
                            </Text>
                        </View>
                        <Ionicons name={dirIcon("chevron-forward")} size={18} color={colors.textMuted} />
                    </Press>
                </>
            ) : null}

            {onChangeIsPrimary !== undefined ? (
                <InkOption
                    label={primaryLabel ?? t("modals.makePrimary")}
                    selected={!!isPrimary}
                    onPress={() => onChangeIsPrimary(!isPrimary)}
                    style={qStyles.primaryOption}
                />
            ) : null}

            <View style={qStyles.btnRow}>
                <Button
                    testID="quickname-cancel"
                    variant="quiet"
                    label={t("common.cancel")}
                    disabled={isCancelDisabled}
                    onPress={onCancel}
                />
                <Button
                    testID="quickname-save"
                    label={saving ? t("modals.saving") : resolvedSaveLabel}
                    accessibilityLabel={resolvedSaveLabel}
                    disabled={isSaveDisabled}
                    onPress={onSave}
                />
            </View>
            {children}
        </WarmModal>
    );
}

const qStyles = StyleSheet.create({
    // One field language: the tonal fill, no border (as the search field wears it).
    input: {
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.lg,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    nameField: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.lg,
    },
    nameInput: {
        flex: 1,
        backgroundColor: "transparent",
    },
    nameGlyphs: {
        flexDirection: "row",
        alignItems: "center",
        paddingEnd: 6,
    },
    glyph: {
        width: 34,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    descriptionInput: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        minHeight: 60,
        textAlignVertical: "top",
    },
    suggestRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 16,
        marginTop: 6,
    },
    suggestWord: {
        minHeight: 34,
        justifyContent: "center",
    },
    suggestWordText: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 14,
        color: colors.textStrong,
    },
    helperText: {
        ...text.caption,
        color: colors.textSecondary,
        marginTop: 8,
    },
    sectionLabel: {
        ...text.annotation,
        color: colors.textSecondary,
        marginTop: 14,
        marginBottom: 6,
    },
    pinList: {
        gap: 6,
    },
    pinRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    pinTime: {
        fontFamily: "PlusJakartaSans_600SemiBold",
        fontSize: 12,
        color: colors.textSecondary,
        fontVariant: ["tabular-nums"],
        minWidth: 40,
    },
    pinInput: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 7,
        fontSize: 14,
        lineHeight: 20,
    },
    destinationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.lg,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    destinationCopy: {
        flex: 1,
        gap: 1,
    },
    destinationWorkspace: {
        fontFamily: "PlusJakartaSans_400Regular",
        fontSize: 11,
        color: colors.textMuted,
    },
    destinationCollection: {
        fontFamily: "PlusJakartaSans_500Medium",
        fontSize: 14,
        color: colors.textPrimary,
    },
    primaryOption: {
        marginTop: 12,
    },
    btnRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 20,
    },
});
