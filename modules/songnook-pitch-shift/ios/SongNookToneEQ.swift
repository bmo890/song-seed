import AVFoundation
import AudioToolbox

/// The take's tone, as one EQ node: six bands, each bypassed unless its flag is
/// on. Shared by the practice engine (live) and the renderer (the mix bake), so a
/// key in the Sound room and a bake of the mix sound the same.
///
/// Tone is a set of flags joined by "+" ("low-cut+mid-boost"); legacy single values
/// parse the same. Band parameters mirror the Android processors:
///   low-cut   = high-pass 140 Hz
///   low-boost = low shelf +4 dB at 120 Hz
///   mid-boost = peak +4 dB at 1.8 kHz
///   hi-cut    = low-pass 7.2 kHz
///   hi-boost  = high shelf +4 dB at 8 kHz (2026-11-22)
///   mid-cut   = peak -4 dB at 600 Hz, wide (2026-11-23): the boxy middle of a room
/// The time-pitch unit's quality (2026-10-21). `overlap` is how many grains
/// overlap per output sample, 3…32, default 8: more means fewer of the
/// scratchy artifacts a shift adds, for more CPU. One stereo stream at 24 is
/// cheap on any phone that runs the app. Shared by the live engine and the
/// bake so a shift sounds the same in both.
enum SongNookTimePitch {
  static let overlap: Float = 24
}

enum SongNookToneEQ {
  static let bandCount = 6

  /// What a mono source loses entering an AVAudioMixerNode: the mixer pans it to the
  /// centre at equal power, 3.01 dB down in each channel (and in a mono output too).
  /// Plain playback has no such loss, so a mono take dropped 3 dB the moment the engine
  /// took over (a tone key pressed mid-song), and every bake of one came out 3 dB under
  /// its source. Measured 2026-11-23: mono -3.14 dB, stereo -0.13 dB through the live
  /// chain. The chains that pass a mono source through a mixer add this back.
  static let monoMixerMakeupDb: Double = 3.0103

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

    let hiBoost = eqNode.bands[4]
    hiBoost.filterType = .highShelf
    hiBoost.frequency = 8000
    hiBoost.bandwidth = 0.8
    hiBoost.gain = 4
    hiBoost.bypass = !flags.contains("hi-boost")

    let midCut = eqNode.bands[5]
    midCut.filterType = .parametric
    midCut.frequency = 600
    midCut.bandwidth = 1.5
    midCut.gain = -4
    midCut.bypass = !flags.contains("mid-cut")
  }

  /// Even (2026-11-22): gentle compression after the tone keys and before the limiter,
  /// so a rehearsal's drums and a voice sit closer. Apple's dynamics processor, fitted to
  /// Android's SoundChainAudioProcessor (see the parameters below): 10 ms attack,
  /// 200 ms release, no expansion.
  /// Bypassed unless the "even" flag is on.
  static func makeEvenNode() -> AVAudioUnitEffect {
    var description = AudioComponentDescription()
    description.componentType = kAudioUnitType_Effect
    description.componentSubType = kAudioUnitSubType_DynamicsProcessor
    description.componentManufacturer = kAudioUnitManufacturer_Apple
    description.componentFlags = 0
    description.componentFlagsMask = 0
    let node = AVAudioUnitEffect(audioComponentDescription: description)
    let unit = node.audioUnit
    let global = kAudioUnitScope_Global
    // Apple's unit has no ratio or knee, only a threshold and a "head room", so its
    // curve was fitted to Android's (threshold -26 dBFS, 3:1, 6 dB knee, +5 dB) by
    // measurement (2026-11-23): these three land within 0.7 dB of it from -40 to -1 dBFS.
    // The first guess (-26 / 12 / +5) ran up to 3.4 dB louder in the middle.
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_Threshold, global, 0, -37, 0)
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_HeadRoom, global, 0, 25, 0)
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_ExpansionRatio, global, 0, 1, 0)
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_AttackTime, global, 0, 0.010, 0)
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_ReleaseTime, global, 0, 0.200, 0)
    AudioUnitSetParameter(unit, kDynamicsProcessorParam_OverallGain, global, 0, 5.3, 0)
    node.bypass = true
    return node
  }

  static func configureEven(_ node: AVAudioUnitEffect, tonePreset: String) {
    node.bypass = !tonePreset.split(separator: "+").contains("even")
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
