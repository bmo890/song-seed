import { useCallback, useState } from "react";
import type { ClipAnalysis } from "../../../types";
import { useStore } from "../../../state/useStore";
import { analyzeClipAudio } from "../../../domain/clipAnalysisRunner";
import { useTranslation } from "react-i18next";

type UseClipAnalysisArgs = {
  playerIdeaId: string | null | undefined;
  playerClipId: string | null | undefined;
  audioUri: string | null | undefined;
};

export function useClipAnalysis({ playerIdeaId, playerClipId, audioUri }: UseClipAnalysisArgs) {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!playerIdeaId || !playerClipId || !audioUri || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result: ClipAnalysis = await analyzeClipAudio(audioUri);
      useStore.getState().setClipAnalysis(playerIdeaId, playerClipId, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("player.analysisUnavailable"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioUri, isAnalyzing, playerClipId, playerIdeaId, t]);

  return { isAnalyzing, error, runAnalysis };
}
