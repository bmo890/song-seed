import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../../styles";
import { IdeaStatus } from "../../types";

type StatusChipValue = "all" | IdeaStatus;

type Props<T extends StatusChipValue> = {
    items: readonly T[];
    activeValue: T;
    onPress: (value: T) => void;
    stretch?: boolean;
    disabled?: boolean;
};

function getChipStyles(value: StatusChipValue) {
    if (value === "seed") return { viewStyle: styles.statusSeed, textStyle: styles.statusSeedText };
    if (value === "sprout") return { viewStyle: styles.statusSprout, textStyle: styles.statusSproutText };
    if (value === "semi") return { viewStyle: styles.statusSemi, textStyle: styles.statusSemiText };
    if (value === "song") return { viewStyle: styles.statusSong, textStyle: styles.statusSongText };
    return { viewStyle: null, textStyle: null };
}

function getLabel(value: StatusChipValue) {
    return value === "song" ? "SONG" : value.toUpperCase();
}

export function StatusChipRow<T extends StatusChipValue>({
    items,
    activeValue,
    onPress,
    stretch = false,
    disabled = false,
}: Props<T>) {
    return (
        <View style={styles.statusRowSpaced}>
            {items.map((item) => {
                const isActive = activeValue === item;
                const { viewStyle, textStyle } = getChipStyles(item);

                return (
                    <Pressable
                        key={item}
                        style={[
                            styles.statusChipBtn,
                            viewStyle,
                            isActive ? styles.statusBtnActive : null,
                            stretch ? { flex: 1, alignItems: "center" } : null,
                            disabled ? styles.btnDisabled : null,
                        ]}
                        onPress={() => onPress(item)}
                        disabled={disabled}
                    >
                        <Text style={[styles.secondaryBtnText, textStyle]}>
                            {getLabel(item)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
