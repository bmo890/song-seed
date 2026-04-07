import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { fmtDuration } from "../../../utils";
import { playerScreenStyles } from "../styles";

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
  return (
    <>
      <BottomSheet
        visible={pinModalVisible}
        onClose={onCloseCreate}
        dismissDistance={360}
        keyboardAvoiding
      >
        <View style={playerScreenStyles.pinSheetContent}>
          <Text style={playerScreenStyles.pinSheetTitle}>Add Practice Pin</Text>
          <Text style={playerScreenStyles.pinSheetTime}>at {fmtDuration(playerPosition)}</Text>

          <TextInput
            style={playerScreenStyles.pinSheetInput}
            placeholder="e.g., Chorus, Bridge, Solo"
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
                pressed ? { opacity: 0.7 } : null,
              ]}
              onPress={onCloseCreate}
            >
              <Text
                style={[
                  playerScreenStyles.pinSheetButtonText,
                  playerScreenStyles.pinSheetButtonSecondaryText,
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                !newPinLabel.trim() ? playerScreenStyles.pinSheetButtonDisabled : null,
                pressed ? { opacity: 0.7 } : null,
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
                Save Pin
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={pinActionsVisible} onClose={onCloseActions} keyboardAvoiding>
        <View style={playerScreenStyles.pinSheetContent}>
          <Text style={playerScreenStyles.pinSheetTitle}>
            {pinTargetLabel || "Unnamed pin"}
          </Text>
          <Text style={playerScreenStyles.pinSheetTime}>
            at {pinTargetAtMs === null ? "" : fmtDuration(pinTargetAtMs)}
          </Text>

          <TextInput
            style={playerScreenStyles.pinSheetInput}
            placeholder="Rename pin"
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
                pressed ? { opacity: 0.7 } : null,
              ]}
              onPress={onDeletePin}
            >
              <Ionicons name="trash-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={playerScreenStyles.pinSheetButtonText}>Delete</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                playerScreenStyles.pinSheetButton,
                !pinRenameValue.trim() ? playerScreenStyles.pinSheetButtonDisabled : null,
                pressed ? { opacity: 0.7 } : null,
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
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
