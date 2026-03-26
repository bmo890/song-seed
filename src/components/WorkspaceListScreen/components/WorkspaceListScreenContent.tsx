import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { styles } from "../styles";
import { useWorkspaceListScreenModel } from "../hooks/useWorkspaceListScreenModel";
import { WorkspaceModal } from "../../modals/WorkspaceModal";
import { ClipboardBanner } from "../../ClipboardBanner";
import { ScreenHeader } from "../../common/ScreenHeader";
import { Button } from "../../common/Button";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock } from "../../common/SelectionDock";
import { SectionHeader } from "../../common/SectionHeader";
import { SegmentedControl } from "../../common/SegmentedControl";
import { FilterSortControls } from "../../common/FilterSortControls";
import { WorkspaceList } from "./WorkspaceList";

export function WorkspaceListScreenContent() {
  const model = useWorkspaceListScreenModel();

  useBrowseRootBackHandler({
    onBack: () => {
      if (model.selection.selectedWorkspaceIds.length > 0) {
        model.selection.setSelectedWorkspaceIds([]);
        model.selection.setSelectionMoreVisible(false);
        return;
      }
    },
  });

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Home" leftIcon="hamburger" />

      {model.clipClipboard ? (
        <ClipboardBanner
          count={model.clipClipboard.clipIds.length}
          mode={model.clipClipboard.mode}
          onCancel={model.cancelClipboard}
          actionLabel="Choose workspace"
          disabled={true}
          onAction={() => {
            Alert.alert(
              "Choose a workspace",
              "You cannot paste items directly on Home. Open a workspace first."
            );
          }}
        />
      ) : null}

        <ScrollView
          style={styles.flexFill}
          contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: model.data.selectionMode
              ? model.selection.selectionDockHeight + 48
              : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{model.data.subtitle}</Text>

        <SegmentedControl
          options={[
            { key: "active", label: "Active" },
            { key: "archived", label: "Archived" },
          ]}
          selectedKey={model.data.viewingArchived ? "archived" : "active"}
          onSelect={(value) => model.actions.setViewingArchived(value === "archived")}
        />

        {!model.data.selectionMode ? (
          <View style={styles.inputRow}>
            <Button
              label="New Workspace"
              disabled={!!model.data.busyWorkspaceId}
              onPress={() => {
                model.modal.setEditId(null);
                model.modal.setModalOpen(true);
              }}
            />
          </View>
        ) : null}

        <SectionHeader
          title={model.data.viewingArchived ? "Archived Workspaces" : "Active Workspaces"}
        />

        <FilterSortControls
          sort={{
            active: model.data.workspaceListOrder !== "last-worked",
            valueIcon: model.data.workspaceOrderState.icon,
            direction: model.data.workspaceOrderState.direction,
            renderMenu: ({ close }) => (
              <View style={styles.orderMenuSection}>
                <Text style={styles.orderMenuTitle}>Order</Text>
                {model.data.workspaceOrderOptions.map((option) => {
                  const active = option.key === model.data.workspaceListOrder;
                  return (
                    <Pressable
                      key={option.key}
                      style={({ pressed }) => [
                        styles.orderMenuItem,
                        active ? styles.orderMenuItemActive : null,
                        pressed ? styles.pressDown : null,
                      ]}
                      onPress={() => {
                        model.actions.setWorkspaceListOrder(option.key);
                        close();
                      }}
                    >
                      <View style={styles.orderMenuItemLead}>
                        <Ionicons
                          name={option.icon as any}
                          size={15}
                          color={active ? "#0f172a" : "#64748b"}
                        />
                        <Text
                          style={[
                            styles.orderMenuItemText,
                            active ? styles.orderMenuItemTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark" size={15} color="#0f172a" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ),
          }}
        />

        <WorkspaceList
          workspaces={model.data.filteredWorkspaces}
          primaryWorkspaceId={model.data.primaryWorkspaceId}
          editingWorkspaceId={model.modal.editId}
          busyWorkspaceId={model.data.busyWorkspaceId}
          busyLabel={model.data.busyLabel}
          selectionMode={model.data.selectionMode}
          selectedWorkspaceIds={model.selection.selectedWorkspaceIds}
          onToggleSelection={model.selection.toggleWorkspaceSelection}
          onTogglePrimaryWorkspace={(workspaceId) => {
            model.actions.setPrimaryWorkspaceId(
              model.data.primaryWorkspaceId === workspaceId ? null : workspaceId
            );
          }}
          onOpenWorkspaceActions={model.modal.openWorkspaceActions}
        />

        {model.data.filteredWorkspaces.length === 0 ? (
          <Text style={styles.emptyText}>
            {model.data.viewingArchived
              ? "No archived workspaces yet."
              : "No active workspaces available."}
          </Text>
        ) : null}
      </ScrollView>

      {model.data.selectionMode ? (
        <>
          <SelectionDock
            count={model.selection.selectedWorkspaceIds.length}
            actions={model.selection.selectionDockActions}
            onDone={() => model.selection.setSelectedWorkspaceIds([])}
            onLayout={(height) => {
              model.selection.setSelectionDockHeight((prev) =>
                Math.abs(prev - height) < 1 ? prev : height
              );
            }}
          />
          <SelectionActionSheet
            visible={model.selection.selectionMoreVisible}
            title="Workspace actions"
            actions={model.selection.selectionSheetActions}
            onClose={() => model.selection.setSelectionMoreVisible(false)}
          />
        </>
      ) : null}

      <WorkspaceModal
        visible={model.modal.modalOpen}
        title={model.modal.isEditing ? "Edit Workspace" : "New Workspace"}
        initialName={model.modal.editingWorkspace?.title}
        initialDescription={model.modal.editingWorkspace?.description}
        showArchiveAction={model.modal.isEditing}
        archiveActionLabel={
          model.modal.editingWorkspace?.isArchived ? "Unarchive" : "Archive"
        }
        archiveActionDisabled={!!model.data.busyWorkspaceId}
        showDelete={model.modal.isEditing}
        deleteLabel="Delete permanently"
        onCancel={() => {
          if (model.data.busyWorkspaceId) return;
          model.modal.closeModal();
        }}
        onSave={model.modal.saveWorkspace}
        onArchiveAction={() => {
          if (!model.modal.editingWorkspace) return;
          model.actions.confirmArchiveWorkspace(model.modal.editingWorkspace);
        }}
        onDelete={() => {
          if (!model.modal.editingWorkspace) return;
          model.actions.confirmDeleteWorkspace(model.modal.editingWorkspace);
        }}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
