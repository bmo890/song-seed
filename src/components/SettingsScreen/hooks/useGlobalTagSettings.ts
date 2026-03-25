import { useState } from "react";
import { Alert } from "react-native";
import { useStore } from "../../../state/useStore";
import { CUSTOM_TAG_COLOR_OPTIONS } from "../../IdeaDetailScreen/songClipControls";

export function useGlobalTagSettings() {
  const globalCustomClipTags = useStore((state) => state.globalCustomClipTags);
  const addGlobalCustomClipTag = useStore((state) => state.addGlobalCustomClipTag);
  const removeGlobalCustomClipTag = useStore((state) => state.removeGlobalCustomClipTag);
  const [newGlobalTagLabel, setNewGlobalTagLabel] = useState("");
  const [newGlobalTagColor, setNewGlobalTagColor] = useState(CUSTOM_TAG_COLOR_OPTIONS[0].bg);

  const addTag = () => {
    const label = newGlobalTagLabel.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, "-");
    if (globalCustomClipTags.some((tag) => tag.key === key)) return;
    addGlobalCustomClipTag({ key, label, color: newGlobalTagColor });
    setNewGlobalTagLabel("");
  };

  const removeTag = (key: string, label: string) => {
    Alert.alert("Remove tag?", `Remove "${label}" from global tags?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeGlobalCustomClipTag(key),
      },
    ]);
  };

  return {
    globalCustomClipTags,
    newGlobalTagLabel,
    setNewGlobalTagLabel,
    newGlobalTagColor,
    setNewGlobalTagColor,
    addTag,
    removeTag,
    canAddTag: newGlobalTagLabel.trim().length > 0,
    colorOptions: CUSTOM_TAG_COLOR_OPTIONS,
  };
}
