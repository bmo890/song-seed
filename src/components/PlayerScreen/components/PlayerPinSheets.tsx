import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { fmtDuration } from "../../../utils";
import { playerScreenStyles } from "../styles";
import { styles as appStyles } from "../../../styles";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../i18n";

type PlayerPinSheetsProps = {
  pinModalVisible: boolean;
  pinActionsVisible: boolean;
  newPinLabel: string;
  playerPosition: number;
  pinTargetLabel: string | null;
  pinTargetAtMs: number | null;
  pinRenameValue: string;
  onCloseCreate: () => void;
  onChangeNewPinLabel: (value: string) => void;
  onSaveNewPin: () => void;
  onCloseActions: () => void;
  onChangePinRenameValue: (value: string) => void;
  onRenamePin: () => void;
  onDeletePin: () => void;
};

export function PlayerPinSheets({
  pinModalVisible,
  pinActionsVisible,
  newPinLabel,
  playerPosition,
  pinTargetLabel,
  pinTargetAtMs,
  pinRenameValue,
  onCloseCreate,
  onChangeNewPinLabel,
  onSaveNewPin,
  onCloseActions,
  onChangePinRenameValue,
  onRenamePin,
  onDeletePin,
}: PlayerPinSheetsProps) {
  const { t } = useTranslation();
  return (
    <>
      <BottomSheet
        visible={pinModalVisible}
        onClose={onCloseCreate}
        dismissDistance={360}
        keyboardAvoiding
      >
        <View style={playerScreenStyles.pinSheetContent}>
          <Text style={playerScreenStyles.pinSheetTitle}>{t("player.addPracticePin")}</Text>
          <Text style={playerScreenStyles.pinSheetTime}>{t("player.atTime", { time: fmtDuration(playerPosition) })}</Text>

          <UserTextInput
            style={playerScreenStyles.pinSheetInput}
            placeholder={t("player.pinExample")}
            placeholderTextColor="#94a3b8"
            value={newPinLabel}
            onChangeText={onChangeNewPinLabel}
            onSubmitEditing={onSaveNewPin}
            returnKeyType="done"
            autoFocus
          />

          <View style={playerScreenStyles.pinSheetFooter}>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                playerScreenStyles.pinSheetButtonSecondary,
                pressed ? appStyles.pressDown : null,
              ]}
              onPress={onCloseCreate}
            >
              <Text
                style={[
                  playerScreenStyles.pinSheetButtonText,
                  playerScreenStyles.pinSheetButtonSecondaryText,
                ]}
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                !newPinLabel.trim() ? playerScreenStyles.pinSheetButtonDisabled : null,
                pressed ? appStyles.pressDown : null,
              ]}
              onPress={onSaveNewPin}
              disabled={!newPinLabel.trim()}
            >
              <Text
                style={[
                  playerScreenStyles.pinSheetButtonText,
                  !newPinLabel.trim() ? playerScreenStyles.pinSheetButtonTextDisabled : null,
                ]}
              >
                {t("player.savePin")}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={pinActionsVisible} onClose={onCloseActions} keyboardAvoiding>
        <View style={playerScreenStyles.pinSheetContent}>
          <Text style={playerScreenStyles.pinSheetTitle}>
            {pinTargetLabel || t("player.unnamedPin")}
          </Text>
          <Text style={playerScreenStyles.pinSheetTime}>
            {pinTargetAtMs === null ? "" : t("player.atTime", { time: fmtDuration(pinTargetAtMs) })}
          </Text>

          <UserTextInput
            style={playerScreenStyles.pinSheetInput}
            placeholder={t("player.renamePin")}
            placeholderTextColor="#94a3b8"
            value={pinRenameValue}
            onChangeText={onChangePinRenameValue}
            onSubmitEditing={onRenamePin}
            returnKeyType="done"
            autoFocus
          />

          <View style={playerScreenStyles.pinSheetFooter}>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                playerScreenStyles.pinSheetButtonDanger,
                pressed ? appStyles.pressDown : null,
              ]}
              onPress={onDeletePin}
            >
              <Ionicons name="trash-outline" size={15} color={colors.surface} style={{ marginRight: 4 }} />
              <Text style={playerScreenStyles.pinSheetButtonText}>{t("common.delete")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                !pinRenameValue.trim() ? playerScreenStyles.pinSheetButtonDisabled : null,
                pressed ? appStyles.pressDown : null,
              ]}
              onPress={onRenamePin}
              disabled={!pinRenameValue.trim()}
            >
              <Text
                style={[
                  playerScreenStyles.pinSheetButtonText,
                  !pinRenameValue.trim() ? playerScreenStyles.pinSheetButtonTextDisabled : null,
                ]}
              >
                {t("common.save")}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
