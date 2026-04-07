import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../common/ScreenHeader";
import { styles } from "../../styles";

type RecordingHeaderProps = {
  title: string;
  controlsDisabled: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onOpenSettings: () => void;
};

export function RecordingHeader({
  title,
  controlsDisabled,
  onBack,
  onMinimize,
  onOpenSettings,
}: RecordingHeaderProps) {
  return (
    <View style={styles.transportHeaderZone}>
      <ScreenHeader
        title={title}
        leftIcon="back"
        onLeftPress={onBack}
        rightElement={
          <View style={styles.transportHeaderActionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.transportHeaderActionBtn,
                pressed ? styles.pressDown : null,
              ]}
              onPress={onMinimize}
              accessibilityRole="button"
              accessibilityLabel="Minimize recorder"
            >
              <Ionicons name="remove" size={18} color="#334155" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.recordingSettingsBtn,
                controlsDisabled ? styles.recordingSettingsBtnDisabled : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={onOpenSettings}
              disabled={controlsDisabled}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color={controlsDisabled ? "#9ca3af" : "#111827"}
              />
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
