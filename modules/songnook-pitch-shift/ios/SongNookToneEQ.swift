import AVFoundation
import AudioToolbox

/// The take's tone, as one EQ node: four bands, each bypassed unless its flag is
/// on. Shared by the practice engine (live) and the renderer (the mix bake), so a
/// key in the Sound room and a bake of the mix sound the same.
///
/// Tone is a set of flags joined by "+" ("low-cut+mid-boost"); legacy single values
/// parse the same. Band parameters mirror the Android processors:
///   low-cut   = high-pass 140 Hz
///   low-boost = low shelf +4 dB at 120 Hz
///   mid-boost = peak +4 dB at 1.8 kHz
///   hi-cut    = low-pass 7.2 kHz
enum SongNookToneEQ {
  static let bandCount = 4

  static func makeNode() -> AVAudioUnitEQ {
    let node = AVAudioUnitEQ(numberOfBands: bandCount)
    configure(node, tonePreset: "neutral")
    return node
  }

  static func configure(_ eqNode: AVAudioUnitEQ, tonePreset: String) {
    let flags = Set(tonePreset.split(separator: "+").map(String.init))
    guard eqNode.bands.count >= bandCount else { return }

    let lowCut = eqNode.bands[0]
    lowCut.filterType = .highPass
    lowCut.frequency = 140
    lowCut.bandwidth = 0.8
    lowCut.gain = 0
    lowCut.bypass = !flags.contains("low-cut")

    let lowBoost = eqNode.bands[1]
    lowBoost.filterType = .lowShelf
    lowBoost.frequency = 120
    lowBoost.bandwidth = 0.8
    lowBoost.gain = 4
    lowBoost.bypass = !flags.contains("low-boost")

    let hiCut = eqNode.bands[2]
    hiCut.filterType = .lowPass
    hiCut.frequency = 7200
    hiCut.bandwidth = 0.8
    hiCut.gain = 0
    hiCut.bypass = !flags.contains("hi-cut")

    let midBoost = eqNode.bands[3]
    midBoost.filterType = .parametric
    midBoost.frequency = 1800
    midBoost.bandwidth = 1.0
    midBoost.gain = 4
    midBoost.bypass = !flags.contains("mid-boost")
  }

  /// A peak limiter after the level lift, so +12 dB never crackles. Apple's own
  /// limiter unit: default attack/release, threshold just under full scale.
  static func makeLimiterNode() -> AVAudioUnitEffect {
    var description = AudioComponentDescription()
    description.componentType = kAudioUnitType_Effect
    description.componentSubType = kAudioUnitSubType_PeakLimiter
    description.componentManufacturer = kAudioUnitManufacturer_Apple
    description.componentFlags = 0
    description.componentFlagsMask = 0
    // Default pre-gain (0 dB): the EQ's global gain carries the lift; this only catches peaks.
    return AVAudioUnitEffect(audioComponentDescription: description)
  }
}
