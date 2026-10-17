import { Modal, ScrollView, Text, View } from "react-native";
import { Press } from "../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../design/directionalIcons";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import type { CollectionMoveDestination } from "../../domain/collectionManagement";
import { useTranslation } from "react-i18next";
import { colors } from "../../design/tokens";
import { ModalDialogLayer } from "../common/AppDialog";

type Props = {
  visible: boolean;
  title?: string;
  helperText?: string;
  confirmLabel?: string;
  destinations: CollectionMoveDestination[];
  selectedWorkspaceId: string | null;
  selectedParentCollectionId: string | null;
  onSelectDestination: (workspaceId: string, parentCollectionId: string | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CollectionMoveModal({
  visible,
  title,
  helperText,
  confirmLabel,
  destinations,
  selectedWorkspaceId,
  selectedParentCollectionId,
  onSelectDestination,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("collection.moveCollection");
  const resolvedConfirmLabel = confirmLabel ?? t("common.move");
  const groupedDestinations = destinations.reduce<Record<string, CollectionMoveDestination[]>>((acc, destination) => {
    if (!acc[destination.workspaceId]) {
      acc[destination.workspaceId] = [];
    }
    acc[destination.workspaceId]!.push(destination);
    return acc;
  }, {});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{resolvedTitle}</Text>
          {helperText ? <Text style={styles.cardMeta}>{helperText}</Text> : null}
          <ScrollView
            style={styles.collectionMoveScroll}
            contentContainerStyle={styles.collectionMoveScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(groupedDestinations).map(([workspaceId, items]) => (
              <View key={workspaceId} style={styles.collectionMoveSection}>
                <Text style={styles.workspaceBrowseSectionTitle}>{items[0]?.workspaceTitle ?? t("modals.workspace")}</Text>
                <View style={styles.collectionMoveOptionList}>
                  {items.map((destination) => {
                    const selected =
                      selectedWorkspaceId === destination.workspaceId &&
                      (selectedParentCollectionId ?? null) === (destination.parentCollectionId ?? null);

                    return (
                      <Press
                        // haptics.ts: tap → a control changed value.
                        haptic="tap"
                        key={`${destination.workspaceId}:${destination.parentCollectionId ?? "root"}`}
                        style={[styles.collectionMoveOption,
                          selected ? styles.collectionMoveOptionSelected : null]}
                        onPress={() =>
                          onSelectDestination(destination.workspaceId, destination.parentCollectionId)
                        }
                      >
                        <View style={styles.collectionMoveOptionCopy}>
                          <Text
                            style={[
                              styles.collectionMoveOptionTitle,
                              selected ? styles.collectionMoveOptionTitleSelected : null,
                            ]}
                          >
                            {destination.label}
                          </Text>
                          {destination.subtitle ? (
                            <Text style={styles.collectionMoveOptionSubtitle}>{destination.subtitle}</Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={selected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                      </Press>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.rowButtons, { justifyContent: "flex-end", marginTop: 8 }]}>
            <Button variant="secondary" label={t("common.cancel")} onPress={onCancel} />
            <Button
              variant="primary"
              label={resolvedConfirmLabel}
              onPress={onConfirm}
              disabled={!selectedWorkspaceId}
            />
          </View>
        </View>
      </View>
      <ModalDialogLayer active={visible} />
    </Modal>
  );
}
