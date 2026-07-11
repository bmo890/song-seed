import type { ComponentProps, ReactNode } from "react";
import { colors } from "../../../design/tokens";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Collection, Workspace } from "../../../types";
import { settingsScreenStyles, styles } from "../styles";
import {
  countCollectionIdeas,
  countWorkspaceIdeas,
  getCollectionSelectionState,
} from "../helpers";
import type { CollectionSelectionState } from "../types";

export const LIBRARY_DEEP = "#8b4f3b";

/** Nocturne library-action card: tinted icon circle, title, live status, right accessory. */
export function LibraryActionCard({
  icon,
  title,
  meta,
  busy,
  rightAccessory,
  onPress,
  disabled,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  meta: string;
  busy?: boolean;
  rightAccessory?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        settingsScreenStyles.libraryCard,
        pressed && !disabled ? styles.pressDown : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={settingsScreenStyles.libraryCardIcon}>
        <Ionicons name={icon} size={20} color={LIBRARY_DEEP} />
      </View>
      <View style={settingsScreenStyles.libraryCardCopy}>
        <Text style={settingsScreenStyles.libraryCardTitle}>{title}</Text>
        <Text style={settingsScreenStyles.libraryCardMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={LIBRARY_DEEP} />
      ) : (
        rightAccessory ?? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/** Label + a compact row of pill chips — for picking one of a few short values. */
export function SegmentedField<T extends string | number>({
  title,
  subtitle,
  value,
  options,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={settingsScreenStyles.segmentedField}>
      <View style={settingsScreenStyles.segmentedCopy}>
        <Text style={settingsScreenStyles.segmentedTitle}>{title}</Text>
        {subtitle ? <Text style={settingsScreenStyles.segmentedSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={settingsScreenStyles.segmentedRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              style={({ pressed }) => [
                settingsScreenStyles.segmentedChip,
                active ? settingsScreenStyles.segmentedChipActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text
                style={[
                  settingsScreenStyles.segmentedChipText,
                  active ? settingsScreenStyles.segmentedChipTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A labelled value (read-only or tappable) for the About page. */
export function AboutLinkRow({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={settingsScreenStyles.aboutRowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {value ? <Text style={settingsScreenStyles.aboutRowValue}>{value}</Text> : null}
        {onPress ? <Ionicons name={icon ?? "chevron-forward"} size={18} color={colors.textMuted} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={settingsScreenStyles.aboutRow}>{content}</View>;
  }
  return (
    <Pressable
      style={({ pressed }) => [settingsScreenStyles.aboutRow, pressed ? styles.pressDown : null]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

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
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
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
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
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
      ? colors.textPrimary
      : state === "excluded"
        ? colors.danger
        : state === "inherited"
          ? colors.textSecondary
          : colors.textMuted;

  return <Ionicons name={iconName} size={18} color={color} />;
}

export { countWorkspaceIdeas };
