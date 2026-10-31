import AVFoundation

/// The play-along click on iOS, inside the song's own stream (2026-10-31, "one clock").
///
/// The click is a second player node on one submix with the song's player, BEFORE the
/// time-pitch unit. The submix pulls both frame for frame, so a click scheduled N file
/// frames after the song's start frame plays exactly N frames into the song, at any
/// speed, through every seek; nothing downstream (time-pitch, tone, limiter, the route)
/// can put them apart. Both players start at the same host time.
///
/// The cost of sharing the song's path: the click is pitched, stretched and toned with
/// it. Its voice is rendered pre-compensated (frequency down by the shift, length times
/// the speed, level against the take's gain) so it comes out as the click you recorded
/// with. Positions are content (file) milliseconds, the grid's own unit, as on Android.

struct PlayAlongClickSegment {
  let startMs: Double
  let pulseMs: Double
  let pulsesPerBar: Int
  let accents: [Double]
  let endMs: Double
}

final class PlayAlongClickPlan {
  /// The file this grid belongs to: another file loaded in the engine never clicks.
  let sourceUri: String?
  let segments: [PlayAlongClickSegment]
  /// The grid is not trusted from here on: no click at or past it.
  let stopAtMs: Double
  let volume: Double
  let voice: String
  /// Buzz with each click at this strength (0..1); nil = no buzz.
  let hapticStrength: Double?
  /// Haptic command → felt tap, ms: the tap is sent this early so it lands with the click.
  let hapticLatencyMs: Double

  init(
    sourceUri: String?,
    segments: [PlayAlongClickSegment],
    stopAtMs: Double,
    volume: Double,
    voice: String,
    hapticStrength: Double?,
    hapticLatencyMs: Double
  ) {
    self.sourceUri = sourceUri
    self.segments = segments
    self.stopAtMs = stopAtMs
    self.volume = volume
    self.voice = voice
    self.hapticStrength = hapticStrength
    self.hapticLatencyMs = hapticLatencyMs
  }

  /// Same beats in the same voice: a volume or buzz change needs no new click track.
  func soundsLike(_ other: PlayAlongClickPlan?) -> Bool {
    guard let other, other.sourceUri == sourceUri, other.stopAtMs == stopAtMs,
          other.voice == voice, other.segments.count == segments.count else {
      return false
    }
    for (a, b) in zip(segments, other.segments) {
      if a.startMs != b.startMs || a.pulseMs != b.pulseMs || a.pulsesPerBar != b.pulsesPerBar ||
        a.endMs != b.endMs || a.accents != b.accents {
        return false
      }
    }
    return true
  }

  static func from(_ raw: [String: Any]) -> PlayAlongClickPlan? {
    guard let rawSegments = raw["segments"] as? [[String: Any]] else { return nil }
    func number(_ value: Any?) -> Double? {
      if let value = value as? Double { return value }
      if let value = value as? Int { return Double(value) }
      if let value = value as? NSNumber { return value.doubleValue }
      return nil
    }
    let parsed: [(Double, Double, Int, [Double])] = rawSegments.compactMap { segment in
      guard let startMs = number(segment["startMs"]), startMs.isFinite,
            let pulseMs = number(segment["pulseMs"]), pulseMs > 1,
            let pulsesPerBar = number(segment["pulsesPerBar"]).map({ Int($0) }), pulsesPerBar > 0,
            let accents = (segment["accentPattern"] as? [Any])?.map({ number($0) ?? 0 }), !accents.isEmpty
      else { return nil }
      return (startMs, pulseMs, pulsesPerBar, accents)
    }.sorted { $0.0 < $1.0 }
    guard !parsed.isEmpty else { return nil }
    let segments = parsed.enumerated().map { index, entry in
      PlayAlongClickSegment(
        startMs: entry.0,
        pulseMs: entry.1,
        pulsesPerBar: entry.2,
        accents: entry.3,
        endMs: index + 1 < parsed.count ? parsed[index + 1].0 : .infinity
      )
    }
    return PlayAlongClickPlan(
      sourceUri: raw["sourceUri"] as? String,
      segments: segments,
      stopAtMs: number(raw["stopAtMs"]) ?? .infinity,
      volume: min(1, max(0, number(raw["volume"]) ?? 0.5)),
      voice: raw["clickVoice"] as? String ?? "click",
      hapticStrength: number(raw["hapticStrength"]).map { min(1, max(0, $0)) },
      hapticLatencyMs: min(200, max(0, number(raw["hapticLatencyMs"]) ?? 35))
    )
  }
}

struct PlayAlongBeat {
  let atMs: Double
  let isDownbeat: Bool
  let accent: Double
}

/// Walks a plan's beats in time order from any content position. Rests (accent 0) are
/// skipped; nothing at or past `stopAtMs`.
final class PlayAlongBeatCursor {
  private let plan: PlayAlongClickPlan
  private var segmentIndex = 0
  private var pulse = 0

  init(plan: PlayAlongClickPlan, fromMs: Double) {
    self.plan = plan
    while segmentIndex < plan.segments.count - 1 && plan.segments[segmentIndex].endMs <= fromMs {
      segmentIndex += 1
    }
    let segment = plan.segments[segmentIndex]
    // Half a microsecond of slack: a seek that lands exactly on a beat still clicks it.
    pulse = max(0, Int(ceil((fromMs - segment.startMs - 0.0005) / segment.pulseMs)))
  }

  func next() -> PlayAlongBeat? {
    while segmentIndex < plan.segments.count {
      let segment = plan.segments[segmentIndex]
      let atMs = segment.startMs + Double(pulse) * segment.pulseMs
      if atMs >= segment.endMs - 0.0005 {
        segmentIndex += 1
        pulse = 0
        continue
      }
      if atMs >= plan.stopAtMs { return nil }
      let inBar = pulse % segment.pulsesPerBar
      pulse += 1
      let accent = segment.accents[min(inBar, segment.accents.count - 1)]
      if accent <= 0 { continue }
      return PlayAlongBeat(atMs: atMs, isDownbeat: inBar == 0, accent: accent)
    }
    return nil
  }
}

/// One click timbre. Mirrors the metronome engine's table (and the Android and JS
/// copies): the click you play along with is the click you recorded with.
struct PlayAlongClickVoice {
  let baseFrequency: Double
  let overtoneFrequency: Double
  let decayPower: Double
  let mixBase: Double
  let mixOvertone: Double
  let durationSec: Double
  let attackSec: Double
  let amplitudeBase: Double
  let amplitudeScale: Double

  static func resolve(voice: String, isDownbeat: Bool) -> PlayAlongClickVoice {
    if voice == "wood" {
      return isDownbeat
        ? PlayAlongClickVoice(baseFrequency: 1180, overtoneFrequency: 1770, decayPower: 3.2, mixBase: 0.70, mixOvertone: 0.30, durationSec: 0.046, attackSec: 0.0015, amplitudeBase: 0.26, amplitudeScale: 0.50)
        : PlayAlongClickVoice(baseFrequency: 880, overtoneFrequency: 1320, decayPower: 2.9, mixBase: 0.70, mixOvertone: 0.30, durationSec: 0.046, attackSec: 0.0015, amplitudeBase: 0.26, amplitudeScale: 0.50)
    }
    return isDownbeat
      ? PlayAlongClickVoice(baseFrequency: 1960, overtoneFrequency: 2940, decayPower: 2.8, mixBase: 0.78, mixOvertone: 0.22, durationSec: 0.034, attackSec: 0.003, amplitudeBase: 0.22, amplitudeScale: 0.46)
      : PlayAlongClickVoice(baseFrequency: 1560, overtoneFrequency: 2350, decayPower: 2.4, mixBase: 0.78, mixOvertone: 0.22, durationSec: 0.034, attackSec: 0.003, amplitudeBase: 0.22, amplitudeScale: 0.46)
  }

  /// The click at unit amplitude, in FILE frames, pre-compensated for the time-pitch
  /// unit it passes through: `pitchScale` divides its frequencies, and its length is
  /// times `speed` so it plays back at its own.
  func render(sampleRate: Double, pitchScale: Double, speed: Double) -> [Float] {
    let frames = max(1, Int((sampleRate * durationSec * speed).rounded()))
    let attackFrames = max(1, Int((sampleRate * attackSec * speed).rounded()))
    // Time-pitch keeps pitch through a speed change; only the shift needs undoing.
    let base = baseFrequency / pitchScale
    let overtone = overtoneFrequency / pitchScale
    return (0..<frames).map { index in
      let time = Double(index) / sampleRate
      let attack = min(1.0, Double(index) / Double(attackFrames))
      let decay = pow(1.0 - Double(index) / Double(frames), decayPower)
      return Float((sin(2 * .pi * base * time) * mixBase + sin(2 * .pi * overtone * time) * mixOvertone) * attack * decay)
    }
  }
}

/// The click track, cut into buffers that follow the song frame for frame from the
/// content position it starts at. Each buffer is rendered as it is queued, so a speed,
/// pitch or level change reaches the voice within the few buffers already queued.
final class PlayAlongClickTrack {
  private let plan: PlayAlongClickPlan
  private let format: AVAudioFormat
  private let fromMs: Double
  private let cursor: PlayAlongBeatCursor
  private var pending: PlayAlongBeat?
  /// File frames since `fromMs` of the next buffer's first frame.
  private var nextFrame: Int64 = 0
  /// Clicks still sounding into the next buffer: their samples and where they began.
  private var ringing: [(wave: [Float], gain: Float, startFrame: Int64)] = []
  private var waves: [String: [Float]] = [:]
  private(set) var clicksQueued = 0

  init(plan: PlayAlongClickPlan, format: AVAudioFormat, fromMs: Double) {
    self.plan = plan
    self.format = format
    self.fromMs = fromMs
    self.cursor = PlayAlongBeatCursor(plan: plan, fromMs: fromMs)
  }

  /// The next `frames` of click track. `speed`, `semitones` and `gainDb` are the
  /// transport's now: the voice is rendered to survive them.
  func nextBuffer(frames: Int, speed: Double, semitones: Int, gainDb: Double) -> AVAudioPCMBuffer? {
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)),
          let channel = buffer.floatChannelData?[0] else { return nil }
    buffer.frameLength = AVAudioFrameCount(frames)
    for index in 0..<frames { channel[index] = 0 }
    let sampleRate = format.sampleRate
    let start = nextFrame
    let end = start + Int64(frames)
    let pitchScale = pow(2.0, Double(semitones) / 12.0)
    // The take's level would lift or sink the click with it; take it back off.
    let levelBack = pow(10.0, -gainDb / 20.0)

    while true {
      guard let beat = pending ?? cursor.next() else { break }
      let onset = Int64(((beat.atMs - fromMs) * sampleRate / 1000.0).rounded())
      if onset >= end {
        pending = beat
        break
      }
      pending = nil
      let voice = PlayAlongClickVoice.resolve(voice: plan.voice, isDownbeat: beat.isDownbeat)
      let key = "\(beat.isDownbeat)-\(Int(speed * 1000))-\(semitones)"
      let wave = waves[key] ?? voice.render(sampleRate: sampleRate, pitchScale: pitchScale, speed: speed)
      waves[key] = wave
      // The plan's volume is the click player's own (live); the level comes back here.
      let amplitude = (voice.amplitudeBase + beat.accent * voice.amplitudeScale) * levelBack
      ringing.append((wave: wave, gain: Float(amplitude), startFrame: max(start, onset)))
      clicksQueued += 1
    }

    var stillRinging: [(wave: [Float], gain: Float, startFrame: Int64)] = []
    for click in ringing {
      let from = Int(max(0, start - click.startFrame))
      let into = Int(max(0, click.startFrame - start))
      let count = min(click.wave.count - from, frames - into)
      if count > 0 {
        for index in 0..<count {
          channel[into + index] = max(-1, min(1, channel[into + index] + click.wave[from + index] * click.gain))
        }
      }
      if from + count < click.wave.count { stillRinging.append(click) }
    }
    ringing = stillRinging
    nextFrame = end
    return buffer
  }
}

/// The play-along tap on iOS: sent ahead of the beat by the haptic engine's own lag,
/// at the wall time the song's position says the beat will be heard. Pure: the caller
/// owns the clock (mirrors Android's PlayAlongHapticPlanner).
final class PlayAlongHapticPlanner {
  private let lookaheadMs: Double
  private var plan: PlayAlongClickPlan?
  private var cursor: PlayAlongBeatCursor?
  private var pending: PlayAlongBeat?
  private var lastHeardMs = Double.nan

  init(lookaheadMs: Double = 150) {
    self.lookaheadMs = lookaheadMs
  }

  func reset() {
    plan = nil
    cursor = nil
    pending = nil
    lastHeardMs = .nan
  }

  /// Taps to send now, as wall ms from now (≥ 0), for a song heard at `heardMs`.
  func due(heardMs: Double, speed: Double, plan nextPlan: PlayAlongClickPlan?) -> [Double] {
    guard let nextPlan, nextPlan.hapticStrength != nil, speed > 0, heardMs.isFinite else {
      reset()
      return []
    }
    let leadContentMs = nextPlan.hapticLatencyMs * speed
    let jumped = lastHeardMs.isNaN || heardMs < lastHeardMs - 20 || heardMs > lastHeardMs + lookaheadMs * speed
    if jumped || !nextPlan.soundsLike(plan) {
      cursor = PlayAlongBeatCursor(plan: nextPlan, fromMs: heardMs + leadContentMs)
      pending = nil
    }
    plan = nextPlan
    lastHeardMs = heardMs
    guard let walk = cursor else { return [] }
    let horizonMs = heardMs + leadContentMs + lookaheadMs * speed
    var out: [Double] = []
    while let beat = pending ?? walk.next() {
      if beat.atMs > horizonMs {
        pending = beat
        break
      }
      pending = nil
      let sendInMs = (beat.atMs - heardMs) / speed - nextPlan.hapticLatencyMs
      if sendInMs >= -8 { out.append(max(0, sendInMs)) }
    }
    return out
  }
}
