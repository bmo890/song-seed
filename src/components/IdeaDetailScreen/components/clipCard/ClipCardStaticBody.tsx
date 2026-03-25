import { type ReactNode } from "react";
import { Text, View, type GestureResponderEvent } from "react-native";
import { styles } from "../../styles";
import { ClipNotesPreview } from "../../../common/clip/ClipNotesPreview";
import { ClipTagBadges } from "../../../common/clip/ClipTagBadges";

type ClipTagPresentation = {
  key: string;
  label: string;
  backgroundColor: string;
  textColor: string;
};

type ClipCardStaticBodyProps = {
  title: string;
  trailing?: ReactNode;
  notes: string;
  disabled?: boolean;
  onPressNotes?: () => void;
  tags: ClipTagPresentation[];
  canEditTags: boolean;
  onPressTags?: (event: GestureResponderEvent) => void;
  createdAtLabel: string;
};

export function ClipCardStaticBody({
  title,
  trailing,
  notes,
  disabled,
  onPressNotes,
  tags,
  canEditTags,
  onPressTags,
  createdAtLabel,
}: ClipCardStaticBodyProps) {
  return (
    <>
      <View style={styles.songDetailVersionTopRow}>
        <View style={styles.songDetailVersionTitleRow}>
          <Text style={styles.songDetailVersionTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>

        <View style={styles.songDetailVersionTrailing}>{trailing}</View>
      </View>

      <ClipNotesPreview
        notes={notes}
        disabled={disabled}
        onPress={disabled ? undefined : onPressNotes}
      />

      <ClipTagBadges
        tags={tags}
        disabled={disabled}
        showAddButton={canEditTags}
        onPress={disabled ? undefined : onPressTags}
      />

      <Text style={styles.songDetailVersionMeta}>{createdAtLabel}</Text>
    </>
  );
}
