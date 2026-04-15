import AVFoundation

final class SongseedPitchShiftRenderer {
  private struct MixedRenderInput {
    let inputURL: URL
    let gainDb: Double
    let offsetMs: Double
    let tonePreset: String
  }

  func renderFile(_ request: [String: Any]) throws -> [String: Any] {
    guard let inputUri = request["inputUri"] as? String else {
      throw NSError(
        domain: "SongseedPitchShift",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Pitch shift rendering requires inputUri."]
      )
    }

    let semitones = max(
      -12,
      min(
        12,
        (request["semitones"] as? Int)
          ?? Int((request["semitones"] as? Double) ?? 0)
      )
    )
    let playbackRate = max(
      0.5,
      min(
        2.0,
        (request["playbackRate"] as? Double)
          ?? Double((request["playbackRate"] as? Int) ?? 1)
      )
    )
    let outputFileName = (request["outputFileName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)
    let inputFile = try AVAudioFile(forReading: inputURL)
    let renderFormat = inputFile.processingFormat
    let outputURL = buildOutputURL(fileName: outputFileName)
    let outputFile = try AVAudioFile(forWriting: outputURL, settings: renderFormat.settings)

    let engine = AVAudioEngine()
    let playerNode = AVAudioPlayerNode()
    let timePitchNode = AVAudioUnitTimePitch()
    timePitchNode.rate = Float(playbackRate)
    timePitchNode.pitch = Float(semitones * 100)

    engine.attach(playerNode)
    engine.attach(timePitchNode)
    engine.connect(playerNode, to: timePitchNode, format: renderFormat)
    engine.connect(timePitchNode, to: engine.mainMixerNode, format: renderFormat)

    let maximumFrameCount: AVAudioFrameCount = 4096
    try engine.enableManualRenderingMode(.offline, format: renderFormat, maximumFrameCount: maximumFrameCount)
    try engine.start()

    playerNode.scheduleFile(inputFile, at: nil, completionHandler: nil)
    playerNode.play()

    let expectedOutputFrames = AVAudioFramePosition(ceil(Double(inputFile.length) / playbackRate))
    let renderBuffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: maximumFrameCount)
      ?? {
        fatalError("Failed to create render buffer.")
      }()
    var renderedFrames: AVAudioFramePosition = 0

    while renderedFrames < expectedOutputFrames {
      let remainingFrames = expectedOutputFrames - renderedFrames
      let framesToRender = AVAudioFrameCount(min(Int64(maximumFrameCount), Int64(max(1, remainingFrames))))
      let status = try engine.renderOffline(framesToRender, to: renderBuffer)

      switch status {
      case .success:
        if renderBuffer.frameLength > 0 {
          try outputFile.write(from: renderBuffer)
          renderedFrames += AVAudioFramePosition(renderBuffer.frameLength)
        } else {
          renderedFrames = expectedOutputFrames
        }
      case .cannotDoInCurrentContext:
        continue
      case .insufficientDataFromInputNode:
        renderedFrames = expectedOutputFrames
      case .error:
        throw NSError(
          domain: "SongseedPitchShift",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Pitch shift rendering failed during offline audio render."]
        )
      @unknown default:
        throw NSError(
          domain: "SongseedPitchShift",
          code: 4,
          userInfo: [NSLocalizedDescriptionKey: "Pitch shift rendering failed with an unknown render status."]
        )
      }
    }

    playerNode.stop()
    engine.stop()
    engine.disableManualRenderingMode()

    return ["outputUri": outputURL.absoluteString]
  }

  func renderMixedFile(_ request: [String: Any]) throws -> [String: Any] {
    guard let rawInputs = request["inputs"] as? [Any] else {
      throw NSError(
        domain: "SongseedPitchShift",
        code: 5,
        userInfo: [NSLocalizedDescriptionKey: "Mixed rendering requires inputs."]
      )
    }

    let inputs = rawInputs.compactMap(parseMixedInput).filter { !$0.inputURL.absoluteString.isEmpty }
    guard !inputs.isEmpty else {
      throw NSError(
        domain: "SongseedPitchShift",
        code: 6,
        userInfo: [NSLocalizedDescriptionKey: "Mixed rendering requires at least one input."]
      )
    }

    let outputFileName = (request["outputFileName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let outputURL = buildOutputURL(fileName: outputFileName)

    let firstFile = try AVAudioFile(forReading: inputs[0].inputURL)
    let renderFormat = firstFile.processingFormat
    let outputFile = try AVAudioFile(forWriting: outputURL, settings: renderFormat.settings)

    let engine = AVAudioEngine()
    let maximumFrameCount: AVAudioFrameCount = 4096
    var playerNodes: [AVAudioPlayerNode] = []
    var eqNodes: [AVAudioUnitEQ] = []
    var scheduledLengthFrames: AVAudioFramePosition = 0

    for input in inputs {
      let audioFile = try AVAudioFile(forReading: input.inputURL)
      let playerNode = AVAudioPlayerNode()
      let eqNode = AVAudioUnitEQ(numberOfBands: 1)
      configureTone(eqNode, tonePreset: input.tonePreset)
      eqNode.globalGain = Float(input.gainDb)

      engine.attach(playerNode)
      engine.attach(eqNode)
      engine.connect(playerNode, to: eqNode, format: audioFile.processingFormat)
      engine.connect(eqNode, to: engine.mainMixerNode, format: audioFile.processingFormat)

      let offsetFrames = AVAudioFramePosition((input.offsetMs / 1000.0) * renderFormat.sampleRate)
      let scheduledTime = AVAudioTime(sampleTime: offsetFrames, atRate: renderFormat.sampleRate)
      playerNode.scheduleFile(audioFile, at: scheduledTime, completionHandler: nil)

      scheduledLengthFrames = max(scheduledLengthFrames, offsetFrames + audioFile.length)
      playerNodes.append(playerNode)
      eqNodes.append(eqNode)
    }

    try engine.enableManualRenderingMode(.offline, format: renderFormat, maximumFrameCount: maximumFrameCount)
    try engine.start()
    playerNodes.forEach { $0.play() }

    let renderBuffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: maximumFrameCount)
      ?? {
        fatalError("Failed to create mixed render buffer.")
      }()
    var renderedFrames: AVAudioFramePosition = 0

    while renderedFrames < scheduledLengthFrames {
      let remainingFrames = scheduledLengthFrames - renderedFrames
      let framesToRender = AVAudioFrameCount(min(Int64(maximumFrameCount), Int64(max(1, remainingFrames))))
      let status = try engine.renderOffline(framesToRender, to: renderBuffer)

      switch status {
      case .success:
        if renderBuffer.frameLength > 0 {
          try outputFile.write(from: renderBuffer)
          renderedFrames += AVAudioFramePosition(renderBuffer.frameLength)
        } else {
          renderedFrames = scheduledLengthFrames
        }
      case .cannotDoInCurrentContext:
        continue
      case .insufficientDataFromInputNode:
        renderedFrames = scheduledLengthFrames
      case .error:
        throw NSError(
          domain: "SongseedPitchShift",
          code: 7,
          userInfo: [NSLocalizedDescriptionKey: "Mixed rendering failed during offline audio render."]
        )
      @unknown default:
        throw NSError(
          domain: "SongseedPitchShift",
          code: 8,
          userInfo: [NSLocalizedDescriptionKey: "Mixed rendering failed with an unknown render status."]
        )
      }
    }

    playerNodes.forEach { $0.stop() }
    engine.stop()
    engine.disableManualRenderingMode()

    return ["outputUri": outputURL.absoluteString]
  }

  private func parseMixedInput(_ rawValue: Any) -> MixedRenderInput? {
    guard let value = rawValue as? [String: Any], let inputUri = value["inputUri"] as? String else {
      return nil
    }

    let gainDb = max(-18.0, min(6.0, (value["gainDb"] as? Double) ?? Double((value["gainDb"] as? Int) ?? 0)))
    let offsetMs = max(0.0, (value["offsetMs"] as? Double) ?? Double((value["offsetMs"] as? Int) ?? 0))
    let tonePreset = (value["tonePreset"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "neutral"
    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)

    return MixedRenderInput(
      inputURL: inputURL,
      gainDb: gainDb,
      offsetMs: offsetMs,
      tonePreset: tonePreset.isEmpty ? "neutral" : tonePreset
    )
  }

  private func configureTone(_ eqNode: AVAudioUnitEQ, tonePreset: String) {
    let band = eqNode.bands[0]
    band.filterType = .highPass
    band.frequency = 140
    band.bandwidth = 0.8
    band.bypass = tonePreset != "low-cut"
    band.gain = 0
  }

  private func buildOutputURL(fileName: String?) -> URL {
    let safeName = sanitizeFileName(fileName)
    let finalName = safeName.hasSuffix(".wav") ? safeName : "\(safeName).wav"
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(finalName)
    try? FileManager.default.removeItem(at: url)
    return url
  }

  private func sanitizeFileName(_ value: String?) -> String {
    let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines)
    let fallback = "songseed-transform-\(UUID().uuidString)"
    guard let raw, !raw.isEmpty else {
      return fallback
    }

    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
    let scalars = raw.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" }
    let joined = String(scalars).trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return joined.isEmpty ? fallback : joined
  }
}
