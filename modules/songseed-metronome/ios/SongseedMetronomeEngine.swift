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
}

final class SongseedMetronomeEngine {
  private let sampleRate: Double = 44_100
  private let pollIntervalMs: Double = 0.008

  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let queue = DispatchQueue(label: "SongseedMetronomeEngine")

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
      previous.clickEnabled != config.clickEnabled

    if !structuralChange {
      player.volume = Float(config.clickVolume)
      onStateChange(getState())
      return getState()
    }

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

  func stop() -> [String: Any] {
    stopInternal(emitState: true)
    return getState()
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
    var anchorEpochMs = nowEpochMs

    if config.clickEnabled,
       player.isPlaying,
       let renderTime = player.lastRenderTime,
       let playerTime = player.playerTime(forNodeTime: renderTime) {
      let currentFrameWithinLoop = Int(playerTime.sampleTime) % max(totalFrames, 1)
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
    startUptimeMs = 0

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

  private func prepareAndStartPlayer() throws {
    guard let buffer = loopBuffer else {
      throw NSError(domain: "SongseedMetronome", code: 1, userInfo: [NSLocalizedDescriptionKey: "Loop buffer unavailable"])
    }

    player.stop()
    player.reset()

    if !engine.isRunning {
      try engine.start()
    }

    player.volume = Float(config.clickVolume)
    player.scheduleBuffer(buffer, at: nil, options: [.loops], completionHandler: nil)
    player.play()
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

    let pulseOrdinal: Int
    if config.clickEnabled, player.isPlaying {
      guard let renderTime = player.lastRenderTime,
            let playerTime = player.playerTime(forNodeTime: renderTime) else {
        return
      }

      let currentFrameWithinLoop = Int(playerTime.sampleTime) % max(totalFrames, 1)
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

  private func emitBeat(_ pulseOrdinal: Int) {
    lastEmittedPulse = pulseOrdinal
    absolutePulse = pulseOrdinal
    beatInBar = (pulseOrdinal % max(config.pulsesPerBar, 1)) + 1
    barNumber = (pulseOrdinal / max(config.pulsesPerBar, 1)) + 1

    let accentIndex = min(max(beatInBar - 1, 0), max(config.accentPattern.count - 1, 0))
    let barsRemainingBeforeBeat = countInBarsRemaining()

    let beatPayload: [String: Any] = [
      "beatInBar": beatInBar,
      "barNumber": barNumber,
      "absolutePulse": absolutePulse,
      "isDownbeat": beatInBar == 1,
      "accent": config.accentPattern[accentIndex],
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
      let intervalMs = beatIntervalMs(for: config.bpm)
      scheduleHaptic(afterMs: max(1, intervalMs + Double(config.hapticOffsetMs)))
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
    let clickFrameCount = min(totalFrames, max(1, Int(round(sampleRate * 0.034))))
    let attackFrames = max(1, Int(round(sampleRate * 0.003)))

    for pulseIndex in 0..<config.pulsesPerBar {
      let accent = config.accentPattern[min(pulseIndex, max(config.accentPattern.count - 1, 0))]
      let startFrame = Int(round(Double(pulseIndex) * exactFramesPerPulse))
      let baseFrequency = pulseIndex == 0 ? 1960.0 : 1560.0
      let overtoneFrequency = pulseIndex == 0 ? 2940.0 : 2350.0
      let amplitude = Float(0.22 + accent * 0.46)

      for frameIndex in 0..<clickFrameCount {
        let absoluteFrame = startFrame + frameIndex
        if absoluteFrame >= totalFrames {
          break
        }

        let sampleTime = Double(frameIndex) / sampleRate
        let attack = min(1.0, Double(frameIndex) / Double(attackFrames))
        let decay = pow(1.0 - Double(frameIndex) / Double(clickFrameCount), pulseIndex == 0 ? 2.8 : 2.4)
        let envelope = Float(attack * decay)
        let sample =
          Float(sin(2.0 * .pi * baseFrequency * sampleTime) * 0.78 +
            sin(2.0 * .pi * overtoneFrequency * sampleTime) * 0.22) *
          amplitude *
          envelope

        channel[absoluteFrame] = max(-1, min(1, channel[absoluteFrame] + sample))
      }
    }

    return buffer
  }
}
