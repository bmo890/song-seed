import AVFoundation

private let pitchShiftTickInterval: TimeInterval = 0.1

final class SongNookPitchShiftPracticeEngine {
  private let onStateChange: ([String: Any]) -> Void
  private let onPlaybackEnded: ([String: Any]) -> Void
  private let onError: (String) -> Void

  private let engine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let timePitchNode = AVAudioUnitTimePitch()
  // The take's sound (Sound room, 2026-10-14): level on the EQ's global gain, the
  // tone keys as its bands, and a limiter after the lift so +12 dB never clips.
  private let eqNode = SongNookToneEQ.makeNode()
  private let limiterNode = SongNookToneEQ.makeLimiterNode()

  private var audioFile: AVAudioFile?
  private var sourceUri: String?
  private var currentPlaybackRate: Double = 1.0
  private var currentPitchShiftSemitones: Int = 0
  private var currentGainDb: Double = 0
  private var currentTonePreset: String = "neutral"
  private var pausedPositionMs: Double = 0
  private var isPlaying = false
  private var didJustFinish = false
  private var playbackSessionId = UUID()
  private var tickTimer: Timer?

  init(
    onStateChange: @escaping ([String: Any]) -> Void,
    onPlaybackEnded: @escaping ([String: Any]) -> Void,
    onError: @escaping (String) -> Void
  ) {
    self.onStateChange = onStateChange
    self.onPlaybackEnded = onPlaybackEnded
    self.onError = onError

    engine.attach(playerNode)
    engine.attach(timePitchNode)
    engine.attach(eqNode)
    engine.attach(limiterNode)
    engine.connect(playerNode, to: timePitchNode, format: nil)
    engine.connect(timePitchNode, to: eqNode, format: nil)
    engine.connect(eqNode, to: limiterNode, format: nil)
    engine.connect(limiterNode, to: engine.mainMixerNode, format: nil)
    timePitchNode.overlap = SongNookTimePitch.overlap
    applyTimePitchSettings()
    applySoundSettings()
  }

  deinit {
    tickTimer?.invalidate()
    playerNode.stop()
    engine.stop()
  }

  func getCapabilities() -> [String: Any] {
    [
      "isAvailable": true,
      "supportsPracticePlayback": true,
      "supportsEditorPreview": true,
      "supportsOfflineRender": true,
      "minSemitones": -12,
      "maxSemitones": 12
    ]
  }

  func getState() -> [String: Any] {
    [
      "isAvailable": true,
      "isLoaded": audioFile != nil && sourceUri != nil,
      "isPlaying": isPlaying,
      "didJustFinish": didJustFinish,
      "currentTimeMs": Int(computedCurrentPositionMs().rounded()),
      "durationMs": durationMs(),
      "playbackRate": currentPlaybackRate,
      "pitchShiftSemitones": currentPitchShiftSemitones,
      "soundGainDb": currentGainDb,
      "soundTonePreset": currentTonePreset,
      "sourceUri": sourceUri as Any
    ]
  }

  func loadForPractice(_ request: [String: Any]) throws -> [String: Any] {
    guard let uriString = request["sourceUri"] as? String else {
      throw NSError(
        domain: "SongNookPitchShift",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Pitch shift practice playback requires sourceUri."]
      )
    }

    let startPositionMs = (request["startPositionMs"] as? Double)
      ?? Double((request["startPositionMs"] as? Int) ?? 0)
    let autoplay = request["autoplay"] as? Bool ?? false
    let playbackRate = (request["playbackRate"] as? Double)
      ?? Double((request["playbackRate"] as? Int) ?? 1)
    let semitones = (request["pitchShiftSemitones"] as? Int)
      ?? Int((request["pitchShiftSemitones"] as? Double) ?? 0)
    let gainDb = (request["gainDb"] as? Double) ?? Double((request["gainDb"] as? Int) ?? 0)
    let tonePreset = (request["tonePreset"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    let url = URL(string: uriString) ?? URL(fileURLWithPath: uriString)
    let file = try AVAudioFile(forReading: url)

    stopTimer()
    playbackSessionId = UUID()
    playerNode.stop()
    audioFile = file
    sourceUri = uriString
    currentPlaybackRate = max(0.5, min(2.0, playbackRate))
    currentPitchShiftSemitones = max(-12, min(12, semitones))
    currentGainDb = clampGainDb(gainDb)
    currentTonePreset = tonePreset.isEmpty ? "neutral" : tonePreset
    pausedPositionMs = max(0, startPositionMs)
    didJustFinish = false
    isPlaying = false
    applyTimePitchSettings()
    applySoundSettings()
    try ensureEngineRunning()

    if autoplay {
      try playInternal()
    } else {
      onStateChange(getState())
    }

    return getState()
  }

  func play() throws -> [String: Any] {
    let duration = Double(durationMs())
    if didJustFinish || (duration > 0 && pausedPositionMs >= max(0, duration - 50)) {
      pausedPositionMs = 0
    }
    try playInternal()
    return getState()
  }

  func pause() -> [String: Any] {
    pausedPositionMs = computedCurrentPositionMs()
    // Stopping the node also runs the segment's completion handler; a new
    // session id makes it stale, so a pause is never reported as the end.
    playbackSessionId = UUID()
    playerNode.stop()
    isPlaying = false
    stopTimer()
    onStateChange(getState())
    return getState()
  }

  func stop() -> [String: Any] {
    pausedPositionMs = 0
    didJustFinish = false
    playbackSessionId = UUID()
    playerNode.stop()
    isPlaying = false
    stopTimer()
    onStateChange(getState())
    return getState()
  }

  func unload() -> [String: Any] {
    stopTimer()
    playbackSessionId = UUID()
    playerNode.stop()
    engine.stop()
    audioFile = nil
    sourceUri = nil
    pausedPositionMs = 0
    currentPlaybackRate = 1.0
    currentPitchShiftSemitones = 0
    currentGainDb = 0
    currentTonePreset = "neutral"
    isPlaying = false
    didJustFinish = false
    applyTimePitchSettings()
    applySoundSettings()
    return getState()
  }

  func seekTo(_ positionMs: Double) throws -> [String: Any] {
    pausedPositionMs = max(0, min(positionMs, Double(durationMs())))
    didJustFinish = false

    if isPlaying {
      try playInternal()
    } else {
      onStateChange(getState())
    }

    return getState()
  }

  func setPlaybackRate(_ rate: Double) -> [String: Any] {
    currentPlaybackRate = max(0.5, min(2.0, rate))
    didJustFinish = false
    applyTimePitchSettings()
    onStateChange(getState())
    return getState()
  }

  func setPitchShiftSemitones(_ semitones: Int) -> [String: Any] {
    currentPitchShiftSemitones = max(-12, min(12, semitones))
    didJustFinish = false
    applyTimePitchSettings()
    onStateChange(getState())
    return getState()
  }

  /// Level and tone on the running transport. The nodes take new parameters live,
  /// so a key press or a knob release is heard without a gap.
  func setSound(_ request: [String: Any]) -> [String: Any] {
    if let gain = (request["gainDb"] as? Double) ?? (request["gainDb"] as? Int).map(Double.init) {
      currentGainDb = clampGainDb(gain)
    }
    if let preset = (request["tonePreset"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) {
      currentTonePreset = preset.isEmpty ? "neutral" : preset
    }
    applySoundSettings()
    onStateChange(getState())
    return getState()
  }

  private func applyTimePitchSettings() {
    timePitchNode.rate = Float(currentPlaybackRate)
    timePitchNode.pitch = Float(currentPitchShiftSemitones * 100)
  }

  private func applySoundSettings() {
    SongNookToneEQ.configure(eqNode, tonePreset: currentTonePreset)
    eqNode.globalGain = Float(currentGainDb)
  }

  private func clampGainDb(_ value: Double) -> Double {
    return max(-24, min(12, value))
  }

  private func ensureEngineRunning() throws {
    if engine.isRunning {
      return
    }

    do {
      try engine.start()
    } catch {
      onError(error.localizedDescription)
      throw error
    }
  }

  private func playInternal() throws {
    guard audioFile != nil else {
      return
    }

    try ensureEngineRunning()
    didJustFinish = false
    playbackSessionId = UUID()
    scheduleFromCurrentPosition(sessionId: playbackSessionId)
    playerNode.play()
    isPlaying = true
    startTimer()
    onStateChange(getState())
  }

  private func scheduleFromCurrentPosition(sessionId: UUID) {
    guard let file = audioFile else {
      return
    }

    playerNode.stop()

    let sampleRate = file.processingFormat.sampleRate
    let totalFrames = file.length
    let startFrame = AVAudioFramePosition((pausedPositionMs / 1000.0) * sampleRate)
    let safeStartFrame = max(0, min(startFrame, totalFrames))
    let remainingFrames = max(0, totalFrames - safeStartFrame)

    if remainingFrames <= 0 {
      pausedPositionMs = Double(durationMs())
      isPlaying = false
      stopTimer()
      onStateChange(getState())
      return
    }

    playerNode.scheduleSegment(
      file,
      startingFrame: safeStartFrame,
      frameCount: AVAudioFrameCount(remainingFrames),
      at: nil
    ) { [weak self] in
      DispatchQueue.main.async {
        guard let self, self.playbackSessionId == sessionId else {
          return
        }
        self.pausedPositionMs = Double(self.durationMs())
        self.isPlaying = false
        self.didJustFinish = true
        self.stopTimer()
        let state = self.getState()
        self.onPlaybackEnded(state)
        self.onStateChange(state)
      }
    }
  }

  private func computedCurrentPositionMs() -> Double {
    guard
      let file = audioFile,
      isPlaying,
      let nodeTime = playerNode.lastRenderTime,
      let playerTime = playerNode.playerTime(forNodeTime: nodeTime)
    else {
      return pausedPositionMs
    }

    let sampleRate = file.processingFormat.sampleRate
    let renderedMs = (Double(playerTime.sampleTime) / sampleRate) * 1000.0
    return max(0, min(pausedPositionMs + renderedMs, Double(durationMs())))
  }

  private func durationMs() -> Int {
    guard let file = audioFile else {
      return 0
    }
    let durationSeconds = Double(file.length) / file.processingFormat.sampleRate
    return Int((durationSeconds * 1000.0).rounded())
  }

  private func startTimer() {
    stopTimer()
    tickTimer = Timer.scheduledTimer(withTimeInterval: pitchShiftTickInterval, repeats: true) { [weak self] _ in
      guard let self else {
        return
      }
      self.onStateChange(self.getState())
    }
    RunLoop.main.add(tickTimer!, forMode: .common)
  }

  private func stopTimer() {
    tickTimer?.invalidate()
    tickTimer = nil
  }
}
