import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { popIn } from "../../design/motion";

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Wrap content in a ScrollView — use for taller modals that may overflow on small screens */
  scrollable?: boolean;
};

export function WarmModal({ visible, onRequestClose, title, children, scrollable }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={warmModalStyles.backdropFill} />
      <KeyboardAvoidingView style={warmModalStyles.avoid} behavior="padding">
        <View style={warmModalStyles.center}>
          <Animated.View style={warmModalStyles.card} entering={popIn}>
            {title ? <Text style={warmModalStyles.title}>{title}</Text> : null}
            {scrollable ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={warmModalStyles.scrollContent}
              >
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const warmModalStyles = StyleSheet.create({
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,28,25,0.45)",
  },
  avoid: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FDFBF7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.35)",
    padding: 20,
    shadowColor: "#3D3732",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 17,
    lineHeight: 24,
    color: "#1C1C19",
    marginBottom: 16,
  },
  scrollContent: {
    gap: 0,
  },
});
