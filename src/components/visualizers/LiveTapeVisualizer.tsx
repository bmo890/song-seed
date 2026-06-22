import React, { useMemo, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { DataPoint } from "@siteed/audio-studio";

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

    const { wavePath, rulerPath, centerLinePath } = useMemo(() => {
        const wave = Skia.Path.Make();
        const ruler = Skia.Path.Make();
        const centerLine = Skia.Path.Make();

        const centerY = canvasHeight > 0 ? canvasHeight / 2 : 70;
        const waveMaxHeight = Math.max(10, centerY - 15);
        const playheadX = canvasWidth > 0 ? canvasWidth / 2 : 0;

        dataPoints.forEach((p) => {
            const pointEndTime = Math.min(p.endTime ?? currentTimeMs, currentTimeMs);
            const x = playheadX - ((currentTimeMs - pointEndTime) / intervalMs) * chunkWidth;
            if (x < -chunkWidth || x > canvasWidth + chunkWidth) {
                return;
            }
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

        const visibleStartMs =
            currentTimeMs - (playheadX / chunkWidth) * intervalMs;
        const visibleEndMs =
            currentTimeMs +
            (Math.max(0, canvasWidth - playheadX) / chunkWidth) * intervalMs;
        const startSecond = Math.floor(Math.max(0, visibleStartMs) / 1000);
        const endSecond = Math.ceil(Math.max(0, visibleEndMs) / 1000);

        for (let second = startSecond; second <= endSecond; second += 1) {
            const tickMs = second * 1000;
            const x = playheadX - ((currentTimeMs - tickMs) / intervalMs) * chunkWidth;
            const isMajor = second % 5 === 0;

            const tickHeight = isMajor ? 12 : 6;
            ruler.moveTo(x, 0);
            ruler.lineTo(x, tickHeight);

            if (canvasHeight > 0) {
                ruler.moveTo(x, canvasHeight);
                ruler.lineTo(x, canvasHeight - tickHeight);
            }
        }

        centerLine.moveTo(0, centerY);
        centerLine.lineTo(canvasWidth, centerY);

        return { wavePath: wave, rulerPath: ruler, centerLinePath: centerLine };
    }, [dataPoints, chunkWidth, intervalMs, canvasHeight, canvasWidth, currentTimeMs]);

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
