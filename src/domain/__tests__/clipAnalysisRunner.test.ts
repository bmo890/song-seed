import { extractAudioData } from "@siteed/audio-studio";
import { analyzeClipAudio } from "../clipAnalysisRunner";
import { TEMPO_ANALYSIS_SAMPLE_RATE } from "../tempoDetection";

jest.mock("@siteed/audio-studio", () => ({
  extractAudioData: jest.fn(),
}));

const mockedExtractAudioData = extractAudioData as jest.MockedFunction<typeof extractAudioData>;

function clickTrack(bpm: number, durationSeconds: number): Float32Array {
  const samples = new Float32Array(TEMPO_ANALYSIS_SAMPLE_RATE * durationSeconds);
  const beatFrames = (TEMPO_ANALYSIS_SAMPLE_RATE * 60) / bpm;
  for (let beat = 0; ; beat += 1) {
    const start = Math.round(beat * beatFrames);
    if (start >= samples.length) break;
    for (let offset = 0; offset < 160 && start + offset < samples.length; offset += 1) {
      samples[start + offset] =
        Math.sin((2 * Math.PI * 1_200 * offset) / TEMPO_ANALYSIS_SAMPLE_RATE) *
        Math.exp(-offset / 45);
    }
  }
  return samples;
}

describe("analyzeClipAudio", () => {
  beforeEach(() => mockedExtractAudioData.mockReset());

  it("uses the converted sample count instead of audio-studio's stale source-rate metadata", async () => {
    mockedExtractAudioData.mockResolvedValue({
      normalizedData: clickTrack(92, 12),
      sampleRate: 48_000,
    });

    const result = await analyzeClipAudio("file:///clip.m4a", 12_050);

    expect(result.bpm).toBe(92);
    expect(result.schemaVersion).toBe(2);
    expect(mockedExtractAudioData).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimeMs: 0,
        endTimeMs: 12_000,
        includeNormalizedData: true,
        decodingOptions: expect.objectContaining({
          targetSampleRate: TEMPO_ANALYSIS_SAMPLE_RATE,
          targetChannels: 1,
        }),
      })
    );
  });

  it("does not decode clips that are too short to support a tempo estimate", async () => {
    const result = await analyzeClipAudio("file:///short.m4a", 2_000);
    expect(result.bpm).toBeNull();
    expect(mockedExtractAudioData).not.toHaveBeenCalled();
  });
});
