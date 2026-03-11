import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Group, Skia } from "@shopify/react-native-skia";
import {
    useSharedValue,
    withSpring,
    useDerivedValue,
} from "react-native-reanimated";
import { DataPoint } from "@siteed/expo-audio-studio";

type Props = {
    dataPoints: DataPoint[];
    currentTimeMs: number;
    intervalMs?: number; // Usually 50
    theme?: {
        waveColor?: string;
        rulerColor?: string;
        playheadColor?: string;
        backgroundColor?: string;
    };
};

export function LiveTapeVisualizer({
    dataPoints,
    currentTimeMs,
    intervalMs = 50,
    theme,
}: Props) {
    const [canvasWidth, setCanvasWidth] = useState(0);
    const [canvasHeight, setCanvasHeight] = useState(0);

    const candleWidth = 2;
    const candleSpace = 1;
    const chunkWidth = candleWidth + candleSpace;
    const pixelsPerSecond = (1000 / intervalMs) * chunkWidth;

    const translateX = useSharedValue(0);

    useEffect(() => {
        if (canvasWidth === 0) return;
        const EXTRA_WIDTH = canvasWidth;
        const playheadX = canvasWidth / 2;
        // We displace the target by EXTRA_WIDTH because we render the recording start at x = EXTRA_WIDTH
        const targetX = playheadX - EXTRA_WIDTH - dataPoints.length * chunkWidth;

        if (dataPoints.length === 0) {
            translateX.value = targetX;
        } else {
            translateX.value = withSpring(targetX, {
                damping: 20,
                stiffness: 90,
                mass: 1,
            });
        }
    }, [dataPoints.length, canvasWidth, chunkWidth]);

    // Skia UI thread translation
    const transform = useDerivedValue(() => {
        return [{ translateX: translateX.value }];
    });

    const { wavePath, rulerPath, centerLinePath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();
        const centerLine = Skia.Path.Make();

        const centerY = canvasHeight > 0 ? canvasHeight / 2 : 70;
        const waveMaxHeight = Math.max(10, centerY - 15);

        const EXTRA_WIDTH = canvasWidth > 0 ? canvasWidth : 1000;
        const startX = EXTRA_WIDTH;

        dataPoints.forEach((p, i) => {
            const x = startX + i * chunkWidth;
            const db = Number.isFinite(p.dB)
                ? p.dB
                : 20 * Math.log10(Math.max(0.00001, p.rms || p.amplitude || 0));

            const noiseFloor = -55;
            const normalized = Math.min(1, Math.max(0, (db - noiseFloor) / Math.abs(noiseFloor)));
            const scale = p.silent
                ? 0.01
                : Math.max(0.015, Math.pow(normalized, 1.35));

            const h = scale * waveMaxHeight;

            wave.moveTo(x, centerY - h);
            wave.lineTo(x, centerY + h);
        });

        const totalSeconds = Math.ceil(dataPoints.length * (intervalMs / 1000)) + 5;
        const negativeSeconds = Math.ceil(EXTRA_WIDTH / pixelsPerSecond);

        for (let s = -negativeSeconds; s <= totalSeconds; s++) {
            const x = startX + s * pixelsPerSecond;
            const isMajor = Math.abs(s) % 5 === 0;

            const tickHeight = isMajor ? 12 : 6;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, tickHeight);

            if (canvasHeight > 0) {
                ruler.moveTo(x, canvasHeight);
                ruler.lineTo(x, canvasHeight - tickHeight);
            }
        }

        centerLine.moveTo(startX - EXTRA_WIDTH, centerY);
        centerLine.lineTo(startX + (totalSeconds * pixelsPerSecond), centerY);

        return { wavePath: wave, rulerPath: ruler, centerLinePath: centerLine };
    }, [dataPoints, chunkWidth, intervalMs, pixelsPerSecond, canvasHeight, canvasWidth]);

    const onLayout = (e: LayoutChangeEvent) => {
        const nextWidth = e.nativeEvent.layout.width;
        const nextHeight = e.nativeEvent.layout.height;
        setCanvasWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        setCanvasHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const waveColor = theme?.waveColor || "#64748b";
    const rulerColor = theme?.rulerColor || "#9ca3af";
    const playheadColor = theme?.playheadColor || "#ef4444";
    const backgroundColor = theme?.backgroundColor || "transparent";

    return (
        <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
            {canvasWidth > 0 && canvasHeight > 0 && (
                <Canvas style={{ flex: 1 }}>
                    <Group transform={transform}>
                        <Path
                            path={centerLinePath}
                            color={rulerColor}
                            style="stroke"
                            strokeWidth={1}
                            opacity={0.3}
                        />
                        <Path
                            path={rulerPath}
                            color={rulerColor}
                            style="stroke"
                            strokeWidth={1.5}
                        />
                        <Path
                            path={wavePath}
                            color={waveColor}
                            style="stroke"
                            strokeWidth={candleWidth}
                        />
                    </Group>
                </Canvas>
            )}

            {/* Static Playhead perfectly centered */}
            {canvasWidth > 0 && (
                <View
                    style={[
                        styles.playhead,
                        { left: canvasWidth / 2, backgroundColor: playheadColor },
                    ]}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
        position: "relative",
    },
    playhead: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        zIndex: 10,
    },
});
