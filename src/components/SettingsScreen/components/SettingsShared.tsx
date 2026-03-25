import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Collection, Workspace } from "../../../types";
import { styles } from "../styles";
import {
  countCollectionIdeas,
  countWorkspaceIdeas,
  getCollectionSelectionState,
} from "../helpers";
import type { CollectionSelectionState } from "../types";

export function FormatOptionRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsChoiceRow,
        selected ? styles.settingsChoiceRowSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <SelectionMark state={selected ? "selected" : "unselected"} />
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        <Text style={styles.settingsChoiceMeta}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export function AccordionSection({
  step,
  title,
  hint,
  open,
  onPress,
  children,
}: {
  step: string;
  title: string;
  hint: string;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.settingsSection,
        styles.settingsAccordionShell,
        open ? styles.settingsAccordionShellOpen : null,
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.settingsAccordionHeader,
          open ? styles.settingsAccordionHeaderOpen : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onPress}
      >
        <View style={styles.settingsAccordionCopy}>
          <Text style={styles.settingsSectionLabel}>{step}</Text>
          <Text style={styles.settingsAccordionTitle}>{title}</Text>
          <Text style={styles.settingsAccordionHint}>{hint}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
      </Pressable>

      {open ? <View style={styles.settingsAccordionBody}>{children}</View> : null}
    </View>
  );
}

export function StorageMetricRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.settingsStorageMetricRow}>
      <View style={styles.settingsStorageMetricCopy}>
        <Text style={styles.settingsChoiceTitle}>{label}</Text>
        <Text style={styles.settingsChoiceMeta}>{detail}</Text>
      </View>
      <Text style={styles.settingsStorageMetricValue}>{value}</Text>
    </View>
  );
}

export function StoragePathRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingsStoragePathRow}>
      <Text style={styles.settingsSectionLabel}>{label}</Text>
      <Text style={styles.settingsStoragePathValue}>{value}</Text>
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingsToggleRow, pressed ? styles.pressDown : null]}
      onPress={onPress}
    >
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        <Text style={styles.settingsChoiceMeta}>{subtitle}</Text>
      </View>
      <View style={[styles.settingsTogglePill, value ? styles.settingsTogglePillActive : null]}>
        <View style={[styles.settingsToggleThumb, value ? styles.settingsToggleThumbActive : null]} />
      </View>
    </Pressable>
  );
}

function ScopeRow({
  title,
  subtitle,
  state,
  level,
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  state: CollectionSelectionState;
  level: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <SelectionMark state={state} />
      <View style={styles.settingsScopeCopy}>
        <Text style={styles.settingsScopeTitle}>{title}</Text>
        <Text style={styles.settingsScopeMeta}>{subtitle}</Text>
      </View>
    </>
  );

  const rowStyle = [
    styles.settingsScopeRow,
    level === 1 ? styles.settingsScopeRowNested : null,
    disabled ? styles.settingsScopeRowDisabled : null,
  ];

  if (!onPress || disabled) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable style={({ pressed }) => [rowStyle, pressed ? styles.pressDown : null]} onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function WorkspaceScopeRow({
  title,
  subtitle,
  state,
  expanded,
  onToggleSelected,
  onToggleExpanded,
}: {
  title: string;
  subtitle: string;
  state: CollectionSelectionState;
  expanded: boolean;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <View style={styles.settingsWorkspaceRow}>
      <Pressable
        style={({ pressed }) => [styles.settingsWorkspaceSelectZone, pressed ? styles.pressDown : null]}
        onPress={onToggleSelected}
      >
        <SelectionMark state={state} />
        <View style={styles.settingsScopeCopy}>
          <Text style={styles.settingsScopeTitle}>{title}</Text>
          <Text style={styles.settingsScopeMeta}>{subtitle}</Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.settingsWorkspaceExpandBtn, pressed ? styles.pressDown : null]}
        onPress={onToggleExpanded}
      >
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
      </Pressable>
    </View>
  );
}

export function CollectionTreeRow({
  workspace,
  collection,
  selectedWorkspaceIds,
  selectedCollectionIds,
  excludedCollectionIds,
  includeHiddenItems,
  onToggleCollection,
}: {
  workspace: Workspace;
  collection: Collection;
  selectedWorkspaceIds: string[];
  selectedCollectionIds: string[];
  excludedCollectionIds: string[];
  includeHiddenItems: boolean;
  onToggleCollection: (workspace: Workspace, collectionId: string) => void;
}) {
  const state = getCollectionSelectionState(
    workspace,
    collection,
    selectedWorkspaceIds,
    selectedCollectionIds,
    excludedCollectionIds
  );
  const itemCount = countCollectionIdeas(workspace, collection.id, includeHiddenItems);
  const inheritedSubtitle =
    state === "excluded"
      ? `Excluded · ${itemCount} items`
      : state === "inherited"
        ? selectedWorkspaceIds.includes(workspace.id)
          ? `Included via workspace · ${itemCount} items`
          : `Included via parent collection · ${itemCount} items`
        : `${itemCount} items`;

  return (
    <View>
      <ScopeRow
        title={collection.title}
        subtitle={inheritedSubtitle}
        state={state}
        level={collection.parentCollectionId ? 1 : 0}
        onPress={() => onToggleCollection(workspace, collection.id)}
      />

      {workspace.collections
        .filter((candidate) => candidate.parentCollectionId === collection.id)
        .map((child) => (
          <CollectionTreeRow
            key={child.id}
            workspace={workspace}
            collection={child}
            selectedWorkspaceIds={selectedWorkspaceIds}
            selectedCollectionIds={selectedCollectionIds}
            excludedCollectionIds={excludedCollectionIds}
            includeHiddenItems={includeHiddenItems}
            onToggleCollection={onToggleCollection}
          />
        ))}
    </View>
  );
}

export function SelectionMark({ state }: { state: CollectionSelectionState }) {
  const iconName: ComponentProps<typeof Ionicons>["name"] =
    state === "selected"
      ? "checkmark-circle"
      : state === "excluded"
        ? "close-circle"
        : state === "inherited"
          ? "remove-circle"
          : "ellipse-outline";
  const color =
    state === "selected"
      ? "#0f172a"
      : state === "excluded"
        ? "#b91c1c"
        : state === "inherited"
          ? "#64748b"
          : "#94a3b8";

  return <Ionicons name={iconName} size={18} color={color} />;
}

export { countWorkspaceIdeas };
