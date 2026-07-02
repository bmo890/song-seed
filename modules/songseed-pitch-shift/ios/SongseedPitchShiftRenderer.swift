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
      if offsetFrames >= 0 {
        let scheduledTime = AVAudioTime(sampleTime: offsetFrames, atRate: renderFormat.sampleRate)
        playerNode.scheduleFile(audioFile, at: scheduledTime, completionHandler: nil)
        scheduledLengthFrames = max(scheduledLengthFrames, offsetFrames + audioFile.length)
      } else {
        // Negative offset pulls the input EARLIER: drop the first |offset| of the file and
        // play the remainder from t=0. This is what corrects a late-recorded overdub.
        let skipFrames = min(audioFile.length, -offsetFrames)
        let remainingFrames = audioFile.length - skipFrames
        if remainingFrames > 0 {
          playerNode.scheduleSegment(
            audioFile,
            startingFrame: skipFrames,
            frameCount: AVAudioFrameCount(remainingFrames),
            at: AVAudioTime(sampleTime: 0, atRate: renderFormat.sampleRate),
            completionHandler: nil
          )
          scheduledLengthFrames = max(scheduledLengthFrames, remainingFrames)
        }
      }
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
    // Negative offsets are legal: they pull the input earlier by trimming its head.
    let rawOffsetMs = (value["offsetMs"] as? Double) ?? Double((value["offsetMs"] as? Int) ?? 0)
    let offsetMs = max(-600_000.0, min(600_000.0, rawOffsetMs))
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

  // MARK: - Tier 2: trim/extract/cut via AVMutableComposition

  func renderTrim(_ request: [String: Any]) throws -> [String: Any] {
    guard let inputUri = request["inputUri"] as? String else {
      throw NSError(domain: "SongseedPitchShift", code: 20, userInfo: [NSLocalizedDescriptionKey: "Trim rendering requires inputUri."])
    }
    guard let rawRanges = request["ranges"] as? [Any] else {
      throw NSError(domain: "SongseedPitchShift", code: 21, userInfo: [NSLocalizedDescriptionKey: "Trim rendering requires ranges."])
    }
    let outputFileName = (request["outputFileName"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)
    let asset = AVURLAsset(url: inputURL)
    guard let sourceTrack = asset.tracks(withMediaType: .audio).first else {
      throw NSError(domain: "SongseedPitchShift", code: 22, userInfo: [NSLocalizedDescriptionKey: "No audio track found."])
    }

    let composition = AVMutableComposition()
    guard let compTrack = composition.addMutableTrack(
      withMediaType: .audio,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      throw NSError(domain: "SongseedPitchShift", code: 23, userInfo: [NSLocalizedDescriptionKey: "Could not create composition track."])
    }

    var cursor = CMTime.zero
    var inserted = false
    for raw in rawRanges {
      guard let map = raw as? [String: Any] else { continue }
      let startMs = (map["startTimeMs"] as? Double) ?? Double((map["startTimeMs"] as? Int) ?? -1)
      let endMs = (map["endTimeMs"] as? Double) ?? Double((map["endTimeMs"] as? Int) ?? -1)
      if startMs < 0 || endMs <= startMs { continue }
      let start = CMTime(seconds: startMs / 1000.0, preferredTimescale: 1000)
      let end = CMTime(seconds: endMs / 1000.0, preferredTimescale: 1000)
      let timeRange = CMTimeRange(start: start, end: end)
      try compTrack.insertTimeRange(timeRange, of: sourceTrack, at: cursor)
      cursor = CMTimeAdd(cursor, timeRange.duration)
      inserted = true
    }
    if !inserted {
      throw NSError(domain: "SongseedPitchShift", code: 24, userInfo: [NSLocalizedDescriptionKey: "Trim rendering requires at least one valid range."])
    }

    let outputURL = buildExportOutputURL(fileName: outputFileName)
    guard let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
      throw NSError(domain: "SongseedPitchShift", code: 25, userInfo: [NSLocalizedDescriptionKey: "Could not create export session."])
    }
    exportSession.outputURL = outputURL
    exportSession.outputFileType = .m4a

    let semaphore = DispatchSemaphore(value: 0)
    var exportError: Error?
    exportSession.exportAsynchronously {
      if exportSession.status == .failed {
        exportError = exportSession.error
          ?? NSError(domain: "SongseedPitchShift", code: 26, userInfo: [NSLocalizedDescriptionKey: "Trim export failed."])
      }
      semaphore.signal()
    }
    semaphore.wait()
    if let exportError {
      try? FileManager.default.removeItem(at: outputURL)
      throw exportError
    }

    return ["outputUri": outputURL.absoluteString]
  }

  private func buildExportOutputURL(fileName: String?) -> URL {
    let safeName = sanitizeFileName(fileName)
    let finalName = safeName.hasSuffix(".m4a") ? safeName : "\(safeName).m4a"
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(finalName)
    try? FileManager.default.removeItem(at: url)
    return url
  }

  // MARK: - Tier 3: waveform analysis via AVAssetReader

  func computeWaveform(_ request: [String: Any]) throws -> [String: Any] {
    guard let inputUri = request["inputUri"] as? String else {
      throw NSError(domain: "SongseedPitchShift", code: 27, userInfo: [NSLocalizedDescriptionKey: "Waveform analysis requires inputUri."])
    }
    let numberOfPoints = max(1, (request["numberOfPoints"] as? Int) ?? Int((request["numberOfPoints"] as? Double) ?? 256))
    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri)
    let asset = AVURLAsset(url: inputURL)
    guard let track = asset.tracks(withMediaType: .audio).first else {
      throw NSError(domain: "SongseedPitchShift", code: 28, userInfo: [NSLocalizedDescriptionKey: "No audio track found."])
    }

    let totalDurationSec = CMTimeGetSeconds(asset.duration)
    let durationMs = totalDurationSec.isFinite ? totalDurationSec * 1000.0 : 0

    let reader = try AVAssetReader(asset: asset)
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
    output.alwaysCopiesSampleData = false
    reader.add(output)
    reader.startReading()

    var sumSquares = [Double](repeating: 0, count: numberOfPoints)
    var sampleCounts = [Int](repeating: 0, count: numberOfPoints)

    while reader.status == .reading, let sampleBuffer = output.copyNextSampleBuffer() {
      let ptsSec = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
      guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else {
        CMSampleBufferInvalidate(sampleBuffer)
        continue
      }
      var length = 0
      var dataPointer: UnsafeMutablePointer<Int8>?
      CMBlockBufferGetDataPointer(
        blockBuffer,
        atOffset: 0,
        lengthAtOffsetOut: nil,
        totalLengthOut: &length,
        dataPointerOut: &dataPointer
      )
      if let dataPointer, length > 1 {
        let sampleCount = length / 2
        let frac = totalDurationSec > 0 ? min(0.999999, max(0, ptsSec / totalDurationSec)) : 0
        let bin = min(numberOfPoints - 1, Int(frac * Double(numberOfPoints)))
        dataPointer.withMemoryRebound(to: Int16.self, capacity: sampleCount) { ptr in
          var i = 0
          while i < sampleCount {
            let sample = Double(ptr[i]) / 32768.0
            sumSquares[bin] += sample * sample
            sampleCounts[bin] += 1
            i += 1
          }
        }
      }
      CMSampleBufferInvalidate(sampleBuffer)
    }

    if reader.status == .failed {
      throw reader.error
        ?? NSError(domain: "SongseedPitchShift", code: 29, userInfo: [NSLocalizedDescriptionKey: "Waveform analysis failed."])
    }

    // Per-bin RMS energy → the same dB-normalized 0..1 curve as the rest of the app
    // (metersToWaveformPeaks). RMS traces the loudness envelope (verse/chorus
    // dynamics); a peak waveform saturates to a solid block for loud/mastered mixes.
    let peaks: [Double] = (0..<numberOfPoints).map { b in
      let rms = sampleCounts[b] > 0 ? (sumSquares[b] / Double(sampleCounts[b])).squareRoot() : 0
      let db = rms > 1e-6 ? 20.0 * log10(rms) : -60.0
      let clamped = max(-60.0, min(0.0, db))
      let normalized = (clamped + 60.0) / 60.0
      return max(0.004, min(1.0, pow(normalized, 1.15)))
    }

    return ["peaks": peaks, "durationMs": durationMs]
  }
}
