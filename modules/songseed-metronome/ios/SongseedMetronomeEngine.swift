import AVFoundation

private struct MetronomeConfig {
  var bpm: Int = 92
  var meterId: String = "4/4"
  var pulsesPerBar: Int = 4
  var denominator: Int = 4
  var accentPattern: [Double] = [1.0, 0.46, 0.72, 0.46]
  var clickEnabled: Bool = true
  var clickVolume: Double = 0.5
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

    config = parseConfig(rawConfig)
    updateDerivedValues()

    if wasRunning {
      return start(countInBars: pendingCountInBars)
    }

    onStateChange(getState())
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
    framesPerPulse = max(1, Int(round(sampleRate * beatIntervalMs(for: config.bpm) / 1000)))
    totalFrames = max(1, framesPerPulse * max(config.pulsesPerBar, 1))
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
      pulseOrdinal = Int(floor(Double(absoluteFrames) / Double(framesPerPulse)))
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

    onBeat([
      "beatInBar": beatInBar,
      "barNumber": barNumber,
      "absolutePulse": absolutePulse,
      "isDownbeat": beatInBar == 1,
      "accent": config.accentPattern[accentIndex],
      "isCountIn": isCountIn,
      "countInBarsRemaining": barsRemainingBeforeBeat,
      "timestampMs": Date().timeIntervalSince1970 * 1000
    ])

    if isCountIn && countInPulsesRemaining > 0 {
      countInPulsesRemaining -= 1
      if countInPulsesRemaining <= 0 {
        isCountIn = false
        onCountInComplete([
          "timestampMs": Date().timeIntervalSince1970 * 1000
        ])
      }
    }

    onStateChange(getState())
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
      let startFrame = pulseIndex * framesPerPulse
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
