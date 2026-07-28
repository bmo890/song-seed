import React from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

type Props = {
    isRecording: boolean;
    isPaused: boolean;
    isArming?: boolean;
    recordToggleDisabled?: boolean;
    compact?: boolean;
    canSave?: boolean;
    canDiscard?: boolean;
    /** Redo scraps the take but keeps the session armed — enabled during count-in too. */
    canRedo?: boolean;
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
    onDiscard: () => void;
    onRedo?: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    isArming = false,
    recordToggleDisabled = false,
    compact = false,
    canSave = true,
    canDiscard = true,
    canRedo = false,
    onPause,
    onResume,
    onStart,
    onRequestSave,
    onDiscard,
    onRedo,
}: Props) {
    const { t } = useTranslation();
    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <View style={[local.sideColumn, local.sideColumnLead]}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canDiscard || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={() => {
                        haptic.tap();
                        onDiscard();
                    }}
                    disabled={!canDiscard || isArming}
                    accessibilityRole="button"
                    accessibilityLabel={t("recording.discardA11y")}
                >
                    <Ionicons
                        name="trash-outline"
                        size={compact ? 18 : 21}
                        color={!canDiscard || isArming ? colors.textMuted : colors.danger}
                    />
                    {compact ? null : (
                        <Text
                            style={[styles.controlBtnLabel, styles.controlBtnLabelDanger]}
                            numberOfLines={1}
                        >
                            {t("recording.discardShort")}
                        </Text>
                    )}
                </Pressable>
                {onRedo ? (
                    <Pressable
                        style={[
                            styles.circleControlBtn,
                            compact ? styles.circleControlBtnCompact : null,
                            !canRedo ? styles.circleControlBtnDisabled : null,
                        ]}
                        onPress={() => {
                            haptic.tap();
                            onRedo();
                        }}
                        disabled={!canRedo}
                        accessibilityRole="button"
                        accessibilityLabel={t("recording.redoA11y")}
                    >
                        <Ionicons
                            name="refresh-outline"
                            size={compact ? 18 : 21}
                            color={!canRedo ? colors.textMuted : colors.textSecondary}
                        />
                        {compact ? null : (
                            <Text style={styles.controlBtnLabel} numberOfLines={1}>
                                {t("recording.redoShort")}
                            </Text>
                        )}
                    </Pressable>
                ) : null}
            </View>

            <View style={styles.recordBtnWrap}>
                <Pressable
                    style={({ pressed }) => [
                        styles.circleRecordBtn,
                        compact ? styles.circleRecordBtnCompact : null,
                        isArming || !isPaused ? styles.circleRecordBtnActive : null,
                        recordToggleDisabled ? styles.circleRecordBtnDisabled : null,
                        pressed ? styles.pressDownStrong : null,
                    ]}
                    onPress={async () => {
                        if (isArming || recordToggleDisabled) {
                            return;
                        }
                        // The most tactile moment in the app — every record-state
                        // change gets a firm pulse.
                        haptic.grab();
                        if (!isRecording) {
                            await onStart();
                            return;
                        }
                        if (isPaused) {
                            await onResume();
                            return;
                        }
                        await onPause();
                    }}
                    disabled={isArming || recordToggleDisabled}
                >
                    <Ionicons
                        name={isArming ? "timer-outline" : !isRecording || isPaused ? "mic" : "pause"}
                        size={compact ? 24 : 34}
                        color={recordToggleDisabled ? colors.surfaceHigh : colors.onPrimary}
                    />
                </Pressable>
            </View>

            <View style={[local.sideColumn, local.sideColumnTrail]}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canSave || isArming ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={() => {
                        haptic.tap();
                        onRequestSave();
                    }}
                    disabled={!canSave || isArming}
                    accessibilityRole="button"
                    accessibilityLabel={t("mediaDock.saveRecording")}
                >
                    <Ionicons
                        name="save-outline"
                        size={compact ? 18 : 21}
                        color={!canSave || isArming ? colors.textMuted : colors.primaryDeep}
                    />
                    {compact ? null : (
                        <Text
                            style={[styles.controlBtnLabel, canSave && !isArming ? local.saveLabel : null]}
                            numberOfLines={1}
                        >
                            {t("recording.saveShort")}
                        </Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const local = StyleSheet.create({
    // Save takes the terracotta ink once there's something to save — it's the one
    // thing you came here to do.
    saveLabel: {
        color: colors.primaryDeep,
    },
    // Both side columns flex equally so the record button sits dead centre
    // whatever the left one is carrying (discard alone, or discard + redo).
    // Centring INSIDE each half looked lopsided — two controls packed on one
    // side and one floating mid-air on the other. Pushing each cluster to its
    // outer edge gives the row matching margins, which is what reads as
    // balanced. Logical alignment, so it mirrors correctly in RTL.
    sideColumn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sideColumnLead: {
        justifyContent: "flex-start",
    },
    sideColumnTrail: {
        justifyContent: "flex-end",
    },
});
