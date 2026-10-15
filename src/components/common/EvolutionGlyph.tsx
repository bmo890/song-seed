import Svg, { Path, Rect } from "react-native-svg";

/**
 * The Evolution glyph (2026-10-15): a card with two paper edges beneath it,
 * the same picture a take with versions makes in the list (`IdeaCard
 * stacked`). It names the sketch page's Evolution view and the Timeline
 * card's way back to it. Drawn here because no stock glyph says it: layers
 * already mean overdubs, a branch is git, two sheets read as "copy".
 */
export function EvolutionGlyph({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={10} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M6.5 17.5h11M9 20.5h6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
