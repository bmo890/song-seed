import AVFoundation
import UIKit

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
  // The play-along click (PlayAlongClick.swift): its own player beside the song's, on
  // one submix ahead of time-pitch, so the two are pulled frame for frame.
  private let clickPlayer = AVAudioPlayerNode()
  private let streamMix = AVAudioMixerNode()
  private let clickLock = NSLock()
  private var clickPlan: PlayAlongClickPlan?
  private var clickTrack: PlayAlongClickTrack?
  private var clickSession = UUID()
  private var clickFormat: AVAudioFormat?
  private var lastClickAnchorMs: Double = 0
  private var clicksQueuedBefore = 0
  private let hapticPlanner = PlayAlongHapticPlanner()
  private let hapticQueue = DispatchQueue(label: "app.songnook.pitchshift.haptics", qos: .userInteractive)
  private var hapticTimer: DispatchSourceTimer?
  private var hapticsSent = 0

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
    engine.attach(clickPlayer)
    engine.attach(streamMix)
    engine.attach(timePitchNode)
    engine.attach(eqNode)
    engine.attach(limiterNode)
    engine.connect(playerNode, to: streamMix, fromBus: 0, toBus: 0, format: nil)
    engine.connect(streamMix, to: timePitchNode, format: nil)
    engine.connect(timePitchNode, to: eqNode, format: nil)
    engine.connect(eqNode, to: limiterNode, format: nil)
    engine.connect(limiterNode, to: engine.mainMixerNode, format: nil)
    timePitchNode.overlap = SongNookTimePitch.overlap
    applyTimePitchSettings()
    applySoundSettings()
  }

  deinit {
    tickTimer?.invalidate()
    hapticTimer?.cancel()
    clickPlayer.stop()
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
      "maxSemitones": 12,
      "supportsPlayAlongClick": true,
      "supportsPlayAlongHaptic": true
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
      "sourceUri": sourceUri as Any,
      "playAlongClick": clickState()
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
    stopClick()
    playerNode.stop()
    connectStreams(for: file)
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
    stopClick()
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
    stopClick()
    playerNode.stop()
    isPlaying = false
    stopTimer()
    onStateChange(getState())
    return getState()
  }

  func unload() -> [String: Any] {
    stopTimer()
    playbackSessionId = UUID()
    stopClick()
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

  /// The take's grid for the play-along click, or nil for none. A new grid or voice
  /// while playing restarts the song and click together; a volume or buzz change is live.
  func setPlayAlongClick(_ request: [String: Any]?) -> [String: Any] {
    let next = request.flatMap { PlayAlongClickPlan.from($0) }
    clickLock.lock()
    let previous = clickPlan
    clickPlan = next
    clickLock.unlock()
    clickPlayer.volume = Float(next?.volume ?? 0)
    let sameSound = next == nil ? previous == nil : next!.soundsLike(previous)
    if isPlaying && !sameSound {
      pausedPositionMs = computedCurrentPositionMs()
      try? playInternal()
    }
    return getState()
  }

  private func soundingClickPlan() -> PlayAlongClickPlan? {
    clickLock.lock()
    defer { clickLock.unlock() }
    guard let plan = clickPlan, plan.sourceUri == nil || plan.sourceUri == sourceUri else { return nil }
    return plan
  }

  private func clickState() -> [String: Any] {
    clickLock.lock()
    defer { clickLock.unlock() }
    return [
      "planned": clickPlan != nil,
      "anchorMs": lastClickAnchorMs,
      "clicks": clicksQueuedBefore + (clickTrack?.clicksQueued ?? 0),
      "buzzes": hapticsSent
    ]
  }

  /// Both players in the file's own frames, so their timelines are one.
  private func connectStreams(for file: AVAudioFile) {
    let songFormat = file.processingFormat
    guard let format = AVAudioFormat(standardFormatWithSampleRate: songFormat.sampleRate, channels: 1) else { return }
    if clickFormat?.sampleRate == format.sampleRate, playerNode.outputFormat(forBus: 0) == songFormat {
      return
    }
    let wasRunning = engine.isRunning
    if wasRunning { engine.stop() }
    engine.disconnectNodeOutput(playerNode)
    engine.disconnectNodeOutput(clickPlayer)
    engine.connect(playerNode, to: streamMix, fromBus: 0, toBus: 0, format: songFormat)
    engine.connect(clickPlayer, to: streamMix, fromBus: 0, toBus: 1, format: format)
    clickFormat = format
    if wasRunning { try? engine.start() }
  }

  /// Queue the click track from `fromMs`; true when there is one to play.
  private func prepareClick(fromMs: Double) -> Bool {
    clickPlayer.stop()
    guard let plan = soundingClickPlan(), let format = clickFormat else {
      clickLock.lock()
      clickTrack = nil
      clickLock.unlock()
      return false
    }
    let session = UUID()
    clickLock.lock()
    clicksQueuedBefore += clickTrack?.clicksQueued ?? 0
    clickSession = session
    clickTrack = PlayAlongClickTrack(plan: plan, format: format, fromMs: fromMs)
    lastClickAnchorMs = fromMs
    clickLock.unlock()
    for _ in 0..<4 { queueClickBuffer(session: session) }
    return true
  }

  /// A quarter second of click track; each one played queues the next.
  private func queueClickBuffer(session: UUID) {
    clickLock.lock()
    guard clickSession == session, let track = clickTrack, let format = clickFormat else {
      clickLock.unlock()
      return
    }
    let buffer = track.nextBuffer(
      frames: Int(format.sampleRate / 4),
      speed: currentPlaybackRate,
      semitones: currentPitchShiftSemitones,
      gainDb: currentGainDb
    )
    clickLock.unlock()
    guard let buffer else { return }
    clickPlayer.scheduleBuffer(buffer, at: nil, options: [], completionCallbackType: .dataConsumed) { [weak self] _ in
      self?.queueClickBuffer(session: session)
    }
  }

  private func stopClick() {
    clickLock.lock()
    clickSession = UUID()
    clickLock.unlock()
    clickPlayer.stop()
    stopHaptics()
  }

  // ---- The play-along tap: sent from the song's own position (PlayAlongHapticPlanner).

  private func startHaptics() {
    stopHaptics()
    guard soundingClickPlan()?.hapticStrength != nil else { return }
    let timer = DispatchSource.makeTimerSource(queue: hapticQueue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(15), leeway: .milliseconds(2))
    timer.setEventHandler { [weak self] in self?.planHaptics() }
    hapticTimer = timer
    timer.resume()
  }

  private func stopHaptics() {
    hapticTimer?.cancel()
    hapticTimer = nil
    hapticQueue.async { [hapticPlanner] in hapticPlanner.reset() }
  }

  private func planHaptics() {
    guard isPlaying, let plan = soundingClickPlan(), let strength = plan.hapticStrength,
          let nodeTime = playerNode.lastRenderTime, nodeTime.isHostTimeValid,
          let playerTime = playerNode.playerTime(forNodeTime: nodeTime), playerTime.sampleRate > 0 else {
      hapticPlanner.reset()
      return
    }
    let speed = currentPlaybackRate
    let renderedMs = pausedPositionMs + Double(playerTime.sampleTime) / playerTime.sampleRate * 1000
    let session = AVAudioSession.sharedInstance()
    // From the player's last render to the ear: time-pitch, the limiter, the route.
    let pathSec = timePitchNode.latency + limiterNode.latency + session.outputLatency + session.ioBufferDuration
    let sinceRenderSec = AVAudioTime.seconds(forHostTime: mach_absolute_time()) - AVAudioTime.seconds(forHostTime: nodeTime.hostTime)
    let heardMs = renderedMs + (sinceRenderSec - pathSec) * 1000 * speed
    for inMs in hapticPlanner.due(heardMs: heardMs, speed: speed, plan: plan) {
      DispatchQueue.main.asyncAfter(deadline: .now() + inMs / 1000) { [weak self] in
        guard let self, self.isPlaying else { return }
        let style: UIImpactFeedbackGenerator.FeedbackStyle = strength >= 0.75 ? .heavy : strength >= 0.4 ? .medium : .light
        UIImpactFeedbackGenerator(style: style).impactOccurred(intensity: CGFloat(0.5 + strength * 0.5))
        self.hapticsSent += 1
      }
    }
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
    stopClick()
    scheduleFromCurrentPosition(sessionId: playbackSessionId)
    // Song and click start on one frame of the submix's timeline, so it pulls them in
    // step. Not one host time: upstream of time-pitch that timeline runs at the speed,
    // and a host time converted at the nominal rate put a slowed click ~3 ms apart.
    let clicking = prepareClick(fromMs: pausedPositionMs)
    let startAt: AVAudioTime
    if let rendered = playerNode.lastRenderTime, rendered.isSampleTimeValid {
      startAt = AVAudioTime(
        sampleTime: rendered.sampleTime + AVAudioFramePosition(rendered.sampleRate * 0.03),
        atRate: rendered.sampleRate
      )
    } else {
      startAt = AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: 0.03))
    }
    playerNode.play(at: startAt)
    if clicking { clickPlayer.play(at: startAt) }
    isPlaying = true
    startTimer()
    startHaptics()
    #if DEBUG
    if clicking {
      // Evidence for the one-clock claim: half a second in, both players must be on
      // the same frame of their timelines.
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
        guard let self, let nodeTime = self.playerNode.lastRenderTime,
              let song = self.playerNode.playerTime(forNodeTime: nodeTime),
              let click = self.clickPlayer.playerTime(forNodeTime: nodeTime) else { return }
        NSLog("[PlayAlongClick] song=%lld click=%lld rate=%.3f from=%.1fms",
              song.sampleTime, click.sampleTime, self.currentPlaybackRate, self.lastClickAnchorMs)
      }
    }
    #endif
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
        self.stopClick()
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
