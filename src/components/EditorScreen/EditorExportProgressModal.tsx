import React from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";

type EditorExportProgressModalProps = {
  visible: boolean;
};

export function EditorExportProgressModal({ visible }: EditorExportProgressModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}>
        <View style={{ backgroundColor: "#1e293b", padding: 32, borderRadius: 16, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={{ marginTop: 16, color: "#f8fafc", fontSize: 16, fontWeight: "600" }}>Exporting Audio...</Text>
          <Text style={{ marginTop: 8, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
            This happens entirely on your device
          </Text>
        </View>
      </View>
    </Modal>
  );
}
