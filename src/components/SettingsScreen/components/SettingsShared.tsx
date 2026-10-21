import { Children, Fragment, useState, type ComponentProps, type ReactNode } from "react";
import Animated, { FadeIn } from "react-native-reanimated";
import { durations } from "../../../design/motion";
import { PopoverRadioRow } from "../../common/PopoverMenu";
import { colors } from "../../../design/tokens";
import { Pressable, Text, View } from "react-native";
import { Spinner } from "../../common/Spinner";
import { Ionicons } from "@expo/vector-icons";
import { Switch } from "../../common/Switch";
import { Press } from "../../common/Press";
import { SegmentedControl } from "../../common/SegmentedControl";
import { i18n } from "../../../i18n/instance";
import { dirIcon } from "../../../design/directionalIcons";
import type { Collection, Workspace } from "../../../types";
import { settingsScreenStyles, styles } from "../styles";
import {
  countCollectionIdeas,
  countWorkspaceIdeas,
  getCollectionSelectionState,
} from "../helpers";
import type { CollectionSelectionState } from "../types";

export const LIBRARY_DEEP = colors.primaryDeep;

/**
 * Groups a section's rows onto one soft surface with hairline dividers between
 * them — the premium "inset list" pattern. Pass `flat`-variant rows as children
 * (they drop their own card fill so the group carries the surface).
 */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={settingsScreenStyles.group}>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={settingsScreenStyles.groupDivider} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

/** Quiet navigation/action row: tonal icon, title, live status, right accessory. */
export function LibraryActionCard({
  icon,
  title,
  meta,
  busy,
  rightAccessory,
  onPress,
  disabled,
  flat = false,
  tone = "default",
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  /** A status line; omitted, the row is its name alone. */
  meta?: string;
  busy?: boolean;
  rightAccessory?: ReactNode;
  /** Omit for a STATIC row — same anatomy, no press affordance. Used for
   *  truthful "coming later" entries that must not read as tappable. */
  onPress?: () => void;
  disabled?: boolean;
  /** Render without its own card fill, for use inside a SettingsGroup. */
  flat?: boolean;
  /** `danger` = a destructive row (erase everything): icon + title in danger ink,
   *  danger-surface icon disc. Colour is the only difference — same anatomy. */
  tone?: "default" | "danger";
}) {
  // Glyphs are ink; only a destructive row keeps a colour (danger).
  const accent = tone === "danger" ? colors.danger : colors.textStrong;
  const titleStyle = tone === "danger" ? { color: colors.danger } : null;
  if (!onPress) {
    return (
      <View
        style={[
          settingsScreenStyles.libraryCard,
          flat ? settingsScreenStyles.libraryCardFlat : null,
        ]}
      >
        <View style={settingsScreenStyles.libraryCardIcon}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <View style={settingsScreenStyles.libraryCardCopy}>
          <Text style={[settingsScreenStyles.libraryCardTitle, titleStyle]}>{title}</Text>
          {meta ? (
            <Text style={settingsScreenStyles.libraryCardMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {rightAccessory ?? null}
      </View>
    );
  }
  return (
    <Pressable
      testID={`settings-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        settingsScreenStyles.libraryCard,
        flat ? settingsScreenStyles.libraryCardFlat : null,
        pressed && !disabled ? styles.pressDown : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={settingsScreenStyles.libraryCardIcon}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={settingsScreenStyles.libraryCardCopy}>
        <Text style={[settingsScreenStyles.libraryCardTitle, titleStyle]}>{title}</Text>
        {meta ? (
          <Text style={settingsScreenStyles.libraryCardMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {busy ? (
        <Spinner size="small" color={accent} />
      ) : (
        rightAccessory ?? <Ionicons name={dirIcon("chevron-forward")} size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/** Label + a compact row of pill chips — for picking one of a few short values. */
/** A titled single choice: the title and hint, then the canon ink tabs
 *  (2026-10-20: was a row of filled terracotta chips). */
export function SegmentedField<T extends string | number>({
  title,
  subtitle,
  value,
  options,
  onChange,
  flat = false,
}: {
  title: string;
  subtitle?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  /** Add row padding for use inside a SettingsGroup surface. */
  flat?: boolean;
}) {
  const keyOf = (option: T) => String(option);
  return (
    <View style={[settingsScreenStyles.segmentedField, flat ? settingsScreenStyles.segmentedFieldFlat : null]}>
      <View style={settingsScreenStyles.segmentedCopy}>
        <Text style={settingsScreenStyles.segmentedTitle}>{title}</Text>
        {subtitle ? <Text style={settingsScreenStyles.segmentedSubtitle}>{subtitle}</Text> : null}
      </View>
      <SegmentedControl
        options={options.map((option) => ({ key: keyOf(option.value), label: option.label }))}
        value={keyOf(value)}
        onChange={(key) => {
          const picked = options.find((option) => keyOf(option.value) === key);
          if (picked) onChange(picked.value);
        }}
      />
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
        {onPress ? <Ionicons name={icon ?? dirIcon("chevron-forward")} size={18} color={colors.textMuted} /> : null}
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
  flat = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Render without its own card fill, for use inside a SettingsGroup. */
  flat?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsChoiceRow,
        flat ? styles.settingsRowFlat : null,
        selected ? (flat ? styles.settingsRowFlatSelected : styles.settingsChoiceRowSelected) : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <SelectionMark state={selected ? "selected" : "unselected"} />
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingsChoiceMeta}>{subtitle}</Text> : null}
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
  detail?: string;
}) {
  return (
    <View style={styles.settingsStorageMetricRow}>
      <View style={styles.settingsStorageMetricCopy}>
        <Text style={styles.settingsChoiceTitle}>{label}</Text>
        {detail ? <Text style={styles.settingsChoiceMeta}>{detail}</Text> : null}
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

/**
 * One choice of a few, said as a value (2026-10-21, founder: "drop downs
 * instead of tab lists"): the row shows the current value; a tap hangs the
 * filter/sort popover (PopoverRadioRow) from its trailing edge. The section
 * holding these rows sits above the ones after it (`settingsScreenStyles.pickerSection`),
 * so an open popover is never covered by a later section.
 */
export function ValueRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? "";
  return (
    <View style={[settingsScreenStyles.valueRowWrap, open ? settingsScreenStyles.valueRowWrapOpen : null]}>
      {open ? (
        <Press
          feel="still"
          // Haptics vocabulary: `light` — the small panel closes, as it opened.
          haptic="light"
          style={settingsScreenStyles.valueRowBackdrop}
          onPress={() => setOpen(false)}
          accessible={false}
        />
      ) : null}
      <Press
        // Haptics vocabulary: `light` — a small panel opens.
        haptic="light"
        style={[styles.settingsToggleRow, styles.settingsRowFlat]}
        onPress={() => setOpen((wasOpen) => !wasOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}: ${current}`}
      >
        <View style={styles.settingsChoiceCopy}>
          <Text style={styles.settingsChoiceTitle}>{title}</Text>
        </View>
        <View style={settingsScreenStyles.valueRowValue}>
          <Text style={settingsScreenStyles.valueRowValueText} numberOfLines={1}>
            {current}
          </Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
        </View>
      </Press>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(durations.fast)}
          style={[styles.ideasSortMenu, settingsScreenStyles.valueRowMenu]}
        >
          {options.map((option) => (
            <PopoverRadioRow
              key={option.value}
              label={option.label}
              selected={option.value === value}
              onPress={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onPress,
  flat = false,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onPress: () => void;
  /** Render without its own card fill, for use inside a SettingsGroup. */
  flat?: boolean;
}) {
  return (
    <Press
      // Haptics vocabulary: `light` — a small state flip (the switch turns).
      haptic="light"
      style={[styles.settingsToggleRow, flat ? styles.settingsRowFlat : null]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingsChoiceMeta}>{subtitle}</Text> : null}
      </View>
      {/* The canon switch (2026-10-20; was a hand-drawn pill). The row's own
          press flips it, so the switch itself takes no touches. */}
      <View pointerEvents="none">
        <Switch value={value} onValueChange={onPress} accessibilityLabel={title} />
      </View>
    </Press>
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
  const items = i18n.t("settingsExport.items", { count: itemCount });
  const inheritedSubtitle =
    state === "excluded"
      ? i18n.t("settingsExport.excludedMeta", { items })
      : state === "inherited"
        ? selectedWorkspaceIds.includes(workspace.id)
          ? i18n.t("settingsExport.viaWorkspaceMeta", { items })
          : i18n.t("settingsExport.viaParentMeta", { items })
        : items;

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

/**
 * Selection in ink (2026-10-20, the multi-select law): a hollow ring that fills
 * terracotta when chosen. Included by a parent reads as the same dot at the
 * outline weight; excluded from a chosen parent is a struck ring.
 */
export function SelectionMark({ state }: { state: CollectionSelectionState }) {
  const iconName: ComponentProps<typeof Ionicons>["name"] =
    state === "selected" || state === "inherited"
      ? "ellipse"
      : state === "excluded"
        ? "remove-circle-outline"
        : "ellipse-outline";
  const color =
    state === "selected"
      ? colors.primary
      : state === "inherited"
        ? colors.primaryOutline
        : state === "excluded"
          ? colors.textSecondary
          : colors.textMuted;

  return <Ionicons name={iconName} size={16} color={color} />;
}

export { countWorkspaceIdeas };
