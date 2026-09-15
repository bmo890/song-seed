import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleProp, TextInputProps, View, ViewStyle } from "react-native";
import { styles } from "../../styles";
import { genIdea } from "../../utils";
import { UserTextInput } from "../../i18n";
import { colors } from "../../design/tokens";

/** One 26pt key plus its gap; the field's trailing padding grows by this per visible key. */
const TRAILING_KEY_WIDTH = 32;

export const DEFAULT_TITLE_MAX_LENGTH = 80;
const DEFAULT_TITLE_MAX_LINES = 2;

type Props = {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    multiline?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    showGenerator?: boolean;
    showClear?: boolean;
    minHeight?: number;
    maxHeight?: number;
    maxLength?: number;
    maxLines?: number;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "style" | "multiline">;

function sanitizeTitleValue(value: string, maxLength: number, maxLines: number, trimTrailing: boolean) {
    const normalized = value.replace(/\r\n/g, "\n");
    let lines = normalized.split("\n").slice(0, maxLines);
    if (trimTrailing) lines = lines.map((line) => line.replace(/\s+$/g, ""));
    return lines.join("\n").replace(/\n{2,}/g, "\n").slice(0, maxLength);
}

export function TitleInput({
    value,
    onChangeText,
    placeholder,
    autoFocus,
    multiline = true,
    containerStyle,
    showGenerator = true,
    showClear = true,
    minHeight = 44,
    maxHeight = 120,
    maxLength = DEFAULT_TITLE_MAX_LENGTH,
    maxLines = DEFAULT_TITLE_MAX_LINES,
    ...inputProps
}: Props) {
    const [inputHeight, setInputHeight] = useState(minHeight);
    const showClearKey = showClear && value.length > 0;
    const trailingKeys = (showGenerator ? 1 : 0) + (showClearKey ? 1 : 0);

    useEffect(() => {
        setInputHeight(minHeight);
    }, [minHeight, placeholder]);

    return (
        <View style={[styles.titleInlineWrap, containerStyle]}>
            <UserTextInput
                style={[
                    styles.titleInlineInput,
                    !value ? styles.titleInlineInputPlaceholder : null,
                    { minHeight: Math.max(minHeight, inputHeight), maxHeight },
                    trailingKeys > 0 ? { paddingEnd: 14 + trailingKeys * TRAILING_KEY_WIDTH } : null,
                ]}
                value={value}
                onChangeText={(nextValue) => {
                    onChangeText(sanitizeTitleValue(nextValue, maxLength, maxLines, false));
                }}
                onBlur={() => {
                    onChangeText(sanitizeTitleValue(value, maxLength, maxLines, true));
                }}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                autoFocus={autoFocus}
                multiline={multiline}
                scrollEnabled={false}
                maxLength={maxLength}
                textAlignVertical={multiline ? "top" : "center"}
                onContentSizeChange={(evt) => {
                    const nextHeight = Math.min(maxHeight, Math.max(minHeight, evt.nativeEvent.contentSize.height));
                    setInputHeight((prev) => (prev === nextHeight ? prev : nextHeight));
                }}
                {...inputProps}
            />
            {trailingKeys > 0 ? (
                <View style={styles.titleInlineBtns}>
                    {showGenerator ? (
                        <Pressable
                            style={({ pressed }) => [styles.titleClearBtn, pressed ? styles.pressDown : null]}
                            onPress={() => onChangeText(sanitizeTitleValue(genIdea(), maxLength, maxLines, true))}
                        >
                            <Ionicons name="sparkles" size={14} color={colors.textSecondary} />
                        </Pressable>
                    ) : null}
                    {showClearKey ? (
                        <Pressable
                            style={({ pressed }) => [styles.titleClearBtn, pressed ? styles.pressDown : null]}
                            onPress={() => onChangeText("")}
                        >
                            <Ionicons name="close" size={14} color={colors.textSecondary} />
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
