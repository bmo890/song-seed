import { StyleSheet, View } from "react-native";

/**
 * The span glyph (|—|): a range on the tape, drawn from views so it tints per
 * mark. A section wears its section ink; a clip-editor part its keep or remove
 * ink. One drawing for both rooms.
 */
export function SpanGlyph({ color }: { color: string }) {
  return (
    <View style={s.glyph}>
      <View style={[s.barV, { backgroundColor: color }]} />
      <View style={[s.barH, { backgroundColor: color }]} />
      <View style={[s.barV, { backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  glyph: {
    width: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  barV: {
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  barH: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
});
