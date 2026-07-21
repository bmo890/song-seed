import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../../styles";
import { haptic } from "../../design/haptics";
import { IdeaStatus } from "../../types";
import { useTranslation } from "react-i18next";

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
    if (value === "stem") return { viewStyle: styles.statusStem, textStyle: styles.statusStemText };
    if (value === "song") return { viewStyle: styles.statusSong, textStyle: styles.statusSongText };
    return { viewStyle: null, textStyle: null };
}

export function StatusChipRow<T extends StatusChipValue>({
    items,
    activeValue,
    onPress,
    stretch = false,
    disabled = false,
}: Props<T>) {
    const { t } = useTranslation();
    return (
        <View style={styles.statusRowSpaced}>
            {items.map((item) => {
                const isActive = activeValue === item;
                const { viewStyle, textStyle } = getChipStyles(item);

                return (
                    <Pressable
                        key={item}
                        style={({ pressed }) => [
                            styles.statusChipBtn,
                            viewStyle,
                            isActive ? styles.statusBtnActive : null,
                            stretch ? { flex: 1, alignItems: "center" } : null,
                            disabled ? styles.btnDisabled : null,
                            pressed && !disabled ? styles.pressDown : null,
                        ]}
                        onPress={() => {
                            haptic.light();
                            onPress(item);
                        }}
                        disabled={disabled}
                    >
                        <Text
                            style={[styles.statusChipLabel, textStyle]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                        >
                            {item === "all" ? t("common.all") : t(`stages.${item}`)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
