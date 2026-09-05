import AVFoundation
import UIKit

private struct MetronomeConfig {
  var bpm: Int = 92
  var meterId: String = "4/4"
  var pulsesPerBar: Int = 4
  var denominator: Int = 4
  var accentPattern: [Double] = [1.0, 0.46, 0.72, 0.46]
  var clickEnabled: Bool = true
  var clickVolume: Double = 0.5
  /// Output latency (ms) of the active route. Delays only the visual beat so it lands with
  /// the audible click (e.g. Bluetooth lag). 0 = immediate / no compensation.
  var outputLatencyMs: Int = 0
  /// Native scheduled haptics: fired from the engine (no bridge at fire time), offset by
  /// `hapticOffsetMs` relative to the render-domain beat so the tap LANDS with the audible
  /// click (signed: route latency − motor spin-up; may be negative on fast routes).
  var hapticEnabled: Bool = false
  var hapticStrength: Double = 0.6
  var hapticOffsetMs: Int = 0
  /// Audio-only ornament: each pulse is split into `subdivision` equal parts and the extra
  /// onsets sound as quiet weak-voice sub-clicks. Beat events, the grid anchor, count-in
  /// math and haptics never see them — they are pure PCM.
  var subdivision: Int = 1
  /// Click timbre: "click" (bright stock voice) or "wood" (softer wood-block voice).
  var clickVoice: String = "click"
}

/// One click timbre. The same table lives in the Android engine and the JS WAV fallback —
/// keep the three verbatim so every surface sounds identical.
private struct ClickVoiceSpec {
  let baseFrequency: Double
  let overtoneFrequency: Double
  let decayPower: Double
  let mixBase: Double
  let mixOvertone: Double
  let durationSec: Double
  let attackSec: Double
  let amplitudeBase: Double
  let amplitudeScale: Double

  func amplitude(forAccent accent: Double) -> Double {
    return amplitudeBase + accent * amplitudeScale
  }

  static func resolve(voice: String, isDownbeat: Bool) -> ClickVoiceSpec {
    if voice == "wood" {
      return isDownbeat
        ? ClickVoiceSpec(baseFrequency: 1180, overtoneFrequency: 1770, decayPower: 3.2, mixBase: 0.70, mixOvertone: 0.30, durationSec: 0.046, attackSec: 0.0015, amplitudeBase: 0.26, amplitudeScale: 0.50)
        : ClickVoiceSpec(baseFrequency: 880, overtoneFrequency: 1320, decayPower: 2.9, mixBase: 0.70, mixOvertone: 0.30, durationSec: 0.046, attackSec: 0.0015, amplitudeBase: 0.26, amplitudeScale: 0.50)
    }
    return isDownbeat
      ? ClickVoiceSpec(baseFrequency: 1960, overtoneFrequency: 2940, decayPower: 2.8, mixBase: 0.78, mixOvertone: 0.22, durationSec: 0.034, attackSec: 0.003, amplitudeBase: 0.22, amplitudeScale: 0.46)
      : ClickVoiceSpec(baseFrequency: 1560, overtoneFrequency: 2350, decayPower: 2.4, mixBase: 0.78, mixOvertone: 0.22, durationSec: 0.034, attackSec: 0.003, amplitudeBase: 0.22, amplitudeScale: 0.46)
  }
}

/// Weight of every sub-click: quiet and present, well under a weak beat.
private let subClickAccent = 0.18

/// One constant-tempo stretch of a tempo map, precomputed in grid frames.
/// Grid zero = the downbeat of bar 1; count-in pulses live at negative grid frames.
private struct MapSegment {
  let atBar: Int
  let bpm: Int
  let pulsesPerBar: Int
  let accentPattern: [Double]
  /// Grid pulse index of this segment's first downbeat (bar 1 → 0).
  let startGridPulse: Int
  /// Grid frame of that downbeat (cumulative over prior segments).
  let startFrame: Double
  let exactFramesPerPulse: Double
}

final class SongNookMetronomeEngine {
  private let sampleRate: Double = 44_100
  private let pollIntervalMs: Double = 0.008

  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let queue = DispatchQueue(label: "SongNookMetronomeEngine")

  private var config = MetronomeConfig()
  private var loopBuffer: AVAudioPCMBuffer?
  private var pollTimer: DispatchSourceTimer?

  private var isRunning = false
  private var isCountIn = false
  private var countInPulsesRemaining = 0
  private var beatInBar = 1
  private var barNumber = 1
  private var absolutePulse = 0
  private var lastEmittedPulse = -1
  private var framesPerPulse = 0
  private var exactFramesPerPulse: Double = 1
  private var totalFrames = 0
  private var lastFrameWithinLoop = 0
  private var loopCount = 0
  private var startUptimeMs: Double = 0
  /// Frames into the bar loop at which playback began (startAtPhase). The player's
  /// sampleTime always counts from 0, so every loop-position read adds this offset.
  private var phaseOffsetFrames = 0

  // ── Tempo-map mode (scheduled clicks) ─────────────────────────────────────
  // When `mapSegments` is set, the engine stops looping a bar buffer and instead
  // schedules each click at its exact sample time along the map — tempo/meter
  // changes land seamlessly at their bar lines, no restart, no phase reset.
  private var mapSegments: [MapSegment]? = nil
  /// Grid frame at which THIS RUN began (count-in start → negative; phase start → the
  /// requested offset). Player sampleTime S is at grid frame runStartGridFrame + S.
  private var runStartGridFrame: Double = 0
  /// Grid pulse index of run pulse 0 (the first pulse this run sounds).
  private var firstRunGridPulse = 0
  /// Next run pulse the scheduler has yet to hand to the player.
  private var scheduledUntilRunPulse = 0
  /// Pre-rendered click voices keyed by (downbeat?, accent) — tiny, reused every bar.
  private var clickCache: [String: AVAudioPCMBuffer] = [:]

  private let onBeat: ([String: Any]) -> Void
  private let onStateChange: ([String: Any]) -> Void
  private let onCountInComplete: ([String: Any]) -> Void
  private let onError: (String) -> Void

  init(
    onBeat: @escaping ([String: Any]) -> Void,
    onStateChange: @escaping ([String: Any]) -> Void,
    onCountInComplete: @escaping ([String: Any]) -> Void,
    onError: @escaping (String) -> Void
  ) {
    self.onBeat = onBeat
    self.onStateChange = onStateChange
    self.onCountInComplete = onCountInComplete
    self.onError = onError

    engine.attach(player)
    let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
    engine.connect(player, to: engine.mainMixerNode, format: format)
    updateDerivedValues()
  }

  func configure(_ rawConfig: [String: Any]) -> [String: Any] {
    let wasRunning = isRunning
    let pendingCountInBars = isCountIn && countInPulsesRemaining > 0
      ? Int(ceil(Double(countInPulsesRemaining) / Double(max(config.pulsesPerBar, 1))))
      : 0

    let previous = config
    config = parseConfig(rawConfig)

    // Live params (volume) must never restart a running engine — a restart resets the
    // beat phase, which is audible and breaks grid continuity mid-take. Only structural
    // changes (tempo, meter, accent shape, click on/off) rebuild and rephase.
    // Haptic params are live too: scheduling reads the current config on every beat.
    let structuralChange =
      previous.bpm != config.bpm ||
      previous.meterId != config.meterId ||
      previous.pulsesPerBar != config.pulsesPerBar ||
      previous.denominator != config.denominator ||
      previous.accentPattern != config.accentPattern ||
      previous.clickEnabled != config.clickEnabled ||
      previous.subdivision != config.subdivision ||
      previous.clickVoice != config.clickVoice

    if previous.clickVoice != config.clickVoice {
      clickCache.removeAll()
    }

    if !structuralChange {
      player.volume = Float(config.clickVolume)
      onStateChange(getState())
      return getState()
    }

    // A structural configure() is the single-tempo world talking (the standalone
    // metronome's controls) — an installed map is stale the moment it happens.
    mapSegments = nil

    updateDerivedValues()

    if wasRunning {
      return start(countInBars: pendingCountInBars)
    }

    onStateChange(getState())
    return getState()
  }

  /** Apply click volume live, without touching the running grid. */
  func setClickVolume(_ volume: Double) -> [String: Any] {
    config.clickVolume = min(1, max(0, volume))
    player.volume = Float(config.clickVolume)
    return getState()
  }

  func start(countInBars: Int) -> [String: Any] {
    if mapSegments != nil {
      let countInPulses = max(0, countInBars) * max(mapSegments![0].pulsesPerBar, 1)
      return startMapRun(countInPulses: countInPulses, gridOffsetMs: 0)
    }
    stopInternal(emitState: false)

    isRunning = true
    isCountIn = countInBars > 0
    countInPulsesRemaining = max(0, countInBars) * max(config.pulsesPerBar, 1)
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1
    lastFrameWithinLoop = 0
    loopCount = 0
    phaseOffsetFrames = 0
    startUptimeMs = ProcessInfo.processInfo.systemUptime * 1000

    do {
      if config.clickEnabled {
        try prepareAndStartPlayer()
      } else {
        stopPlayer()
      }
    } catch {
      onError("iOS metronome audio start failed: \(error.localizedDescription)")
      stopPlayer()
    }

    // Pulse 0's haptic can't be scheduled from a previous beat — aim it at "now + offset"
    // (audio starts near-immediately from the pre-built buffer); pulses 1+ self-correct
    // off the audio clock via emitBeat.
    if config.hapticEnabled {
      scheduleHaptic(afterMs: Double(max(0, config.hapticOffsetMs)))
    }

    startPolling()
    let state = getState()
    onStateChange(state)
    return state
  }

  /**
   * Start the click mid-bar: `offsetMs` (wall-clock, wrapped into one bar) becomes the
   * loop position of the FIRST rendered sample, so a playback click can join an
   * already-moving take exactly in phase. No count-in, no pulse-0 haptic (the start is
   * mid-bar by definition — cues self-correct from the next beat via emitBeat).
   */
  func startAtPhase(offsetMs: Double) -> [String: Any] {
    if mapSegments != nil {
      // Map mode: the offset is a position along the WHOLE grid, not within one bar.
      return startMapRun(countInPulses: 0, gridOffsetMs: offsetMs)
    }
    stopInternal(emitState: false)

    isRunning = true
    isCountIn = false
    countInPulsesRemaining = 0
    loopCount = 0

    let clampedMs = max(0, offsetMs)
    let rawFrames = Int(round(clampedMs / 1000 * sampleRate))
    phaseOffsetFrames = totalFrames > 0 ? rawFrames % totalFrames : 0
    let initialPulse = Int(floor(Double(phaseOffsetFrames) / exactFramesPerPulse))
    absolutePulse = initialPulse
    // The pulse we start inside has already sounded its click-onset — never re-emit it.
    lastEmittedPulse = initialPulse
    beatInBar = (initialPulse % max(config.pulsesPerBar, 1)) + 1
    barNumber = 1
    lastFrameWithinLoop = phaseOffsetFrames
    // Silent-run clock: back-date the start so elapsed time includes the phase.
    startUptimeMs = ProcessInfo.processInfo.systemUptime * 1000 - Double(phaseOffsetFrames) / sampleRate * 1000

    do {
      if config.clickEnabled {
        try prepareAndStartPlayer(atFrame: phaseOffsetFrames)
      } else {
        stopPlayer()
      }
    } catch {
      onError("iOS metronome phase start failed: \(error.localizedDescription)")
      stopPlayer()
    }

    startPolling()
    let state = getState()
    onStateChange(state)
    return state
  }

  func stop() -> [String: Any] {
    stopInternal(emitState: true)
    return getState()
  }

  // ── Tempo-map mode ─────────────────────────────────────────────────────────

  /**
   * Install a tempo map: an ordered list of {atBar, bpm, pulsesPerBar, accentPattern}
   * segments, bar-anchored, first at bar 1. While a map is installed, start /
   * startCountIn / startAtPhase schedule every click at its exact sample position along
   * the map instead of looping a single bar. A structural configure() clears the map
   * (the standalone metronome's controls are single-tempo by definition).
   */
  func configureTempoMap(_ rawSegments: [[String: Any]]) -> [String: Any] {
    var segments: [MapSegment] = []
    for raw in rawSegments {
      guard let atBar = (raw["atBar"] as? NSNumber)?.intValue,
            let bpm = (raw["bpm"] as? NSNumber)?.intValue,
            let pulsesPerBar = (raw["pulsesPerBar"] as? NSNumber)?.intValue,
            pulsesPerBar > 0 else {
        continue
      }
      let accents = ((raw["accentPattern"] as? [NSNumber])?.map { min(1, max(0, $0.doubleValue)) })
        ?? [1.0]
      let clampedBpm = min(240, max(40, bpm))
      let efpp = max(1.0, sampleRate * 60_000.0 / Double(clampedBpm) / 1000.0)
      let previous = segments.last
      let barsSincePrevious = previous.map { Double(atBar - $0.atBar) } ?? 0
      let startGridPulse = previous.map { $0.startGridPulse + Int(barsSincePrevious) * $0.pulsesPerBar } ?? 0
      let startFrame = previous.map {
        $0.startFrame + barsSincePrevious * $0.exactFramesPerPulse * Double($0.pulsesPerBar)
      } ?? 0
      segments.append(MapSegment(
        atBar: max(1, atBar),
        bpm: clampedBpm,
        pulsesPerBar: pulsesPerBar,
        accentPattern: accents,
        startGridPulse: startGridPulse,
        startFrame: startFrame,
        exactFramesPerPulse: efpp
      ))
    }
    mapSegments = segments.isEmpty ? nil : segments
    return getState()
  }

  func clearTempoMap() -> [String: Any] {
    mapSegments = nil
    return getState()
  }

  private func mapSegment(forGridPulse gridPulse: Int) -> MapSegment {
    let segments = mapSegments!
    var active = segments[0]
    for segment in segments {
      if segment.startGridPulse <= gridPulse { active = segment } else { break }
    }
    return active
  }

  private func mapFrame(ofGridPulse gridPulse: Int) -> Double {
    let segments = mapSegments!
    if gridPulse < 0 {
      return Double(gridPulse) * segments[0].exactFramesPerPulse
    }
    let segment = mapSegment(forGridPulse: gridPulse)
    return segment.startFrame + Double(gridPulse - segment.startGridPulse) * segment.exactFramesPerPulse
  }

  private func mapGridPulse(atFrame frame: Double) -> Int {
    let segments = mapSegments!
    if frame < 0 {
      return Int(floor(frame / segments[0].exactFramesPerPulse))
    }
    var active = segments[0]
    for segment in segments {
      if segment.startFrame <= frame + 0.5 { active = segment } else { break }
    }
    return active.startGridPulse + Int(floor((frame - active.startFrame) / active.exactFramesPerPulse))
  }

  /// Beat metadata for a grid pulse: (beatInBar, barNumber, accent, pulsesPerBar).
  private func mapPulseMeta(gridPulse: Int) -> (Int, Int, Double, Int) {
    let segments = mapSegments!
    if gridPulse < 0 {
      // Count-in territory: felt in segment 1's meter; bar number stays 1.
      let ppb = segments[0].pulsesPerBar
      let position = ((gridPulse % ppb) + ppb) % ppb
      let accents = segments[0].accentPattern
      let accent = accents[min(position, accents.count - 1)]
      return (position + 1, 1, accent, ppb)
    }
    let segment = mapSegment(forGridPulse: gridPulse)
    let pulsesInto = gridPulse - segment.startGridPulse
    let beatInBar = pulsesInto % segment.pulsesPerBar + 1
    let barNumber = segment.atBar + pulsesInto / segment.pulsesPerBar
    let accents = segment.accentPattern
    let accent = accents[min(beatInBar - 1, accents.count - 1)]
    return (beatInBar, barNumber, accent, segment.pulsesPerBar)
  }

  /// Start along the installed map. `countInPulses` > 0 begins that many pulses before
  /// grid zero (segment 1 tempo); `gridOffsetMs` > 0 instead joins mid-song in phase.
  private func startMapRun(countInPulses: Int, gridOffsetMs: Double) -> [String: Any] {
    stopInternal(emitState: false)

    isRunning = true
    isCountIn = countInPulses > 0
    countInPulsesRemaining = max(0, countInPulses)
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1

    let segments = mapSegments!
    if countInPulses > 0 {
      runStartGridFrame = -Double(countInPulses) * segments[0].exactFramesPerPulse
      firstRunGridPulse = -countInPulses
    } else {
      runStartGridFrame = max(0, gridOffsetMs) / 1000 * sampleRate
      // First sounded pulse: the next grid pulse at or after the join point (the pulse
      // we join INSIDE already sounded its onset elsewhere — never re-click it).
      var pulse = mapGridPulse(atFrame: runStartGridFrame)
      if mapFrame(ofGridPulse: pulse) < runStartGridFrame - 1 { pulse += 1 }
      firstRunGridPulse = pulse
    }
    scheduledUntilRunPulse = 0
    startUptimeMs = ProcessInfo.processInfo.systemUptime * 1000

    do {
      if config.clickEnabled {
        player.stop()
        player.reset()
        if !engine.isRunning {
          try engine.start()
        }
        player.volume = Float(config.clickVolume)
        player.play()
        scheduleMapClicks(window: 32)
      } else {
        stopPlayer()
      }
    } catch {
      onError("iOS metronome map start failed: \(error.localizedDescription)")
      stopPlayer()
    }

    startPolling()
    let state = getState()
    onStateChange(state)
    return state
  }

  /// Keep the player fed: hand every not-yet-scheduled click inside the window to the
  /// node at its exact sample position. Called at start and topped up from the poll.
  private func scheduleMapClicks(window: Int) {
    guard config.clickEnabled, isRunning, mapSegments != nil, player.isPlaying else { return }

    let currentRunPulse = max(0, lastEmittedPulse + 1)
    while scheduledUntilRunPulse < currentRunPulse + window {
      let runPulse = scheduledUntilRunPulse
      let gridPulse = firstRunGridPulse + runPulse
      let position = mapFrame(ofGridPulse: gridPulse) - runStartGridFrame
      let (beatInBar, _, accent, _) = mapPulseMeta(gridPulse: gridPulse)
      if let click = clickBuffer(accent: accent, isDownbeat: beatInBar == 1) {
        let when = AVAudioTime(sampleTime: AVAudioFramePosition(max(0, position.rounded())), atRate: sampleRate)
        player.scheduleBuffer(click, at: when, options: [], completionHandler: nil)
      }
      // Sub-clicks ride the pulse's own segment spacing: segments are bar-aligned, so the
      // gap to the next pulse always equals this segment's spacing — including the last
      // pulse before a tempo change. A rest pulse (accent 0) has no sub-clicks either.
      if accent > 0, config.subdivision > 1, let sub = clickBuffer(accent: subClickAccent, isDownbeat: false) {
        let framesPerPulse = gridPulse < 0
          ? mapSegments![0].exactFramesPerPulse
          : mapSegment(forGridPulse: gridPulse).exactFramesPerPulse
        for step in 1..<config.subdivision {
          let subPosition = position + Double(step) * framesPerPulse / Double(config.subdivision)
          let when = AVAudioTime(sampleTime: AVAudioFramePosition(max(0, subPosition.rounded())), atRate: sampleRate)
          player.scheduleBuffer(sub, at: when, options: [], completionHandler: nil)
        }
      }
      scheduledUntilRunPulse += 1
    }
  }

  /// One click voice, rendered once per (voice, accent) and cached — the same synthesis
  /// as the loop buffer, minus the bar around it.
  private func clickBuffer(accent: Double, isDownbeat: Bool) -> AVAudioPCMBuffer? {
    // Accent 0 is a rest, not a quiet click — the calibration screen leans on this to
    // render gap patterns on the real click pipeline.
    if accent <= 0 {
      return nil
    }
    let key = "\(config.clickVoice)-\(isDownbeat ? "d" : "w")-\(Int((accent * 100).rounded()))"
    if let cached = clickCache[key] {
      return cached
    }
    let spec = ClickVoiceSpec.resolve(voice: config.clickVoice, isDownbeat: isDownbeat)
    let clickFrames = max(1, Int((sampleRate * spec.durationSec).rounded()))
    guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(clickFrames)),
          let channel = buffer.floatChannelData?[0] else {
      return nil
    }
    buffer.frameLength = AVAudioFrameCount(clickFrames)
    renderClick(into: channel, at: 0, spec: spec, amplitude: spec.amplitude(forAccent: accent), totalFrames: clickFrames)
    clickCache[key] = buffer
    return buffer
  }

  /// Additively mix one click (voice + amplitude) into `channel` starting at `onset`,
  /// truncated at `totalFrames`. Shared by the loop buffer and the per-click cache so the
  /// two modes can never drift apart in timbre.
  private func renderClick(
    into channel: UnsafeMutablePointer<Float>,
    at onset: Int,
    spec: ClickVoiceSpec,
    amplitude: Double,
    totalFrames: Int
  ) {
    let clickFrames = min(totalFrames, max(1, Int((sampleRate * spec.durationSec).rounded())))
    let attackFrames = max(1, Int((sampleRate * spec.attackSec).rounded()))
    for frameIndex in 0..<clickFrames {
      let absoluteFrame = onset + frameIndex
      if absoluteFrame >= totalFrames {
        break
      }
      let sampleTime = Double(frameIndex) / sampleRate
      let attack = min(1.0, Double(frameIndex) / Double(attackFrames))
      let decay = pow(1.0 - Double(frameIndex) / Double(clickFrames), spec.decayPower)
      let sample =
        Float(sin(2.0 * .pi * spec.baseFrequency * sampleTime) * spec.mixBase +
          sin(2.0 * .pi * spec.overtoneFrequency * sampleTime) * spec.mixOvertone) *
        Float(amplitude) * Float(attack * decay)
      channel[absoluteFrame] = max(-1, min(1, channel[absoluteFrame] + sample))
    }
  }

  func getState() -> [String: Any] {
    return [
      "isAvailable": true,
      "isRunning": isRunning,
      "isCountIn": isCountIn,
      "bpm": config.bpm,
      "meterId": config.meterId,
      "pulsesPerBar": config.pulsesPerBar,
      "denominator": config.denominator,
      "clickEnabled": config.clickEnabled,
      "clickVolume": config.clickVolume,
      "subdivision": config.subdivision,
      "clickVoice": config.clickVoice,
      "beatIntervalMs": beatIntervalMs(for: config.bpm),
      "beatInBar": beatInBar,
      "barNumber": barNumber,
      "absolutePulse": absolutePulse,
      "countInBarsRemaining": countInBarsRemaining()
    ]
  }

  /**
   * One anchor instead of an event stream: the epoch time of pulse 0 (grid t=0), plus the
   * exact pulse spacing. Everything else — current beat, time-to-next-downbeat, count-in
   * progress, UI cue scheduling — derives from this without racing bridge events. When the
   * click is audible the anchor comes from the audio clock (player sample position);
   * silent runs fall back to the uptime clock.
   */
  func getGridAnchor() -> [String: Any] {
    guard isRunning else {
      return ["isRunning": false]
    }

    let nowEpochMs = Date().timeIntervalSince1970 * 1000

    if let segments = mapSegments {
      // Map mode: the anchor is still "epoch of run pulse 0 + current pulse spacing" —
      // consumers re-derive per bar, so a spacing that changes at a boundary self-heals.
      let currentGridFrame: Double
      if config.clickEnabled, player.isPlaying,
         let renderTime = player.lastRenderTime,
         let playerTime = player.playerTime(forNodeTime: renderTime) {
        currentGridFrame = runStartGridFrame + Double(playerTime.sampleTime)
      } else {
        let elapsedMs = max(0, ProcessInfo.processInfo.systemUptime * 1000 - startUptimeMs)
        currentGridFrame = runStartGridFrame + elapsedMs / 1000 * sampleRate
      }
      let runPulseZeroFrame = mapFrame(ofGridPulse: firstRunGridPulse)
      let framesSincePulseZero = currentGridFrame - runPulseZeroFrame
      let gridPulseNow = mapGridPulse(atFrame: currentGridFrame)
      let segment = gridPulseNow >= 0 ? mapSegment(forGridPulse: gridPulseNow) : segments[0]
      return [
        "isRunning": true,
        "isCountIn": isCountIn,
        "anchorEpochMs": nowEpochMs - framesSincePulseZero / sampleRate * 1000,
        "msPerPulse": segment.exactFramesPerPulse / sampleRate * 1000,
        "pulsesPerBar": segment.pulsesPerBar,
        "countInPulsesRemaining": countInPulsesRemaining,
        "absolutePulse": absolutePulse
      ]
    }

    var anchorEpochMs = nowEpochMs

    if config.clickEnabled,
       player.isPlaying,
       let renderTime = player.lastRenderTime,
       let playerTime = player.playerTime(forNodeTime: renderTime) {
      let currentFrameWithinLoop = (Int(playerTime.sampleTime) + phaseOffsetFrames) % max(totalFrames, 1)
      let absoluteFrames = loopCount * totalFrames + currentFrameWithinLoop
      anchorEpochMs = nowEpochMs - Double(absoluteFrames) / sampleRate * 1000
    } else {
      let elapsedMs = max(0, ProcessInfo.processInfo.systemUptime * 1000 - startUptimeMs)
      anchorEpochMs = nowEpochMs - elapsedMs
    }

    return [
      "isRunning": true,
      "isCountIn": isCountIn,
      "anchorEpochMs": anchorEpochMs,
      "msPerPulse": beatIntervalMs(for: config.bpm),
      "pulsesPerBar": config.pulsesPerBar,
      "countInPulsesRemaining": countInPulsesRemaining,
      "absolutePulse": absolutePulse
    ]
  }

  private func stopInternal(emitState: Bool) {
    pollTimer?.cancel()
    pollTimer = nil
    stopPlayer()

    isRunning = false
    isCountIn = false
    countInPulsesRemaining = 0
    beatInBar = 1
    barNumber = 1
    absolutePulse = 0
    lastEmittedPulse = -1
    lastFrameWithinLoop = 0
    loopCount = 0
    phaseOffsetFrames = 0
    startUptimeMs = 0
    runStartGridFrame = 0
    firstRunGridPulse = 0
    scheduledUntilRunPulse = 0

    if emitState {
      onStateChange(getState())
    }
  }

  private func updateDerivedValues() {
    // Keep the BAR sample-exact for the nominal BPM (Bresenham: pulse boundaries are
    // round(k · exact), so per-pulse rounding error never accumulates). A uniformly
    // rounded framesPerPulse quantizes the tempo and drifts several ms/minute against
    // an external metronome or DAW set to the same BPM.
    exactFramesPerPulse = max(1.0, sampleRate * beatIntervalMs(for: config.bpm) / 1000)
    framesPerPulse = max(1, Int(round(exactFramesPerPulse)))
    totalFrames = max(1, Int(round(exactFramesPerPulse * Double(max(config.pulsesPerBar, 1)))))
    loopBuffer = buildLoopBuffer()
  }

  private func prepareAndStartPlayer(atFrame startFrame: Int = 0) throws {
    guard let buffer = loopBuffer else {
      throw NSError(domain: "SongNookMetronome", code: 1, userInfo: [NSLocalizedDescriptionKey: "Loop buffer unavailable"])
    }

    player.stop()
    player.reset()

    if !engine.isRunning {
      try engine.start()
    }

    player.volume = Float(config.clickVolume)
    // Phase start: play the tail of the bar first, then settle into the whole-bar loop.
    // Sample-exact — the tail slice ends exactly where the loop's frame 0 begins.
    if startFrame > 0, startFrame < totalFrames, let tail = sliceBuffer(buffer, fromFrame: startFrame) {
      player.scheduleBuffer(tail, at: nil, options: [], completionHandler: nil)
      player.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
    } else {
      player.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
    }
    player.play()
  }

  private func sliceBuffer(_ source: AVAudioPCMBuffer, fromFrame startFrame: Int) -> AVAudioPCMBuffer? {
    let remaining = Int(source.frameLength) - startFrame
    guard remaining > 0,
          let slice = AVAudioPCMBuffer(pcmFormat: source.format, frameCapacity: AVAudioFrameCount(remaining)),
          let sourceChannel = source.floatChannelData?[0],
          let sliceChannel = slice.floatChannelData?[0] else {
      return nil
    }
    slice.frameLength = AVAudioFrameCount(remaining)
    sliceChannel.update(from: sourceChannel + startFrame, count: remaining)
    return slice
  }

  private func stopPlayer() {
    if player.isPlaying {
      player.stop()
    }
    if engine.isRunning {
      engine.pause()
    }
  }

  private func startPolling() {
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: pollIntervalMs)
    timer.setEventHandler { [weak self] in
      self?.pollBeatProgress()
    }
    pollTimer = timer
    timer.resume()
  }

  private func pollBeatProgress() {
    guard isRunning else {
      return
    }

    if mapSegments != nil {
      pollMapBeatProgress()
      return
    }

    let pulseOrdinal: Int
    if config.clickEnabled, player.isPlaying {
      guard let renderTime = player.lastRenderTime,
            let playerTime = player.playerTime(forNodeTime: renderTime) else {
        return
      }

      let currentFrameWithinLoop = (Int(playerTime.sampleTime) + phaseOffsetFrames) % max(totalFrames, 1)
      if currentFrameWithinLoop + framesPerPulse < lastFrameWithinLoop {
        loopCount += 1
      }
      lastFrameWithinLoop = currentFrameWithinLoop
      let absoluteFrames = loopCount * totalFrames + currentFrameWithinLoop
      pulseOrdinal = Int(floor(Double(absoluteFrames) / exactFramesPerPulse))
    } else {
      let elapsedMs = max(0, ProcessInfo.processInfo.systemUptime * 1000 - startUptimeMs)
      pulseOrdinal = Int(floor(elapsedMs / beatIntervalMs(for: config.bpm)))
    }

    if pulseOrdinal <= lastEmittedPulse {
      return
    }

    for nextPulse in (lastEmittedPulse + 1)...pulseOrdinal {
      emitBeat(nextPulse)
    }
  }

  private func pollMapBeatProgress() {
    let currentGridFrame: Double
    if config.clickEnabled, player.isPlaying,
       let renderTime = player.lastRenderTime,
       let playerTime = player.playerTime(forNodeTime: renderTime) {
      currentGridFrame = runStartGridFrame + Double(playerTime.sampleTime)
    } else {
      let elapsedMs = max(0, ProcessInfo.processInfo.systemUptime * 1000 - startUptimeMs)
      currentGridFrame = runStartGridFrame + elapsedMs / 1000 * sampleRate
    }

    let runPulseNow = mapGridPulse(atFrame: currentGridFrame) - firstRunGridPulse
    if runPulseNow > lastEmittedPulse {
      for nextPulse in (lastEmittedPulse + 1)...runPulseNow {
        emitMapBeat(runPulse: nextPulse)
      }
    }
    scheduleMapClicks(window: 32)
  }

  private func emitBeat(_ pulseOrdinal: Int) {
    lastEmittedPulse = pulseOrdinal
    absolutePulse = pulseOrdinal
    beatInBar = (pulseOrdinal % max(config.pulsesPerBar, 1)) + 1
    barNumber = (pulseOrdinal / max(config.pulsesPerBar, 1)) + 1

    let accentIndex = min(max(beatInBar - 1, 0), max(config.accentPattern.count - 1, 0))
    finishBeatEmission(accent: config.accentPattern[accentIndex], beatIntervalMsForCues: beatIntervalMs(for: config.bpm))
  }

  /// Map-mode twin of emitBeat: meta comes from the segment table, cues use the
  /// CURRENT segment's pulse spacing so the haptic lead stays true across changes.
  private func emitMapBeat(runPulse: Int) {
    lastEmittedPulse = runPulse
    absolutePulse = runPulse
    let gridPulse = firstRunGridPulse + runPulse
    let (pulseBeatInBar, pulseBarNumber, accent, _) = mapPulseMeta(gridPulse: gridPulse)
    beatInBar = pulseBeatInBar
    barNumber = max(1, pulseBarNumber)
    let segment = gridPulse >= 0 ? mapSegment(forGridPulse: gridPulse) : mapSegments![0]
    finishBeatEmission(accent: accent, beatIntervalMsForCues: segment.exactFramesPerPulse / sampleRate * 1000)
  }

  private func finishBeatEmission(accent: Double, beatIntervalMsForCues: Double) {
    let barsRemainingBeforeBeat = countInBarsRemaining()

    let beatPayload: [String: Any] = [
      "beatInBar": beatInBar,
      "barNumber": barNumber,
      "absolutePulse": absolutePulse,
      "isDownbeat": beatInBar == 1,
      "accent": accent,
      "isCountIn": isCountIn,
      "countInBarsRemaining": barsRemainingBeforeBeat,
      "timestampMs": Date().timeIntervalSince1970 * 1000
    ]
    // Delay only the visual/haptic beat by the configured output latency so the on-screen
    // beat lands with the audible click. The audio itself is untouched.
    if config.outputLatencyMs > 0 {
      let delay = Double(config.outputLatencyMs) / 1000.0
      queue.asyncAfter(deadline: .now() + delay) { [weak self] in
        guard let self = self, self.isRunning else { return }
        self.onBeat(beatPayload)
      }
    } else {
      onBeat(beatPayload)
    }

    // Schedule the NEXT beat's haptic natively: one beat of lead means the signed offset
    // (route latency − motor spin-up) can land the tap exactly on the audible click, even
    // when it must fire BEFORE the beat event — something a bridge-event chain can never do.
    if config.hapticEnabled {
      scheduleHaptic(afterMs: max(1, beatIntervalMsForCues + Double(config.hapticOffsetMs)))
    }

    // Snapshot state for *this* beat before flipping isCountIn off below, so the final count-in
    // beat (e.g. dot 4 of 4) still reports isCountIn=true and gets a chance to render before the
    // UI transitions to "recording" on the next beat. The snapshot is emitted with the SAME
    // output-latency delay as onBeat: beat numbers / count-in dots are driven off this state,
    // and undelayed they run a full route latency AHEAD of the audible click (the "screen
    // counts before I hear the beep" bug on Bluetooth).
    let beatStateSnapshot = getState()
    if config.outputLatencyMs > 0 {
      let delay = Double(config.outputLatencyMs) / 1000.0
      queue.asyncAfter(deadline: .now() + delay) { [weak self] in
        guard let self = self, self.isRunning else { return }
        self.onStateChange(beatStateSnapshot)
      }
    } else {
      onStateChange(beatStateSnapshot)
    }

    if isCountIn && countInPulsesRemaining > 0 {
      countInPulsesRemaining -= 1
      if countInPulsesRemaining <= 0 {
        isCountIn = false
        onCountInComplete([
          "timestampMs": Date().timeIntervalSince1970 * 1000
        ])
      }
    }
  }

  private func scheduleHaptic(afterMs: Double) {
    let strength = min(1, max(0, config.hapticStrength))
    DispatchQueue.main.asyncAfter(deadline: .now() + afterMs / 1000.0) { [weak self] in
      guard let self = self, self.isRunning, self.config.hapticEnabled else { return }
      let style: UIImpactFeedbackGenerator.FeedbackStyle =
        strength >= 0.75 ? .heavy : strength >= 0.4 ? .medium : .light
      let generator = UIImpactFeedbackGenerator(style: style)
      generator.impactOccurred(intensity: CGFloat(0.5 + strength * 0.5))
    }
  }

  private func countInBarsRemaining() -> Int {
    guard isCountIn, countInPulsesRemaining > 0 else {
      return 0
    }
    return Int(ceil(Double(countInPulsesRemaining) / Double(max(config.pulsesPerBar, 1))))
  }

  private func parseConfig(_ rawConfig: [String: Any]) -> MetronomeConfig {
    var next = config

    if let bpm = rawConfig["bpm"] as? Int {
      next.bpm = min(240, max(40, bpm))
    } else if let bpm = rawConfig["bpm"] as? Double {
      next.bpm = min(240, max(40, Int(round(bpm))))
    }

    if let meterId = rawConfig["meterId"] as? String {
      next.meterId = meterId
    }

    if let pulsesPerBar = rawConfig["pulsesPerBar"] as? Int {
      next.pulsesPerBar = max(1, pulsesPerBar)
    } else if let pulsesPerBar = rawConfig["pulsesPerBar"] as? Double {
      next.pulsesPerBar = max(1, Int(round(pulsesPerBar)))
    }

    if let denominator = rawConfig["denominator"] as? Int {
      next.denominator = max(1, denominator)
    } else if let denominator = rawConfig["denominator"] as? Double {
      next.denominator = max(1, Int(round(denominator)))
    }

    if let accentPattern = rawConfig["accentPattern"] as? [Double], !accentPattern.isEmpty {
      next.accentPattern = accentPattern.map { min(1, max(0, $0)) }
    } else if let accentPattern = rawConfig["accentPattern"] as? [NSNumber], !accentPattern.isEmpty {
      next.accentPattern = accentPattern.map { min(1, max(0, $0.doubleValue)) }
    }

    if let clickEnabled = rawConfig["clickEnabled"] as? Bool {
      next.clickEnabled = clickEnabled
    }

    if let clickVolume = rawConfig["clickVolume"] as? Double {
      next.clickVolume = min(1, max(0, clickVolume))
    } else if let clickVolume = rawConfig["clickVolume"] as? NSNumber {
      next.clickVolume = min(1, max(0, clickVolume.doubleValue))
    }

    if let outputLatencyMs = rawConfig["outputLatencyMs"] as? Int {
      next.outputLatencyMs = min(1000, max(0, outputLatencyMs))
    } else if let outputLatencyMs = rawConfig["outputLatencyMs"] as? NSNumber {
      next.outputLatencyMs = min(1000, max(0, outputLatencyMs.intValue))
    }

    if let hapticEnabled = rawConfig["hapticEnabled"] as? Bool {
      next.hapticEnabled = hapticEnabled
    }

    if let hapticStrength = rawConfig["hapticStrength"] as? Double {
      next.hapticStrength = min(1, max(0, hapticStrength))
    } else if let hapticStrength = rawConfig["hapticStrength"] as? NSNumber {
      next.hapticStrength = min(1, max(0, hapticStrength.doubleValue))
    }

    if let hapticOffsetMs = rawConfig["hapticOffsetMs"] as? Int {
      next.hapticOffsetMs = min(1000, max(-200, hapticOffsetMs))
    } else if let hapticOffsetMs = rawConfig["hapticOffsetMs"] as? NSNumber {
      next.hapticOffsetMs = min(1000, max(-200, hapticOffsetMs.intValue))
    }

    if let subdivision = rawConfig["subdivision"] as? Int {
      next.subdivision = min(4, max(1, subdivision))
    } else if let subdivision = rawConfig["subdivision"] as? NSNumber {
      next.subdivision = min(4, max(1, subdivision.intValue))
    }

    // A present-but-unknown voice falls back to the stock click; absent keeps running.
    if let clickVoice = rawConfig["clickVoice"] as? String {
      next.clickVoice = clickVoice == "wood" ? "wood" : "click"
    }

    return next
  }

  private func beatIntervalMs(for bpm: Int) -> Double {
    return 60_000.0 / Double(max(bpm, 1))
  }

  private func buildLoopBuffer() -> AVAudioPCMBuffer? {
    guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(totalFrames)),
          let channel = buffer.floatChannelData?[0] else {
      return nil
    }

    buffer.frameLength = AVAudioFrameCount(totalFrames)
    let weakSpec = ClickVoiceSpec.resolve(voice: config.clickVoice, isDownbeat: false)
    let subdivision = max(1, config.subdivision)

    for pulseIndex in 0..<config.pulsesPerBar {
      let accent = config.accentPattern[min(pulseIndex, max(config.accentPattern.count - 1, 0))]
      // Accent 0 is a rest, not a quiet click (see clickBuffer).
      if accent <= 0 {
        continue
      }
      // Bresenham onsets: round(k · exact) for the beat AND its sub-clicks, so the
      // ornament rides the same sample-exact bar as the grid.
      let startFrame = Int(round(Double(pulseIndex) * exactFramesPerPulse))
      let spec = ClickVoiceSpec.resolve(voice: config.clickVoice, isDownbeat: pulseIndex == 0)
      renderClick(into: channel, at: startFrame, spec: spec, amplitude: spec.amplitude(forAccent: accent), totalFrames: totalFrames)

      if subdivision > 1 {
        for step in 1..<subdivision {
          let subFrame = Int(round((Double(pulseIndex) + Double(step) / Double(subdivision)) * exactFramesPerPulse))
          renderClick(into: channel, at: subFrame, spec: weakSpec, amplitude: weakSpec.amplitude(forAccent: subClickAccent), totalFrames: totalFrames)
        }
      }
    }

    return buffer
  }
}
