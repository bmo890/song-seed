import AVFoundation

/// Measures a clip for the Sound drawer's Auto (2026-11-22). One pass over the audio,
/// folded to mono at 44.1 kHz, reported in 0.4 s windows: the RMS of the whole signal,
/// of the rumble band (below ~60 Hz) and of the hiss band (above ~6 kHz), plus the
/// peak. The app decides what to do with them (src/domain/autoSound.ts); this only
/// measures. Mirrors SongNookSoundAnalysis.kt.
struct SongNookSoundMeter {
  static let windowSeconds = 0.4

  private let windowFrames: Int
  private let subA: Double
  private let highA: Double
  private var sub1 = 0.0, sub2 = 0.0, hiLp1 = 0.0, hiLp2 = 0.0, hpStage1 = 0.0
  private var sumAll = 0.0, sumSub = 0.0, sumHigh = 0.0, framesInWindow = 0
  private(set) var rms: [Double] = []
  private(set) var sub: [Double] = []
  private(set) var high: [Double] = []
  private(set) var peak = 0.0

  init(sampleRate: Double) {
    windowFrames = max(1, Int(sampleRate * Self.windowSeconds))
    subA = exp(-2.0 * Double.pi * 60.0 / sampleRate)
    highA = exp(-2.0 * Double.pi * 6000.0 / sampleRate)
  }

  mutating func feed(_ x: Double) {
    peak = max(peak, abs(x))
    // Rumble: two one-pole low-passes at 60 Hz (12 dB/oct).
    sub1 = (1 - subA) * x + subA * sub1
    sub2 = (1 - subA) * sub1 + subA * sub2
    // Hiss: two one-pole high-passes at 6 kHz (x minus its low-pass, twice).
    hiLp1 = (1 - highA) * x + highA * hiLp1
    let hp1 = x - hiLp1
    hiLp2 = (1 - highA) * hp1 + highA * hiLp2
    hpStage1 = hp1 - hiLp2
    sumAll += x * x
    sumSub += sub2 * sub2
    sumHigh += hpStage1 * hpStage1
    framesInWindow += 1
    if framesInWindow >= windowFrames { closeWindow() }
  }

  mutating func finish() {
    if framesInWindow > 0 { closeWindow() }
  }

  private mutating func closeWindow() {
    let n = Double(framesInWindow)
    rms.append((sumAll / n).squareRoot())
    sub.append((sumSub / n).squareRoot())
    high.append((sumHigh / n).squareRoot())
    sumAll = 0; sumSub = 0; sumHigh = 0; framesInWindow = 0
  }

  var result: [String: Any] {
    ["windowMs": Self.windowSeconds * 1000, "rms": rms, "sub": sub, "high": high, "peak": peak]
  }
}

extension SongNookPitchShiftRenderer {
  func analyzeSound(_ request: [String: Any]) throws -> [String: Any] {
    guard let inputUri = request["inputUri"] as? String else {
      throw NSError(domain: "SongNookPitchShift", code: 41, userInfo: [NSLocalizedDescriptionKey: "Sound analysis requires inputUri."])
    }
    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)
    let asset = AVURLAsset(url: inputURL)
    guard let track = asset.tracks(withMediaType: .audio).first else {
      throw NSError(domain: "SongNookPitchShift", code: 42, userInfo: [NSLocalizedDescriptionKey: "No audio track found."])
    }
    let sampleRate = 44_100.0
    let reader = try AVAssetReader(asset: asset)
    // The reader folds every channel to one and resamples, so the filters see one rate.
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsNonInterleaved: false,
      AVNumberOfChannelsKey: 1,
      AVSampleRateKey: sampleRate,
    ])
    output.alwaysCopiesSampleData = false
    reader.add(output)
    reader.startReading()

    var meter = SongNookSoundMeter(sampleRate: sampleRate)
    while reader.status == .reading, let sampleBuffer = output.copyNextSampleBuffer() {
      if let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) {
        var length = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(
          blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer
        )
        if let dataPointer, length > 1 {
          let count = length / 2
          dataPointer.withMemoryRebound(to: Int16.self, capacity: count) { samples in
            for i in 0..<count { meter.feed(Double(samples[i]) / 32768.0) }
          }
        }
      }
      CMSampleBufferInvalidate(sampleBuffer)
    }
    if reader.status == .failed {
      throw reader.error
        ?? NSError(domain: "SongNookPitchShift", code: 43, userInfo: [NSLocalizedDescriptionKey: "Sound analysis failed."])
    }
    meter.finish()
    return meter.result
  }
}
