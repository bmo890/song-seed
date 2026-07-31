import {
  ANALYSIS_SCHEMA_VERSION,
  createTempoAnalysis,
  formatBpmLabel,
  hasAnalysisResult,
} from "../domain/clipAnalysis";

describe("clip tempo analysis presentation", () => {
  it("stores a confidence-gated schema-2 tempo result without inventing a key", () => {
    const analysis = createTempoAnalysis({
      bpm: 92,
      confidence: 0.88,
      steadiness: 0.91,
      alternativeBpm: 184,
    });

    expect(analysis.schemaVersion).toBe(ANALYSIS_SCHEMA_VERSION);
    expect(analysis.bpm).toBe(92);
    expect(analysis.bpmConfidence).toBe(0.88);
    expect(analysis.bpmAlternative).toBe(184);
    expect(analysis.key).toBeNull();
    expect(analysis.mode).toBeNull();
    expect(formatBpmLabel(analysis)).toBe("92 BPM");
  });

  it("invalidates schema-1 results because 120 may be the old native fallback", () => {
    const legacy = {
      schemaVersion: 1,
      analyzedAt: 1,
      key: "C",
      mode: "major" as const,
      keyConfidence: 0.9,
      bpm: 120,
      bpmSteadiness: 1,
    };

    expect(hasAnalysisResult(legacy)).toBe(false);
    expect(formatBpmLabel(legacy)).toBe("—");
  });

  it("keeps an inconclusive run as an honest no-result", () => {
    const analysis = createTempoAnalysis({
      bpm: null,
      confidence: 0.31,
      steadiness: 0.2,
      alternativeBpm: null,
    });
    expect(hasAnalysisResult(analysis)).toBe(false);
  });
});
