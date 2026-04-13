import AVFoundation

final class SongseedPitchShiftRenderer {
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
