import React, { useState } from "react";
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
    onPause: () => Promise<void>;
    onResume: () => Promise<void>;
    onStart: () => Promise<void>;
    onRequestSave: () => void;
    onDiscard: () => void;
};

export function RecordingControls({
    isRecording,
    isPaused,
    isArming = false,
    recordToggleDisabled = false,
    compact = false,
    canSave = true,
    canDiscard = true,
    onPause,
    onResume,
    onStart,
    onRequestSave,
    onDiscard,
}: Props) {
    const { t } = useTranslation();
    // The key answers the press at once (2026-10-17): it shows the take as begun
    // while the recorder spins up, and goes back if the start fails.
    const [starting, setStarting] = useState(false);
    const busy = isArming || starting || recordToggleDisabled;
    return (
        <View style={[styles.recordingControlsBar, compact ? styles.recordingControlsBarCompact : null]}>
            <View style={[local.sideColumn, local.sideColumnLead]}>
                <Pressable
                    style={[
                        styles.circleControlBtn,
                        compact ? styles.circleControlBtnCompact : null,
                        !canDiscard ? styles.circleControlBtnDisabled : null,
                    ]}
                    onPress={() => {
                        haptic.tap();
                        onDiscard();
                    }}
                    // Live during a count-in too: its Redo answer is how a count
                    // that started wrong is stopped (REC-25).
                    disabled={!canDiscard}
                    accessibilityRole="button"
                    accessibilityLabel={t("recording.discardA11y")}
                >
                    <Ionicons
                        name="trash-outline"
                        size={compact ? 18 : 21}
                        color={!canDiscard ? colors.textMuted : colors.danger}
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
                        if (busy) {
                            return;
                        }
                        // The most tactile moment in the app — every record-state
                        // change gets a firm pulse.
                        haptic.grab();
                        if (!isRecording) {
                            setStarting(true);
                            try {
                                await onStart();
                            } finally {
                                setStarting(false);
                            }
                            return;
                        }
                        if (isPaused) {
                            await onResume();
                            return;
                        }
                        await onPause();
                    }}
                    disabled={busy}
                >
                    <Ionicons
                        name={
                            isArming
                                ? "timer-outline"
                                : starting || (isRecording && !isPaused)
                                  ? "pause"
                                  : "mic"
                        }
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
    // Keys are spread evenly through their column — with the dock edge to
    // edge there is room for that, and it stops discard and redo huddling
    // against the record button. The bar is pinned left to right (styles).
    sideColumn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
    },
    sideColumnLead: {},
    sideColumnTrail: {},
});
