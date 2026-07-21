import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Button } from "../common/Button";
import type { CollectionMoveDestination } from "../../domain/collectionManagement";
import { useTranslation } from "react-i18next";

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
  const resolvedConfirmLabel = confirmLabel ?? t("modals.move");
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
                      <Pressable
                        key={`${destination.workspaceId}:${destination.parentCollectionId ?? "root"}`}
                        style={({ pressed }) => [
                          styles.collectionMoveOption,
                          selected ? styles.collectionMoveOptionSelected : null,
                          pressed ? styles.pressDown : null,
                        ]}
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
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color="#0f172a" />
                        ) : (
                          <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
                        )}
                      </Pressable>
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
    </Modal>
  );
}
