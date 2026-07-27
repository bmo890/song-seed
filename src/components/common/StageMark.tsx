import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { styles } from "../../styles";
import { colors } from "../../design/tokens";

/** Canonical warm ink per stage — the single source for stage accent color
 *  (mark, filter chip, header ink, edit-sheet radio). Reuse this instead of
 *  cold literals. One hue gaining saturation as the work progresses. */
export const STAGE_INK: Record<string, string> = {
    seed: colors.textMuted,
    sprout: colors.stageMid,
    stem: colors.stageLate,
    song: colors.primaryDeep,
    clip: colors.textSecondary,
};

/** How full the dial reads at each stage. A single dot could only say "a stage";
 *  the wedge says WHICH stage without being read. */
const STAGE_FILL: Record<string, number> = {
    seed: 0.25,
    sprout: 0.5,
    stem: 0.75,
    song: 1,
    clip: 0,
};

/**
 * The stage dial — a hollow ring filled clockwise in proportion to progress.
 * Glyph-only; pair it with `StageInk` when the word is affordable.
 */
export function StageMark({ status, size = 11 }: { status: string; size?: number }) {
    const ink = STAGE_INK[status] ?? STAGE_INK.clip;
    const fill = STAGE_FILL[status] ?? 0;
    const c = size / 2;
    const r = size / 2 - 1.4;

    let wedge = null;
    if (fill >= 1) {
        wedge = <Circle cx={c} cy={c} r={r} fill={ink} />;
    } else if (fill > 0) {
        const a = 2 * Math.PI * fill;
        const x = c + r * Math.sin(a);
        const y = c - r * Math.cos(a);
        const large = fill > 0.5 ? 1 : 0;
        wedge = (
            <Path d={`M${c},${c} L${c},${c - r} A${r},${r} 0 ${large} 1 ${x},${y} Z`} fill={ink} />
        );
    }

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle cx={c} cy={c} r={r} fill="none" stroke={ink} strokeWidth={1.1} opacity={0.55} />
            {wedge}
        </Svg>
    );
}

/**
 * Stage as editorial ink — dial + word, one color, matching the PRIMARY mark's
 * form so the title row speaks one language.
 *
 * Title-row truncation law: the dial never shrinks, the word truncates only
 * after the title has hit its floor. See `ideasListCardTitle.minWidth`.
 */
export function StageInk({ status }: { status: string }) {
    const { t } = useTranslation();
    const ink = STAGE_INK[status] ?? STAGE_INK.clip;
    return (
        <View style={styles.stageInk}>
            <StageMark status={status} />
            <Text style={[styles.stageInkText, { color: ink }]} numberOfLines={1}>
                {t(`stages.${status}`)}
            </Text>
        </View>
    );
}
