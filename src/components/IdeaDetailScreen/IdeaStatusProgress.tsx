import React from "react";
import { StyleProp, View, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { styles } from "./styles";
import { IdeaStatus } from "../../types";
import { StatusChipRow } from "../common/StatusChipRow";

const PROJECT_STATUSES: IdeaStatus[] = ["seed", "sprout", "semi", "song"];

type IdeaStatusProgressProps = {
    isEditMode: boolean;
    draftStatus: IdeaStatus;
    setDraftStatus: (v: IdeaStatus) => void;
    draftCompletion: number;
    setDraftCompletion: (v: number) => void;
    kind: "clip" | "project";
    status: IdeaStatus;
    completionPct: number;
    cardStyle?: StyleProp<ViewStyle>;
};

export function IdeaStatusProgress({
    isEditMode,
    draftStatus,
    setDraftStatus,
    draftCompletion,
    setDraftCompletion,
    kind,
    status,
    completionPct,
    cardStyle,
}: IdeaStatusProgressProps) {
    if (kind !== "project") return null;

    if (!isEditMode) {
        const stageStyle =
            status === "song"
                ? [styles.badge, styles.statusSong, styles.statusSongText]
                : status === "semi"
                    ? [styles.badge, styles.statusSemi, styles.statusSemiText]
                    : status === "sprout"
                        ? [styles.badge, styles.statusSprout, styles.statusSproutText]
                        : [styles.badge, styles.statusSeed, styles.statusSeedText];

        return (
            <View style={[styles.card, styles.songDetailSummaryCard, styles.songDetailSummaryCardCompact, cardStyle]}>
                <View style={styles.songDetailSummaryHeader}>
                    <View style={styles.songDetailSummaryTitleWrap}>
                        <Ionicons name="trending-up-outline" size={14} color="#64748b" />
                        <Text style={styles.songDetailMiniCardTitle}>Progress</Text>
                    </View>
                </View>
                <View style={styles.songDetailStatusSummaryRow}>
                    <Text style={[...stageStyle, styles.songDetailStatusBadgeLarge]}>
                        {status === "song" ? "SONG" : status.toUpperCase()}
                    </Text>
                    <Text style={styles.songDetailStatusPercentCompact}>{completionPct}%</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.card, styles.songDetailEditorCard]}>
            <Text style={styles.songDetailSectionEyebrow}>Progress</Text>
            <StatusChipRow
                items={PROJECT_STATUSES}
                activeValue={draftStatus}
                stretch
                disabled={false}
                onPress={(s) => {
                    setDraftStatus(s);

                    if (s === "song") setDraftCompletion(75);
                    if (s === "semi") setDraftCompletion(50);
                    if (s === "sprout") setDraftCompletion(25);
                    if (s === "seed" && draftCompletion >= 25) setDraftCompletion(0);
                }}
            />

            <View style={styles.progressWrap}>
                <Text style={styles.progressMeta}>Completion: {draftCompletion}%</Text>
                <Slider
                    minimumValue={0}
                    maximumValue={100}
                    step={5}
                    value={draftCompletion}
                    onValueChange={(val) => {
                        setDraftCompletion(val);
                        if (val >= 75) setDraftStatus("song");
                        else if (val >= 50) setDraftStatus("semi");
                        else if (val >= 25) setDraftStatus("sprout");
                        else setDraftStatus("seed");
                    }}
                    minimumTrackTintColor="#111827"
                    maximumTrackTintColor="#d1d5db"
                    thumbTintColor="#111827"
                />
            </View>
        </View>
    );
}
