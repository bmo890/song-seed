import { useCallback, useState } from "react";
import type { ClipAnalysis } from "../../../types";
import { useStore } from "../../../state/useStore";
import { analyzeClipAudio } from "../../../domain/clipAnalysisRunner";
import { useTranslation } from "react-i18next";

type UseClipAnalysisArgs = {
  playerIdeaId: string | null | undefined;
  playerClipId: string | null | undefined;
  audioUri: string | null | undefined;
  durationMs: number;
};

export function useClipAnalysis({ playerIdeaId, playerClipId, audioUri, durationMs }: UseClipAnalysisArgs) {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!playerIdeaId || !playerClipId || !audioUri || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result: ClipAnalysis = await analyzeClipAudio(audioUri, durationMs);
      useStore.getState().setClipAnalysis(playerIdeaId, playerClipId, result);
      if (result.bpm == null) {
        setError(t("player.tempoInconclusive"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("player.analysisUnavailable"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioUri, durationMs, isAnalyzing, playerClipId, playerIdeaId, t]);

  return { isAnalyzing, error, runAnalysis };
}
