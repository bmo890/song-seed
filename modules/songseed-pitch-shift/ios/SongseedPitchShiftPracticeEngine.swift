import AVFoundation

private let pitchShiftTickInterval: TimeInterval = 0.1

final class SongseedPitchShiftPracticeEngine {
  private let onStateChange: ([String: Any]) -> Void
  private let onPlaybackEnded: ([String: Any]) -> Void
  private let onError: (String) -> Void

  private let engine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let timePitchNode = AVAudioUnitTimePitch()

  private var audioFile: AVAudioFile?
  private var sourceUri: String?
  private var currentPlaybackRate: Double = 1.0
  private var currentPitchShiftSemitones: Int = 0
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
    engine.connect(playerNode, to: timePitchNode, format: nil)
    engine.connect(timePitchNode, to: engine.mainMixerNode, format: nil)
    applyTimePitchSettings()
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
      "sourceUri": sourceUri as Any
    ]
  }

  func loadForPractice(_ request: [String: Any]) throws -> [String: Any] {
    guard let uriString = request["sourceUri"] as? String else {
      throw NSError(
        domain: "SongseedPitchShift",
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

    let url = URL(string: uriString) ?? URL(fileURLWithPath: uriString)
    let file = try AVAudioFile(forReading: url)

    stopTimer()
    playerNode.stop()
    audioFile = file
    sourceUri = uriString
    currentPlaybackRate = max(0.5, min(2.0, playbackRate))
    currentPitchShiftSemitones = max(-12, min(12, semitones))
    pausedPositionMs = max(0, startPositionMs)
    didJustFinish = false
    isPlaying = false
    applyTimePitchSettings()
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
    playerNode.stop()
    isPlaying = false
    stopTimer()
    onStateChange(getState())
    return getState()
  }

  func stop() -> [String: Any] {
    pausedPositionMs = 0
    didJustFinish = false
    playerNode.stop()
    isPlaying = false
    stopTimer()
    onStateChange(getState())
    return getState()
  }

  func unload() -> [String: Any] {
    stopTimer()
    playerNode.stop()
    engine.stop()
    audioFile = nil
    sourceUri = nil
    pausedPositionMs = 0
    currentPlaybackRate = 1.0
    currentPitchShiftSemitones = 0
    isPlaying = false
    didJustFinish = false
    applyTimePitchSettings()
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

  private func applyTimePitchSettings() {
    timePitchNode.rate = Float(currentPlaybackRate)
    timePitchNode.pitch = Float(currentPitchShiftSemitones * 100)
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
